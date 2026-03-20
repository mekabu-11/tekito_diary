/**
 * ユーザー管理 API（管理者専用）
 *
 * エンドポイント: /api/admin/users
 *
 * 管理者（role: "admin"）のみがアクセス可能なユーザー管理 CRUD API。
 * Supabase の Admin API（Service Role Key）を使用して、
 * 認証ユーザーとプロファイルの管理を行う。
 *
 * 対応するHTTPメソッド:
 * - GET    : ユーザー一覧取得（Auth ユーザー + プロファイルを結合）
 * - POST   : 新規ユーザー作成（Auth ユーザー作成 + プロファイル作成）
 * - DELETE  : ユーザー削除（Auth ユーザー削除、プロファイルは CASCADE で削除）
 * - PATCH  : ユーザー更新（メールアドレス・表示名・ロール変更）
 */
import { createAdminSupabase, createServerSupabaseFromRequest } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

/** キャッシュを無効化（常に最新データを返す） */
export const dynamic = "force-dynamic";

/**
 * 管理者権限チェック
 *
 * リクエストの Cookie からセッションを読み取り、
 * ユーザーが管理者（role: "admin"）かどうかを検証する。
 * NextRequest から直接 Cookie を読むことで Forbidden エラーを回避する。
 *
 * @returns 管理者であればユーザーオブジェクト、そうでなければ null
 */
async function checkAdmin(request: NextRequest) {
    const supabase = createServerSupabaseFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Admin クライアントで RLS をバイパスしてロールを確認
    const adminSupa = await createAdminSupabase();
    const { data: profile } = await adminSupa
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();
    return profile?.role === "admin" ? user : null;
}

/**
 * GET: ユーザー一覧取得
 *
 * Supabase Auth のユーザー一覧と user_profiles テーブルを結合し、
 * 各ユーザーの ID・メール・作成日・表示名・ロールを返す。
 */
export async function GET(request: NextRequest) {
    const admin = await checkAdmin(request);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const adminSupa = await createAdminSupabase();

    // Auth ユーザー一覧を取得
    const { data: authData, error: authError } = await adminSupa.auth.admin.listUsers();

    if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    // プロファイル一覧を取得（表示名・ロール情報が格納されている）
    const { data: profiles, error: profileError } = await adminSupa
        .from("user_profiles")
        .select("*");

    if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    // Auth ユーザーとプロファイルを id で結合
    const users = authData.users.map((u) => {
        const profile = profiles.find((p) => p.id === u.id);
        return {
            id: u.id,
            email: u.email,
            createdAt: u.created_at,
            displayName: profile?.display_name || "",
            role: profile?.role || "user",
        };
    });

    return NextResponse.json({ users });
}

/**
 * POST: 新規ユーザー作成
 *
 * 1. Supabase Auth でユーザーを作成（メール確認済みとして作成）
 * 2. user_profiles テーブルにプロファイルを手動で upsert
 *    （DB トリガーが失敗した場合のフォールバック）
 *
 * リクエストボディ: { email, password, displayName }
 */
export async function POST(request: NextRequest) {
    const admin = await checkAdmin(request);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { email, password, displayName } = await request.json();
    const adminSupa = await createAdminSupabase();

    try {
        // Supabase Auth でユーザーを作成（email_confirm: true でメール確認をスキップ）
        const { data, error } = await adminSupa.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { display_name: displayName || "" },
        });

        if (error) {
            console.error("createUser error:", JSON.stringify(error, null, 2));
            return NextResponse.json({ error: error.message || "ユーザー作成に失敗しました" }, { status: 500 });
        }

        if (!data?.user) {
            return NextResponse.json({ error: "ユーザーデータが返されませんでした" }, { status: 500 });
        }

        // user_profiles テーブルに手動でプロファイルを作成
        // DB のトリガーが失敗した場合でもプロファイルが確実に存在するようにする
        const { error: profileError } = await adminSupa
            .from("user_profiles")
            .upsert(
                {
                    id: data.user.id,
                    display_name: displayName || "",
                    role: "user",
                },
                { onConflict: "id" }
            );

        if (profileError) {
            console.error("user_profiles upsert error:", profileError);
            // プロファイル作成失敗はユーザー自体の作成に影響しないため、警告に留める
        }

        return NextResponse.json({ user: data.user });
    } catch (err: unknown) {
        console.error("POST /api/admin/users unexpected error:", err);
        const errorMessage = err instanceof Error ? err.message : "予期しないエラーが発生しました";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

/**
 * DELETE: ユーザー削除
 *
 * Supabase Auth からユーザーを削除する。
 * user_profiles は CASCADE 設定により自動で削除される。
 *
 * リクエストボディ: { id: "削除対象のユーザーID" }
 */
export async function DELETE(request: NextRequest) {
    const admin = await checkAdmin(request);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await request.json();
    const adminSupa = await createAdminSupabase();

    try {
        const { error } = await adminSupa.auth.admin.deleteUser(id);
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "削除に失敗しました";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

/**
 * PATCH: ユーザー更新
 *
 * ユーザーのメールアドレス、表示名、ロールを更新する。
 * メールアドレスは Auth 側、表示名・ロールは user_profiles テーブルを更新する。
 *
 * リクエストボディ: { userId, email?, displayName, role }
 */
export async function PATCH(request: NextRequest) {
    const admin = await checkAdmin(request);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { userId, displayName, role, email } = await request.json();
    const adminSupa = await createAdminSupabase();

    try {
        // メールアドレス変更がある場合は Auth 側を更新
        if (email) {
            const { error: emailError } = await adminSupa.auth.admin.updateUserById(userId, { email });
            if (emailError) throw emailError;
        }

        // user_profiles テーブルの表示名・ロールを更新
        const { error: profileError } = await adminSupa.from("user_profiles").upsert({
            id: userId,
            display_name: displayName,
            role,
        });
        if (profileError) throw profileError;

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "更新に失敗しました";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
