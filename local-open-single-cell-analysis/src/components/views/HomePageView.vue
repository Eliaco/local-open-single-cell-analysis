<script setup lang="ts">
import { ref, watch } from "vue";
import DynamicPipelineWorker from "../../workers/scran.dynamic.pipeline.worker.ts?worker"; // Import the worker using Vite's worker syntax
import { clearLoadedDataset, loadedDataset } from "../../globalRefs";
import exampleDatasetUrl from "../../../example_data/SRA779509_SRS3805247.h5ad?url";
const file = ref<File | null>(null);

const statusText = ref<string>("Waiting for file upload...");
const loading = ref<boolean>(false);
const datasetLoaded = ref<boolean>(false);

const removeFile = () => {
  clearLoadedDataset();
  file.value = null;
  datasetLoaded.value = false;
  statusText.value = "Waiting for file upload...";
};

const loadExample = async () => {
  try {
    const response = await fetch(exampleDatasetUrl);
    if (!response.ok) throw new Error(`Request failed with ${response.status}`);

    file.value = new File(
      [await response.blob()],
      "SRA779509_SRS3805247_initial.h5ad",
      { type: "application/octet-stream" },
    );
    await processFile();
  } catch (error) {
    console.error("Example dataset loading failed:", error);
    statusText.value = "Failed to load the example dataset.";
    loading.value = false;
  }
};

const processFile = async () => {
  if (!file.value) return;

  loading.value = true;
  statusText.value = "Reading file into memory...";

  try {
    console.log("file", file.value.name, file.value.size, file.value);
    const buffer: ArrayBuffer = await file.value.arrayBuffer();

    // Instantiate the worker using the Vite import
    const worker = new DynamicPipelineWorker();

    // Listen for messages coming back from pipeline.worker.ts
    worker.onmessage = (e: MessageEvent) => {
      const data = e.data;

      if (data.type === "status") {
        statusText.value = data.text;
      } else if (data.type === "error") {
        statusText.value = `Error: ${data.text}`;
        loading.value = false;
        worker.terminate();
      } else if (data.type === "complete") {
        clearLoadedDataset();
        loadedDataset.worker.value = worker;
        loadedDataset.fileName.value = file.value?.name || "undefined.h5ad";
        loadedDataset.rows.value = data.rows;
        loadedDataset.columns.value = data.cols;
        statusText.value = "Finished!";
        loading.value = false;
        datasetLoaded.value = true;
      }
    };

    // The "name" property is required for the worker to know it is an H5AD file
    worker.postMessage(
      {
        msgType: "load",
        buffer: buffer,
        name: file.value.name,
        file: file.value,
      },
      [buffer],
    );
  } catch (error) {
    console.error("File reading failed:", error);
    statusText.value = "Failed to read the file.";
    loading.value = false;
  }
};

watch(loadedDataset.worker, (newVal) => {
  console.log("loadedDataset changed:", newVal);
  if (newVal === null) {
    file.value = null;
    datasetLoaded.value = false;
    statusText.value = "Waiting for file upload...";
  }
});
</script>

<template>
  <div class="w-full h-full flex flex-col items-center justify-center gap-4">
    <h2 class="text-3xl">local open single cell analysis</h2>
    <div v-if="!file" class="w-1/2 h-16">
      <UFileUpload
        v-model="file"
        @change="processFile"
        accept=".h5ad"
        color="neutral"
        highlight
        :icon="false"
        label="drop your dataset here"
        description="only .h5ad"
        :ui="{
          root: '!p-0',
          base: '!p-0 rounded-full',
        }"
      />
      <ULink
        class="w-full mt-2 flex justify-center text-[0.65em] text-secondary underline"
        @click="loadExample"
      >
        ...or use an example
      </ULink>
    </div>
    <UCard
      v-else
      class="w-1/2 transition-[height,border-radius] duration-500 ease-in-out overflow-hidden"
      :class="{
        'h-16 rounded-full': !datasetLoaded,
        'h-24 rounded-4xl': datasetLoaded,
      }"
      :ui="{
        /* items-start anchors the inner content to the top boundary */
        body: 'h-full !p-3 flex items-start',
      }"
    >
      <!-- h-10 fits inside the h-16 parent padding; items-center keeps text centered within this top row -->
      <div class="w-full h-10 grid grid-cols-3 gap-2 items-center">
        <!--File name and action-->
        <div class="ml-3 col-span-2 flex items-center gap-2">
          <div>{{ file?.name }}</div>
          <UButton
            color="error"
            size="md"
            variant="ghost"
            class="rounded-full"
            @click="removeFile"
          >
            remove
          </UButton>
        </div>
        <!--General actions-->
        <div class="flex items-center justify-end gap-2">
          <UButton
            v-if="!datasetLoaded && !loading"
            icon="i-lucide-menu"
            variant="soft"
            size="lg"
            class="px-2 py-1 rounded-full"
            disabled
          ></UButton>
          <UButton
            v-if="!datasetLoaded"
            @click="processFile"
            :label="loading ? 'loading...' : 'load'"
            :preview="false"
            :color="loading ? 'secondary' : 'primary'"
            :disabled="loading"
            size="2xl"
            class="px-8 py-2 rounded-full"
          >
          </UButton>
          <UButton
            v-else
            @click="$router.push('/run')"
            color="primary"
            size="2xl"
            class="px-8 py-2 rounded-full"
          >
            continue
          </UButton>
        </div>
        <!--Dataset info-->
        <div
          v-if="datasetLoaded"
          class="ml-3 col-span-2 text-sm text-neutral-500"
        >
          <span class="font-semibold">{{ loadedDataset.columns.value }}</span>
          barcodes x
          <span class="font-semibold">{{ loadedDataset.rows.value }}</span>
          number of transcripts
        </div>
      </div>
    </UCard>
  </div>
</template>
