# Markdown表示の安全化と互換性

Markdownは保存時のサーバー処理と、プレビュー・保存済みASTの描画時に安全化する。
元のMarkdown、HAST、MDC ASTそれぞれの構造を区別する。

- 保存前のHTML除去はMarkdownのHTMLノードだけに適用する。コード・エスケープ・リンクタイトル・frontmatterの文字列は保持する。
- ページのタイトル・説明・ディスカッション設定は、表示用ASTの有効性とは別に取得する。`component` と `mdc` によるレンダラー上書きは許可しない。
- 標準のタブ、折りたたみ、バッジなどは明示的な部品リストで許可する。アプリ全体の任意コンポーネントは公開しない。
- コードのハイライトは、検証済みの `--shiki-light/default/dark` 変数と `app.css` の固定ルールで表示する。本文内の `style` 要素は許可しない。
- `{{ label }}`、`{{ nested.name }}`、`{{ items[0] }}`、`{{ $doc.label }}` はfrontmatter内の文字列・有限数値・真偽値をテキスト化する。式の評価、関数呼び出し、getter、プロトタイプ参照は行わない。
- 文字色と背景色に加え、固定値の文字揃えを許可する。`display: none` は表セルだけに限定する。
- 画像の `width`、`height`、`max-width`、`max-height` は非負の数値と `px`・`%`・`em`・`rem` を許可する。幅・高さの `auto` と最大寸法の `none` も許可する。`url()`・`expression()`・`var()`・`calc()` は寸法として受け付けない。
- `ruby`・`rt`・`rp` と脚注の `section` を保持する。
- 表の `>` は左のセル、`~` は上のセルに結合する。幅2のセルを下に延長するときは `~ | ~` または `~ | >` と書く。
  長方形全体を継続できない場合や、ヘッダーと本文をまたぐ場合は結合せず記号を残す。インラインコード内の記号は結合しない。

`utils/markdown-security.ts` の `MARKDOWN_RENDER_VERSION` が古い保存済みASTは、元のMarkdownから描画し直す。
タグ・属性・本文が過去に除去されている場合、保存済みASTだけからは復元できないためである。
表示結果に影響するパーサー・安全化処理を変更したときは、このバージョンと回帰テストを更新する。
ページの再保存は不要。ページAPIは古いASTを返す前にMarkdownから作り直し、DBへ書き戻す。
コメントのASTは管理画面の `/admin/backfill-comment-ast` で更新する。未生成と古いASTが対象で、
対象がなくなるまで実行する。更新前のコメントは元のMarkdownから描画される。
新たに保存するASTには現在のバージョンが記録される。

過去の安全化処理でMarkdown本文そのものから削除されたコード例は、自動復元できない。
必要に応じて削除前のリビジョンや原本から復元する。

検証は、単体テストで構造と危険な値の除去、Nuxtテストでプレビュー・保存済みASTの描画と操作、
API結合テストで保存される本文を確認する。

## 回帰テストの範囲

| 対象                                                                                      | 主なテスト                                                             |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 旧ASTからの再描画とメタデータ                                                             | `test/nuxt/wiki-page.test.ts`、`test/nuxt/markdown-rendering.test.ts`  |
| コード例・引用・リスト・frontmatter・CRLFと危険なHTMLの隣接                               | `test/markdownSanitize.test.ts`                                        |
| セル結合・背景色・揃え・不完全な結合・コード内の記号                                      | `test/tableMerge.test.ts`                                              |
| バインディングの文字列・数値・真偽値・既定値と危険な参照                                  | `test/markdownBindings.test.ts`、`test/nuxt/markdown-bindings.test.ts` |
| タブ・折りたたみ・バッジ・コード色・画像寸法・ルビ・脚注                                  | `test/nuxt/markdown-{widgets,highlight,layout}.test.ts`                |
| 結合表×色×リンク×バインディング、定義リスト、チェックリスト、引用、旧Wikiリンク、脚注往復 | `test/nuxt/markdown-combinations.test.ts`                              |
| タブ内の表、折りたたみ内のカード・名前付きスロット・コード、再表示の操作                  | `test/nuxt/markdown-combinations.test.ts`                              |
| 保存・編集・履歴取得・復元、コメント保存・編集・再取得で本文とASTを保持                   | `test/integration/api-characterization.test.ts`                        |

組み合わせテストは共通の例文をプレビューと保存済みASTの両方で描画し、期待するDOMと操作を検証する。
保存済みASTをJSON化して複数回安全化しても構造が失われないことも確認する。
全記法の全組み合わせを網羅するものではない。
NuxtのUIテストはhappy-domであり、実ブラウザーのセル寸法・折り返し・モバイル幅・明暗テーマの描画差は検証しない。
今後は実ブラウザーでの表示比較、ソート可能な表と結合セルの組み合わせ、入力を変化させる生成テストを補う。
