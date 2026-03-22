/**
 * ダッシュボードページ（app/dashboard/page.tsx）
 *
 * ログイン後に最初に表示されるページ。
 * Suspense でラップして、useSearchParams の SSR 互換性を確保する。
 */
import { Suspense } from "react";
import DashboardContent from "./DashboardContent";

export default function DashboardPage() {
    return (
        <Suspense>
            <DashboardContent />
        </Suspense>
    );
}
