import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { type NextRequest } from 'next/server';

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
                    }
                },
            },
        }
    );
}

// Route Handler 専用: NextRequest からクッキーを直接読む
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

export async function createAdminSupabase() {
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}
