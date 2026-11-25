const CACHE_NAME = 'alisms-pwa-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Web Push Notification listener (works when app is in background or closed)
self.addEventListener('push', (event) => {
  let payload = {
    title: 'alisim',
    body: 'لديك إشعار جديد',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: 'alisim-push',
    url: '/',
  };
  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    }
  } catch {
    if (event.data) {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      tag: payload.tag,
      vibrate: [140, 60, 140],
      data: { url: payload.url || '/' },
    })
  );
});

// Client-triggered OS notification via Service Worker (for reliable background/PWA alerts)
self.addEventListener('message', (event) => {
  const data = event.data;
  if (data && data.type === 'SHOW_PUSH_NOTIFICATION') {
    const title = String(data.title || 'alisim');
    const body = String(data.body || '');
    const icon = String(data.icon || '/pwa-192x192.png');
    const tag = String(data.tag || `alisim-${Date.now()}`);
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon,
        badge: '/pwa-192x192.png',
        tag,
        vibrate: [120, 50, 120],
        data: { url: data.url || '/' },
      })
    );
  }
});

// Focus or open app when user taps a push notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
