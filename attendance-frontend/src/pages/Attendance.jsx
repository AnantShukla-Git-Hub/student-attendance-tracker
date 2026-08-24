import { useEffect, useState, useMemo } from 'react'
import * as api from '../api/endpoints'
import GlassCard from '../components/GlassCard'

const STATUS_STYLES = {
  attended: 'bg-[var(--accent-soft)]/20 text-[var(--accent)]',
  not_attended: 'bg-[var(--danger)]/15 text-[var(--danger)]',
  cancelled: 'bg-black/10 text-[var(--ink-soft)]',
}

const STATUS_LABEL = {
  attended: 'Attended',
  not_attended: 'Not attended',
  cancelled: 'Cancelled',
}

// JS Date.getDay(): 0=Sunday..6=Saturday. Backend convention: 0=Monday..6=Sunday.
function toBackendDayOfWeek(dateStr) {
  const jsDay = new Date(dateStr + 'T00:00:00').getDay()
  return jsDay === 0 ? 6 : jsDay - 1
}

export default function Attendance() {
  const [subjects, setSubjects] = useState([])
  const [slots, setSlots] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busySlot, setBusySlot] = useState(null)

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))

  // extra class form state
  const [extraSubjectId, setExtraSubjectId] = useState('')
  const [extraStatus, setExtraStatus] = useState('attended')

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    const [subjectsRes, slotsRes, recordsRes] = await Promise.all([
      api.getSubjects(),
      api.getTimetable(),
      api.getAttendance(),
    ])
    setSubjects(subjectsRes.data)
    setSlots(slotsRes.data)
    setRecords(recordsRes.data)
    if (subjectsRes.data.length > 0 && !extraSubjectId) {
      setExtraSubjectId(String(subjectsRes.data[0].id))
    }
    setLoading(false)
  }

  const subjectName = (id) => subjects.find((s) => s.id === id)?.name || 'Unknown'

  const dayOfWeek = useMemo(() => toBackendDayOfWeek(date), [date])

  const slotsForDay = useMemo(
    () =>
      slots
        .filter((s) => s.day_of_week === dayOfWeek)
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [slots, dayOfWeek]
  )

  const recordFor = (timetableId) =>
    records.find((r) => r.timetable_id === timetableId && r.date === date)

  const handleTick = async (slot, status) => {
    setError('')
    setBusySlot(slot.id)
    try {
      const existing = recordFor(slot.id)
      if (existing && existing.status === status) {
        // clicking the same status again removes the mark
        await api.deleteAttendance(existing.id)
      } else {
        if (existing) await api.deleteAttendance(existing.id)
        await api.markAttendance({
          subject_id: slot.subject_id,
          timetable_id: slot.id,
          date,
          status,
        })
      }
      await loadAll()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not update attendance')
    } finally {
      setBusySlot(null)
    }
  }

  const handleExtraClass = async (e) => {
    e.preventDefault()
    setError('')
    if (!extraSubjectId) {
      setError('Add a subject first')
      return
    }
    try {
      await api.markAttendance({
        subject_id: Number(extraSubjectId),
        timetable_id: null,
        date,
        status: extraStatus,
      })
      loadAll()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not mark attendance')
    }
  }

  const handleDeleteRecord = async (id) => {
    if (!confirm('Delete this attendance record?')) return
    await api.deleteAttendance(id)
    loadAll()
  }

  const extraRecordsForDate = records.filter(
    (r) => r.date === date && r.timetable_id === null
  )

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-3xl font-semibold text-[var(--ink)]">
        Attendance
      </h1>
      <p className="mb-6 text-sm text-[var(--ink-soft)]">
        Tick a class to mark it — tap the same status again to undo
      </p>

      <GlassCard className="mb-6">
        <label className="mb-2 block text-xs font-medium text-[var(--ink-soft)]">
          Date
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border border-white/60 bg-white/50 px-4 py-2.5 text-sm outline-none focus:border-[var(--accent-soft)]"
        />
      </GlassCard>

      {error && (
        <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-[var(--ink-soft)]">Loading...</p>
      ) : slotsForDay.length === 0 ? (
        <GlassCard className="mb-6">
          <p className="text-sm text-[var(--ink-soft)]">
            No classes scheduled for this day.
          </p>
        </GlassCard>
      ) : (
        <div className="mb-6 flex flex-col gap-2">
          {slotsForDay.map((slot) => {
            const existing = recordFor(slot.id)
            const isBusy = busySlot === slot.id
            return (
              <GlassCard key={slot.id} className="flex flex-wrap items-center justify-between gap-3 !p-4">
                <div>
                  <p className="font-medium text-[var(--ink)]">
                    {subjectName(slot.subject_id)}
                  </p>
                  <p className="text-xs text-[var(--ink-soft)]">
                    {slot.start_time.slice(0, 5)} – {slot.end_time?.slice(0, 5)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {['attended', 'not_attended', 'cancelled'].map((s) => {
                    const active = existing?.status === s
                    return (
                      <button
                        key={s}
                        disabled={isBusy}
                        onClick={() => handleTick(slot, s)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-opacity disabled:opacity-50 ${
                          active
                            ? STATUS_STYLES[s]
                            : 'bg-black/5 text-[var(--ink-soft)] hover:bg-black/10'
                        }`}
                      >
                        {STATUS_LABEL[s]}
                      </button>
                    )
                  })}
                </div>
              </GlassCard>
            )
          })}
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold text-[var(--ink-soft)]">
        Extra class (not on timetable)
      </h2>
      <GlassCard className="mb-6">
        <form onSubmit={handleExtraClass} className="flex flex-col gap-3 sm:flex-row">
          <select
            value={extraSubjectId}
            onChange={(e) => setExtraSubjectId(e.target.value)}
            className="flex-1 rounded-xl border border-white/60 bg-white/50 px-3 py-2.5 text-sm outline-none focus:border-[var(--accent-soft)]"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={extraStatus}
            onChange={(e) => setExtraStatus(e.target.value)}
            className="rounded-xl border border-white/60 bg-white/50 px-3 py-2.5 text-sm outline-none focus:border-[var(--accent-soft)]"
          >
            <option value="attended">Attended</option>
            <option value="not_attended">Not attended</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button
            type="submit"
            className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Add
          </button>
        </form>

        {extraRecordsForDate.length > 0 && (
          <div className="mt-4 flex flex-col gap-2 border-t border-white/50 pt-4">
            {extraRecordsForDate.map((r) => (
              <div key={r.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--ink)]">{subjectName(r.subject_id)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status]}`}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteRecord(r.id)}
                  className="text-xs font-medium text-[var(--danger)] hover:opacity-70"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  )
}