import { createContext, useContext, useState, useEffect } from 'react'
import * as api from '../api/endpoints'
import { saveTokenForServiceWorker, clearTokenForServiceWorker } from '../push/pushClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'))

  // keep the service worker's copy of the token in sync (it can't read localStorage)
  useEffect(() => {
    if (token) {
      saveTokenForServiceWorker(token)
    }
  }, [token])

  const loginUser = async (email, password) => {
    const res = await api.login({ email, password })
    localStorage.setItem('token', res.data.access_token)
    setToken(res.data.access_token)
  }

  const signupUser = async (name, email, password) => {
    await api.signup({ name, email, password })
    // auto-login right after signup
    await loginUser(email, password)
  }

  const logout = () => {
    localStorage.removeItem('token')
    clearTokenForServiceWorker()
    setToken(null)
  }

  return (
    <AuthContext.Provider
      value={{ token, isAuthenticated: !!token, loginUser, signupUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}