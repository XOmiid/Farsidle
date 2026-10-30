'use client';
import { useState } from 'react';
import Link from 'next/link';
import Shell from './Shell';
import GameArt, { Icon } from './Art';
import { GAMES } from '@/lib/classic/catalog';
import { useArcade, useCountdown } from './Provider';
import { fa, countdown } from '@/lib/classic/rules.mjs';
export default function Collection() {
  const [filter, setFilter] = useState('all');
  const { player, day } = useArcade(),
    timer = useCountdown();
  const groups = {
    all: GAMES.map((g) => g.id),
    words: ['wordle', 'crossword'],
    world: ['factle', 'teamdle'],
    senses: ['colordle', 'chordle', 'memorydle'],
  };
  return (
    <Shell back="/" title="خانهٔ فارسیدل">
      <section className="collection-heading">
        <div>
          <div className="eyebrow">مجموعهٔ اول</div>
          <h1>
            فارسیدل <span className="text-coral">کلاسیک</span>
          </h1>
          <p>هفت بازی روزانه، در یک مجموعه.</p>
        </div>
        <div className="reset-chip">
          <span className="live-dot" />
          چالش‌های بعدی<b dir="ltr">{timer === null ? '—' : countdown(timer)}</b>
        </div>
      </section>
      <div className="collection-filters" role="group" aria-label="دسته‌بندی بازی‌ها">
        {[
          ['all', 'همهٔ بازی‌ها'],
          ['words', 'کلمه و جدول'],
          ['world', 'جغرافیا'],
          ['senses', 'حواس و حافظه'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={filter === id ? 'selected' : ''}
            aria-pressed={filter === id}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="games-grid">
        {GAMES.filter((g) => groups[filter].includes(g.id)).map((g, i) => {
          const result = player?.results?.find((r) => r.game === g.id && r.date === day);
          const streak = player?.streaks?.[g.id]?.count || 0;
          return (
            <Link href={'/classic/' + g.id} className={'game-card theme-' + g.color} key={g.id}>
              <div className="game-card-art">
                <span className="game-index">{fa(String(i + 1).padStart(2, '0'))}</span>
                <GameArt type={g.icon} />
                <span className="game-audience">{g.label}</span>
              </div>
              <div className="game-card-copy">
                <div className="game-title-row">
                  <h2>{g.name}</h2>
                  {result ? (
                    <span className="done-badge">
                      <Icon name="check" size={13} />
                      انجام شد
                    </span>
                  ) : streak > 1 ? (
                    <span className="streak">🔥 {fa(streak)}</span>
                  ) : null}
                </div>
                <span className="game-category">{g.category}</span>
                <p>{g.description}</p>
                <div className="game-card-bottom">
                  <span>◷ {g.duration}</span>
                  <strong>
                    {result ? 'دیدن نتیجه' : 'شروع بازی'}
                    <Icon name="arrow" size={17} />
                  </strong>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <p className="collection-footnote">
        بازی‌های روزانه هر شب ساعت ۹ به وقت ایران به‌روز می‌شوند.
      </p>
    </Shell>
  );
}
