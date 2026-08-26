<template>
  <span class="inline-flex">
    <span
      v-for="i in 3"
      :key="i"
      class="inline-block w-[0.5em]"
      :class="{ invisible: count < i }"
    >
      .
    </span>
  </span>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const count = ref(0);
let interval: ReturnType<typeof setInterval>;

onMounted(() => {
  interval = setInterval(() => {
    count.value = count.value >= 3 ? 0 : count.value + 1;
  }, 400);
});

onUnmounted(() => {
  clearInterval(interval);
});
</script>
