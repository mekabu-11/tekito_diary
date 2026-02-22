"use client";

import { Bell, BellOff, Check, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

interface Props {
    onClose: () => void;
}

export default function NotificationSettings({ onClose }: Props) {
    const [supported, setSupported] = useState(false);
    const [permission, setPermission] = useState<NotificationPermission>("default");
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [notifyHour, setNotifyHour] = useState(21);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const init = async () => {
            if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
                setSupported(false);
                setLoading(false);
                return;
            }
            setSupported(true);
            setPermission(Notification.permission);

            // サービスワーカーを登録
            const reg = await navigator.serviceWorker.register("/sw.js");
            await reg.update();

            // 既存の購読情報を取得
            const res = await fetch("/api/notifications/subscribe");
            if (res.ok) {
                const data = await res.json();
                if (data.subscription?.endpoint) {
                    setIsSubscribed(true);
                    setNotifyHour(data.subscription.notify_hour ?? 21);
                }
            }
            setLoading(false);
        };
        init();
    }, []);


    const saveSubscription = async (subscription: PushSubscription) => {
        setSaving(true);
        const sub = subscription.toJSON();
        await fetch("/api/notifications/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                subscription: { endpoint: sub.endpoint, keys: sub.keys },
                notifyHour,
                notifyMinute: 0,
            }),
        });
        setIsSubscribed(true);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        setSaving(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const reg = await navigator.serviceWorker.ready;
            let subscription = await reg.pushManager.getSubscription();
            if (!subscription) {
                if (permission !== "granted") {
                    const perm = await Notification.requestPermission();
                    setPermission(perm);
                    if (perm !== "granted") { setSaving(false); return; }
                }
                subscription = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
                });
            }
            await saveSubscription(subscription);
        } catch (e) {
            console.error("Save failed:", e);
        }
        setSaving(false);
    };

    const handleUnsubscribe = async () => {
        setSaving(true);
        try {
            const reg = await navigator.serviceWorker.ready;
            const subscription = await reg.pushManager.getSubscription();
            if (subscription) await subscription.unsubscribe();
            await fetch("/api/notifications/subscribe", { method: "DELETE" });
            setIsSubscribed(false);
        } catch (e) {
            console.error("Unsubscribe failed:", e);
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 sm:items-center">
            <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bell size={20} className="text-emerald-500" />
                        <h2 className="font-extrabold text-gray-800">通知設定</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 transition">
                        <X size={18} className="text-gray-400" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-6">
                        <Loader2 size={24} className="animate-spin text-emerald-400" />
                    </div>
                ) : !supported ? (
                    <div className="text-center py-4">
                        <p className="text-sm text-gray-500">
                            このブラウザはプッシュ通知に対応していません。<br />
                            ホーム画面に追加したPWAからご利用ください。
                        </p>
                    </div>
                ) : (
                    <>
                        {/* 通知の説明 */}
                        <p className="text-xs text-gray-500 leading-relaxed">
                            毎日設定した時刻に「日記を書こう」と通知が届きます。
                        </p>

                        {/* 時刻設定 */}
                        <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                            <p className="text-xs font-bold text-gray-600">通知時刻</p>
                            <select
                                value={notifyHour}
                                onChange={(e) => setNotifyHour(Number(e.target.value))}
                                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:ring-2 focus:ring-emerald-400"
                            >
                                {Array.from({ length: 24 }, (_, i) => (
                                    <option key={i} value={i}>{i}時に通知</option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-400">
                                設定中: 毎日 {notifyHour}:00 に通知が届きます
                            </p>
                        </div>

                        {/* 権限状態 */}
                        {permission === "denied" && (
                            <p className="text-xs text-red-500 bg-red-50 rounded-xl p-3">
                                通知がブロックされています。ブラウザの設定から許可してください。
                            </p>
                        )}

                        {/* ボタン */}
                        <div className="flex gap-2">
                            {permission !== "denied" && (
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                                >
                                    {saving ? (
                                        <Loader2 size={15} className="animate-spin" />
                                    ) : saved ? (
                                        <><Check size={15} /> 保存済み</>
                                    ) : (
                                        <><Bell size={15} /> {isSubscribed ? "時刻を更新" : "通知を許可"}</>
                                    )}
                                </button>
                            )}
                            {isSubscribed && (
                                <button
                                    onClick={handleUnsubscribe}
                                    disabled={saving}
                                    className="px-4 py-3 rounded-xl bg-gray-100 text-gray-500 font-bold text-sm hover:bg-red-50 hover:text-red-500 transition disabled:opacity-50 flex items-center gap-1"
                                >
                                    <BellOff size={15} />
                                    解除
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
