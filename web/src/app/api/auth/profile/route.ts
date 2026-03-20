/**
 * ユーザープロファイル取得 API
 *
 * エンドポイント: GET /api/auth/profile
 *
 * 現在ログイン中のユーザーのプロファイル情報を返す。
 * ヘッダーの表示名やadmin権限の判定に使用される。
 *
 * レスポンス例:
 * { email: "user@example.com", role: "admin", displayName: "ユーザー名", isAdmin: true }
 */
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET() {
    // 通常のクライアントでログイン中のユーザーを取得
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Service Role Key で RLS を回避してプロファイルを取得
    // （user_profiles テーブルは RLS で保護されているため、通常クライアントでは読めない）
    const adminSupa = await createAdminSupabase();
    const { data: profile } = await adminSupa
        .from("user_profiles")
        .select("role, display_name")
        .eq("id", user.id)
        .single();

    return NextResponse.json({
        email: user.email,
        role: profile?.role || "user",
        displayName: profile?.display_name || user.email,
        isAdmin: profile?.role === "admin",
    });
}
