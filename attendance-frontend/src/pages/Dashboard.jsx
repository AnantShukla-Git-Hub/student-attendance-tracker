import { useEffect, useState } from 'react'
import * as api from '../api/endpoints'
import GlassCard from '../components/GlassCard'
import Footer from '../components/Footer'

export default function Dashboard() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: subjects } = await api.getSubjects()
      const withPercentage = await Promise.all(
        subjects.map(async (subject) => {
          const { data: stats } = await api.getSubjectPercentage(subject.id)
          return { ...subject, ...stats }
        })
      )
      setRows(withPercentage)
    } finally {
      setLoading(false)
    }
  }

  const overall =
    rows.length > 0
      ? (
          rows.reduce((sum, r) => sum + r.percentage, 0) / rows.length
        ).toFixed(2)
      : null

  const percentColor = (p) => {
    if (p >= 75) return 'text-[var(--accent)]'
    if (p >= 50) return 'text-amber-600'
    return 'text-[var(--danger)]'
  }

  const insightText = (r) => {
    if (r.total_classes === 0) return 'No classes marked yet'
    if (!r.target_achievable) return `Target ${r.target_percentage}% is no longer reachable`
    if (r.percentage >= r.target_percentage) {
      return r.classes_can_skip_and_stay_on_target > 0
        ? `Can skip ${r.classes_can_skip_and_stay_on_target} class${r.classes_can_skip_and_stay_on_target > 1 ? 'es' : ''} and stay at ${r.target_percentage}%`
        : `Right at the ${r.target_percentage}% line — don't miss more`
    }
    return `Attend next ${r.classes_needed_to_reach_target} class${r.classes_needed_to_reach_target > 1 ? 'es' : ''} to reach ${r.target_percentage}%`
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-3xl font-semibold text-[var(--ink)]">
        Dashboard
      </h1>
      <p className="mb-6 text-sm text-[var(--ink-soft)]">
        Your attendance overview across all subjects
      </p>

      {loading ? (
        <p className="text-sm text-[var(--ink-soft)]">Loading...</p>
      ) : rows.length === 0 ? (
        <GlassCard>
          <p className="text-sm text-[var(--ink-soft)]">
            No subjects yet. Add one from the Subjects tab to get started.
          </p>
        </GlassCard>
      ) : (
        <>
          <GlassCard className="mb-6">
            <p className="text-sm text-[var(--ink-soft)]">
              Overall attendance
            </p>
            <p className={`text-4xl font-semibold ${percentColor(Number(overall))}`}>
              {overall}%
            </p>
          </GlassCard>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {rows.map((r) => (
              <GlassCard key={r.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-[var(--ink)]">
                      {r.name}
                    </h2>
                    {r.code && (
                      <p className="text-xs text-[var(--ink-soft)]">{r.code}</p>
                    )}
                  </div>
                  <span className={`text-xl font-semibold ${percentColor(r.percentage)}`}>
                    {r.percentage}%
                  </span>
                </div>
                <p className="mt-3 text-xs text-[var(--ink-soft)]">
                  {r.attended_classes} / {r.total_classes} classes attended
                </p>
                <p className="mt-2 text-xs font-medium text-[var(--accent)]">
                  {insightText(r)}
                </p>
              </GlassCard>
            ))}
          </div>
        </>
      )}
      <Footer />
    </div>
  )
}