import { createAdminSupabase, createServerSupabaseFromRequest } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// NextRequest を受け取り、クッキーから直接セッションを読む（Forbidden回避）
async function checkAdmin(request: NextRequest) {
    const supabase = createServerSupabaseFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const adminSupa = await createAdminSupabase();
    const { data: profile } = await adminSupa
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();
    return profile?.role === "admin" ? user : null;
}

// ユーザー一覧取得
export async function GET(request: NextRequest) {
    const admin = await checkAdmin(request);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const adminSupa = await createAdminSupabase();

    // Auth ユーザー一覧を取得
    const { data: authData, error: authError } = await adminSupa.auth.admin.listUsers();

    if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    // プロファイル一覧を取得
    const { data: profiles, error: profileError } = await adminSupa
        .from("user_profiles")
        .select("*");

    if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    // 結合
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

// ユーザー作成
export async function POST(request: NextRequest) {
    const admin = await checkAdmin(request);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { email, password, displayName } = await request.json();
    const adminSupa = await createAdminSupabase();

    try {
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

        // トリガーが失敗した場合に備えて、user_profiles を手動で upsert する
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
            // プロファイル作成は失敗してもユーザー自体は作成されているので、警告として返す
        }

        return NextResponse.json({ user: data.user });
    } catch (err: unknown) {
        console.error("POST /api/admin/users unexpected error:", err);
        const errorMessage = err instanceof Error ? err.message : "予期しないエラーが発生しました";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

// ユーザー削除
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

// ユーザー更新（メール・表示名・ロール）
export async function PATCH(request: NextRequest) {
    const admin = await checkAdmin(request);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { userId, displayName, role, email } = await request.json();
    const adminSupa = await createAdminSupabase();

    try {
        // メールアドレス変更
        if (email) {
            const { error: emailError } = await adminSupa.auth.admin.updateUserById(userId, { email });
            if (emailError) throw emailError;
        }

        // プロファイル更新
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
