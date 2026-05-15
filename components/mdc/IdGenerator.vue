<script setup lang="ts">
const alp = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '0',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z'
]

const { user } = useUserSession()
const route = useRoute()
const router = useRouter()

const name = ref('')
const result = ref<{ id: string; success: boolean } | null>(null)
const copied = ref(false)

watch(name, () => {
  result.value = null
})

const queryName = computed(() => {
  const keys = Object.keys(route.query)
  return keys.length > 0 ? keys[0] : null
})

watch(
  queryName,
  (val, oldVal) => {
    name.value = val ?? user.value?.name ?? ''
    if (oldVal !== undefined) {
      nextTick(() => {
        document.getElementById('id-generator')?.scrollIntoView()
      })
    }
  },
  { immediate: true }
)

function checkSuccess(id: string): boolean {
  let intFlag = false
  let fiveFlag = false
  for (const ch of id) {
    if (ch === '5') {
      intFlag = true
      fiveFlag = true
    } else if (ch === '0') {
      if (intFlag) fiveFlag = true
      else intFlag = false
    } else if (!isNaN(Number(ch))) {
      if (fiveFlag) fiveFlag = false
      intFlag = true
    } else {
      if (fiveFlag) return true
      intFlag = false
    }
  }
  return fiveFlag
}

async function generate() {
  if (!name.value.trim()) return
  const { default: seedrandom } = await import('seedrandom')
  const now = new Date()
  const date = String(now.getFullYear()) + String(now.getMonth()) + String(now.getDate())
  const rng = seedrandom(name.value + date)
  let id = ''
  for (let i = 0; i < 8; i++) id += alp[Math.floor(rng() * alp.length)]
  result.value = { id, success: checkSuccess(id) }
  copied.value = false
}

const message = computed(() =>
  result.value?.success ? '当たりです！お題をもらいに行きましょう。' : '残念、明日もチャレンジ！'
)

const copyText = computed(() => {
  if (!result.value) return ''
  return `${name.value}さんのIDは、${result.value.id}です。${message.value}\n[IDを確認](${window.location.pathname}?${encodeURIComponent(name.value)})`
})

async function copyResult() {
  if (!copyText.value) return
  await navigator.clipboard.writeText(copyText.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

function reset() {
  router.replace(route.path)
}
</script>

<template>
  <div id="id-generator" class="border rounded p-4 my-3">
    <p class="mb-3 text-sm">このツールは「5の倍数のIDがお題に挑戦」用のID出力ツールです。結果は日替わりです。</p>

    <div class="flex gap-2 mb-4">
      <input
        v-model="name"
        type="text"
        placeholder="名前を入力"
        class="border rounded px-3 py-1.5 text-sm flex-1 max-w-xs bg-white dark:bg-gray-900 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
        @keydown.enter="generate"
      />
      <button
        class="border px-3 py-1.5 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors whitespace-nowrap"
        @click="generate"
      >
        出力
      </button>
      <button
        class="border px-3 py-1.5 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors whitespace-nowrap"
        @click="reset"
      >
        リセット
      </button>
    </div>

    <div v-if="result">
      <p class="mb-2">
        {{ name }}さんのIDは、<strong class="font-mono text-base tracking-widest">{{ result.id }}</strong
        >です。
      </p>
      <p
        class="mb-3 font-bold"
        :class="result.success ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'"
      >
        {{ message }}
      </p>

      <template v-if="result.success">
        <p class="mb-3 text-sm">
          お題をもらうときは、適正レベル、プレイスタイル、希望するお題などを書き込むようにしましょう。
        </p>
        <p class="mb-3">
          <NuxtLink
            to="/楽しい話題/5の倍数入りのIDがポップンのお題に挑戦#discussion__section"
            class="text-blue-600 dark:text-blue-400 underline text-sm"
          >
            Wikiへのリンク（ディスカッション）
          </NuxtLink>
        </p>
      </template>

      <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">結果コピー用</p>
      <div class="flex items-start gap-2">
        <textarea
          readonly
          :value="copyText"
          rows="5"
          class="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1.5 rounded flex-1 resize-none font-mono border border-gray-200 dark:border-gray-700 focus:outline-none"
        />
        <button
          class="border px-2 py-1 rounded text-sm whitespace-nowrap hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          @click="copyResult"
        >
          {{ copied ? 'コピー済み' : 'コピー' }}
        </button>
      </div>
    </div>
  </div>
</template>
