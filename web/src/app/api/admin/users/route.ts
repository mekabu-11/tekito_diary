import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

async function checkAdmin(supabase: any) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();
    return profile?.role === "admin" ? user : null;
}

// ユーザー一覧取得
export async function GET() {
    const supabase = await createServerSupabase();
    const admin = await checkAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const adminSupa = await createAdminSupabase();
    const { data: { users }, error } = await adminSupa.auth.admin.listUsers();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: profiles } = await supabase.from("user_profiles").select("*");
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
    const supabase = await createServerSupabase();
    const admin = await checkAdmin(supabase);
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
    return NextResponse.json({ user: data.user });
}

// ユーザー削除
export async function DELETE(request: NextRequest) {
    const supabase = await createServerSupabase();
    const admin = await checkAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { userId } = await request.json();
    const adminSupa = await createAdminSupabase();

    const { error } = await adminSupa.auth.admin.deleteUser(userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}

// ユーザー更新
export async function PATCH(request: NextRequest) {
    const supabase = await createServerSupabase();
    const admin = await checkAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { userId, displayName, role } = await request.json();
    const adminSupa = await createAdminSupabase();

    await adminSupa.from("user_profiles").update({
        display_name: displayName,
        role,
    }).eq("id", userId);

    return NextResponse.json({ success: true });
}
