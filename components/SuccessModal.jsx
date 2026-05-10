'use client';

import { useEffect } from 'react';

/**
 * Success Modal
 * Shown after successful registration
 */
export default function SuccessModal({ player, onClose }) {
  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', animation: 'fadeIn 0.3s ease-out' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative w-full max-w-md rounded-3xl overflow-hidden animate-scale-in"
        style={{
          background: 'linear-gradient(145deg, #0d1f12, #0a1508)',
          border: '1px solid rgba(34,197,94,0.3)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 60px rgba(34,197,94,0.1)',
        }}
      >
        {/* Top green glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 opacity-30 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(34,197,94,0.5) 0%, transparent 70%)' }}
        />

        {/* Content */}
        <div className="relative p-8 flex flex-col items-center text-center gap-5">
          {/* Success Icon */}
          <div className="relative">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-5xl"
              style={{
                background: 'rgba(34,197,94,0.1)',
                border: '2px solid rgba(34,197,94,0.3)',
                boxShadow: '0 0 40px rgba(34,197,94,0.2)',
                animation: 'float 3s ease-in-out infinite',
              }}
            >
              🏏
            </div>
            {/* Check badge */}
            <div
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: '#22c55e', boxShadow: '0 4px 12px rgba(34,197,94,0.5)' }}
            >
              <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
                <path d="M1 5.5L5 9.5L13 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* Heading */}
          <div>
            <h2
              className="text-3xl font-bold"
              style={{
                fontFamily: 'var(--font-display)',
                letterSpacing: '0.05em',
                background: 'linear-gradient(135deg, #4ade80, #22c55e)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              YOU'RE IN!
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Registration submitted successfully
            </p>
          </div>

          {/* Player Details Card */}
          {player && (
            <div
              className="w-full rounded-2xl p-4 text-left"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="flex items-center gap-3 mb-4">
                {player.playerPhoto && (
                  <img
                    src={player.playerPhoto}
                    alt={player.name}
                    className="w-12 h-12 rounded-xl object-cover"
                    style={{ border: '2px solid rgba(34,197,94,0.3)' }}
                  />
                )}
                <div>
                  <p className="font-semibold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-accent)' }}>
                    {player.name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
                    {player.role}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <DetailRow label="Transaction ID" value={player.transactionId} highlight />
                <DetailRow label="Status" value="Pending Review" statusPending />
                <DetailRow label="Playing Style" value={player.playingStyle?.join(', ')} />
              </div>
            </div>
          )}

          {/* Info */}
          <p className="text-xs px-4" style={{ color: 'var(--color-text-dim)', lineHeight: 1.6 }}>
            Your registration is under review. We'll contact you on your registered mobile number once approved.
          </p>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:opacity-90 active:scale-98"
            style={{
              background: 'linear-gradient(135deg, #16a34a, #22c55e)',
              color: '#fff',
              fontFamily: 'var(--font-accent)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              boxShadow: '0 8px 24px rgba(34,197,94,0.3)',
            }}
          >
            Register Another Player
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, highlight, statusPending }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs" style={{ color: 'var(--color-text-dim)', fontFamily: 'var(--font-accent)', textTransform: 'uppercase', fontSize: '9px', letterSpacing: '0.08em' }}>
        {label}
      </span>
      <span
        className="text-xs font-medium"
        style={{
          color: highlight ? '#fbbf24' : statusPending ? '#fb923c' : 'var(--color-text)',
          fontFamily: highlight ? 'monospace' : 'inherit',
        }}
      >
        {value || '—'}
      </span>
    </div>
  );
}
