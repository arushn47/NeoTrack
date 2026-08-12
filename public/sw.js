// NeoTrack Service Worker — Web Push Notification Handler

self.addEventListener('push', function (event) {
  if (!event.data) {
    console.log('[SW] Push event received without data');
    return;
  }

  try {
    const payload = event.data.json();
    const title = payload.title || 'NeoTrack Notification';
    const options = {
      body: payload.body || '',
      icon: payload.icon || '/favicon.ico',
      badge: payload.badge || '/favicon.ico',
      tag: payload.tag || 'neotrack-alert',
      renotify: true,
      data: payload.data || { url: '/' },
      vibrate: [100, 50, 100],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('[SW] Error displaying push notification:', err);
    // Fallback for plain text push data
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('NeoTrack', {
        body: text,
        icon: '/favicon.ico',
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
