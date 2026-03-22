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
  themeColor: "#6C63FF",
};

/**
 * 全ページを包むルートレイアウトコンポーネント
 * - lang="ja" で日本語ページとして設定
 * - ThemeProvider でダーク/ライトモードのコンテキストを提供
 * - グローバルCSSとTailwindの基本スタイルを適用
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
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
      <body className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 antialiased transition-colors duration-300">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
