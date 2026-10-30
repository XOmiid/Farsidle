'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Shell from './Shell';
import { useArcade } from './Provider';
import { GAMES } from '@/lib/classic/catalog';
import { leaderboard, isLocal } from '@/lib/classic/gateway';
import { Icon } from './Art';
import { fa, iranTime } from '@/lib/classic/rules.mjs';
function PlayerRow({ entry, index, game }) {
  return (
    <div className="leaderboard-row">
      <span className="leaderboard-rank">
        {game === 'wordle' && !entry.won
          ? fa(index + 1)
          : ['🥇', '🥈', '🥉'][index] || fa(index + 1)}
      </span>
      <span className="leaderboard-avatar">{entry.avatar || '◉'}</span>
      <div className="leaderboard-player">
        <strong>{entry.name}</strong>
        {entry.self && <small> · تو</small>}
        {entry.pending && <small className="pending-note">در انتظار بازیکن تیم مقابل</small>}
        {game === 'wordle' && entry.submittedAt && (
          <time className="submission-time" dateTime={entry.submittedAt}>
            {iranTime(entry.submittedAt)}
          </time>
        )}
      </div>
      {game === 'wordle' ? (
        <span
          className={'wordle-result ' + (entry.won ? 'success' : 'failure')}
          role="img"
          aria-label={entry.won ? 'کلمه پیدا شد' : 'کلمه پیدا نشد'}
        >
          <Icon name={entry.won ? 'check' : 'close'} size={25} />
        </span>
      ) : (
        <span className="score-tag">
          {fa(entry.score)} / {fa(entry.max)}
        </span>
      )}
    </div>
  );
}
function TeamBoards({ entries }) {
  return (
    <div className="team-boards">
      {[
        ['coral', 'تیم قرمز'],
        ['blue', 'تیم آبی'],
      ].map(([team, label]) => {
        const members = entries.rows.filter(
          (e) => e.team === team || (team === 'coral' && e.team === 'red'),
        );
        return (
          <section className={'team-board team-' + team} key={team} aria-label={label}>
            <header className="team-board-heading">
              <h2>
                <i aria-hidden="true" />
                {label}
              </h2>
              <div>
                <strong>{fa(entries.totals?.[team] ?? 0)}</strong>
                <small>امتیاز تیم</small>
              </div>
            </header>
            <div className="team-members">
              {members.length ? (
                members.map((entry, i) => (
                  <PlayerRow key={entry.name + ':' + i} entry={entry} index={i} game="teamdle" />
                ))
              ) : (
                <p className="empty-state">هنوز بازیکنی در این تیم بازی نکرده است.</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
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
      <div className={'leaderboard-wrap' + (game === 'teamdle' ? ' team-leaderboard' : '')}>
        <div className="page-heading">
          <div className="eyebrow">نتایج امروز</div>
          <h1>جدول امتیازها</h1>
          <p>
            {game === 'wordle'
              ? 'پاسخ‌های درست بر اساس زمان ثبت، سپس پاسخ‌های نادرست.'
              : 'امتیاز بازیکنان در بازی‌های امروز.'}
          </p>
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
        <section className={game === 'teamdle' ? 'team-results' : 'profile-card theme-blue'}>
          {error ? (
            <p className="game-error" role="alert">
              {error}
            </p>
          ) : entries?.game !== game ? (
            <div className="loading-state">
              <i className="loading-dot" />
              در حال بارگذاری…
            </div>
          ) : game === 'teamdle' ? (
            <TeamBoards entries={entries} />
          ) : entries.rows.length ? (
            entries.rows.map((entry, i) => (
              <PlayerRow key={entry.name + ':' + i} entry={entry} index={i} game={game} />
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
