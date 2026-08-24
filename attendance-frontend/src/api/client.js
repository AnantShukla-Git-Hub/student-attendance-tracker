import axios from 'axios'

// Locally: uses the '/api' Vite proxy (see vite.config.js) → talks to localhost:8000.
// In production (GitHub Pages, Vercel, etc.): set VITE_API_URL to your deployed
// backend's full URL, e.g. https://your-app.onrender.com
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

// attach token to every request automatically
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// if token is invalid/expired, kick back to login
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default client