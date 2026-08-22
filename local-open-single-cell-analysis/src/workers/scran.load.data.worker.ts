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
  // Extract 'name' along with 'buffer' so we know the file extension
  const { buffer, name } = event.data;

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
};
