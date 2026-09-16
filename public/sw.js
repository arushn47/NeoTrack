// Where's My Offer Service Worker — Web Push Notification Handler

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function (event) {
  if (!event.data) {
    console.log('[SW] Push event received without data');
    return;
  }

  try {
    const payload = event.data.json();
    const title = payload.title || "Where's My Offer?";
    const options = {
      body: payload.body || '',
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/icon-192.png',
      tag: payload.tag || 'wmo-alert',
      renotify: true,
      data: payload.data || { url: '/' },
      vibrate: [200, 100, 200],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('[SW] Error displaying push notification:', err);
    // Fallback for plain text push data
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification("Where's My Offer?", {
        body: text,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
      })
    );
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const targetUrl =
    event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : '/';

  // Absolute URL resolution
  const fullUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clientList) {
        // If an open window exists on this origin, focus it and navigate
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            client.navigate(fullUrl);
            return client.focus();
          }
        }
        // Otherwise, open a new window
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      })
  );
});

