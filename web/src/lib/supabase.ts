/**
 * ブラウザ（クライアント）用 Supabase クライアント生成ユーティリティ
 *
 * クライアントコンポーネント（"use client"）内で Supabase にアクセスするために使用する。
 * 環境変数から Supabase の URL と匿名キーを読み取り、ブラウザ用のクライアントを作成する。
 *
 * @example
 * const supabase = createClient();
 * const { data } = await supabase.from("diaries").select("*");
 */
import { createBrowserClient } from '@supabase/ssr';

/**
 * ブラウザ環境用の Supabase クライアントを生成する
 * - Cookie ベースのセッション管理を自動で行う（@supabase/ssr が担当）
 * - クライアントコンポーネントからのみ呼び出すこと
 */
export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}
