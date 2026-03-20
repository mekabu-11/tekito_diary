/**
 * サーバー用 Supabase クライアント生成ユーティリティ
 *
 * サーバー側（Server Components / Route Handlers / Middleware）から
 * Supabase にアクセスするためのクライアント生成関数群。
 *
 * 3つのクライアント生成関数を提供:
 * 1. createServerSupabase      - Server Components / Route Handlers 用（cookieStore ベース）
 * 2. createServerSupabaseFromRequest - Route Handlers 用（NextRequest の cookie を直接読む）
 * 3. createAdminSupabase       - Service Role Key を使った管理者用（RLS バイパス）
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { type NextRequest } from 'next/server';

/**
 * Server Components / Route Handlers 用の Supabase クライアントを生成する
 *
 * Next.js の `cookies()` を使ってセッション情報を取得する。
 * Server Components から呼び出す場合、setAll は書き込み不可のため catch で無視する。
 */
export async function createServerSupabase() {
    const cookieStore = await cookies();

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // Server Component からの書き込みは無視
                        // （Server Components は読み取り専用のため）
                    }
                },
            },
        }
    );
}

/**
 * Route Handler 専用: NextRequest のクッキーから直接セッションを読むクライアント
 *
 * `cookies()` ではなく NextRequest のクッキーを直接読むため、
 * Route Handler 内でキャッシュの影響を受けずにセッション情報を取得できる。
 * 主に admin API ルートで使用される（Forbidden 回避のため）。
 */
export function createServerSupabaseFromRequest(request: NextRequest) {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll() {
                    // Route Handler 内での書き込みは不要
                },
            },
        }
    );
}

/**
 * 管理者用 Supabase クライアント（Service Role Key 使用）
 *
 * RLS（Row Level Security）をバイパスして全データにアクセスできる。
 * ユーザープロファイルの取得やユーザー管理など、管理者権限が必要な操作で使用する。
 *
 * ⚠️ このクライアントは非常に強い権限を持つため、サーバーサイドのみで使用すること。
 */
export async function createAdminSupabase() {
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}
