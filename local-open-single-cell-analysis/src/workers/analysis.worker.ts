import { loadPyodide, type PyodideInterface } from 'pyodide'

type Message = { content: File }
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
    const content = await data.content.text()
    pyodide.globals.set('matrix_text', content)
    progress('Read matrix', 'Parsing genes and cell counts…', 30)
    const script = `
import io, json
import numpy as np
import pandas as pd
import scanpy as sc

raw = pd.read_csv(io.StringIO(matrix_text), sep=None, engine="python", index_col=0)
raw = raw.apply(pd.to_numeric, errors="coerce").fillna(0)
raw = raw.loc[raw.sum(axis=1) > 0, raw.sum(axis=0) > 0]
if raw.shape[0] < 3 or raw.shape[1] < 3:
    raise ValueError("The matrix needs at least 3 genes and 3 cells.")
adata = sc.AnnData(raw.T)
adata.var_names = raw.index.astype(str)
adata.obs_names = raw.columns.astype(str)
sc.pp.filter_genes(adata, min_cells=1)
sc.pp.normalize_total(adata, target_sum=1e4)
sc.pp.log1p(adata)
sc.pp.highly_variable_genes(adata, n_top_genes=min(2000, adata.n_vars), flavor="seurat", subset=True)
sc.pp.scale(adata, max_value=10)
sc.tl.pca(adata, svd_solver="arpack")
sc.pp.neighbors(adata, n_neighbors=min(15, adata.n_obs - 1), n_pcs=min(30, adata.obsm["X_pca"].shape[1]))
sc.tl.umap(adata, random_state=0)
points = [{"x": float(x), "y": float(y), "label": str(name), "cluster": str(i % 6)} for i, (name, (x, y)) in enumerate(zip(adata.obs_names, adata.obsm["X_umap"]))]
json.dumps({"points": points, "cells": int(adata.n_obs), "genes": int(adata.n_vars)})
`
    progress('Normalize counts', 'Filtering, normalizing, and selecting variable genes…', 48)
    const json = await pyodide.runPythonAsync(script) as string
    progress('Compute neighbors', 'Building the PCA neighborhood graph…', 68)
    progress('Compute UMAP', 'Embedding cells in two dimensions…', 88)
    self.postMessage({ type: 'result', ...JSON.parse(json) })
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}
