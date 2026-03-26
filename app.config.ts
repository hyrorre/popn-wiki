export default defineAppConfig({
  app: {
    lang: 'ja',
    title: 'ポップンミュージック上級攻略Wiki',
    description: 'ポップンミュージック中級・上級・超上級曲の難易度表・攻略情報をまとめるサイト',
    type: 'website',
    url: 'https://popn.wiki',
    image: 'https://popn.wiki/icon.svg',
    twitter: '@hyrorre',
    card: 'summary'
  },
  format: {
    locale: 'ja-JP',
    option: {
      year: 'numeric',
      month: '2-digit',
      date: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: undefined
    }
  }
})
