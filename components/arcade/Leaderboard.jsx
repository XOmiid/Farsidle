'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Shell from './Shell';
import { useArcade } from './Provider';
import { GAMES } from '@/lib/classic/catalog';
import { leaderboard, isLocal } from '@/lib/classic/gateway';
import { fa } from '@/lib/classic/rules.mjs';
export default function Leaderboard({ initialGame = 'wordle' }) {
  const [game, setGame] = useState(
      GAMES.some((g) => g.id === initialGame) ? initialGame : 'wordle',
    ),
    [entries, setEntries] = useState(null),
    [error, setError] = useState('');
  const { day } = useArcade();
  useEffect(() => {
    let alive = true;
    leaderboard(game)
      .then((data) => {
        if (alive) {
          setEntries({
            game,
            rows: Array.isArray(data) ? data : data.entries,
            totals: data.totals,
          });
          setError('');
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [game, day]);
  return (
    <Shell>
      <div className="leaderboard-wrap">
        <div className="page-heading">
          <div className="eyebrow">نتایج امروز</div>
          <h1>جدول امتیازها</h1>
          <p>امتیاز بازیکنان در بازی‌های امروز.</p>
        </div>
        <div className="collection-filters" role="group" aria-label="انتخاب جدول بازی">
          {GAMES.filter((g) => g.id !== 'crossword').map((g) => (
            <button
              key={g.id}
              aria-pressed={game === g.id}
              className={game === g.id ? 'selected' : ''}
              onClick={() => setGame(g.id)}
            >
              {g.name}
            </button>
          ))}
        </div>
        {game === 'teamdle' && entries?.game === game && entries.totals && (
          <div className="team-totals">
            <div>
              <span>🔴 تیم مرجانی</span>
              <strong>{fa(entries.totals.coral)}</strong>
            </div>
            <div>
              <span>🔵 تیم آبی</span>
              <strong>{fa(entries.totals.blue)}</strong>
            </div>
          </div>
        )}
        <section className="profile-card theme-blue">
          {error ? (
            <p className="game-error" role="alert">
              {error}
            </p>
          ) : entries?.game !== game ? (
            <div className="loading-state">
              <i className="loading-dot" />
              در حال بارگذاری…
            </div>
          ) : entries.rows.length ? (
            entries.rows.map((entry, i) => (
              <div className="leaderboard-row" key={i}>
                <span className="leaderboard-rank">{['🥇', '🥈', '🥉'][i] || fa(i + 1)}</span>
                <span className="leaderboard-avatar">{entry.avatar || '◉'}</span>
                <div>
                  <strong>{entry.name}</strong>
                  {entry.self && <small> · تو</small>}
                  {entry.pending && <small> · در انتظار همتا</small>}
                </div>
                <span className="score-tag">
                  {fa(entry.score)} / {fa(entry.max)}
                </span>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <div className="empty-rule" aria-hidden="true" />
              <p>هنوز امتیازی برای امروز ثبت نشده است.</p>
              <Link
                href={'/classic/' + game}
                className="button secondary-button"
                style={{ marginTop: 20 }}
              >
                شروع بازی
              </Link>
            </div>
          )}
        </section>
        {isLocal && (
          <p className="local-note">
            <strong>نتایج این دستگاه</strong>در پیش‌نمایش، بازیکن ساختگی نمایش نمی‌دهیم. جدول رقابت
            با دیگران پس از اتصال نسخهٔ جدید به سرور در دسترس است.
          </p>
        )}
        {!isLocal && game === 'teamdle' && (
          <p className="center-note">
            فقط امتیاز جایگاه‌هایی که هر دو تیم بازی کرده‌اند، در جمع تیم حساب می‌شود.
          </p>
        )}
      </div>
    </Shell>
  );
}
