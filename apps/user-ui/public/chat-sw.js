self.addEventListener('push', event => {
 const data = event.data ? event.data.json() : {};
 event.waitUntil(self.registration.showNotification(data.title || 'Eshop', { body: data.body || 'New message', data: { url: data.url || '/inbox' } }));
});
self.addEventListener('notificationclick', event => {
 event.notification.close();
 const path = event.notification.data?.url || '/inbox';
 const url = new URL(path, self.location.origin);
 if (url.origin === self.location.origin) event.waitUntil(clients.openWindow(url.href));
});