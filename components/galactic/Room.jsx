'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/arcade/Shell';
import Draft from './Draft';
import { Icon } from '@/components/arcade/Art';
import { useArcade } from '@/components/arcade/Provider';
import { fa } from '@/lib/classic/rules.mjs';
import { matchClock, minuteLabel } from '@/lib/galactic/rules.mjs';
import { call, watch } from '@/lib/galactic/gateway';
import { Access, Pitch, useNow, phaseLabel } from './Common';
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
                                  {m.formation ? (
                                    <>
                                      <bdi dir="ltr">
                                        {catalog.config.formations[m.formation]?.name}
                                      </bdi>{' '}
                                      · {catalog.config.tactics[m.tactic]?.name}
                                    </>
                                  ) : (
                                    'در حال انتخاب آرایش'
                                  )}
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
                  مدل اختصاصی فارسیدل · {fa(catalog.players.length)} بازیکن · پنج لیگ اروپایی
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
        <select dir="ltr" value={formation} onChange={(e) => setFormation(e.target.value)}>
          {Object.entries(config.formations).map(([id, f]) => (
            <option key={id} value={id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <p className="g-formation-description">{config.formations[formation].description}</p>
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
export function Tournament({ room, catalog, now }) {
  const [selectedSide, setSide] = useState(null),
    [viewMatch, setViewMatch] = useState(null),
    match = room.liveMatches?.find((m) => m.id === viewMatch) || room.currentMatch,
    side = selectedSide || (match?.away.id === room.self ? 'away' : 'home'),
    champion = room.members.find((m) => m.id === room.winner),
    current = match?.[side],
    events = match?.events || [],
    last = events.at(-1),
    paused = match && now < match.playback.pausedUntil;
  const otherGoals = (room.liveMatches || [])
    .filter((m) => m.id !== match?.id)
    .flatMap((m) =>
      m.events
        .filter((e) => e.kind === 'goal')
        .map((e) => ({
          ...e,
          other: true,
          key: m.id + ':' + e.atMs,
          when: new Date(m.startedAt).getTime() + e.atMs,
          text:
            'در بازی «' +
            m.home.teamName +
            '» و «' +
            m.away.teamName +
            '»: ' +
            (e.side === 0 ? m.home.teamName : m.away.teamName) +
            ' گل زد. نتیجه: ' +
            m.home.teamName +
            ' ' +
            fa(e.homeScore) +
            '، ' +
            m.away.teamName +
            ' ' +
            fa(e.awayScore),
        })),
    )
    .sort((a, b) => a.when - b.when);
  const feed = [
    ...events.map((e) => ({
      ...e,
      key: match.id + ':' + e.atMs,
      when: new Date(match.startedAt).getTime() + e.atMs,
    })),
    ...otherGoals,
  ].sort((a, b) => b.when - a.when);
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
      {!!room.matches.length && (
        <section className="g-panel g-other-scores">
          <div className="g-section-title">
            <h2>بازی‌های هم‌زمان</h2>
            <span>مرحلهٔ {fa(room.currentRound || 1)}</span>
          </div>
          <div className="g-live-score-grid">
            {room.matches
              .filter((m) => m.round === (room.currentRound || 1))
              .map((m) => (
                <button
                  key={m.id}
                  disabled={!['live', 'finished'].includes(m.status)}
                  onClick={() => {
                    setViewMatch(m.id);
                    setSide(null);
                  }}
                  className={m.id === match?.id ? 'selected' : ''}
                >
                  <span className="g-team-blue">
                    {m.home ? member(m.home) : 'استراحت'}{' '}
                    <b>{m.homeScore === null ? '—' : fa(m.homeScore)}</b>
                  </span>
                  <span className="g-team-red">
                    {m.away ? member(m.away) : 'استراحت'}{' '}
                    <b>{m.awayScore === null ? '—' : fa(m.awayScore)}</b>
                  </span>
                  <small>
                    {m.status === 'live'
                      ? 'در حال پخش'
                      : m.status === 'finished'
                        ? 'پایان'
                        : m.status === 'bye'
                          ? 'استراحت'
                          : 'در انتظار شروع'}
                  </small>
                </button>
              ))}
          </div>
          <p className="g-muted">
            برای تماشای یک مسابقه، روی نتیجهٔ آن بزن. صعود مرحلهٔ بعد پس از پایان همهٔ بازی‌های این
            مرحله انجام می‌شود.
          </p>
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
            <div className="g-team-blue">
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
            <div className="g-team-red">
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
          {!!otherGoals.length && (
            <p className="g-other-goal-notice" role="status">
              خبر از بازی دیگر: {otherGoals.at(-1).text}
            </p>
          )}
          <div className="g-match-field">
            <Pitch
              formation={current.formation}
              players={current.players}
              config={catalog.config}
              teamColor={side === 'home' ? 'blue' : 'red'}
              sentOff={side === 'home' ? match.sentOffHome || [] : match.sentOffAway || []}
            />
            {last && paused && (
              <div
                className={
                  'g-incident' +
                  (last.side === 0 ? ' attacking-blue' : last.side === 1 ? ' attacking-red' : '') +
                  (last.kind === 'goal' ? ' goal' : '')
                }
                role="status"
                key={match.id + ':' + last.atMs}
              >
                <span>
                  {{
                    goal: 'گل!',
                    build_up: 'حمله در حال شکل‌گیری',
                    action: 'ادامهٔ حمله',
                    penalty_kick: 'پنالتی',
                    free_kick: 'ضربهٔ آزاد',
                    yellow_card: 'کارت زرد',
                    red_card: 'اخراج',
                    woodwork: 'تیر دروازه',
                    shootout_setup: 'پنالتی پایان مسابقه',
                    shootout_kick: 'نتیجهٔ ضربه',
                    final: 'پایان مسابقه',
                  }[last.kind] || 'گزارش بازی'}
                </span>
                <p>{last.text}</p>
              </div>
            )}
          </div>
          <div className="g-match-stats">
            <span>تاکتیک: {catalog.config.tactics[current.tactic].name}</span>
            <span>
              آرایش: <b dir="ltr">{catalog.config.formations[current.formation].name}</b>
            </span>
          </div>
          <div className="g-statistics" aria-label="آمار تا این لحظهٔ مسابقه">
            <h3>آمار تا این لحظه</h3>
            {[
              ['possession', 'مالکیت توپ'],
              ['shots', 'شوت'],
              ['onTarget', 'شوت در چارچوب'],
              ['passes', 'پاس'],
              ['passesCompleted', 'پاس موفق'],
              ['corners', 'کرنر'],
              ['fouls', 'خطا'],
              ['yellowCards', 'کارت زرد'],
              ['redCards', 'کارت قرمز'],
              ['offsides', 'آفساید'],
              ['penalties', 'پنالتی در جریان بازی'],
            ].map(([key, label]) => (
              <div key={key}>
                <b className="g-team-blue">
                  {fa(match.stats?.home?.[key] ?? 0)}
                  {key === 'possession' ? '٪' : ''}
                </b>
                <span>{label}</span>
                <b className="g-team-red">
                  {fa(match.stats?.away?.[key] ?? 0)}
                  {key === 'possession' ? '٪' : ''}
                </b>
              </div>
            ))}
          </div>
          <details className="g-commentary" open>
            <summary>گزارش مسابقه</summary>
            <ol aria-label="گزارش اتفاق‌های بازی">
              {feed.map((e) => (
                <li
                  key={e.key}
                  className={
                    (e.side === 0 ? ' attacking-blue' : e.side === 1 ? ' attacking-red' : '') +
                    (e.other ? ' other-goal' : '') +
                    (e.kind === 'goal' ? ' goal' : '')
                  }
                >
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
            بازی‌های مرحله تا{' '}
            {fa(Math.max(0, Math.ceil((new Date(room.nextMatchAt) - now) / 1000)))} ثانیهٔ دیگر شروع
            می‌شود.
          </p>
        </section>
      )}
      {room.phase === 'tournament' && match?.status === 'finished' && (
        <p className="g-next-match" role="status">
          {room.nextMatchAt ? (
            <>
              مرحلهٔ بعد تا {fa(Math.max(0, Math.ceil((new Date(room.nextMatchAt) - now) / 1000)))}{' '}
              ثانیهٔ دیگر شروع می‌شود.
            </>
          ) : (
            <>
              این مسابقه تمام شده؛ منتظر پایان دیگر بازی‌های این مرحله هستیم. می‌توانی آن‌ها را از
              تابلوی بالا تماشا کنی.
            </>
          )}
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
