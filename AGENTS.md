# Codex Development Notes

このリポジトリで Codex が作業するときの開発メモです。既存の実装に合わせて、小さく安全に変更してください。

## Project Overview

- Nuxt 4 / Vue 3 の Wiki アプリです。
- パッケージマネージャは Bun です。`bun.lock` を更新対象にします。
- UI は `@nuxt/ui`、Markdown 表示は `@nuxtjs/mdc` を使います。
- 認証は `nuxt-auth-utils`、メールは Resend、DB/Blob/Cloudflare 連携は NuxtHub を使います。
- DB は SQLite / Cloudflare D1 想定で、スキーマとマイグレーションは Drizzle で管理します。
- デプロイ先は Cloudflare Workers module preset です。

## Runtime

`.tool-versions` の指定:

- Node.js 24.14.1
- Bun 1.3.12

## Common Commands

依存関係のインストール:

```bash
bun install
```

開発サーバー:

```bash
bun run dev
```

本番ビルド:

```bash
bun run build
```

本番ビルドのローカルプレビュー:

```bash
bun run preview
```

型チェック:

```bash
bun run tsc
```

Lint:

```bash
bun run lint
```

注意: 現在の `lint` は `eslint . --fix` なので、自動修正でファイルを書き換えます。確認だけしたい場合は、必要に応じて `bunx eslint .` を使ってください。

Format:

```bash
bun run format
```

注意: `format` は `prettier . --write` なのでファイルを書き換えます。

テスト:

```bash
bun test
```

注意: `package.json` に `test` script はありません。既存テストは `test/auth.test.ts` で、`.env.example` の `TEST_*` 変数が必要です。

DB マイグレーション生成:

```bash
bun run db:generate
```

DB 反映:

```bash
bun run db:migrate
```

DB push / Studio:

```bash
bun run db:push
bun run db:studio
```

注意: Drizzle / Cloudflare D1 系のコマンドは `NUXT_HUB_CLOUDFLARE_ACCOUNT_ID`、`NUXT_HUB_CLOUDFLARE_DATABASE_ID`、`NUXT_HUB_CLOUDFLARE_API_TOKEN` などの環境変数が必要です。

## Directory Map

- `pages/`: Nuxt pages。Wiki本文表示、編集、認証、プロフィールなどの画面。
- `components/`: 共通 Vue コンポーネント。`components/mdc/` は Markdown 内で使う MDC コンポーネント。
- `composables/`: Vue composables。ナビゲーションやページ操作の共通処理。
- `middleware/`: Nuxt route middleware。
- `server/api/`: Nitro server API。ページ、コメント、画像、認証、プロフィールなど。
- `server/api/auth/`: サインアップ、サインイン、OAuth、確認メール、パスワードリセット。
- `server/db/`: Drizzle schema と migrations。
- `server/utils/`: サーバー側の共通処理。
- `server/middleware/`: Nitro middleware。
- `server/tasks/`: Nitro task。現在は seed 用。
- `shared/types/`: 共有型定義。
- `utils/`: MDC/Markdown 用 remark plugin。
- `public/`: favicon、icon、robots など静的ファイル。
- `test/`: Bun test。

## Important Files

- `nuxt.config.ts`: Nuxt modules、MDC plugin、NuxtHub、Cloudflare Workers/D1/R2 設定。
- `app.config.ts`: サイトメタデータ、locale、表示フォーマット。
- `app.css`: グローバル CSS。
- `server/db/schema.ts`: DB schema の一次情報。
- `drizzle.config.ts`: Drizzle Kit 設定。Cloudflare D1 credentials を環境変数から読む。
- `.env.example`: 必要な環境変数一覧。
- `.gitignore`: `.env*`、`.nuxt`、`.output`、`.data`、`.wrangler`、`node_modules` などは追跡しない。

## Environment Notes

- `.env` はローカル秘密情報を含むため読まない・表示しない・コミットしないでください。
- 新しい環境変数を追加した場合は、秘密値なしで `.env.example` にキーを追加してください。
- Cloudflare / Resend / Google OAuth 関連の変更では、本番影響と必要な環境変数を明記してください。

## Database Notes

- Schema 変更は `server/db/schema.ts` を変更し、必要に応じて `bun run db:generate` で migration を生成します。
- 既存 migration を手で書き換える前に、生成済み migration と本番 DB への影響を確認してください。
- ページ履歴は `pages` テーブルの `(path, revision)` 複合主キーで管理されています。

## Coding Notes

- 既存の Nuxt auto-import 前提の書き方に合わせてください。
- API の入力検証は既存実装に合わせ、可能なら `zod` を使います。
- Markdown 表示まわりは `nuxt.config.ts` の MDC remark/rehype plugin 設定と `utils/` を確認してから変更してください。
- 認証・セッション・パスワード移行処理は `server/utils/auth.ts` と `server/api/auth/` を確認してから触ってください。
- UI 変更は日本語サイトであることを前提に、`app.config.ts` の `ja` / `ja-JP` 設定と既存コピーに合わせます。

## Before Changing

1. `git status --short --branch` でユーザーの未コミット変更を確認します。
2. 関連ファイルを `rg` / `sed` で読み、既存パターンを優先します。
3. `.env` や秘密情報を含むファイルは必要がない限り読まないでください。
4. 依存パッケージ追加、DB schema 変更、migration 生成、Cloudflare 設定変更は影響が大きいので、理由を明確にしてください。

## After Changing

変更内容に応じて、できる範囲で以下を実行します。

- TypeScript / API / server logic を変更した場合: `bun run tsc`
- Lint 対象のコードを変更した場合: `bunx eslint .` または必要に応じて `bun run lint`
- フォーマットが崩れた場合: 対象ファイルを確認してから `bun run format`
- テスト対象を変更した場合: `bun test`
- Nuxt config / build / Cloudflare preset に関わる変更: `bun run build`
- DB schema を変更した場合: migration 生成と差分確認

最後に `git status --short` で、意図したファイルだけが変更されていることを確認してください。
