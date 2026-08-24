import { useEffect, useState } from 'react'
import * as api from '../api/endpoints'
import GlassCard from '../components/GlassCard'

export default function Subjects() {
  const [subjects, setSubjects] = useState([])
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [target, setTarget] = useState('75')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadSubjects()
  }, [])

  const loadSubjects = async () => {
    setLoading(true)
    const { data } = await api.getSubjects()
    setSubjects(data)
    setLoading(false)
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) return
    try {
      await api.createSubject({
        name,
        code: code || null,
        target_percentage: target ? Number(target) : 75,
      })
      setName('')
      setCode('')
      setTarget('75')
      loadSubjects()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not add subject')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this subject? Its timetable slots and attendance records will be removed too.')) return
    await api.deleteSubject(id)
    loadSubjects()
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-3xl font-semibold text-[var(--ink)]">
        Subjects
      </h1>
      <p className="mb-6 text-sm text-[var(--ink-soft)]">
        Manage the subjects you're tracking
      </p>

      <GlassCard className="mb-6">
        <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            placeholder="Subject name (e.g. Data Structures)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-xl border border-white/60 bg-white/50 px-4 py-2.5 text-sm outline-none focus:border-[var(--accent-soft)]"
          />
          <input
            type="text"
            placeholder="Code (optional)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-xl border border-white/60 bg-white/50 px-4 py-2.5 text-sm outline-none focus:border-[var(--accent-soft)] sm:w-40"
          />
          <div className="flex items-center gap-2 sm:w-32">
            <input
              type="number"
              min="1"
              max="100"
              placeholder="75"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full rounded-xl border border-white/60 bg-white/50 px-4 py-2.5 text-sm outline-none focus:border-[var(--accent-soft)]"
            />
            <span className="text-sm text-[var(--ink-soft)]">%</span>
          </div>
          <button
            type="submit"
            className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Add
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}
      </GlassCard>

      {loading ? (
        <p className="text-sm text-[var(--ink-soft)]">Loading...</p>
      ) : subjects.length === 0 ? (
        <GlassCard>
          <p className="text-sm text-[var(--ink-soft)]">
            No subjects yet — add your first one above.
          </p>
        </GlassCard>
      ) : (
        <div className="flex flex-col gap-3">
          {subjects.map((s) => (
            <GlassCard key={s.id} className="flex items-center justify-between">
              <div>
                <h2 className="font-medium text-[var(--ink)]">{s.name}</h2>
                {s.code && (
                  <p className="text-xs text-[var(--ink-soft)]">{s.code}</p>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-[var(--ink-soft)]">
                  Target {s.target_percentage}%
                </span>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="text-sm font-medium text-[var(--danger)] hover:opacity-70"
                >
                  Delete
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  )
}