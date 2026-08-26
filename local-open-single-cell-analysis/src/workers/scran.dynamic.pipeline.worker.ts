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

// This remains in the worker's WASM instance until the worker is terminated.
let mat: any = null;

self.onmessage = async (event: MessageEvent) => {
  if (!event.data.msgType) {
    self.postMessage({ type: "error", text: "Invalid message format" });
    return;
  }

  if (event.data.msgType === "load") {
    // Extract 'name' along with 'buffer' so we know the file extension
    const { msgType, buffer, name } = event.data;

    try {
      self.postMessage({ type: "status", text: "Initializing WebAssembly..." });

      // Initialize with localFile: false to use the CDN binaries
      await scran.initialize({ numberOfThreads: 4, localFile: false });

      mat?.free();
      mat = null;
      const uint8_buffer = new Uint8Array(buffer);

      // Route the parser based on the file extension
      if (name && name.endsWith(".h5ad")) {
        self.postMessage({ type: "status", text: "Parsing H5AD file..." });

        // Write to the virtual file system
        scran.writeFile(name, uint8_buffer);

        const handle = new scran.H5File(name);
        const x = handle.open("X");

        try {
          if (x instanceof scran.H5Group) {
            // Load in AnnData's native cells x genes layout so indptr matches.
            const shape = x.readAttribute("shape").values;
            const encoding = x.readAttribute("encoding-type").values[0];
            mat = scran.initializeSparseMatrixFromHdf5Group(
              name,
              "X",
              shape[0],
              shape[1],
              encoding === "csr_matrix",
            );
            mat = scran.transpose(mat, { inPlace: true });
          } else {
            mat = scran.initializeSparseMatrixFromHdf5Dataset(name, "X");
          }
        } finally {
          // The matrix has already been materialized in WASM memory.
          scran.removeFile(name);
        }
      } else {
        self.postMessage({ type: "error", text: `not a h5ad file: ${name}` });
        return;
      }

      self.postMessage({
        type: "complete",
        rows: mat.numberOfRows(),
        cols: mat.numberOfColumns(),
      });
    } catch (error: any) {
      self.postMessage({ type: "error", text: error.message || String(error) });
    }
  } else if (event.data.msgType === "run") {
    if (!mat) {
      self.postMessage({ type: "error", text: "Matrix not loaded" });
      return;
    }

    const { msgType, nMADS } = event.data;

    //
    // Quality control
    //
    self.postMessage({
      type: "status",
      text: `Quality controll: nMADS = ${nMADS}`,
      step: 1,
    });
    console.log("Running Quality Control with nMADS:", nMADS);
    let qc_metrics = scran.perCellRnaQcMetrics(mat);
    let qc_filters = scran.suggestRnaQcFilters(qc_metrics, {
      numberOfMADs: nMADS,
    });
    let filtered_mat = scran.filterCells(mat, qc_filters.filter(qc_metrics));
    self.postMessage({
      type: "status",
      text: "Quality Control done. Running Log Normalization...",
      step: 2,
    });
    // Clean up memory
    qc_metrics.free();
    qc_filters.free();

    //
    // Normalization
    //
    let log_mat = scran.normalizeCounts(filtered_mat);
    self.postMessage({
      type: "status",
      text: "Normalization done. Selecting features...",
      step: 3,
    });

    //
    // Feature Selection
    //
    let variances = scran.modelGeneVariances(log_mat);
    let hvg_indices = scran.chooseHvgs(variances, { number: 4000 });
    self.postMessage({
      type: "status",
      text: "Feature Selection done. Computing PCA...",
      step: 4,
    });

    //
    // PCA
    //
    let pca = scran.runPca(log_mat, { features: hvg_indices, numberOfPCs: 20 });

    self.postMessage({
      type: "status",
      text: "PCA done. Optimizing UMAP (this may take a few seconds)...",
    });
    console.log("PCA computed:", pca);
    let index = scran.buildNeighborSearchIndex(pca);
    let neighbors = scran.findNearestNeighbors(index, 15);
    let umap = scran.initializeUmap(neighbors);
    umap.run(umap.totalEpochs());

    self.postMessage({ type: "status", text: "Extracting coordinates..." });
    let coords = umap.extractCoordinates(0);

    self.postMessage({
      type: "complete",
      umap_x: Array.from(coords.x),
      umap_y: Array.from(coords.y),
    });

    // Clean up memory
    filtered_mat.free();
    log_mat.free();
    variances.free();
    pca.free();
    index.free();
    neighbors.free();
    umap.free();
  } else {
    self.postMessage({ type: "error", text: "Matrix not loaded" });
    return;
  }
};
