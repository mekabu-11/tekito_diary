import { createAdminSupabase, createServerSupabaseFromRequest } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

// 購読を登録・更新
export async function POST(request: NextRequest) {
    const supabase = createServerSupabaseFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { subscription, notifyHour, notifyMinute } = await request.json();
    if (!subscription?.endpoint) {
        return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const adminSupa = await createAdminSupabase();
    const { error } = await adminSupa.from("notification_subscriptions").upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys?.p256dh || "",
        auth: subscription.keys?.auth || "",
        notify_hour: notifyHour ?? 21,
        notify_minute: notifyMinute ?? 0,
    }, { onConflict: "user_id" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}

// 購読情報を取得
export async function GET(request: NextRequest) {
    const supabase = createServerSupabaseFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminSupa = await createAdminSupabase();
    const { data } = await adminSupa
        .from("notification_subscriptions")
        .select("notify_hour, notify_minute, endpoint")
        .eq("user_id", user.id)
        .maybeSingle();

    return NextResponse.json({ subscription: data });
}

// 購読解除
export async function DELETE(request: NextRequest) {
    const supabase = createServerSupabaseFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminSupa = await createAdminSupabase();
    await adminSupa.from("notification_subscriptions").delete().eq("user_id", user.id);
    return NextResponse.json({ success: true });
}
