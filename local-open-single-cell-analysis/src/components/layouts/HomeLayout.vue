<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";
import { loadedDataset, clearLoadedDataset } from "../../globalRefs";

const items: NavigationMenuItem[] = [
  {
    label: "Home",
    icon: "i-lucide-house",
    to: "/",
    exact: true,
  },
  {
    label: "Run",
    icon: "i-lucide-play",
    to: "/run",
    exact: true,
  },
  {
    label: "View",
    icon: "i-lucide-eye",
    to: "/view",
    exact: true,
  },
];
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
            class="rounded-full"
            @click="clearLoadedDataset"
            >remove</UButton
          >
        </div>
        <div class="basis-1/3 flex items-center justify-around">
          <!--TODO-->
        </div>
      </div>
    </header>

    <div class="main">
      <aside class="sidebar">
        <UNavigationMenu
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
