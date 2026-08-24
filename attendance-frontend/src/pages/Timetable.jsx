import { useEffect, useState } from 'react'
import * as api from '../api/endpoints'
import GlassCard from '../components/GlassCard'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function Timetable() {
  const [subjects, setSubjects] = useState([])
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [subjectId, setSubjectId] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState('0')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    const [subjectsRes, slotsRes] = await Promise.all([
      api.getSubjects(),
      api.getTimetable(),
    ])
    setSubjects(subjectsRes.data)
    setSlots(slotsRes.data)
    if (subjectsRes.data.length > 0 && !subjectId) {
      setSubjectId(String(subjectsRes.data[0].id))
    }
    setLoading(false)
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setError('')
    if (!subjectId) {
      setError('Add a subject first')
      return
    }
    try {
      await api.createTimetableSlot({
        subject_id: Number(subjectId),
        day_of_week: Number(dayOfWeek),
        start_time: `${startTime}:00`,
        end_time: `${endTime}:00`,
      })
      loadAll()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not add slot')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this timetable slot?')) return
    await api.deleteTimetableSlot(id)
    loadAll()
  }

  const subjectName = (id) => subjects.find((s) => s.id === id)?.name || 'Unknown'

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-3xl font-semibold text-[var(--ink)]">
        Timetable
      </h1>
      <p className="mb-6 text-sm text-[var(--ink-soft)]">
        Your weekly recurring class schedule
      </p>

      <GlassCard className="mb-6">
        <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="col-span-2 rounded-xl border border-white/60 bg-white/50 px-3 py-2.5 text-sm outline-none focus:border-[var(--accent-soft)] sm:col-span-1"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(e.target.value)}
            className="rounded-xl border border-white/60 bg-white/50 px-3 py-2.5 text-sm outline-none focus:border-[var(--accent-soft)]"
          >
            {DAYS.map((d, i) => (
              <option key={d} value={i}>{d}</option>
            ))}
          </select>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="rounded-xl border border-white/60 bg-white/50 px-3 py-2.5 text-sm outline-none focus:border-[var(--accent-soft)]"
          />
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="rounded-xl border border-white/60 bg-white/50 px-3 py-2.5 text-sm outline-none focus:border-[var(--accent-soft)]"
          />
          <button
            type="submit"
            className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Add
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}
      </GlassCard>

      {loading ? (
        <p className="text-sm text-[var(--ink-soft)]">Loading...</p>
      ) : (
        <div className="flex flex-col gap-4">
          {DAYS.map((day, i) => {
            const daySlots = slots
              .filter((s) => s.day_of_week === i)
              .sort((a, b) => a.start_time.localeCompare(b.start_time))
            if (daySlots.length === 0) return null
            return (
              <div key={day}>
                <h3 className="mb-2 text-sm font-semibold text-[var(--ink-soft)]">
                  {day}
                </h3>
                <div className="flex flex-col gap-2">
                  {daySlots.map((s) => (
                    <GlassCard key={s.id} className="flex items-center justify-between !p-4">
                      <div>
                        <p className="font-medium text-[var(--ink)]">
                          {subjectName(s.subject_id)}
                        </p>
                        <p className="text-xs text-[var(--ink-soft)]">
                          {s.start_time.slice(0, 5)} – {s.end_time?.slice(0, 5)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="text-sm font-medium text-[var(--danger)] hover:opacity-70"
                      >
                        Delete
                      </button>
                    </GlassCard>
                  ))}
                </div>
              </div>
            )
          })}
          {slots.length === 0 && (
            <GlassCard>
              <p className="text-sm text-[var(--ink-soft)]">
                No slots yet — add your weekly schedule above.
              </p>
            </GlassCard>
          )}
        </div>
      )}
    </div>
  )
}