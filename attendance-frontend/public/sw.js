// Service worker for Web Push notifications.
// Runs in the background even when no tab is open.

const DB_NAME = 'attendance-sw-db'
const STORE_NAME = 'auth'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function getToken() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get('token')
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

async function getApiUrl() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get('apiUrl')
    req.onsuccess = () => resolve(req.result || '/api')
    req.onerror = () => reject(req.error)
  })
}

self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()

  const title = data.subject_name || data.title || 'Class reminder'
  const body = data.subject_code
    ? `${data.subject_code} — mark your attendance`
    : 'Mark your attendance'

  const options = {
    body,
    tag: `slot-${data.timetable_id}-${data.date}`,
    data,
    // Chrome and Edge only display a maximum of 2 action buttons — a 3rd is
    // silently dropped. Keeping the two most common actions here; "Cancelled"
    // can still be marked by opening the app (tap the notification body).
    actions: [
      { action: 'attended', title: '\u2713 Attended' },
      { action: 'not_attended', title: '\u2717 Not attended' },
    ],
    requireInteraction: true,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const action = event.action // 'attended' | 'not_attended' | '' (body click)
  const data = event.notification.data

  if (!action) {
    // body click (not an action button) — open the app so the user can
    // mark it manually, including "Cancelled" which has no button here
    event.waitUntil(
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientsList) => {
          for (const client of clientsList) {
            if ('focus' in client) {
              client.navigate('/attendance')
              return client.focus()
            }
          }
          return self.clients.openWindow('/attendance')
        })
    )
    return
  }

  event.waitUntil(
    (async () => {
      const token = await getToken()
      if (!token) return
      const apiUrl = await getApiUrl()

      await fetch(`${apiUrl}/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject_id: data.subject_id,
          timetable_id: data.timetable_id,
          date: data.date,
          status: action,
        }),
      }).catch(() => {
        // silently ignore — user can still mark it manually in the app
      })
    })()
  )
})