'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/arcade/Shell';
import { Icon } from '@/components/arcade/Art';
import { useArcade } from '@/components/arcade/Provider';
import { fa } from '@/lib/classic/rules.mjs';
import {
  positionFit,
  effectiveRating,
  matchClock,
  minuteLabel,
  snakeTurn,
} from '@/lib/galactic/rules.mjs';
import { call, watch } from '@/lib/galactic/gateway';
import { Access, Pitch, useNow, phaseLabel } from './Common';
const leagues = {
  'premier-league': 'انگلستان',
  laliga: 'اسپانیا',
  'ligue-1': 'فرانسه',
  'serie-a': 'ایتالیا',
  bundesliga: 'آلمان',
};
export default function Room({ code }) {
  const { player, notify } = useArcade(),
    router = useRouter(),
    signed = player && !player.local;
  const [room, setRoom] = useState(null),
    [catalog, setCatalog] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [received, setReceived] = useState(0),
    [offset, setOffset] = useState(0);
  const fetching = useRef(false),
    alive = useRef(true);
  const now = useNow();
  const accept = useCallback(
    (data) => {
      if (!alive.current) return;
      setOffset(data.serverNow - Date.now());
      setReceived(Date.now());
      setRoom((old) => (!old || data.serverNow >= old.serverNow ? data : old));
      if (data.notice) notify(data.notice);
      setError('');
    },
    [notify],
  );
  const refresh = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      accept(await call('room', { p_code: code }));
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      fetching.current = false;
    }
  }, [code, accept]);
  useEffect(() => {
    alive.current = true;
    if (!signed) return;
    const initial = setTimeout(refresh, 0),
      timer = setInterval(refresh, 2000);
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      alive.current = false;
      clearTimeout(initial);
      clearInterval(timer);
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [signed, refresh]);
  useEffect(() => {
    if (!room?.datasetVersion) return;
    let keep = true;
    call('catalog', { p_version: room.datasetVersion })
      .then((d) => {
        if (keep) setCatalog(d);
      })
      .catch((e) => {
        if (keep) setError(e.message);
      });
    return () => {
      keep = false;
    };
  }, [room?.datasetVersion]);
  useEffect(() => {
    if (!room?.id) return;
    let stop,
      keep = true;
    watch(room.id, refresh)
      .then((fn) => {
        if (keep) stop = fn;
        else fn();
      })
      .catch(() => {});
    return () => {
      keep = false;
      stop?.();
    };
  }, [room?.id, refresh]);
  async function action(data) {
    if (busy) return;
    setBusy(true);
    try {
      const next = await call('act', { p_code: code, p_action: data });
      if (next.left) router.push('/galactic');
      else accept(next);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function join() {
    setBusy(true);
    try {
      accept(await call('join', { p_code: code }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function invite() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify('لینک دعوت کپی شد.');
    } catch {
      notify('کد اتاق را برای دوستانت بفرست: ' + code);
    }
  }
  const self = room?.members.find((m) => m.self),
    serverNow = now + offset,
    stale = received > 0 && now - received > 10000;
  return (
    <Shell back="/galactic" title="کهکشانی">
      <div className="galactic">
        {!player ? (
          <p role="status">در حال بررسی حساب…</p>
        ) : !signed ? (
          <Access returnTo={'/galactic/room/' + code} />
        ) : !room ? (
          <section className="g-panel">
            <h1>اتاق کهکشانی</h1>
            <p dir="ltr">{code}</p>
            {error ? (
              <>
                <p className="g-error" role="alert">
                  {error}
                </p>
                <button disabled={busy} className="button ink-button" onClick={join}>
                  پیوستن با دعوت
                </button>
              </>
            ) : (
              <p>در حال دریافت اتاق…</p>
            )}
          </section>
        ) : (
          <>
            <header className="g-room-header">
              <div>
                <span className="g-kicker">
                  {phaseLabel[room.phase]} · {room.public ? 'عمومی' : 'خصوصی'}
                </span>
                <h1>{room.title}</h1>
              </div>
              <button className="g-invite" onClick={invite} aria-label="کپی لینک دعوت">
                <span>کد دعوت</span>
                <b dir="ltr">{room.code}</b>
              </button>
            </header>
            <div className="g-connection" role="status">
              <i className={stale ? 'offline' : ''} />
              {stale ? 'اتصال قطع شده؛ در حال تلاش دوباره…' : 'وضعیت مشترک اتاق'}
              <span>
                {fa(room.members.length)} / {fa(room.capacity)} نفر
              </span>
            </div>
            {error && (
              <p className="g-error" role="alert">
                {error}
                <button onClick={refresh}>تلاش دوباره</button>
              </p>
            )}
            {!catalog ? (
              <section className="g-panel">
                <p>در حال دریافت فهرست بازیکنان…</p>
                {error && (
                  <button
                    onClick={() =>
                      call('catalog', { p_version: room.datasetVersion })
                        .then(setCatalog)
                        .catch((e) => setError(e.message))
                    }
                  >
                    دریافت دوباره
                  </button>
                )}
              </section>
            ) : (
              <>
                {room.phase === 'lobby' && (
                  <>
                    <div className="g-columns">
                      <Setup
                        key={self.id}
                        self={self}
                        config={catalog.config}
                        busy={busy}
                        action={action}
                      />
                      <section className="g-panel">
                        <div className="g-section-title">
                          <h2>تیم‌های اتاق</h2>
                          <span>{fa(room.members.length)} نفر</span>
                        </div>
                        <div className="g-members">
                          {room.members.map((m) => (
                            <div key={m.id}>
                              <span className={'g-member-dot' + (m.online ? ' online' : '')} />
                              <span>
                                <b>{m.teamName}</b>
                                <small>
                                  {m.name}
                                  {m.host ? ' · میزبان' : ''}
                                  {m.self ? ' · شما' : ''}
                                </small>
                                <small>
                                  {m.formation
                                    ? catalog.config.formations[m.formation]?.name +
                                      ' · ' +
                                      catalog.config.tactics[m.tactic]?.name
                                    : 'در حال انتخاب آرایش'}
                                </small>
                              </span>
                              <span className={m.ready ? 'g-ready' : 'g-muted'}>
                                {m.ready ? 'آماده' : 'منتظر'}
                              </span>
                              {room.host && !m.self && (
                                <button
                                  className="g-text-button"
                                  disabled={busy}
                                  onClick={() => action({ type: 'kick', member: m.id })}
                                  aria-label={'حذف ' + m.name}
                                >
                                  حذف
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        {room.host ? (
                          <>
                            <button
                              disabled={
                                busy ||
                                room.members.length < 2 ||
                                room.members.some((m) => !m.ready)
                              }
                              className="button ink-button g-full"
                              onClick={() => action({ type: 'start' })}
                            >
                              شروع انتخاب بازیکنان
                            </button>
                            <p className="g-muted">
                              با حداقل دو نفر و آمادگی همه، بازی را شروع کن. ترتیب انتخاب به‌صورت
                              تصادفی تعیین می‌شود.
                            </p>
                          </>
                        ) : (
                          <p className="g-muted">بعد از آمادگی همه، میزبان بازی را شروع می‌کند.</p>
                        )}
                        <button
                          className="g-text-button"
                          disabled={busy}
                          onClick={() => action({ type: 'leave' })}
                        >
                          خروج از اتاق
                        </button>
                      </section>
                    </div>
                  </>
                )}
                {room.phase === 'draft' && (
                  <Draft
                    room={room}
                    catalog={catalog}
                    self={self}
                    now={serverNow}
                    busy={busy || stale}
                    action={action}
                  />
                )}
                {['tournament', 'finished'].includes(room.phase) && (
                  <Tournament
                    room={room}
                    catalog={catalog}
                    now={stale ? room.serverNow : serverNow}
                  />
                )}
                <p className="g-rating-note">
                  امتیازهای اختصاصی فارسیدل · {fa(catalog.players.length)} بازیکن · پنج لیگ اروپایی
                </p>
              </>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}
function Setup({ self, config, busy, action }) {
  const [formation, setFormation] = useState(self.formation || '433'),
    [tactic, setTactic] = useState(self.tactic || 'balanced'),
    [name, setName] = useState(self.teamName);
  const dirty = formation !== self.formation || tactic !== self.tactic || name !== self.teamName;
  return (
    <form
      className="g-panel"
      onSubmit={(e) => {
        e.preventDefault();
        action({ type: 'setup', formation, tactic, teamName: name, ready: true });
      }}
    >
      <span className="g-kicker">پیش از شروع</span>
      <h2>تیمت را آماده کن</h2>
      <label>
        نام تیم
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={30}
        />
      </label>
      <label>
        ۱. آرایش تیم
        <select value={formation} onChange={(e) => setFormation(e.target.value)}>
          {Object.entries(config.formations).map(([id, f]) => (
            <option key={id} value={id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <Pitch compact formation={formation} config={config} />
      <label>
        ۲. تاکتیک
        <select value={tactic} onChange={(e) => setTactic(e.target.value)}>
          {Object.entries(config.tactics).map(([id, t]) => (
            <option key={id} value={id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <p className="g-muted">{config.tactics[tactic].description}</p>
      <button className="button ink-button g-full" disabled={busy || (self.ready && !dirty)}>
        {self.ready && !dirty ? 'تیم آماده است ✓' : 'ذخیره و اعلام آمادگی'}
      </button>
      {self.ready && (
        <button
          type="button"
          className="g-text-button"
          disabled={busy}
          onClick={() => action({ type: 'setup', formation, tactic, teamName: name, ready: false })}
        >
          لغو آمادگی
        </button>
      )}
      <p className="g-muted">بعد از شروع انتخاب‌ها، آرایش و تاکتیک قابل تغییر نیست.</p>
    </form>
  );
}
function Draft({ room, catalog, self, now, busy, action }) {
  const [slot, setSlot] = useState(''),
    [query, setQuery] = useState(''),
    [league, setLeague] = useState(''),
    [role, setRole] = useState(''),
    [limit, setLimit] = useState(40),
    [view, setView] = useState(self.id);
  const config = catalog.config,
    slots = config.formations[self.formation].slots,
    open = slots.filter((s) => !self.players.some((p) => p.slot === s.id)),
    selected = open.find((s) => s.id === slot) || open[0],
    mine = room.turn === self.id,
    turn = room.members.find((m) => m.id === room.turn),
    taken = new Set(room.picks.map((p) => p.player)),
    viewTeam = room.members.find((m) => m.id === view) || self;
  const seconds = Math.min(
    60,
    Math.min(60, Math.max(0, Math.ceil((new Date(room.pickDeadline).getTime() - now) / 1000))),
  );
  const needle = query.toLocaleLowerCase().trim();
  const pool = catalog.players
    .filter(
      (p) =>
        !taken.has(p.id) &&
        (!league || p.league === league) &&
        (!role || p.positions.includes(role)) &&
        (!needle || (p.name + ' ' + p.club).toLocaleLowerCase().includes(needle)),
    )
    .sort((a, b) =>
      selected
        ? effectiveRating(b, selected.role, config.adjacency) -
            effectiveRating(a, selected.role, config.adjacency) || a.name.localeCompare(b.name)
        : b.overall - a.overall,
    );
  return (
    <>
      <section className={'g-turn' + (mine ? ' my-turn' : '')} aria-live="polite">
        <div>
          <span className="g-kicker">
            انتخاب {fa(room.pickNumber + 1)} از {fa(room.members.length * 11)}
          </span>
          <h2>{mine ? 'نوبت انتخاب توست' : 'نوبت ' + turn?.name}</h2>
          <p>
            {mine
              ? 'یک جایگاه خالی را مشخص کن، سپس بازیکن را انتخاب کن.'
              : 'فهرست را بررسی کن؛ نوبتت می‌رسد.'}
          </p>
        </div>
        <div className="g-pick-clock" aria-label={'زمان باقی‌مانده ' + fa(seconds) + ' ثانیه'}>
          <b>{fa(seconds)}</b>
          <small>ثانیه</small>
        </div>
      </section>
      <div className="g-draft-order" aria-label="ترتیب انتخاب‌های بعدی">
        {Array.from(
          { length: Math.min(room.members.length + 2, room.members.length * 11 - room.pickNumber) },
          (_, i) => {
            const id = snakeTurn(room.draftOrder, room.pickNumber + i),
              m = room.members.find((m) => m.id === id);
            return (
              <span key={i} className={i === 0 ? 'current' : ''}>
                {fa(room.pickNumber + i + 1)}. {m.name}
              </span>
            );
          },
        )}
      </div>
      <div className="g-draft-grid">
        <section className="g-panel g-pool">
          <h2>بازیکنان آزاد</h2>
          <label>
            جایگاه انتخاب
            <select
              value={selected?.id || ''}
              disabled={!open.length}
              onChange={(e) => setSlot(e.target.value)}
            >
              {open.map((s) => (
                <option key={s.id} value={s.id}>
                  {config.roles[s.role]} · {s.id}
                </option>
              ))}
            </select>
          </label>
          <div className="g-filters">
            <input
              aria-label="جست‌وجوی بازیکن یا باشگاه"
              placeholder="نام بازیکن یا باشگاه…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(40);
              }}
            />
            <select
              aria-label="لیگ"
              value={league}
              onChange={(e) => {
                setLeague(e.target.value);
                setLimit(40);
              }}
            >
              <option value="">همهٔ لیگ‌ها</option>
              {Object.entries(leagues).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <select
              aria-label="پست اصلی بازیکن"
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setLimit(40);
              }}
            >
              <option value="">همهٔ پست‌ها</option>
              {Object.entries(config.roles).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <p className="g-muted">
            امتیاز سبز: عملکرد در جایگاه انتخابی. افت پست به‌صورت درصد نمایش داده می‌شود.
          </p>
          <div className="g-player-list">
            {pool.slice(0, limit).map((p) => {
              const fit = selected ? positionFit(p.positions, selected.role, config.adjacency) : 1,
                effective = selected
                  ? effectiveRating(p, selected.role, config.adjacency)
                  : p.overall;
              return (
                <div className="g-player-row" key={p.id}>
                  <div className="g-overall">
                    <b>{fa(p.overall)}</b>
                    <small>امتیاز</small>
                  </div>
                  <div className="g-player-copy">
                    <b dir="auto">{p.name}</b>
                    <small dir="auto">{p.club}</small>
                    <span dir="ltr">{p.positions.join(' / ')}</span>
                    {fit < 1 && (
                      <small className="g-fit">افت پست: {fa(Math.round((1 - fit) * 100))}٪</small>
                    )}
                  </div>
                  <div className="g-effective">
                    <b>{fa(effective)}</b>
                    <small>عملکرد</small>
                  </div>
                  <button
                    className="g-pick-button"
                    disabled={!mine || busy || !selected}
                    onClick={() =>
                      action({
                        type: 'pick',
                        pickNumber: room.pickNumber,
                        player: p.id,
                        slot: selected.id,
                      })
                    }
                    aria-label={'انتخاب ' + p.name}
                  >
                    انتخاب
                  </button>
                </div>
              );
            })}
            {!pool.length && <p className="g-muted">بازیکنی با این فیلترها باقی نمانده است.</p>}
          </div>
          {pool.length > limit && (
            <button className="g-text-button g-full" onClick={() => setLimit((n) => n + 40)}>
              نمایش بیشتر ({fa(pool.length - limit)})
            </button>
          )}
        </section>
        <aside className="g-draft-aside">
          <details className="g-panel" open>
            <summary>تیم‌ها و چیدمان</summary>
            <label>
              نمایش تیم
              <select value={viewTeam.id} onChange={(e) => setView(e.target.value)}>
                {room.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.teamName} · {fa(m.players.length)} / ۱۱
                  </option>
                ))}
              </select>
            </label>
            <Pitch
              formation={viewTeam.formation}
              players={viewTeam.players}
              config={config}
              selected={viewTeam.self ? selected?.id : null}
              onSelect={viewTeam.self ? setSlot : null}
            />
            <p className="g-muted">
              {config.tactics[viewTeam.tactic].name} · {config.formations[viewTeam.formation].name}
            </p>
          </details>
          <details className="g-panel">
            <summary>انتخاب‌های اخیر</summary>
            <ol className="g-history">
              {room.picks
                .slice(-12)
                .reverse()
                .map((p) => {
                  const footballer = catalog.players.find((x) => x.id === p.player),
                    m = room.members.find((x) => x.id === p.member);
                  return (
                    <li key={p.number}>
                      <b dir="auto">{footballer.name}</b>
                      <small>
                        {m.teamName}
                        {p.automatic ? ' · خودکار' : ''}
                      </small>
                    </li>
                  );
                })}
            </ol>
          </details>
          <p className="g-muted">
            با پایان زمان، انتخاب مناسب به‌صورت خودکار انجام می‌شود. پس از کامل شدن تیم‌ها، مسابقات
            شروع می‌شوند.
          </p>
        </aside>
      </div>
    </>
  );
}
function Tournament({ room, catalog, now }) {
  const [side, setSide] = useState('home'),
    match = room.currentMatch,
    champion = room.members.find((m) => m.id === room.winner),
    current = match?.[side],
    events = match?.events || [],
    last = events.at(-1),
    paused = match && now < match.playback.pausedUntil;
  const member = (id) => room.members.find((m) => m.id === id)?.teamName || 'در انتظار برنده';
  const finalRound = Math.max(...room.matches.map((m) => m.round));
  return (
    <>
      {champion && (
        <section className="g-champion">
          <span className="g-kicker">قهرمان جام</span>
          <span className="g-cup" aria-hidden="true">
            <Icon name="trophy" size={46} />
          </span>
          <h2>{champion.teamName}</h2>
          <p>
            {champion.name} · پایان رقابت {fa(room.members.length)} تیم
          </p>
          <Link className="button ink-button" href="/galactic">
            یک جام دیگر
          </Link>
        </section>
      )}
      {match ? (
        <section className="g-match">
          <div className="g-match-top">
            <span className="g-kicker">
              {match.round === finalRound
                ? 'فینال'
                : finalRound - match.round === 1
                  ? 'نیمه‌نهایی'
                  : 'یک‌چهارم نهایی'}
            </span>
            <span className="g-live-indicator">
              {match.status === 'live' ? 'در حال پخش مشترک' : 'پایان مسابقه'}
            </span>
          </div>
          <div className="g-scoreboard">
            <div>
              <b>{match.home.teamName}</b>
              <small>{match.home.name}</small>
            </div>
            <strong
              className="g-score-pair"
              aria-label={
                match.home.teamName +
                ' ' +
                fa(match.homeScore) +
                '، ' +
                match.away.teamName +
                ' ' +
                fa(match.awayScore)
              }
            >
              <span className="g-score-value">{fa(match.homeScore)}</span>
              <span>:</span>
              <span className="g-score-value">{fa(match.awayScore)}</span>
            </strong>
            <div>
              <b>{match.away.teamName}</b>
              <small>{match.away.name}</small>
            </div>
          </div>
          {match.penalties && (
            <p className="g-penalty-score">
              پنالتی{' '}
              <b className="g-score-pair">
                <span>{fa(match.penalties.home)}</span>
                <span>:</span>
                <span>{fa(match.penalties.away)}</span>
              </b>
            </p>
          )}
          <div className={'g-match-clock' + (paused ? ' paused' : '')}>
            <b dir="ltr">{minuteLabel(matchClock(match.playback, now))}</b>
            <small>
              {match.status === 'finished' ? 'پایان' : paused ? 'گزارش لحظه' : 'زمان مسابقه'}
            </small>
          </div>
          <div className="g-team-tabs">
            <button aria-pressed={side === 'home'} onClick={() => setSide('home')}>
              {match.home.teamName}
            </button>
            <button aria-pressed={side === 'away'} onClick={() => setSide('away')}>
              {match.away.teamName}
            </button>
          </div>
          <div className="g-match-field">
            <Pitch
              formation={current.formation}
              players={current.players}
              config={catalog.config}
            />
            {last && paused && (
              <div
                className={'g-incident' + (last.kind === 'goal' ? ' goal' : '')}
                role="status"
                key={match.id + ':' + last.atMs}
              >
                <span>
                  {last.kind === 'goal'
                    ? 'گل!'
                    : last.kind === 'penalty'
                      ? 'پنالتی'
                      : last.kind === 'final'
                        ? 'پایان مسابقه'
                        : 'گزارش بازی'}
                </span>
                <p>{last.text}</p>
              </div>
            )}
          </div>
          <div className="g-match-stats">
            <span>تاکتیک: {catalog.config.tactics[current.tactic].name}</span>
            <span>قدرت تیم: {fa(match.stats?.[side]?.overall)}</span>
            <span>مالکیت برآوردی: {fa(match.stats?.[side + 'Possession'])}٪</span>
          </div>
          <details className="g-commentary" open>
            <summary>گزارش مسابقه</summary>
            <ol aria-label="گزارش اتفاق‌های بازی">
              {[...events].reverse().map((e) => (
                <li key={e.atMs} className={e.kind === 'goal' ? 'goal' : ''}>
                  <b>{fa(e.minute)}′</b>
                  <span>{e.text}</span>
                </li>
              ))}
            </ol>
          </details>
        </section>
      ) : (
        <section className="g-panel g-wait">
          <h2>تیم‌ها کامل شدند</h2>
          <p>
            اولین مسابقه تا {fa(Math.max(0, Math.ceil((new Date(room.nextMatchAt) - now) / 1000)))}{' '}
            ثانیهٔ دیگر شروع می‌شود.
          </p>
        </section>
      )}
      {room.phase === 'tournament' && match?.status === 'finished' && (
        <p className="g-next-match" role="status">
          مسابقهٔ بعدی تا {fa(Math.max(0, Math.ceil((new Date(room.nextMatchAt) - now) / 1000)))}{' '}
          ثانیهٔ دیگر شروع می‌شود. همه در همین اتاق بمانید.
        </p>
      )}
      <section className="g-panel">
        <h2>جدول مسابقات</h2>
        <div className="g-bracket">
          {Array.from({ length: finalRound }, (_, i) => i + 1).map((round) => (
            <div className="g-bracket-round" key={round}>
              <h3>
                {round === finalRound
                  ? 'فینال'
                  : finalRound - round === 1
                    ? 'نیمه‌نهایی'
                    : 'یک‌چهارم نهایی'}
              </h3>
              {room.matches
                .filter((m) => m.round === round)
                .map((m) => (
                  <div
                    key={m.id}
                    className={'g-bracket-match' + (m.status === 'live' ? ' live' : '')}
                  >
                    <small>
                      {m.status === 'bye'
                        ? 'استراحت و صعود'
                        : m.status === 'live'
                          ? 'در حال پخش'
                          : m.status === 'finished'
                            ? 'پایان یافته'
                            : 'در انتظار مسابقه'}
                    </small>
                    {['home', 'away'].map((s) => (
                      <div className={m.winner === m[s] ? 'winner' : ''} key={s}>
                        <span>{m.status === 'bye' && !m[s] ? 'استراحت' : member(m[s])}</span>
                        <b>{m[s + 'Score'] !== null ? fa(m[s + 'Score']) : '—'}</b>
                      </div>
                    ))}
                    {m.penalties && (
                      <small>
                        پنالتی: {fa(m.penalties.home)} – {fa(m.penalties.away)}
                      </small>
                    )}
                  </div>
                ))}
            </div>
          ))}
        </div>
      </section>
      <details className="g-panel">
        <summary>تیم‌های این جام</summary>
        <div className="g-final-teams">
          {room.members.map((m) => (
            <div key={m.id}>
              <h3>{m.teamName}</h3>
              <p className="g-muted">
                {m.name} · {catalog.config.tactics[m.tactic].name}
              </p>
              <Pitch compact formation={m.formation} players={m.players} config={catalog.config} />
            </div>
          ))}
        </div>
      </details>
    </>
  );
}
