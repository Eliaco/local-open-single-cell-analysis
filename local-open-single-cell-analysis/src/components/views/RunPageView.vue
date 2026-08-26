<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { StepperItem } from "@nuxt/ui";
import type { AccordionItem } from "@nuxt/ui";
import { loadedDataset, clearLoadedDataset } from "../../globalRefs";

const items = ref<StepperItem[]>([
  {
    value: "qc",
    title: "Quality Control",
    icon: "i-lucide-broom-sparkles",
    description: "filters out dying cells/empty droplets",
  },
  {
    value: "nm",
    title: "Normalization",
    icon: "i-lucide-chart-column",
    description: "removes technical bias",
  },
  {
    value: "fs",
    title: "Feature Selection",
    icon: "i-lucide-list-checks",
    description: "exclude uninformative genes",
  },
  {
    value: "dr",
    title: "Dim. Reduction",
    icon: "i-lucide-move-3d",
    description: "from a high- to low-dimensional space",
  },
]);
// extent type with value
const accordionItems = ref<(AccordionItem & { value?: string })[]>([]);

onMounted(() => {
  accordionItems.value = items.value.map((item) => ({
    label: item.title,
    icon: item.icon,
    value: String(item.value),
    content: item.description,
  }));
});

// Initialize with -1 so no step index is matched
const active = ref(-1);

const QCfilters = {
  nMADs: {
    title: "Number of MADs",
    description: "removes cells with too few or too many genes",
    options: [
      { label: "2", value: 2 },
      { label: "3", value: 3 },
      { label: "5", value: 5 },
    ],
    selectedOption: ref({ label: "3", value: 3 }), // Default to 3 MADs
  },
};

const loading = ref(false);
const statusText = ref("");
const pipelineFinished = ref(false);

const runPipeline = async () => {
  loading.value = true;
  statusText.value = "Running pipeline...";
  if (!loadedDataset.worker.value) {
    statusText.value = "Please load a dataset first.";
    loading.value = false;
    return;
  }
  try {
    // Instantiate the worker using the Vite import
    const worker = loadedDataset.worker.value;

    // Listen for messages coming back from pipeline.worker.ts
    worker.onmessage = (e: MessageEvent) => {
      const data = e.data;

      if (data.type === "status") {
        statusText.value = data.text;
        if (data.step !== undefined) {
          active.value = data.step - 1; // Update the stepper index
        }
      } else if (data.type === "error") {
        statusText.value = `Error: ${data.text}`;
        loading.value = false;
        worker.terminate();
      } else if (data.type === "complete") {
        statusText.value = "Finished!";
        console.log(
          "Pipeline finished, UMAP coordinates:",
          data.umap_x,
          data.umap_y,
        );
        loadedDataset.umap_x.value = data.umap_x;
        loadedDataset.umap_y.value = data.umap_y;
        loading.value = false;
        pipelineFinished.value = true;
      }
    };

    // The "name" property is required for the worker to know it is an H5AD file
    worker.postMessage({
      msgType: "run",
      nMADs: QCfilters.nMADs.selectedOption.value.value,
    });
  } catch (error) {
    console.error("File reading failed:", error);
    statusText.value = "Failed to read the file.";
    loading.value = false;
  }
};

const activeAccordion = ref(["qc"]);
</script>

<template>
  <div class="w-full h-full flex flex-col items-center gap-4">
    <div class="mt-8 text-xl font-semibold">run pipeline</div>
    <div class="w-full h-full mb-8 flex justify-center">
      <div class="w-2/3 flex flex-col justify-between glass !rounded-4xl">
        <div class="p-8">
          <div
            v-if="!loading && !pipelineFinished"
            class="text-xl mb-2 text-secondary"
          >
            settings
          </div>
          <UAccordion
            v-if="!loading && !pipelineFinished"
            v-model="activeAccordion"
            type="multiple"
            :items="accordionItems"
          >
            <template #content="{ item }">
              <p class="text-xs pb-2 text-secondary">
                {{ item.content }}
              </p>
              <div v-if="item.value === 'qc'" class="p-4">
                <span class="text-sm">nMADs: </span>
                <USelect
                  v-model="QCfilters.nMADs.selectedOption.value"
                  :items="QCfilters.nMADs.options"
                  size="sm"
                />
              </div>
            </template>
          </UAccordion>
          <UStepper v-else v-model="active" :items="items" class="p-8" />
          {{ statusText }}
        </div>
        <div class="text-right p-4">
          <UButton
            v-if="!pipelineFinished"
            :label="loading ? 'running...' : 'run'"
            :disabled="loading"
            :color="loading ? 'secondary' : 'primary'"
            size="2xl"
            class="pl-8 pt-2 pr-8 pb-2 rounded-full"
            @click="runPipeline"
          ></UButton>
          <UButton
            v-else
            @click="$router.push('/view')"
            color="primary"
            size="2xl"
            class="px-8 py-2 rounded-full"
          >
            continue
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
