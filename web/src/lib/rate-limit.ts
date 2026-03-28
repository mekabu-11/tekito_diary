/**
 * インメモリ レートリミッター
 * AIルート用: 1ユーザーあたり1分間に最大10リクエスト
 * ※ Vercelのサーバーレス環境ではインスタンス間で共有されないが、基本的な乱用防止として機能する
 */

const WINDOW_MS = 60 * 1000; // 1分
const MAX_REQUESTS = 10;

const store = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + WINDOW_MS });
        return { allowed: true, remaining: MAX_REQUESTS - 1 };
    }

    if (entry.count >= MAX_REQUESTS) {
        return { allowed: false, remaining: 0 };
    }

    entry.count++;
    return { allowed: true, remaining: MAX_REQUESTS - entry.count };
}
