/**
 * 日記履歴ページ（ラッパー）
 *
 * useSearchParams() を使う HistoryContent コンポーネントを
 * React の Suspense で包むためのラッパーページ。
 *
 * Next.js App Router では、useSearchParams() を使うクライアントコンポーネントは
 * Suspense バウンダリ内に配置する必要がある（SSR 時のフォールバック表示のため）。
 */
import { Suspense } from "react";
import HistoryContent from "./HistoryContent";

export default function HistoryPage() {
    return (
        <Suspense fallback={
            /* HistoryContent の読み込み中に表示するローディング画面 */
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-400 text-sm">読み込み中...</p>
            </div>
        }>
            <HistoryContent />
        </Suspense>
    );
}
