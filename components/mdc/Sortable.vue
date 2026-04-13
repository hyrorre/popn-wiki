<script setup lang="ts">
import { useAttrs } from 'vue'

const attrs = useAttrs()
const container = ref<HTMLElement | null>(null)
const thElements = ref<HTMLTableCellElement[]>([])

const sortCol = ref<number | null>(null)
const sortDir = ref<'asc' | 'desc' | null>(null)

// TODO: fix sort of category and difficulty
function getSortValue(text: string, type: string) {
  if (type === 'numeric' || type === 'bpm') {
    const match = text.match(/[\d.]+/)
    return match ? parseFloat(match[0]) : 0
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

  rows.forEach((row) => {
    tbody.appendChild(row)
  })

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
