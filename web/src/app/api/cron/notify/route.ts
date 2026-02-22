import { createAdminSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
);

// Vercel Cron または手動テスト用: 毎時 xx:00 に呼ばれる想定
// Cron schedule: "0 * * * *" (毎時0分)
export async function GET(request: NextRequest) {
    // CRON_SECRET で保護
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 現在のJST時刻（時のみ）を取得
    const now = new Date();
    // JST = UTC+9
    const jstHour = (now.getUTCHours() + 9) % 24;

    const adminSupa = await createAdminSupabase();

    // 現在の「時」に設定している購読者を全員取得（分は0固定）
    const { data: subscriptions, error } = await adminSupa
        .from("notification_subscriptions")
        .select("*")
        .eq("notify_hour", jstHour);

    if (error) {
        console.error("Failed to fetch subscriptions:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
        return NextResponse.json({ sent: 0, message: "No subscribers at this time" });
    }

    const payload = JSON.stringify({
        title: "てきとー日記",
        body: "今日の日記を書いていますか？📝",
        url: "/diary",
    });

    const results = await Promise.allSettled(
        subscriptions.map((sub: any) =>
            webpush.sendNotification(
                {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth,
                    },
                },
                payload
            ).catch(async (err: any) => {
                // 購読が無効（410 Gone）なら削除
                if (err.statusCode === 410) {
                    await adminSupa
                        .from("notification_subscriptions")
                        .delete()
                        .eq("user_id", sub.user_id);
                }
                throw err;
            })
        )
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({ sent, failed });
}
