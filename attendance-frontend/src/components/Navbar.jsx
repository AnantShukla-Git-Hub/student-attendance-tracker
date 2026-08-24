import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { subscribeToPush } from '../push/pushClient'

export default function Navbar() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [notifStatus, setNotifStatus] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )

  useEffect(() => {
    // if permission was already granted in a previous session, make sure
    // we still have an active subscription registered with the backend
    if (notifStatus === 'granted') {
      subscribeToPush().catch(() => {})
    }
  }, [])

  const linkClass = ({ isActive }) =>
    `px-4 py-2 rounded-full text-sm font-medium transition-colors ${
      isActive
        ? 'bg-[var(--accent)] text-white'
        : 'text-[var(--ink-soft)] hover:bg-white/40'
    }`

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleEnableNotifications = async () => {
    const result = await subscribeToPush()
    setNotifStatus(
      result.ok ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'default'
    )
  }

  return (
    <nav className="glass sticky top-4 z-10 mx-auto mt-4 flex w-[92%] max-w-4xl flex-wrap items-center justify-between gap-2 rounded-full px-4 py-2">
      <span className="pl-2 text-lg font-semibold text-[var(--ink)]">
        Attendance
      </span>
      <div className="flex flex-wrap items-center gap-1">
        <NavLink to="/" end className={linkClass}>
          Dashboard
        </NavLink>
        <NavLink to="/subjects" className={linkClass}>
          Subjects
        </NavLink>
        <NavLink to="/timetable" className={linkClass}>
          Timetable
        </NavLink>
        <NavLink to="/attendance" className={linkClass}>
          Attendance
        </NavLink>

        {notifStatus !== 'granted' && notifStatus !== 'unsupported' && (
          <button
            onClick={handleEnableNotifications}
            className="rounded-full px-4 py-2 text-sm font-medium text-[var(--accent)] hover:bg-white/40"
          >
            {notifStatus === 'denied' ? 'Notifications blocked' : 'Enable notifications'}
          </button>
        )}

        <button
          onClick={handleLogout}
          className="ml-2 rounded-full px-4 py-2 text-sm font-medium text-[var(--danger)] hover:bg-white/40"
        >
          Logout
        </button>
      </div>
    </nav>
  )
}