import { createAdminSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

interface SubscriptionRecord {
    id: string;
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
    user_id: string; // for deletion
}

// Vercel Cron または手動テスト用: 毎時 xx:00 に呼ばれる想定
// Cron schedule: "0 * * * *" (毎時0分)
export async function GET(request: NextRequest) {
    // VAPID 設定はリクエスト時に行う（ビルド時に実行するとエラーになるため）
    webpush.setVapidDetails(
        process.env.VAPID_EMAIL!,
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        process.env.VAPID_PRIVATE_KEY!
    );

    // CRON_SECRET で保護
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const adminSupa = await createAdminSupabase();

    // 日本時間の現在の「時」(0-23)を取得して文字列化
    const jstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
    const currentHourStr = String(jstNow.getHours()).padStart(2, "0");

    // notify_time が現在の時のものを取得
    const { data: subscriptions, error } = await adminSupa
        .from("notification_subscriptions")
        .select("*")
        .eq("notify_time", currentHourStr);

    if (error || !subscriptions?.length) {
        return NextResponse.json({ sent: 0, failed: 0, message: "No subscriptions for this hour" });
    }

    const payload = JSON.stringify({
        title: "てきとー日記",
        body: "今日の日記を書いていますか？📝",
        url: "/diary",
    });

    const results = await Promise.allSettled(
        (subscriptions as SubscriptionRecord[]).map((sub) =>
            webpush.sendNotification(
                {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.keys.p256dh,
                        auth: sub.keys.auth,
                    },
                },
                payload
            ).catch(async (err: unknown) => {
                // 購読が無効（410 Gone）なら削除
                const pushError = err as { statusCode?: number };
                if (pushError.statusCode === 410) {
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
