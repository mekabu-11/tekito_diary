import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET() {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Service Role Key でRLSを回避してプロファイル取得
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
