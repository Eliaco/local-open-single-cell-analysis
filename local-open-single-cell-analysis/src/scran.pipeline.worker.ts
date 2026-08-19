// 1. The Blob Proxy: Intercept Cross-Origin Web Workers inside the worker
const OriginalWorker = self.Worker;
if (OriginalWorker) {
  self.Worker = function (scriptURL: string | URL, options?: WorkerOptions) {
    const urlStr = scriptURL instanceof URL ? scriptURL.href : scriptURL;

    if (urlStr.startsWith("http")) {
      const isModule = options && options.type === "module";
      const script = isModule
        ? `import "${urlStr}";`
        : `importScripts("${urlStr}");`;
      const blob = new Blob([script], { type: "application/javascript" });
      return new OriginalWorker(URL.createObjectURL(blob), options);
    }
    return new OriginalWorker(scriptURL, options);
  } as any;
}

// 2. Import the library from the CDN
import * as scran from "https://cdn.jsdelivr.net/npm/scran.js/+esm";

self.onmessage = async (event: MessageEvent) => {
  // Extract 'name' along with 'buffer' so we know the file extension
  const { buffer, name } = event.data;

  console.log("Worker received file name:", name);

  try {
    self.postMessage({ type: "status", text: "Initializing WebAssembly..." });

    // Initialize with localFile: false to use the CDN binaries
    await scran.initialize({ numberOfThreads: 4, localFile: false });

    let mat;
    const uint8_buffer = new Uint8Array(buffer);

    // Route the parser based on the file extension
    if (name && name.endsWith(".h5ad")) {
      self.postMessage({ type: "status", text: "Parsing H5AD file..." });

      // Write to the virtual file system
      scran.writeFile(name, uint8_buffer);

      try {
        // AnnData typically stores sparse matrices as an HDF5 group named "X"
        mat = scran.initializeSparseMatrixFromHdf5Group(name, "X");
      } catch (e) {
        // Fallback: If it fails, the matrix might be saved as a dense dataset
        mat = scran.initializeMatrixFromHdf5Dataset(name, "X");
      }

      // Clean up the virtual file system
      scran.removeFile(name);
    } else {
      self.postMessage({
        type: "status",
        text: "Parsing Matrix Market file...",
      });
      mat = scran.initializeSparseMatrixFromMatrixMarket(uint8_buffer);
    }

    self.postMessage({
      type: "status",
      text: `Matrix loaded: ${mat.numberOfRows()} genes, ${mat.numberOfColumns()} cells. Running Quality Control...`,
    });
    let qc_metrics = scran.perCellRnaQcMetrics(mat);
    let qc_filters = scran.suggestRnaQcFilters(qc_metrics);
    let filtered_mat = scran.filterCells(mat, qc_filters.filter(qc_metrics));

    self.postMessage({ type: "status", text: "Running Log Normalization..." });
    let log_mat = scran.normalizeCounts(filtered_mat);

    self.postMessage({
      type: "status",
      text: "Selecting Highly Variable Genes...",
    });
    let variances = scran.modelGeneVariances(log_mat);
    let hvg_indices = scran.chooseHvgs(variances, { number: 4000 });

    self.postMessage({ type: "status", text: "Computing PCA..." });
    let pca = scran.runPca(log_mat, { features: hvg_indices, numberOfPCs: 20 });

    self.postMessage({
      type: "status",
      text: "Optimizing UMAP (this may take a few seconds)...",
    });
    let index = scran.buildNeighborSearchIndex(pca);
    let neighbors = scran.findNearestNeighbors(index, 15);
    let umap = scran.initializeUmap(neighbors);
    umap.run(umap.totalEpochs());

    self.postMessage({ type: "status", text: "Extracting coordinates..." });
    let coords = umap.extractCoordinates(0);

    self.postMessage({
      type: "complete",
      x: Array.from(coords.x),
      y: Array.from(coords.y),
    });

    // Clean up memory
    mat.free();
    qc_metrics.free();
    qc_filters.free();
    filtered_mat.free();
    log_mat.free();
    variances.free();
    pca.free();
    index.free();
    neighbors.free();
    umap.free();
  } catch (error: any) {
    self.postMessage({ type: "error", text: error.message || String(error) });
  }
};
