'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fa } from '@/lib/classic/rules.mjs';
export function useNow() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, []);
  return now;
}
export function Access({ returnTo = '/galactic' }) {
  return (
    <section className="g-panel g-access">
      <span className="g-kicker">ورود به زمین</span>
      <h2>با حساب فارسیدل بازی کن</h2>
      <p>برای ساخت اتاق، انتخاب تیم و شرکت در مسابقات وارد حساب شو.</p>
      <div className="g-actions">
        <Link className="button ink-button" href={'/login?next=' + encodeURIComponent(returnTo)}>
          ورود
        </Link>
        <Link className="button" href={'/register?next=' + encodeURIComponent(returnTo)}>
          ساخت حساب
        </Link>
      </div>
    </section>
  );
}
export function Pitch({ formation, players = [], selected, onSelect, config, compact = false }) {
  const slots = config.formations[formation]?.slots || [];
  return (
    <div className={'g-pitch' + (compact ? ' g-pitch-compact' : '')} aria-label="چیدمان تیم">
      <div className="g-pitch-mid" />
      <div className="g-pitch-circle" />
      <div className="g-box g-box-top" />
      <div className="g-box g-box-bottom" />
      {slots.map((s) => {
        const p = players.find((p) => p.slot === s.id),
          label = p ? p.name : config.roles[s.role];
        const content = (
          <>
            <span className={'g-shirt' + (p?.fit < 1 ? ' g-penalty' : '')}>
              {p ? fa(p.effective) : s.role}
            </span>
            <span className="g-player-name" dir="auto">
              {label}
            </span>
            {p?.fit < 1 && <small className="g-fit">−{fa(Math.round((1 - p.fit) * 100))}٪</small>}
          </>
        );
        return onSelect ? (
          <button
            key={s.id}
            type="button"
            className={'g-position' + (selected === s.id ? ' selected' : '')}
            style={{ left: s.x + '%', top: s.y + '%' }}
            onClick={() => onSelect(s.id)}
            aria-pressed={selected === s.id}
            aria-label={config.roles[s.role] + ': ' + label}
          >
            {content}
          </button>
        ) : (
          <div key={s.id} className="g-position" style={{ left: s.x + '%', top: s.y + '%' }}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
export const phaseLabel = {
  lobby: 'آماده‌سازی',
  draft: 'انتخاب بازیکن',
  tournament: 'مسابقات',
  finished: 'پایان مسابقات',
};
