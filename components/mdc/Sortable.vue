<script setup lang="ts">
import { useAttrs } from 'vue'

const attrs = useAttrs()
const container = ref<HTMLElement | null>(null)
const thElements = ref<HTMLTableCellElement[]>([])

const sortCol = ref<number | null>(null)
const sortDir = ref<'asc' | 'desc' | null>(null)

function getSortValue(text: string, type: string) {
  if (type === 'category') {
    return quantify_category(text)
  }
  if (type === 'numeric') {
    // 弱(-0.505±0.5) や 中(+0.040) からカッコ内の数値を抽出
    const match = text.match(/([-+]?\d+(?:\.\d+)?)/)
    return parseFloat(match?.[1] ?? '0')
  }
  if (type === 'bpm') {
    // 210～360 などの範囲表記から最初の数値を抽出
    const match = text.match(/\d+/)
    return parseInt(match?.[0] ?? '0')
  }
  return text.trim().toLowerCase()
}

function sortTable(table: HTMLTableElement, colIndex: number) {
  const tbody = table.querySelector('tbody')
  if (!tbody) return

  const rows = Array.from(tbody.querySelectorAll('tr'))
  const type = (attrs[`c${colIndex + 1}`] as string) || 'text'

  const currentSortCol = table.getAttribute('data-sort-col')
  const currentSortDir = table.getAttribute('data-sort-dir')

  const isAsc = currentSortCol === String(colIndex) && currentSortDir === 'asc'
  const newDir = isAsc ? 'desc' : 'asc'

  rows.sort((a, b) => {
    const valA = getSortValue(a.cells[colIndex]?.innerText || '', type)
    const valB = getSortValue(b.cells[colIndex]?.innerText || '', type)

    if (typeof valA === 'number' && typeof valB === 'number') {
      return newDir === 'asc' ? valA - valB : valB - valA
    }

    const strA = String(valA)
    const strB = String(valB)
    return newDir === 'asc'
      ? strA.localeCompare(strB, undefined, { numeric: true })
      : strB.localeCompare(strA, undefined, { numeric: true })
  })

  rows.forEach((row) => tbody.appendChild(row))

  table.setAttribute('data-sort-col', String(colIndex))
  table.setAttribute('data-sort-dir', newDir)

  sortCol.value = colIndex
  sortDir.value = newDir
}

onMounted(() => {
  if (!container.value) return
  const table = container.value.querySelector('table')
  if (!table) return

  const headers = table.querySelectorAll('th')
  thElements.value = Array.from(headers)

  headers.forEach((th, index) => {
    th.style.cursor = 'pointer'
    th.title = 'クリックでソート'
    th.addEventListener('click', () => sortTable(table, index))
  })
})

const quantify_category = (a: string) => {
  a = a.replace(/\[(.*?)\]/u, '$1')
  if (a.match(/^[0-9]+$/u)) {
    return Number(a)
  }
  if (a.match(/^CS[0-9]*$/u)) {
    return 5000 + Number(a.substr(2))
  }
  switch (a) {
    case 'SP':
      return 21
    case 'LT':
      return 22
    case 'écl':
    case 'ecl':
      return 23
    case 'うさ':
      return 24
    case 'pe':
      return 25
    case '解':
      return 26
    case 'UL':
      return 27
    case 'JF':
      return 28
    case 'HC':
      return 29
    case '版権':
      return 3001
    case 'CSbest':
      return 5501
    case 'PMP':
      return 6001
    case 'うたっち':
      return 6501
    case 'PMP2':
      return 7002
    case 'ee':
      return 8001
    case 'ee2':
      return 8002
  }
  return 9999
}
</script>

<template>
  <div ref="container" class="sortable-table-wrapper">
    <slot />

    <!-- ヘッダーにアイコンをテレポート -->
    <template v-for="(th, index) in thElements" :key="index">
      <Teleport :to="th">
        <Icon
          :name="
            sortCol === index
              ? sortDir === 'asc'
                ? 'lucide:chevron-up'
                : 'lucide:chevron-down'
              : 'lucide:chevrons-up-down'
          "
          class="w-4 h-4 ml-1 inline-block align-middle transition-opacity"
          :class="sortCol === index ? 'opacity-100' : 'opacity-30'"
        />
      </Teleport>
    </template>
  </div>
</template>

<style scoped>
.sortable-table-wrapper :deep(th) {
  cursor: pointer;
  white-space: nowrap;
}
</style>
