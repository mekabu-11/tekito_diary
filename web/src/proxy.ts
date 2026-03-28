/**
 * 認証プロキシ
 *
 * Next.js の Proxy として全リクエストに対して実行される。
 * Supabase Auth のセッションを検証し、以下のルーティング制御を行う:
 *
 * - 未認証ユーザー → /login にリダイレクト（API・ログインページ以外）
 * - 認証済みで /login にアクセス → /dashboard にリダイレクト
 * - 認証済みで / にアクセス → /dashboard にリダイレクト
 * - ブラウザキャッシュを無効化（戻るボタンでの古いデータ表示を防止）
 */
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request });

    // Supabase のサーバークライアントを作成（Cookie 経由でセッション管理）
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                // リクエストから全 Cookie を取得
                getAll() {
                    return request.cookies.getAll();
                },
                // レスポンスに Cookie をセット（セッションの更新用）
                setAll(cookiesToSet) {
                    // リクエスト側の Cookie も更新（後続処理で使えるように）
                    cookiesToSet.forEach(({ name, value, options }) =>
                        request.cookies.set(name, value)
                    );
                    // 新しいレスポンスを作成し、Cookie を設定
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // 現在のセッションからユーザー情報を取得
    const { data: { user } } = await supabase.auth.getUser();

    // 未認証ユーザーが保護されたページにアクセスした場合 → ログインページへリダイレクト
    // ただし /login と /api パスはリダイレクト対象外
    if (!user && !request.nextUrl.pathname.startsWith('/login') && !request.nextUrl.pathname.startsWith('/api')) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    // 認証済みユーザーがログインページにアクセスした場合 → ダッシュボードへリダイレクト
    if (user && request.nextUrl.pathname === '/login') {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
    }

    // 認証済みユーザーがルートパスにアクセスした場合 → ダッシュボードへリダイレクト
    if (user && request.nextUrl.pathname === '/') {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
    }

    // ブラウザキャッシュを無効化（戻るボタンでキャッシュから表示されるのを防ぐ）
    supabaseResponse.headers.set('Cache-Control', 'no-store');

    return supabaseResponse;
}

/**
 * Proxy の適用対象パスの設定
 * - 静的アセット（_next/static, _next/image, favicon.ico 等）は除外
 * - それ以外のすべてのパスに適用
 */
export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)'],
};
