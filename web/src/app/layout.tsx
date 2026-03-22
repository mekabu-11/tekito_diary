/**
 * ルートレイアウト（app/layout.tsx）
 *
 * アプリケーション全体に共通するHTMLレイアウトを定義する。
 * Next.js の App Router で全ページに適用される最上位のレイアウトコンポーネント。
 *
 * - PWA（Progressive Web App）対応: manifest.json、apple-touch-icon の設定
 * - メタデータ: アプリ名・説明・テーマカラーの定義
 * - ビューポート: モバイル対応のレスポンシブ設定
 * - テーマプロバイダー: ダーク/ライトモード切替のコンテキスト提供
 * - Google Fonts: Zen Kaku Gothic New（本文） + Zen Maru Gothic（見出し）
 */
import type { Metadata, Viewport } from "next";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";

/** アプリケーション全体のメタデータ（SEO・PWA用） */
export const metadata: Metadata = {
  title: "てきとー日記",
  description: "適当に書くだけでAIが日記にしてくれるアプリ",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "てきとー日記",
  },
};

/** ビューポート設定（モバイルでのピンチズーム無効化・テーマカラー） */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0D9488",
};

/**
 * 全ページを包むルートレイアウトコンポーネント
 * - lang="ja" で日本語ページとして設定
 * - ThemeProvider でダーク/ライトモードのコンテキストを提供
 * - Google Fonts（Zen Kaku Gothic New / Zen Maru Gothic）を読み込み
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        {/* Google Fonts: Zen Kaku Gothic New（本文）+ Zen Maru Gothic（見出し） */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700&family=Zen+Maru+Gothic:wght@500;700;900&display=swap"
          rel="stylesheet"
        />
        {/* PWA: iOS ホーム画面アイコン */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        {/* テーマ初期化スクリプト: FOUC防止（ちらつき防止） */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('theme');
                if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body className="bg-stone-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 antialiased transition-colors duration-300">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
