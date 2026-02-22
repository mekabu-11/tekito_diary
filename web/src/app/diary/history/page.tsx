import { Suspense } from "react";
import HistoryContent from "./HistoryContent";

export default function HistoryPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-400 text-sm">読み込み中...</p>
            </div>
        }>
            <HistoryContent />
        </Suspense>
    );
}
