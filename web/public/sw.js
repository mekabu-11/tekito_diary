// Service Worker for PWA Push Notifications

self.addEventListener("install", (event) => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener("push", (event) => {
    if (!event.data) return;

    let data;
    try {
        data = event.data.json();
    } catch {
        data = { title: "てきとー日記", body: event.data.text() };
    }

    const options = {
        body: data.body || "今日の日記を書きましょう！",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: "diary-reminder",
        renotify: true,
        data: { url: data.url || "/diary" },
    };

    event.waitUntil(
        self.registration.showNotification(data.title || "てきとー日記", options)
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = event.notification.data?.url || "/diary";

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(url) && "focus" in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});
