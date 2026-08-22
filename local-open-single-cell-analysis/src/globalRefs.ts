import { ref, shallowRef } from "vue";

export const loadedDataset = {
  worker: shallowRef<Worker | null>(null),
  fileName: ref<string | null>(null),
  rows: ref<number | null>(null),
  columns: ref<number | null>(null),
};

export function clearLoadedDataset() {
  loadedDataset.worker.value?.terminate();
  loadedDataset.worker.value = null;
  loadedDataset.fileName.value = null;
  loadedDataset.rows.value = null;
  loadedDataset.columns.value = null;
}
