<script setup lang="ts">
import { ref, onMounted } from "vue";
import Plotly from "plotly.js-dist-min";
import { loadedDataset, clearLoadedDataset } from "../../globalRefs";

const plotDiv = ref<HTMLDivElement | null>(null);

onMounted(() => {
  if (!loadedDataset.umap_x.value) {
    throw new Error("No UMAP coordinates found.");
  }

  const x = loadedDataset.umap_x.value;
  const y = loadedDataset.umap_y.value;

  if (!x || !y) {
    throw new Error("No UMAP coordinates found.");
  }

  const trace = {
    x,
    y,
    mode: "markers",
    type: "scatter",
    marker: {
      size: 3,
      color: "#1f77b4",
      opacity: 0.7,
    },
  };

  const layout = {
    title: `Real Data UMAP (${x.length} Cells)`,
    xaxis: { title: "UMAP 1", scaleanchor: "y", scaleratio: 1 },
    yaxis: { title: "UMAP 2" },
    hovermode: "closest",

    autosize: true,

    margin: {
      l: 60,
      r: 20,
      t: 60,
      b: 60,
    },
  };

  if (plotDiv.value) {
    Plotly.newPlot(plotDiv.value, [trace], layout as any, {
      responsive: true,
      displaylogo: false,
    });
  }
});
</script>

<template>
  <div class="w-full h-full flex flex-col items-center gap-4">
    <div class="mt-8 text-xl font-semibold">results view</div>
    <div class="w-full h-full mb-8 flex justify-center">
      <div class="w-2/3 flex flex-col justify-between glass rounded-4xl">
        <div class="p-8">
          <div ref="plotDiv" class="plot-container"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.plot-container {
  width: 600px;
  height: 600px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: #f9f9f9;
}
</style>
