import client from '../api/client'

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

// Store the JWT where the service worker can read it too (SW has no access to localStorage).
export async function saveTokenForServiceWorker(token) {
  try {
    const db = await openDb()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(token, 'token')
  } catch {
    // IndexedDB unavailable — push action buttons just won't work, rest of app is unaffected
  }
}

// Store the API base URL too — sw.js can't read Vite env vars (it's a static file,
// not processed by the build), so we hand it the URL this way instead.
export async function saveApiUrlForServiceWorker() {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || '/api'
    const db = await openDb()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(apiUrl, 'apiUrl')
  } catch {
    // ignore
  }
}

export async function clearTokenForServiceWorker() {
  try {
    const db = await openDb()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete('token')
  } catch {
    // ignore
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  return navigator.serviceWorker.register('/sw.js')
}

export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'unsupported' }
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return { ok: false, reason: 'denied' }
  }

  const registration = await navigator.serviceWorker.ready

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    const { data } = await client.get('/push/vapid-public-key')
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.public_key),
    })
  }

  const subJson = subscription.toJSON()
  await client.post('/push/subscribe', {
    endpoint: subJson.endpoint,
    keys: subJson.keys,
  })

  return { ok: true }
}