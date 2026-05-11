<script setup lang="ts">
const { app } = useAppConfig()

useSeoMeta({
  title: 'プライバシーポリシー',
  description: `${app.title}のプライバシーポリシーです。`,
  ogTitle: 'プライバシーポリシー',
  ogDescription: `${app.title}のプライバシーポリシーです。`,
  ogUrl: `${app.url}/privacy-policy`,
})
</script>

<template>
  <Header />

  <u-container class="py-8 lg:py-12">
    <div class="max-w-3xl mx-auto content">
      <h1 class="text-3xl font-bold mb-8 border-b border-default pb-4">プライバシーポリシー</h1>

      <p class="mb-8">
        「{{
          app.title
        }}」（以下、「当サイト」）は、ユーザーの個人情報の保護を重要視し、以下の通りプライバシーポリシーを定めます。
      </p>

      <section class="mb-8">
        <h2 class="text-xl font-bold mb-4">1. 個人情報の取得</h2>
        <p>当サイトは、ユーザーがアカウント作成やコンテンツ投稿を行う際に、以下の情報を取得することがあります。</p>
        <ul>
          <li>ユーザー名（ニックネーム）</li>
          <li>メールアドレス</li>
          <li>プロフィール画像（アバター）</li>
          <li>外部サービス（Google等）との連携により提供される、当該サービスの公開プロフィール情報</li>
        </ul>
      </section>

      <section class="mb-8">
        <h2 class="text-xl font-bold mb-4">2. 情報の利用目的</h2>
        <p>取得した情報は、以下の目的で利用いたします。</p>
        <ul>
          <li>ユーザー認証およびアカウント管理</li>
          <li>ページ編集・コメント投稿の履歴保持（Wikiの健全な運営のため）</li>
          <li>アカウント確認やパスワードリセット等の重要な通知</li>
          <li>当サイトのサービス向上・改善</li>
        </ul>
      </section>

      <section class="mb-8">
        <h2 class="text-xl font-bold mb-4">3. 情報の保管・セキュリティ</h2>
        <ul>
          <li>パスワードは適切にハッシュ化（暗号化）して保存し、厳重に管理します。</li>
        </ul>
      </section>

      <section class="mb-8">
        <h2 class="text-xl font-bold mb-4">4. 第三者提供の制限</h2>
        <p>法令に基づく場合を除き、ユーザーの同意なく個人情報を第三者に提供することはありません。</p>
      </section>

      <section class="mb-8">
        <h2 class="text-xl font-bold mb-4">5. 外部サービス・Cookieの利用</h2>
        <ul>
          <li><strong>Google OAuth</strong>: ユーザー認証のために使用します。</li>
          <li>
            <strong>Cloudflare</strong>:
            サイトの高速化・セキュリティ向上のために、アクセスログやCookieを利用することがあります。
          </li>
          <li><strong>Resend</strong>: メール送信のためにメールアドレスを使用します。</li>
        </ul>
      </section>

      <section class="mb-8">
        <h2 class="text-xl font-bold mb-4">6. 免責事項</h2>
        <p>
          当サイトに掲載されている情報については、可能な限り正確を期しておりますが、その内容の正確性や安全性を保証するものではありません。当サイトの利用により生じた損害について、当サイト管理者は一切の責任を負いません。
        </p>
      </section>

      <section class="mb-8">
        <h2 class="text-xl font-bold mb-4">7. プライバシーポリシーの変更</h2>
        <p>
          当サイトは、必要に応じて本ポリシーの内容を変更することがあります。変更した場合は、当サイト上での掲示等により告知します。
        </p>
      </section>

      <div class="mt-12 pt-8 border-t border-default text-sm text-muted">
        <p>策定日: 2026年4月30日</p>
      </div>
    </div>
  </u-container>

  <Footer />
</template>
