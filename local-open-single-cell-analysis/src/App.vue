<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

type AnalysisProgressEvent = { type: 'progress'; step: string; detail: string; progress: number }
type ResultEvent = {
  type: 'result'
  points: Array<{ x: number; y: number; label: string; cluster: string }>
  cells: number
  genes: number
  projection: 'UMAP' | 'PCA'
}

const file = ref<File | null>(null)
const running = ref(false)
const error = ref('')
const progress = ref(0)
const status = ref('Choose a CSV, TSV, or H5AD file to begin.')
const steps = ref<{ step: string; detail: string }[]>([])
const result = ref<ResultEvent | null>(null)
let worker: Worker | null = null

const plotPoints = computed(() => {
  if (!result.value) return []
  const xs = result.value.points.map((point) => point.x)
  const ys = result.value.points.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return result.value.points.map((point) => ({
    ...point,
    cx: 28 + ((point.x - minX) / (maxX - minX || 1)) * 344,
    cy: 372 - ((point.y - minY) / (maxY - minY || 1)) * 344,
  }))
})

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`
}

function selectFile(event: Event) {
  const input = event.target as HTMLInputElement
  file.value = input.files?.[0] ?? null
  result.value = null
  error.value = ''
  progress.value = 0
  steps.value = []
  status.value = file.value ? `${file.value.name} is ready to analyze.` : 'Choose a count matrix to begin.'
}

function analyze() {
  if (!file.value || running.value) return
  running.value = true
  error.value = ''
  result.value = null
  steps.value = []
  progress.value = 0
  status.value = 'Starting the Python runtime…'
  worker = new Worker(new URL('./workers/analysis.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = ({ data }: MessageEvent<AnalysisProgressEvent | ResultEvent | { type: 'error'; message: string }>) => {
    if (data.type === 'progress') {
      progress.value = data.progress
      status.value = data.detail
      steps.value.push({ step: data.step, detail: data.detail })
    } else if (data.type === 'result') {
      result.value = data
      progress.value = 100
      status.value = 'Analysis complete. Results stayed in this browser.'
      running.value = false
      worker?.terminate()
    } else {
      error.value = data.message
      status.value = 'The analysis could not be completed.'
      running.value = false
      worker?.terminate()
    }
  }
  worker.onerror = () => {
    error.value = 'The worker stopped unexpectedly. Check the file format and try again.'
    running.value = false
  }
  file.value.arrayBuffer().then((buffer) => {
    if (!worker) {
      running.value = false
      return
    }
    worker.postMessage({ name: file.value?.name ?? '', bytes: buffer }, [buffer])
  }).catch((readError: unknown) => {
    error.value = readError instanceof Error ? readError.message : 'The file could not be read.'
    status.value = 'The file could not be loaded.'
    running.value = false
  })
}

onBeforeUnmount(() => worker?.terminate())
</script>

<template>
  <main class="shell">
    <header class="hero">
      <p class="eyebrow">LOCAL // SINGLE-CELL WORKBENCH</p>
      <h1>Explore your cells,<br /><em>privately.</em></h1>
      <p class="intro">A browser-only single-cell pipeline. Your data never leaves this device, and heavy Python work runs off the main thread.</p>
    </header>

    <section class="workspace">
      <aside class="panel controls">
        <div class="panel-heading"><span>01</span><h2>Load matrix</h2></div>
        <label class="dropzone" :class="{ selected: file }">
          <input type="file" accept=".csv,.tsv,.txt,.h5ad" @change="selectFile" />
          <strong>{{ file ? file.name : 'Drop a matrix here' }}</strong>
          <small>{{ file ? `${formatSize(file.size)} · ready` : 'or click to browse · CSV / TSV / H5AD' }}</small>
        </label>
        <button class="run" :disabled="!file || running" @click="analyze">
          {{ running ? 'RUNNING PYTHON…' : 'RUN ANALYSIS' }} <span>↗</span>
        </button>
        <p class="privacy"><span>◉</span> Processed locally with Pyodide<br />No uploads. No server required.</p>
      </aside>

      <section class="panel activity">
        <div class="panel-heading"><span>02</span><h2>Pipeline activity</h2></div>
        <div class="progress-track"><i :style="{ width: `${progress}%` }"></i></div>
        <p class="status">{{ status }}</p>
        <ol class="steps">
          <li v-for="(item, index) in steps" :key="`${item.step}-${index}`" class="done"><b>✓</b><span><strong>{{ item.step }}</strong>{{ item.detail }}</span></li>
          <li v-if="!steps.length" class="empty">Waiting for a matrix.</li>
        </ol>
        <p v-if="error" class="error">{{ error }}</p>
      </section>

      <section class="panel results">
        <div class="panel-heading"><span>03</span><h2>{{ result?.projection ?? 'UMAP' }} projection</h2><small v-if="result">{{ result.cells }} cells · {{ result.genes }} genes</small></div>
        <div v-if="result" class="chart-wrap">
          <svg viewBox="0 0 400 400" role="img" :aria-label="`${result.projection} scatter plot`">
            <line x1="28" y1="372" x2="372" y2="372" /><line x1="28" y1="372" x2="28" y2="28" />
            <circle v-for="point in plotPoints" :key="point.label" :cx="point.cx" :cy="point.cy" r="4.5" :class="`cluster-${point.cluster}`"><title>{{ point.label }}</title></circle>
          </svg>
          <p class="axis-label">{{ result.projection }} 1 <span>{{ result.projection }} 2 ↗</span></p>
        </div>
        <div v-else class="placeholder"><span>∿</span><p>Your projection<br />will appear here</p></div>
      </section>
    </section>
  </main>
</template>
