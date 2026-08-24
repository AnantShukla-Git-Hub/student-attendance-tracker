import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import { registerServiceWorker, saveApiUrlForServiceWorker } from './push/pushClient'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Subjects from './pages/Subjects'
import Timetable from './pages/Timetable'
import Attendance from './pages/Attendance'

export default function App() {
  useEffect(() => {
    registerServiceWorker()
    saveApiUrlForServiceWorker()
  }, [])

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/subjects" element={<Subjects />} />
            <Route path="/timetable" element={<Timetable />} />
            <Route path="/attendance" element={<Attendance />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}