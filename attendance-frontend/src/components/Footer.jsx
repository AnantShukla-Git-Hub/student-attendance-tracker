export default function Footer() {
  return (
    <footer className="mx-auto mt-10 max-w-4xl px-4 pb-8 text-xs text-[var(--ink-soft)]">
      <div className="glass rounded-2xl p-4">
        <p className="mb-2 font-medium text-[var(--ink)]">Notification actions</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span>&#10003; Attended — marks the class as attended</span>
          <span>&#10007; Not attended — marks the class as missed</span>
        </div>
        <p className="mt-2 text-[var(--ink-soft)]">
          A class you never mark doesn't count toward your percentage at all — only marked classes are included.
        </p>
      </div>
    </footer>
  )
}