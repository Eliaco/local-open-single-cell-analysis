<script setup lang="ts">
import { ref, watch } from "vue";
import type { NavigationMenuItem } from "@nuxt/ui";
import { loadedDataset, clearLoadedDataset } from "../../globalRefs";

const items = ref<NavigationMenuItem[]>([
  {
    label: "home",
    icon: "i-lucide-house",
    to: "/",
    exact: true,
  },
]);

watch(loadedDataset.rows, (rows) => {
  if (rows === null) {
    // remove run object from items if it exists
    items.value = items.value.filter((item) => item.label !== "run");
  } else {
    items.value.push({
      label: "run",
      icon: "i-lucide-play",
      to: "/run",
      exact: true,
    });
  }
});

watch(loadedDataset.umap_x, (rows) => {
  if (rows === null) {
    // remove view object from items if it exists
    items.value = items.value.filter((item) => item.label !== "view");
  } else {
    items.value.push({
      label: "view",
      icon: "i-lucide-eye",
      to: "/view",
      exact: true,
    });
  }
});
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="w-full h-full flex flex-row gap-4 glass">
        <div class="basis-1/3 flex items-center">
          <div class="flex items-center p-2">
            <img
              src="@/assets/LoSCA_logo.png"
              alt="local open single cell analysis logo"
              height="32px"
              width="32px"
            />
          </div>
          <h1 class="pl-4 text-md">local open single cell analysis</h1>
        </div>
        <div
          v-if="loadedDataset.fileName.value"
          class="basis-1/3 flex items-center justify-center"
        >
          <span>{{ loadedDataset.fileName }}</span
          ><UButton
            color="error"
            size="md"
            variant="ghost"
            class="ml-2 rounded-full"
            @click="clearLoadedDataset"
            >remove</UButton
          >
        </div>
        <div class="basis-1/3 flex items-center justify-around">
          <!--TODO-->
        </div>
      </div>
    </header>

    <div class="main relative flex flex-row w-full h-full">
      <aside class="sidebar absolute left-0 top-0 bottom-0">
        <UNavigationMenu
          v-if="items.length > 1"
          collapsed
          orientation="vertical"
          :items="items"
          :ui="{
            link: 'flex-col gap-1',
            linkLabel: 'block text-[10px]/3 text-center',
          }"
          class="glass p-1"
        />
      </aside>
      <main class="workspace">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.navItem {
  margin: 0.5rem 0;
}
</style>
