import { ref, shallowRef } from "vue";
import type { Router } from "vue-router";

export const loadedDataset = {
  worker: shallowRef<Worker | null>(null),
  fileName: ref<string | null>(null),
  rows: ref<number | null>(null),
  columns: ref<number | null>(null),
  umap_x: ref<number[] | null>(null),
  umap_y: ref<number[] | null>(null),
};

export function clearLoadedDataset(router: Router) {
  loadedDataset.worker.value?.terminate();
  loadedDataset.worker.value = null;
  loadedDataset.fileName.value = null;
  loadedDataset.rows.value = null;
  loadedDataset.columns.value = null;
  loadedDataset.umap_x.value = null;
  loadedDataset.umap_y.value = null;
  router.push("/");
  globalState.value = ["home"];
}

// To show sidebar if at least 2 node states are present, and to show only used node states in the sidebar
export type GlobalNodeStates = "home" | "run" | "view";
export const globalState = ref<GlobalNodeStates[]>(["home"]);
