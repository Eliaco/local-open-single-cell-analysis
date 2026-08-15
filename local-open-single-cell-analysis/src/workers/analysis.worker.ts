import { loadPyodide, type PyodideInterface } from 'pyodide'

type Message = { name: string; bytes: ArrayBuffer }
let pyodidePromise: Promise<PyodideInterface> | undefined

function progress(step: string, detail: string, value: number) {
  self.postMessage({ type: 'progress', step, detail, progress: value })
}

async function getPyodide() {
  pyodidePromise ??= loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/' })
  return pyodidePromise
}

self.onmessage = async ({ data }: MessageEvent<Message>) => {
  try {
    progress('Python runtime', 'Loading Pyodide and scientific packages…', 8)
    const pyodide = await getPyodide()
    await pyodide.loadPackage(['numpy', 'scipy', 'pandas', 'scikit-learn'])
    progress('Python runtime', 'Python is ready in a dedicated worker.', 20)
    const isH5ad = data.name.toLowerCase().endsWith('.h5ad')
    if (isH5ad) {
      progress('Install H5AD reader', 'Preparing the compatible AnnData reader…', 24)
      await pyodide.loadPackage('h5py')
      await pyodide.loadPackage('micropip')
      await pyodide.runPythonAsync('import micropip')
      const micropip = pyodide.pyimport('micropip')
      await micropip.install('anndata==0.11.4')
      micropip.destroy()
    }
    pyodide.globals.set('file_bytes', new Uint8Array(data.bytes))
    pyodide.globals.set('is_h5ad', isH5ad)
    progress('Read matrix', 'Parsing genes and cell counts…', 30)
    const script = `
import base64, io, json
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA

if is_h5ad:
    import anndata as ad
    with open("/tmp/input.h5ad", "wb") as handle:
        handle.write(file_bytes.tobytes())
    adata = ad.read_h5ad("/tmp/input.h5ad")
    matrix = adata.X.toarray() if hasattr(adata.X, "toarray") else np.asarray(adata.X)
    labels = adata.obs_names.astype(str)
    stored_coordinates = adata.obsm.get("X_umap")
    if stored_coordinates is not None:
        coordinates = stored_coordinates.toarray() if hasattr(stored_coordinates, "toarray") else np.asarray(stored_coordinates)
        used_umap = coordinates.ndim == 2 and coordinates.shape[0] == matrix.shape[0] and coordinates.shape[1] >= 2
        coordinates = coordinates[:, :2] if used_umap else None
    else:
        used_umap = False
        coordinates = None
else:
    raw = pd.read_csv(io.StringIO(bytes(file_bytes).decode("utf-8")), sep=None, engine="python", index_col=0)
    raw = raw.apply(pd.to_numeric, errors="coerce").fillna(0)
    raw = raw.loc[raw.sum(axis=1) > 0, raw.sum(axis=0) > 0]
    matrix, labels = raw.T.to_numpy(), raw.columns.astype(str)
    used_umap = False
    coordinates = None

if matrix.ndim != 2 or matrix.shape[0] < 3 or matrix.shape[1] < 3:
    raise ValueError("The file needs at least 3 cells and 3 genes.")
matrix = np.nan_to_num(matrix, nan=0.0, posinf=0.0, neginf=0.0)
matrix = np.log1p(matrix / np.maximum(matrix.sum(axis=1, keepdims=True), 1) * 1e4)
if coordinates is None:
    coordinates = PCA(n_components=2, random_state=0).fit_transform(matrix)
coordinates = np.nan_to_num(coordinates, nan=0.0, posinf=0.0, neginf=0.0)
projection = "UMAP" if used_umap else "PCA"
clusters = KMeans(n_clusters=min(5, matrix.shape[0]), random_state=0, n_init=10).fit_predict(matrix) + 1
points = [{"x": float(coordinate[0]), "y": float(coordinate[1]), "label": str(name), "cluster": str(cluster)} for name, coordinate, cluster in zip(labels, coordinates, clusters)]
json.dumps({"points": points, "cells": int(matrix.shape[0]), "genes": int(matrix.shape[1]), "projection": projection})
`
    progress('Normalize counts', isH5ad ? 'Reading AnnData and preparing expression values…' : 'Filtering and normalizing count values…', 48)
    progress('Compute projection', isH5ad ? 'Using stored UMAP coordinates when available; otherwise computing PCA…' : 'Computing a local PCA projection and cell clusters…', 68)
    const json = await pyodide.runPythonAsync(script) as string
    progress('Render results', 'Preparing the local projection for display…', 88)
    self.postMessage({ type: 'result', ...JSON.parse(json) })
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}
