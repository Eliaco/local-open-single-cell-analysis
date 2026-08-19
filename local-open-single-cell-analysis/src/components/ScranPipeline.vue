<template>
  <div class="scran-container">
    <h2>Upload Real Single-Cell Data</h2>

    <input
      type="file"
      accept=".mtx"
      @change="processFile"
      :disabled="isProcessing"
    />
    <p class="status-text">{{ statusText }}</p>

    <div ref="plotDiv" class="plot-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Plotly from "plotly.js-dist-min";
import PipelineWorker from "../scran.pipeline.worker.ts?worker"; // Import the worker using Vite's worker syntax

const statusText = ref<string>("Waiting for file upload...");
const isProcessing = ref<boolean>(false);
const plotDiv = ref<HTMLElement | null>(null);

const processFile = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  isProcessing.value = true;
  statusText.value = "Reading file into memory...";

  try {
    const buffer = await file.arrayBuffer();

    // Instantiate the worker using the Vite import
    const worker = new PipelineWorker();

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
        statusText.value = "Processing complete! Rendering plot...";

        const trace = {
          x: data.x,
          y: data.y,
          mode: "markers",
          type: "scatter",
          marker: { size: 3, color: "#1f77b4", opacity: 0.7 },
        };

        const layout = {
          title: `Real Data UMAP (${data.x.length} Cells)`,
          xaxis: { title: "UMAP 1" },
          yaxis: { title: "UMAP 2" },
          hovermode: "closest",
        };

        if (plotDiv.value) {
          Plotly.newPlot(plotDiv.value, [trace], layout as any);
        }

        statusText.value = "Finished!";
        isProcessing.value = false;

        worker.terminate();
      }
    };

    // The "name" property is required for the worker to know it is an H5AD file
    worker.postMessage({ buffer: buffer, name: file.name }, [buffer]);
  } catch (error) {
    console.error("File reading failed:", error);
    statusText.value = "Failed to read the file.";
    isProcessing.value = false;
  }
};
</script>

<style scoped>
.scran-container {
  font-family: Arial, sans-serif;
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}
.status-text {
  color: #0056b3;
  font-weight: bold;
  margin: 15px 0;
}
.plot-container {
  width: 100%;
  height: 600px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: #f9f9f9;
}
</style>
