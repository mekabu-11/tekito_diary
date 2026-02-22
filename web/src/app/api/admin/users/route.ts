import { createAdminSupabase, createServerSupabaseFromRequest } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

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
    const { data: { users }, error } = await adminSupa.auth.admin.listUsers();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: profiles } = await adminSupa.from("user_profiles").select("*");
    const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));

    const result = users.map((u: any) => ({
        id: u.id,
        email: u.email,
        displayName: profileMap[u.id]?.display_name || "",
        role: profileMap[u.id]?.role || "user",
        createdAt: u.created_at,
    }));

    return NextResponse.json({ users: result });
}

// ユーザー作成
export async function POST(request: NextRequest) {
    const admin = await checkAdmin(request);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { email, password, displayName } = await request.json();
    const adminSupa = await createAdminSupabase();

    const { data, error } = await adminSupa.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName || "" },
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // user_profiles にも追加
    if (data.user) {
        await adminSupa.from("user_profiles").upsert({
            id: data.user.id,
            display_name: displayName || "",
            role: "user",
        });
    }

    return NextResponse.json({ user: data.user });
}

// ユーザー削除
export async function DELETE(request: NextRequest) {
    const admin = await checkAdmin(request);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { userId } = await request.json();
    const adminSupa = await createAdminSupabase();

    const { error } = await adminSupa.auth.admin.deleteUser(userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}

// ユーザー更新（メール・表示名・ロール）
export async function PATCH(request: NextRequest) {
    const admin = await checkAdmin(request);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { userId, displayName, role, email } = await request.json();
    const adminSupa = await createAdminSupabase();

    // メールアドレス変更
    if (email) {
        const { error } = await adminSupa.auth.admin.updateUserById(userId, { email });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // プロファイル更新
    await adminSupa.from("user_profiles").upsert({
        id: userId,
        display_name: displayName,
        role,
    });

    return NextResponse.json({ success: true });
}
