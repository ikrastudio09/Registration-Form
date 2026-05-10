/**
 * Tournament Header — Server Component
 */
export default function TournamentHeader() {
  return (
    <header className="text-center pt-12 pb-8 px-4 relative">
      {/* Decorative top line */}
      <div className="flex items-center gap-3 justify-center mb-8">
        <div className="h-px flex-1 max-w-20" style={{ background: 'linear-gradient(to right, transparent, rgba(245,158,11,0.4))' }} />
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24', fontFamily: 'var(--font-accent)', textTransform: 'uppercase' }}>
          <span>🏆</span> Season 2026
        </div>
        <div className="h-px flex-1 max-w-20" style={{ background: 'linear-gradient(to left, transparent, rgba(245,158,11,0.4))' }} />
      </div>

      {/* Main title */}
      <div className="relative inline-block">
        <h1
          className="text-6xl sm:text-7xl md:text-8xl font-bold tracking-widest"
          style={{
            fontFamily: 'var(--font-display)',
            background: 'linear-gradient(135deg, #e8f5e9 0%, #ffffff 40%, #e8f5e9 70%, #a7f3d0 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1.05,
          }}
        >
          Crazy Cricket
        </h1>
        <div
          className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-[0.4em] text-gold-shimmer"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          League
        </div>
      </div>

      {/* Cricket bat decorative icon */}
      <div className="text-5xl my-4 animate-float inline-block">🏏</div>

      {/* Subtitle */}
      <p
        className="text-base sm:text-lg max-w-lg mx-auto mt-2"
        style={{ color: 'rgba(232,245,233,0.55)', fontFamily: 'var(--font-body)', fontWeight: 300, lineHeight: 1.6 }}
      >
        This time with more crazy rules and more madness more power and more cricket
      </p>

      {/* Stats row */}
      <div className="flex items-center justify-center gap-8 mt-8">
        {[
          { value: '₹750', label: 'Entry Fee' },
          { value: '11', label: 'Players/Team' },
          { value: '🏆', label: 'Grand Prize' },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col items-center gap-0.5">
            <span
              className="text-xl font-bold"
              style={{ fontFamily: 'var(--font-display)', color: '#fbbf24', letterSpacing: '0.05em' }}
            >
              {stat.value}
            </span>
            <span className="text-xs" style={{ color: 'var(--color-text-dim)', fontFamily: 'var(--font-accent)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '9px' }}>
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="mt-10 h-px max-w-2xl mx-auto" style={{ background: 'linear-gradient(to right, transparent, rgba(34,197,94,0.2), rgba(245,158,11,0.2), rgba(34,197,94,0.2), transparent)' }} />
    </header>
  );
}
