'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import Shell from '@/components/arcade/Shell';
import { getSupabase } from '@/lib/classic/gateway';
import { useNow } from '@/components/galactic/Common';
const fa = (n) => new Intl.NumberFormat('fa-IR').format(n);
export default function Room({ code }) {
  const [room, setRoom] = useState(null),
    [answerDraft, setAnswerDraft] = useState({ key: '', values: {} }),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false),
    [saveStatus, setSaveStatus] = useState('');
  const autoSaveQueue = useRef(Promise.resolve());
  const now = useNow();
  const refresh = useCallback(async () => {
    try {
      const sb = await getSupabase();
      const { data, error } = await sb.rpc('name_family_room', { p_code: code });
      if (error) throw error;
      setRoom(data);
    } catch (e) {
      setError(e.message);
    }
  }, [code]);
  useEffect(() => {
    const initial = setTimeout(refresh, 0);
    const t = setInterval(() => {
      refresh();
    }, 1800);
    return () => {
      clearTimeout(initial);
      clearInterval(t);
    };
  }, [refresh]);
  const call = async (type, extra = {}) => {
    setBusy(true);
    setError('');
    try {
      const sb = await getSupabase();
      const { data, error } = await sb.rpc('name_family_act', {
        p_code: code,
        p_action: { type, ...extra },
      });
      if (error) throw error;
      setRoom(data);
      if (type === 'save') setSaveStatus('saved');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const answerKey = room ? `${room.phase}:${room.round}:${room.self}` : '';
  const savedAnswers = room
    ? Object.fromEntries(
        room.entries
          .filter((entry) => entry.round === room.round && entry.user === room.self)
          .map((entry) => [entry.category, entry.value]),
      )
    : {};
  const answers = answerDraft.key === answerKey ? answerDraft.values : savedAnswers;
  const roomPhase = room?.phase;
  const roundNo = room?.round;
  useEffect(() => {
    if (roomPhase !== 'playing' || !answerKey || answerDraft.key !== answerKey) return;
    const values = answerDraft.values;
    const timer = setTimeout(() => {
      autoSaveQueue.current = autoSaveQueue.current
        .catch(() => {})
        .then(async () => {
          const sb = await getSupabase();
          const { error } = await sb.rpc('name_family_act', {
            p_code: code,
            p_action: { type: 'save', answers: values, stop: false, round: roundNo },
          });
          if (error) throw error;
          setSaveStatus('saved');
        })
        .catch((saveError) => {
          setSaveStatus('error');
          setError(saveError.message);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [answerDraft, answerKey, roomPhase, roundNo, code]);
  if (!room)
    return (
      <Shell>
        <section className="g-panel" dir="rtl">
          <p>
            {error ? 'برای ورود به این اتاق، ابتدا باید عضو آن شوید.' : 'در حال بارگذاری اتاق…'}
          </p>
          {error && <p role="alert">{error}</p>}
          {error && (
            <>
              <div className="g-actions">
                <button
                  className="button ink-button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError('');
                    try {
                      const sb = await getSupabase();
                      const { data, error } = await sb.rpc('name_family_join', { p_code: code });
                      if (error) throw error;
                      setRoom(data);
                    } catch (e) {
                      setError(e.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  پیوستن با این حساب
                </button>
                <Link
                  className="button"
                  href={'/login?next=' + encodeURIComponent('/name-family/room/' + code)}
                >
                  ورود
                </Link>
                <Link
                  className="button"
                  href={'/register?next=' + encodeURIComponent('/name-family/room/' + code)}
                >
                  ساخت حساب
                </Link>
              </div>
            </>
          )}
        </section>
      </Shell>
    );
  const currentDeadline = room.stopDeadline || room.deadline;
  const left = currentDeadline
      ? Math.max(0, Math.ceil((new Date(currentDeadline).getTime() - now) / 1000))
      : null,
    pending = room.entries?.find(
      (x) => x.round === room.round && !x.reviewed && x.value && x.user !== room.self,
    ),
    waitingOwn = room.entries?.some(
      (x) => x.round === room.round && !x.reviewed && x.value && x.user === room.self,
    ),
    ownVote = pending?.votes?.[room.self],
    voteCount = Object.keys(pending?.votes || {}).length,
    needsVotes = Math.floor((room.members.length - 1) / 2) + 1,
    hasPending = room.entries?.some((entry) => !entry.reviewed && entry.value),
    reviewTimedOut = room.reviewDeadline && now >= new Date(room.reviewDeadline).getTime(),
    scores = [...room.members].sort((a, b) => b.score - a.score);
  function saveAnswers(stop) {
    const letter = room.letter.replace(/[إأآٱ]/g, 'ا').toLowerCase();
    const invalid = Object.values(answers).some((value) => {
      const answer = value
        .trim()
        .replace(/[إأآٱ]/g, 'ا')
        .toLowerCase();
      return answer && !answer.startsWith(letter);
    });
    if (invalid) {
      setError('همهٔ پاسخ‌ها باید با حرف «' + room.letter + '» شروع شوند.');
      return;
    }
    call('save', { answers, stop, round: room.round });
  }
  function moveRoomCategory(index, direction) {
    const next = [...room.categories];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    call('reorder', { categories: next });
  }
  return (
    <Shell>
      <section className="g-panel" dir="rtl">
        <div className="nf-room-heading">
          <span className="g-kicker">اسم و فامیل · کد {room.code}</span>
          {room.phase === 'lobby' && (
            <button
              className="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `${window.location.origin}/name-family/room/${room.code}`,
                  );
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                } catch {
                  setError('کپی لینک در این مرورگر در دسترس نیست؛ کد اتاق را برای دوستان بفرستید.');
                }
              }}
            >
              {copied ? 'لینک کپی شد' : 'کپی لینک دعوت'}
            </button>
          )}
        </div>
        <h1>{room.title}</h1>
        <p>{room.members.map((m) => m.name + ' · ' + fa(m.score)).join('　')}</p>
        {room.phase === 'lobby' && (
          <>
            <h2>
              بازیکنان ({room.members.length}/{room.capacity})
            </h2>
            <p>{room.members.map((m) => m.name).join('، ')}</p>
            <h3>ترتیب ستون‌های بررسی</h3>
            {room.host && <p>با فلش‌ها مشخص کنید بررسی با کدام ستون شروع شود.</p>}
            <ol className="nf-order-list" aria-label="ترتیب فعلی ستون‌ها">
              {room.categories.map((category, index) => (
                <li key={category}>
                  <strong>
                    {fa(index + 1)}. {category}
                  </strong>
                  {room.host && (
                    <span className="nf-order-actions">
                      <button
                        className="button"
                        aria-label={'انتقال ' + category + ' به بالاتر'}
                        disabled={busy || index === 0}
                        onClick={() => moveRoomCategory(index, -1)}
                      >
                        ↑
                      </button>
                      <button
                        className="button"
                        aria-label={'انتقال ' + category + ' به پایین‌تر'}
                        disabled={busy || index === room.categories.length - 1}
                        onClick={() => moveRoomCategory(index, 1)}
                      >
                        ↓
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ol>
            {room.host ? (
              <button
                className="button ink-button"
                disabled={busy || room.members.length < 2}
                onClick={() => call('start')}
              >
                شروع بازی · {fa(room.rounds)} دور
              </button>
            ) : (
              <p>میزبان پس از پیوستن بازیکنان بازی را شروع می‌کند.</p>
            )}
          </>
        )}
        {room.phase === 'playing' && (
          <>
            <h2>
              دور {fa(room.round)} از {fa(room.rounds)} · حرف «{room.letter}»
            </h2>
            {left !== null ? (
              <p className="g-kicker">
                {room.stopDeadline
                  ? `استپ زده شد؛ ${fa(left)} ثانیه برای تکمیل پاسخ‌ها فرصت دارید.`
                  : `زمان باقی‌مانده: ${fa(left)} ثانیه`}
              </p>
            ) : (
              <p>تا وقتی همهٔ خانه‌ها را پر نکرده‌اید، ادامه دهید.</p>
            )}
            <p className="nf-save-status" aria-live="polite">
              {saveStatus === 'saving'
                ? 'در حال ذخیرهٔ پاسخ‌ها…'
                : saveStatus === 'error'
                  ? 'ذخیره انجام نشد؛ دوباره تلاش کنید.'
                  : saveStatus === 'saved'
                    ? 'پاسخ‌ها ذخیره شدند.'
                    : 'پاسخ‌ها هنگام نوشتن خودکار ذخیره می‌شوند.'}
            </p>
            <div className="nf-grid">
              {room.categories.map((c) => (
                <label key={c}>
                  {c}
                  <input
                    disabled={left === 0}
                    value={answers[c] || ''}
                    onChange={(e) => {
                      setSaveStatus('saving');
                      setError('');
                      setAnswerDraft((draft) => ({
                        key: answerKey,
                        values: {
                          ...(draft.key === answerKey ? draft.values : savedAnswers),
                          [c]: e.target.value,
                        },
                      }));
                    }}
                    placeholder={'با «' + room.letter + '»'}
                  />
                </label>
              ))}
            </div>
            <div className="g-actions">
              <button
                className="button ink-button"
                disabled={busy || Boolean(room.stopDeadline) || left === 0}
                onClick={() => saveAnswers(true)}
              >
                {room.stopDeadline ? `پایان دور تا ${fa(left || 0)} ثانیه` : 'استپ · ۵ ثانیه فرصت'}
              </button>
            </div>
          </>
        )}
        {room.phase === 'review' && (
          <>
            <h2>
              دور {fa(room.round)} · بررسی «{room.category}»
            </h2>
            {pending ? (
              <article className="nf-review">
                <b>{pending.name}</b>
                <p>
                  {pending.category}: <strong>{pending.value}</strong>
                </p>
                <div className="g-actions">
                  <button
                    className="button"
                    disabled={busy || ownVote !== undefined}
                    onClick={() => call('vote', { entry: pending.id, valid: true })}
                  >
                    👍 درست است
                  </button>
                  <button
                    className="button"
                    disabled={busy || ownVote !== undefined}
                    onClick={() => call('vote', { entry: pending.id, valid: false })}
                  >
                    👎 نادرست است
                  </button>
                </div>
                <small>
                  {ownVote !== undefined ? (
                    <>رأی شما ثبت شد؛ منتظر بقیهٔ بازیکنان باشید.</>
                  ) : (
                    <>
                      رأی‌ها: {fa(voteCount)} از {fa(room.members.length - 1)} · حداقل{' '}
                      {fa(needsVotes)} رأی مثبت لازم است.
                    </>
                  )}
                </small>
              </article>
            ) : (
              <p>
                {waitingOwn
                  ? 'دیگران در حال بررسی پاسخ شما هستند.'
                  : 'پاسخ‌های این ستون بررسی شدند.'}
              </p>
            )}
            {room.host && (
              <button
                className="button ink-button"
                disabled={busy || (hasPending && !reviewTimedOut)}
                onClick={() => call('advance')}
              >
                {room.categoryNo + 1 < room.categories.length
                  ? 'ستون بعدی'
                  : 'پایان بررسی · دور بعد'}
              </button>
            )}
            {room.entries
              .filter((e) => e.round === room.round)
              .map((e) => (
                <p key={e.id}>
                  {e.name} · {e.category}: {e.value || '—'} · {fa(e.points)} امتیاز{' '}
                  {e.reviewed ? (e.valid ? '✓' : '×') : ''}
                </p>
              ))}
          </>
        )}
        {room.phase === 'finished' && (
          <>
            <h2>جدول نهایی</h2>
            {scores.map((m, i) => (
              <p key={m.id}>
                {fa(i + 1)}. {m.name} — {fa(m.score)} امتیاز
              </p>
            ))}
          </>
        )}
        {error && <p role="alert">{error}</p>}
      </section>
    </Shell>
  );
}
