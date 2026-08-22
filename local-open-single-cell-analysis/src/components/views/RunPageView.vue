<script setup lang="ts">
import { ref } from "vue";
import type { StepperItem } from "@nuxt/ui";

const items = ref<StepperItem[]>([
  {
    title: "Quality Control",
    description: "Perform quality control on your dataset",
    icon: "i-lucide-house",
  },
  {
    title: "Normalization",
    description: "Normalize your dataset",
    icon: "i-lucide-truck",
  },
  {
    title: "Feature Selection",
    description: "Select features for downstream analysis",
  },
  {
    title: "Dim. Reduction",
    description: "Perform dimensionality reduction on your dataset",
  },
]);
</script>

<template>
  <div class="w-full h-full flex flex-col items-center gap-4">
    <div class="mt-8 text-xl font-semibold">run pipeline</div>
    <div class="w-full h-full mb-8 flex justify-center">
      <div class="w-2/3 flex flex-col justify-between glass !rounded-4xl">
        <UStepper disabled :items="items" class="p-8" />
        <div class="text-right p-4">
          <UButton
            color="primary"
            size="2xl"
            class="pl-8 pt-2 pr-8 pb-2 rounded-full"
            >run</UButton
          >
        </div>
      </div>
    </div>
  </div>
</template>
