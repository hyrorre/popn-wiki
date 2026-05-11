import { ja } from '@nuxt/ui/locale'

const dateTimeFormatOptions: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: undefined
}

export default defineAppConfig({
  app: {
    locale: ja,
    lang: 'ja',
    title: 'ポップンミュージック上級攻略Wiki',
    description: 'ポップンミュージック中級・上級・超上級曲の難易度表・攻略情報まとめ',
    type: 'website',
    url: 'https://popn.wiki',
    image: 'https://popn.wiki/icon.svg',
    twitter: '@hyrorre',
    card: 'summary'
  },
  format: {
    locale: 'sv-SE',
    dateTimeFormatOptions
  }
})
