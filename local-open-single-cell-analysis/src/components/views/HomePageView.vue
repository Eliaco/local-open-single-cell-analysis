<script setup lang="ts">
import { ref } from "vue";
const file = ref<File | null>(null);
</script>

<template>
  <div class="w-full h-full flex flex-col items-center justify-center gap-4">
    <h2 class="text-3xl">local open single cell analysis</h2>
    <UFileUpload
      v-if="!file"
      v-model="file"
      color="neutral"
      highlight
      :icon="false"
      label="drop your dataset here"
      description="only .h5ad"
      class="w-1/2 h-24"
      :ui="{
        base: 'rounded-full',
      }"
    />
    <UCard
      v-else
      class="w-1/2 h-24 rounded-full"
      :ui="{
        body: 'h-full !p-3 flex items-center',
      }"
    >
      <div class="w-full flex items-center justify-between">
        <div class="ml-3 flex items-center gap-2">
          <div class="">{{ file.name }}</div>
          <UButton
            color="error"
            size="md"
            variant="ghost"
            class="rounded-full"
            @click="file = null"
            >remove</UButton
          >
        </div>
        <div class="flex items-center gap-2">
          <UButton
            icon="i-lucide-menu"
            variant="soft"
            size="xl"
            class="pl-6 pt-4 pr-6 pb-4 rounded-full"
            disabled
          ></UButton>
          <UButton
            color="primary"
            size="xl"
            class="pl-8 pt-6 pr-8 pb-6 rounded-full"
            >load</UButton
          >
        </div>
      </div>
    </UCard>
  </div>
</template>
