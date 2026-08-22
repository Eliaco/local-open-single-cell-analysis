<script setup lang="ts">
import { ref } from "vue";
import LoadDatasetWorker from "../../workers/scran.load.data.worker.ts?worker"; // Import the worker using Vite's worker syntax
import { clearLoadedDataset, loadedDataset } from "../../globalRefs";
const file = ref<File | null>(null);

const statusText = ref<string>("Waiting for file upload...");
const isProcessing = ref<boolean>(false);
const datasetLoaded = ref<boolean>(false);

const removeFile = () => {
  clearLoadedDataset();
  file.value = null;
  datasetLoaded.value = false;
  statusText.value = "Waiting for file upload...";
};

const processFile = async () => {
  if (!file.value) return;

  isProcessing.value = true;
  statusText.value = "Reading file into memory...";

  try {
    console.log("aaaa", file.value);
    console.log("file", file.value.name, file.value.size, file.value);
    const buffer: ArrayBuffer = await file.value.arrayBuffer();
    console.log("buffer", file.value.name, buffer.byteLength);

    // Instantiate the worker using the Vite import
    const worker = new LoadDatasetWorker();

    // Listen for messages coming back from pipeline.worker.ts
    worker.onmessage = (e: MessageEvent) => {
      const data = e.data;

      if (data.type === "status") {
        statusText.value = data.text;
      } else if (data.type === "error") {
        statusText.value = `Error: ${data.text}`;
        isProcessing.value = false;
        worker.terminate();
      } else if (data.type === "complete") {
        clearLoadedDataset();
        loadedDataset.worker.value = worker;
        loadedDataset.fileName.value = file.value?.name || "undefined.h5ad";
        loadedDataset.rows.value = data.rows;
        loadedDataset.columns.value = data.cols;
        statusText.value = "Finished!";
        isProcessing.value = false;
        datasetLoaded.value = true;
      }
    };

    // The "name" property is required for the worker to know it is an H5AD file
    worker.postMessage(
      { buffer: buffer, name: file.value.name, file: file.value },
      [buffer],
    );
  } catch (error) {
    console.error("File reading failed:", error);
    statusText.value = "Failed to read the file.";
    isProcessing.value = false;
  }
};
</script>

<template>
  <div class="w-full h-full flex flex-col items-center justify-center gap-4">
    <h2 class="text-3xl">local open single cell analysis</h2>
    <UFileUpload
      v-if="!file"
      v-model="file"
      @change="processFile"
      accept=".h5ad"
      color="neutral"
      highlight
      :icon="false"
      label="drop your dataset here"
      description="only .h5ad"
      class="w-1/2 h-16"
      :ui="{
        root: '!p-0',
        base: '!p-0 rounded-full',
      }"
    />
    <UCard
      v-else
      class="w-1/2 h-16 rounded-full"
      :ui="{
        body: 'h-full !p-3 flex items-center',
      }"
    >
      <div class="w-full flex items-center justify-between">
        <div class="ml-3 flex items-center gap-2">
          <div class="">{{ file?.name }}</div>
          <UButton
            color="error"
            size="md"
            variant="ghost"
            class="rounded-full"
            @click="removeFile"
            >remove</UButton
          >
        </div>
        <div class="flex items-center gap-2">
          <UButton
            v-if="!datasetLoaded"
            icon="i-lucide-menu"
            variant="soft"
            size="lg"
            class="pl-2 pt-1 pr-2 pb-1 rounded-full"
            disabled
          ></UButton>
          <UButton
            v-if="!datasetLoaded"
            @click="processFile"
            :loading="isProcessing"
            :preview="false"
            color="primary"
            size="2xl"
            class="pl-8 pt-2 pr-8 pb-2 rounded-full"
            >load</UButton
          ><UButton
            v-else
            @click="$router.push('/run')"
            color="primary"
            size="2xl"
            class="pl-8 pt-2 pr-8 pb-2 rounded-full"
            >continue</UButton
          >
        </div>
      </div>
    </UCard>
  </div>
</template>
