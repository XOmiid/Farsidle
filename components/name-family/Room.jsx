'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import Shell from '@/components/arcade/Shell';
import { getSupabase } from '@/lib/classic/gateway';
import { useNow } from '@/components/galactic/Common';

const fa = (n) => new Intl.NumberFormat('fa-IR').format(n);
const normalizeAnswer = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ك/g, 'ک')
    .replace(/[يى]/g, 'ی')
    .replace(/[ةۀ]/g, 'ه')
    .replace(/[\s\u200c\u200d\u200e\u200fـًٌٍَُِّْٰ]/g, '');

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
    const t = setInterval(refresh, 1800);
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

  const answerKey = room ? [room.phase, room.round, room.self].join(':') : '';
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
        <div className="galactic nf-screen" dir="rtl">
          <section className="g-panel nf-card">
            <span className="g-kicker">اسم و فامیل</span>
            <h1>ورود به اتاق</h1>
            <p>
              {error ? 'برای ورود به این اتاق، ابتدا باید عضو آن شوید.' : 'در حال بارگذاری اتاق…'}
            </p>
            {error && <p className="nf-error" role="alert">{error}</p>}
            {error && (
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
            )}
          </section>
        </div>
      </Shell>
    );

  const currentDeadline = room.stopDeadline || room.deadline;
  const left = currentDeadline
      ? Math.max(0, Math.ceil((new Date(currentDeadline).getTime() - now) / 1000))
      : null,
    pending = room.entries?.find(
      (entry) => entry.round === room.round && !entry.reviewed && entry.value && entry.user !== room.self,
    ),
    waitingOwn = room.entries?.some(
      (entry) => entry.round === room.round && !entry.reviewed && entry.value && entry.user === room.self,
    ),
    ownVote = pending?.votes?.[room.self],
    voteCount = Object.keys(pending?.votes || {}).length,
    needsVotes = Math.floor((room.members.length - 1) / 2) + 1,
    hasPending = room.entries?.some((entry) => !entry.reviewed && entry.value),
    reviewTimedOut = room.reviewDeadline && now >= new Date(room.reviewDeadline).getTime(),
    scores = [...room.members].sort((a, b) => b.score - a.score);
  const phaseText = {
    lobby: 'اتاق انتظار',
    playing: 'در حال بازی',
    review: 'بررسی پاسخ‌ها',
    finished: 'پایان بازی',
  }[room.phase];

  function saveAnswers(stop) {
    const letter = normalizeAnswer(room.letter);
    const invalid = Object.values(answers).some((value) => {
      const answer = normalizeAnswer(value);
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
      <div className="galactic nf-screen nf-room-screen" dir="rtl">
        <header className="g-panel nf-room-header">
          <div className="nf-room-heading">
            <div>
              <div className="nf-room-meta">
                <span className="g-kicker">اسم و فامیل · کد {room.code}</span>
                <span className="nf-phase-badge">{phaseText}</span>
              </div>
              <h1>{room.title}</h1>
            </div>
            {room.phase === 'lobby' && (
              <button
                className="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      window.location.origin + '/name-family/room/' + room.code,
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

          <div className="nf-scoreboard" aria-label="امتیاز بازیکنان">
            {room.members.map((member) => (
              <article
                className={'nf-score-card' + (member.id === room.self ? ' is-self' : '')}
                key={member.id}
              >
                <span>{member.name}{member.id === room.self ? ' · شما' : ''}</span>
                <strong>{fa(member.score)}<small> امتیاز</small></strong>
              </article>
            ))}
          </div>
        </header>

        {room.phase === 'lobby' && (
          <section className="g-panel nf-card nf-stage">
            <header className="nf-card-heading">
              <span className="nf-step-number">۰۱</span>
              <div>
                <span className="g-kicker">آماده‌سازی</span>
                <h2>بازیکنان و ترتیب موضوع‌ها</h2>
                <p>
                  {fa(room.members.length)} از {fa(room.capacity)} بازیکن
                  {room.host ? ' · میزبان می‌تواند ترتیب بررسی را تغییر دهد.' : ' · میزبان بازی را شروع می‌کند.'}
                </p>
              </div>
            </header>
            <div className="nf-member-list">
              {room.members.map((member, index) => (
                <span className="nf-member-pill" key={member.id}>
                  <i>{fa(index + 1)}</i>{member.name}
                </span>
              ))}
            </div>
            <div className="nf-order-heading">
              <h3>موضوع‌ها به همین ترتیب بررسی می‌شوند</h3>
              <span>{fa(room.categories.length)} موضوع</span>
            </div>
            <ol className="nf-order-list" aria-label="ترتیب فعلی موضوع‌ها">
              {room.categories.map((category, index) => (
                <li key={category}>
                  <strong>
                    <span className="nf-order-index">{fa(index + 1)}</span>
                    {category}
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
                className="button ink-button nf-primary-action"
                disabled={busy || room.members.length < 2}
                onClick={() => call('start')}
              >
                {busy ? 'در حال آماده‌سازی…' : 'شروع بازی · ' + fa(room.rounds) + ' دور'}
              </button>
            ) : (
              <p className="nf-empty-state">پس از پیوستن بقیه، میزبان بازی را شروع می‌کند.</p>
            )}
          </section>
        )}

        {room.phase === 'playing' && (
          <section className="g-panel nf-card nf-stage">
            <header className="nf-card-heading compact">
              <span className="nf-step-number">۰۲</span>
              <div>
                <span className="g-kicker">نوبت پاسخ‌گویی</span>
                <h2>دور {fa(room.round)} از {fa(room.rounds)}</h2>
                <p>برای هر موضوع یک پاسخ با حرف این دور بنویسید.</p>
              </div>
            </header>
            <div className="nf-round-banner">
              <div className="nf-letter-box">
                <span>حرف دور</span>
                <strong>{room.letter}</strong>
              </div>
              <div className="nf-time-box">
                <span>{room.stopDeadline ? 'پایان دور' : 'زمان باقی‌مانده'}</span>
                {left !== null ? (
                  <strong>{fa(left)} <small>ثانیه</small></strong>
                ) : (
                  <strong>آزاد</strong>
                )}
                {room.stopDeadline && <small>برای تکمیل پاسخ‌ها</small>}
              </div>
            </div>
            <p className="nf-save-status" aria-live="polite">
              {saveStatus === 'saving'
                ? 'در حال ذخیرهٔ پاسخ‌ها…'
                : saveStatus === 'error'
                  ? 'ذخیره انجام نشد؛ دوباره تلاش کنید.'
                  : saveStatus === 'saved'
                    ? 'پاسخ‌ها ذخیره شدند.'
                    : 'پاسخ‌ها هنگام نوشتن خودکار ذخیره می‌شوند.'}
            </p>
            <div className="nf-grid nf-answer-grid">
              {room.categories.map((category) => (
                <label key={category}>
                  <span>{category}</span>
                  <input
                    disabled={left === 0}
                    value={answers[category] || ''}
                    onChange={(e) => {
                      setSaveStatus('saving');
                      setError('');
                      setAnswerDraft((draft) => ({
                        key: answerKey,
                        values: {
                          ...(draft.key === answerKey ? draft.values : savedAnswers),
                          [category]: e.target.value,
                        },
                      }));
                    }}
                    placeholder={'با «' + room.letter + '»'}
                  />
                </label>
              ))}
            </div>
            <div className="g-actions nf-stage-actions">
              <button
                className="button ink-button"
                disabled={busy || Boolean(room.stopDeadline) || left === 0}
                onClick={() => saveAnswers(true)}
              >
                {room.stopDeadline ? 'پایان دور تا ' + fa(left || 0) + ' ثانیه' : 'استپ · ۵ ثانیه فرصت'}
              </button>
            </div>
          </section>
        )}

        {room.phase === 'review' && (
          <section className="g-panel nf-card nf-stage">
            <header className="nf-card-heading compact">
              <span className="nf-step-number">۰۳</span>
              <div>
                <span className="g-kicker">بررسی گروهی</span>
                <h2>دور {fa(room.round)} · {room.category}</h2>
                <p>به پاسخ بازیکن دیگر رأی بدهید؛ پاسخ‌های مشابه املایی هم‌ارز حساب می‌شوند.</p>
              </div>
            </header>

            {pending ? (
              <article className="nf-review">
                <div className="nf-answer-owner">
                  <span className="nf-answer-avatar">{pending.name.slice(0, 1)}</span>
                  <div><small>پاسخ {pending.name}</small><strong>{pending.category}</strong></div>
                </div>
                <p className="nf-answer-text">{pending.value}</p>
                <div className="g-actions nf-vote-actions">
                  <button
                    className="button nf-vote-yes"
                    disabled={busy || ownVote !== undefined}
                    onClick={() => call('vote', { entry: pending.id, valid: true })}
                  >
                    👍 درست است
                  </button>
                  <button
                    className="button nf-vote-no"
                    disabled={busy || ownVote !== undefined}
                    onClick={() => call('vote', { entry: pending.id, valid: false })}
                  >
                    👎 نادرست است
                  </button>
                </div>
                <small className="nf-vote-count">
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
              <p className="nf-empty-state">
                {waitingOwn
                  ? 'دیگران در حال بررسی پاسخ شما هستند.'
                  : 'پاسخ‌های این موضوع بررسی شدند.'}
              </p>
            )}

            <div className="nf-results-list">
              {room.entries
                .filter((entry) => entry.round === room.round)
                .map((entry) => (
                  <div className="nf-result-row" key={entry.id}>
                    <div>
                      <strong>{entry.name}</strong>
                      <span>{entry.value || 'پاسخی ثبت نشده'}</span>
                    </div>
                    <div className="nf-result-status">
                      <span className={'nf-validity' + (entry.valid ? ' is-valid' : entry.valid === false ? ' is-invalid' : '')}>
                        {entry.reviewed ? (entry.valid ? 'پذیرفته‌شده' : 'ردشده') : 'در انتظار رأی'}
                      </span>
                      <b>{fa(entry.points)} امتیاز</b>
                    </div>
                  </div>
                ))}
            </div>

            {room.host && (
              <button
                className="button ink-button nf-primary-action"
                disabled={busy || (hasPending && !reviewTimedOut)}
                onClick={() => call('advance')}
              >
                {room.categoryNo + 1 < room.categories.length
                  ? 'رفتن به موضوع بعدی'
                  : 'پایان بررسی · دور بعد'}
              </button>
            )}
          </section>
        )}

        {room.phase === 'finished' && (
          <section className="g-panel nf-card nf-stage nf-finished-card">
            <span className="g-kicker">بازی به پایان رسید</span>
            <h2>جدول نهایی</h2>
            <div className="nf-final-score-list">
              {scores.map((member, index) => (
                <article className={'nf-final-score' + (index === 0 ? ' is-winner' : '')} key={member.id}>
                  <span className="nf-final-rank">{index === 0 ? '★' : fa(index + 1)}</span>
                  <strong>{member.name}</strong>
                  <b>{fa(member.score)} <small>امتیاز</small></b>
                </article>
              ))}
            </div>
          </section>
        )}

        {error && <p className="nf-error" role="alert">{error}</p>}
      </div>
    </Shell>
  );
}
