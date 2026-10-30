'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Shell, { Dialog } from './Shell';
import GameArt, { Icon } from './Art';
import { useArcade, useCountdown } from './Provider';
import { gameById } from '@/lib/classic/catalog';
import { getGame, act, catalog, isLocal } from '@/lib/classic/gateway';
import { fa, normalize, countdown, remaining } from '@/lib/classic/rules.mjs';
import { sound, stopAudio, unlockAudio } from '@/lib/classic/audio';
const KEY_ROWS = ['ضصثقفغعهخحجچ', 'شسیبلاتنمکگ', 'ظطزرذدپوژ'];
const HELP = {
  wordle: [
    'کلمهٔ پنهان امروز را در شش تلاش پیدا کن. هر ترکیب از حروف فارسی با طول مشخص‌شده پذیرفته می‌شود.',
    'سبز: حرف و جای آن درست است. زرد: حرف درست، جای آن اشتباه. خاکستری: حرف در جواب نیست.',
    '«آ» و «ا» یکسان حساب می‌شوند.',
  ],
  factle: [
    'هر روز پنج کشور متفاوت داریم؛ برای هر کشور فقط یک سرنخ می‌بینی.',
    'در هر دور یک پاسخ بده یا بگذر. هر پاسخ درست یک امتیاز و ۲۰ سکه دارد.',
    'در پایان می‌توانی پاسخ هر پنج دور را مرور کنی.',
  ],
  colordle: [
    'وقتی آماده‌ای، رنگ را برای ده ثانیه ببین.',
    'بعد از ناپدید شدن رنگ، با سه اسلایدر آن را از حافظه بساز.',
    'فقط یک بار می‌توانی رنگ را ببینی؛ بستن صفحه زمان را از اول شروع نمی‌کند.',
  ],
  memorydle: [
    'دو مرحله داری. در هر مرحله پنج عدد، هرکدام دو ثانیه، نمایش داده می‌شود.',
    'سپس همان پنج عدد را از بین پانزده عدد پیدا کن. ترتیب انتخاب مهم نیست.',
    'هر انتخاب درست یک امتیاز؛ مجموع دو مرحله ده امتیاز.',
  ],
  chordle: [
    'در سه دور، با سه رنگ صدا روبه‌رو می‌شوی.',
    'توالی پنج صدا را بشنو. دکمه‌ها را امتحان کن و پنج خانه را به همان ترتیب بچین.',
    'می‌توانی توالی را دوباره بشنوی. هر جای درست یک امتیاز دارد.',
  ],
  teamdle: [
    'در هر سؤال، از میان دو شهر یک کشور، پایتخت را انتخاب کن.',
    'برای هر سؤال شش ثانیه وقت داری. پاسخ بعد از زمان مقرر امتیاز نمی‌گیرد.',
    'امتیاز تیم‌ها فقط از بازیکنانی محاسبه می‌شود که همتای تیم مقابلشان بازی کرده است.',
  ],
  crossword: [
    'جدول را با سکه‌هایی که از بازی‌ها می‌گیری باز کن.',
    'روی یک خانه یا سرنخ بزن. با کیبورد فارسی، کلمه را کامل کن.',
    'دوباره روی خانه بزن تا جهت عوض شود. با «بررسی» خانه‌های درست و اشتباه را ببین.',
  ],
};
function useClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);
  return now;
}
function Progress({ index, total, score, max }) {
  return (
    <div className="game-progress">
      <span>
        دور {fa(Math.min(index + 1, total))} از {fa(total)}
      </span>
      <div className="round-dots">
        {Array.from({ length: total }, (_, i) => (
          <i key={i} className={i < index ? 'done' : i === index ? 'current' : ''} />
        ))}
      </div>
      <span>
        {fa(score)} / {fa(max)}
      </span>
    </div>
  );
}
function Keyboard({ onLetter, onDelete, onEnter, disabled, status = {} }) {
  return (
    <div className="persian-keyboard" aria-label="صفحه‌کلید فارسی">
      {KEY_ROWS.map((row) => (
        <div className="keyboard-row" key={row}>
          {[...row].map((c) => (
            <button
              type="button"
              key={c}
              disabled={disabled}
              className={status[c] || ''}
              onClick={() => onLetter(c)}
            >
              {c}
            </button>
          ))}
        </div>
      ))}
      <div className="keyboard-row controls">
        <button type="button" disabled={disabled} onClick={onDelete}>
          ⌫ پاک کردن
        </button>
        {onEnter && (
          <button type="button" className="enter" disabled={disabled} onClick={onEnter}>
            ثبت حدس ↵
          </button>
        )}
      </div>
    </div>
  );
}
export default function Game({ game, id }) {
  const meta = gameById(game);
  const { day, player } = useArcade();
  const [help, setHelp] = useState(false);
  return (
    <Shell back="/classic" help={() => setHelp(true)}>
      <div className={'play-wrap theme-' + meta.color}>
        <div className="play-heading">
          <GameArt type={meta.icon} />
          <div className="game-day">
            <span className="live-dot" />
            فارسیدل کلاسیک · {!isLocal && player?.local ? 'تمرین مهمان' : 'چالش روزانه'}
          </div>
          <h1>{meta.name}</h1>
          <p>{meta.category}</p>
        </div>
        {game === 'crossword' && !id ? (
          <CrosswordLibrary />
        ) : (
          <PlaySession
            key={game + ':' + (id || '') + ':' + day}
            game={game}
            id={id}
            paused={help}
          />
        )}
      </div>
      {help && (
        <Dialog title={'چطور ' + meta.name + ' بازی کنیم؟'} onClose={() => setHelp(false)}>
          <ul>
            {HELP[game].map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p>چالش جدید هر شب ساعت ۹ به وقت ایران منتشر می‌شود.</p>
          <button className="button" onClick={() => setHelp(false)}>
            شروع بازی
          </button>
        </Dialog>
      )}
    </Shell>
  );
}
function PlaySession({ game, id, paused }) {
  const [state, setState] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0),
    [guestPrompt, setGuestPrompt] = useState(false);
  const lock = useRef(false);
  const currentState = useRef(null);
  const { day, player } = useArcade();
  const guest = !!player?.local;
  useEffect(() => {
    let alive = true;
    getGame(game, id)
      .then((s) => {
        if (alive) {
          currentState.current = s;
          setState(s);
          setError('');
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [game, id, day, retry]);
  const action = useCallback(
    async (payload) => {
      if (lock.current) return null;
      lock.current = true;
      setBusy(true);
      setError('');
      try {
        const next = await act(
          game,
          {
            ...payload,
            round: currentState.current?.history.length ?? 0,
            day: currentState.current?.date,
          },
          id,
        );
        if (next.finished && !currentState.current?.finished && guest) setGuestPrompt(true);
        currentState.current = next;
        setState(next);
        return next;
      } catch (e) {
        setError(e.message);
        return null;
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [game, id, guest],
  );
  if (!state)
    return (
      <div className="game-surface">
        {error ? (
          <>
            <p className="game-error" role="alert">
              {error}
            </p>
            <button className="button" onClick={() => setRetry((n) => n + 1)}>
              تلاش دوباره
            </button>
          </>
        ) : (
          <div className="loading-state">
            <i className="loading-dot" />
            در حال آماده کردن بازی…
          </div>
        )}
      </div>
    );
  const shared = { state, action, busy: busy || paused };
  return (
    <div className="game-surface">
      {error && (
        <p className="game-error" role="alert">
          {error}
        </p>
      )}
      {guestPrompt && (
        <Dialog title="در جدول امتیازها حضور داشته باش" onClose={() => setGuestPrompt(false)}>
          <p>برای حضور در جدول امتیازها وارد شو یا حساب کاربری بساز.</p>
          <p>
            با حساب کاربری می‌توانی نتایج بازی‌های روزانه‌ات را ذخیره کنی و با دیگران رقابت کنی.
          </p>
          <div className="guest-auth-actions">
            <Link className="button" href="/login">
              ورود به حساب
            </Link>
            <Link className="button secondary-button" href="/register">
              ساخت حساب کاربری
            </Link>
          </div>
          <button className="text-button" onClick={() => setGuestPrompt(false)}>
            دیدن نتیجه
          </button>
        </Dialog>
      )}
      {state.finished ? (
        <Result state={state} />
      ) : (
        <>
          {game === 'wordle' && <Wordle {...shared} />}
          {game === 'factle' && <Factle {...shared} />}
          {game === 'colordle' && <Colordle {...shared} />}
          {game === 'memorydle' && <Memory key={state.history.length} {...shared} />}
          {game === 'chordle' && <Chordle key={state.history.length} {...shared} />}
          {game === 'teamdle' && <Teamdle key={state.history.length} {...shared} />}
          {game === 'crossword' && <Crossword {...shared} />}
        </>
      )}
    </div>
  );
}
function Wordle({ state, action, busy }) {
  const [guess, setGuess] = useState('');
  const length = state.puzzle.length;
  const status = {};
  const order = { absent: 1, present: 2, correct: 3 };
  for (const h of state.history)
    [...h.word].forEach((c, i) => {
      if ((order[status[c]] || 0) < order[h.result[i]]) status[c] = h.result[i];
    });
  const letter = useCallback(
    (c) => {
      if (!busy) setGuess((value) => (value.length < length ? value + normalize(c) : value));
    },
    [busy, length],
  );
  const remove = useCallback(() => {
    if (!busy) setGuess((value) => value.slice(0, -1));
  }, [busy]);
  const submit = useCallback(async () => {
    if (busy || guess.length !== length) return;
    const next = await action({ type: 'guess', word: guess });
    if (next) setGuess('');
  }, [action, busy, guess, length]);
  useEffect(() => {
    function onKey(e) {
      if (
        busy ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)
      )
        return;
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        remove();
      } else if (KEY_ROWS.join('').includes(normalize(e.key)) && e.key.length === 1) letter(e.key);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [letter, remove, submit, busy]);
  return (
    <>
      <div className="game-progress">
        <span>کلمهٔ امروز {fa(length)} حرف دارد</span>
        <span>{fa(state.history.length)} / ۶ تلاش</span>
      </div>
      <div className="word-grid" role="grid" aria-label="حدس‌های کلمه">
        {Array.from({ length: 6 }, (_, r) => (
          <div className="word-row" role="row" key={r}>
            {Array.from({ length }, (_, c) => {
              const h = state.history[r];
              const value = h?.word[c] || (r === state.history.length ? guess[c] : '');
              return (
                <div
                  role="gridcell"
                  aria-label={
                    value
                      ? value +
                        '، ' +
                        ({ correct: 'جای درست', present: 'جای نادرست', absent: 'در کلمه نیست' }[
                          h?.result[c]
                        ] || 'حدس جاری')
                      : 'خالی'
                  }
                  className={'letter-cell ' + (h?.result[c] || (value ? 'filled' : ''))}
                  key={c}
                >
                  {value}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="center-note">یک واژه حدس بزن. رنگ‌ها راه را نشانت می‌دهند.</p>
      <Keyboard
        onLetter={letter}
        onDelete={remove}
        onEnter={submit}
        disabled={busy}
        status={status}
      />
    </>
  );
}
function CountrySearch({ value, onChange, onSelect, disabled }) {
  const [open, setOpen] = useState(false);
  const matches = value.trim()
    ? catalog.countries.filter((c) => normalize(c.name).includes(normalize(value))).slice(0, 6)
    : [];
  return (
    <div className="country-search">
      <input
        className="input"
        role="combobox"
        aria-label="جستجوی کشور"
        aria-expanded={open && matches.length > 0}
        aria-controls="country-options"
        aria-autocomplete="list"
        value={value}
        disabled={disabled}
        placeholder="اسم کشور را بنویس…"
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'Enter') {
            e.preventDefault();
            const exact =
              matches.find((c) => normalize(c.name) === normalize(value)) ||
              (matches.length === 1 ? matches[0] : null);
            if (exact) {
              onSelect(exact);
              setOpen(false);
            }
          }
        }}
      />
      {open && matches.length > 0 && (
        <div className="suggestions" id="country-options" role="listbox">
          {matches.map((c) => (
            <button
              type="button"
              role="option"
              aria-selected={normalize(c.name) === normalize(value)}
              key={c.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(c);
                setOpen(false);
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function Factle({ state, action, busy }) {
  const [query, setQuery] = useState(''),
    [selection, setSelection] = useState(null),
    [review, setReview] = useState(null);
  const round = state.history.length;
  async function answer(skip = false) {
    const next = await action({ type: 'guess', country: selection?.id, skip });
    if (next) {
      setReview(next.history.at(-1));
      setQuery('');
      setSelection(null);
    }
  }
  return (
    <>
      <Progress index={round} total={5} score={state.score} max={5} />
      {review ? (
        <div className="round-reveal">
          <span className="result-sticker">{review.correct ? '🎯' : '🌍'}</span>
          <h3>{review.correct ? 'درست گفتی!' : 'این یکی ' + review.answer + ' بود.'}</h3>
          <p>
            {review.correct
              ? review.answer + '؛ یک امتیاز برای تو.'
              : 'یک کشور تازه، یک فرصت تازه.'}
          </p>
          <a className="source-link" href={review.source} target="_blank" rel="noreferrer">
            دربارهٔ این سرنخ بخوان
          </a>
          <button className="button full-button" onClick={() => setReview(null)}>
            سرنخ بعدی
            <Icon name="arrow" size={18} />
          </button>
        </div>
      ) : (
        <>
          <div className="fact-card">
            <div className="fact-label">سرنخ {fa(round + 1)} · این کشور کجاست؟</div>
            <p>{state.puzzle.rounds[round]?.fact}</p>
          </div>
          <CountrySearch
            value={query}
            onChange={(v) => {
              setQuery(v);
              setSelection(null);
            }}
            onSelect={(c) => {
              setQuery(c.name);
              setSelection(c);
            }}
            disabled={busy}
          />
          <div className="button-row">
            <button className="button" disabled={busy || !selection} onClick={() => answer()}>
              این کشوره!
            </button>
            <button className="text-button" disabled={busy} onClick={() => answer(true)}>
              این دور می‌گذرم
            </button>
          </div>
          <p className="center-note" style={{ marginTop: 16 }}>
            هر دور یک پاسخ. پنج کشور متفاوت در انتظار توست.
          </p>
        </>
      )}
    </>
  );
}
function Colordle({ state, action, busy }) {
  const now = useClock(),
    [pick, setPick] = useState([128, 128, 128]);
  const start = state.puzzle.revealedAt;
  const left = start ? remaining(start, 10000, now) : 0;
  return (
    <>
      {!start ? (
        <>
          <div className="color-swatch hidden-swatch">✳</div>
          <p className="center-note">
            ده ثانیه، فقط تو و یک رنگ.
            <br />
            وقتی آماده‌ای، شروع کن.
          </p>
          <button
            className="button full-button"
            disabled={busy}
            onClick={() => action({ type: 'reveal' })}
          >
            رنگ امروز را ببین
          </button>
        </>
      ) : left > 0 ? (
        <>
          <div className="color-swatch" style={{ background: state.puzzle.target.hex }} />
          <p className="center-note">خوب نگاه کن؛ قرار است از حافظه بسازیش.</p>
          <div className="large-countdown" aria-live="off">
            {fa(Math.ceil(left / 1000))}
          </div>
          <div className="timer-track">
            <i style={{ width: left / 100 + '%' }} />
          </div>
        </>
      ) : (
        <>
          <p className="center-note" style={{ marginBottom: 18 }}>
            حالا رنگی که دیدی را بساز.
          </p>
          <div className="color-swatch" style={{ background: 'rgb(' + pick.join(',') + ')' }} />
          {['قرمز', 'سبز', 'آبی'].map((name, i) => (
            <div className="slider-row" key={name}>
              <label htmlFor={'channel-' + i}>{name}</label>
              <input
                id={'channel-' + i}
                type="range"
                min="0"
                max="255"
                value={pick[i]}
                disabled={busy}
                onChange={(e) =>
                  setPick((value) => value.map((v, n) => (n === i ? Number(e.target.value) : v)))
                }
              />
              <span>{fa(pick[i])}</span>
            </div>
          ))}
          <button
            className="button full-button"
            disabled={busy}
            onClick={() => action({ type: 'color', rgb: pick })}
          >
            همین رنگ بود!
          </button>
        </>
      )}
    </>
  );
}
function Memory({ state, action, busy }) {
  const now = useClock(),
    [picks, setPicks] = useState([]),
    level = state.history.length,
    started = state.puzzle.startedAt[level],
    elapsed = started ? Math.max(0, now - started) : 0;
  const targets = state.puzzle.targets?.[level],
    index = Math.floor(elapsed / 2400),
    running = started && elapsed < 12000;
  const shown = running && elapsed % 2400 < 2000 ? targets?.[index] : null;
  return (
    <>
      <Progress index={level} total={2} score={state.score} max={10} />
      {!started ? (
        <>
          <div className="number-display">{level === 0 ? '۱۲' : '۱۲۳'}</div>
          <p className="center-note">
            پنج عدد را به خاطر بسپار.
            <br />
            {level === 0 ? 'مرحلهٔ اول: اعداد دو رقمی' : 'مرحلهٔ دوم: اعداد سه رقمی'}
          </p>
          <button
            className="button full-button"
            disabled={busy}
            onClick={() => action({ type: 'start' })}
          >
            آماده‌ام؛ اعداد را نشان بده
          </button>
        </>
      ) : running ? (
        <>
          <p className="center-note">فقط نگاه کن و به خاطر بسپار…</p>
          <div className="number-display" aria-live="polite">
            {shown === null ? '·' : fa(shown)}
          </div>
          <div className="round-dots" style={{ justifyContent: 'center' }}>
            {targets?.map((n, i) => (
              <i key={n} className={i === index ? 'current' : i < index ? 'done' : ''} />
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="center-note" style={{ marginBottom: 16 }}>
            کدام پنج عدد را دیدی؟ <b>{fa(picks.length)} / ۵</b>
          </p>
          <div className="number-grid">
            {state.puzzle.grids[level].map((n) => (
              <button
                className={picks.includes(n) ? 'selected' : ''}
                aria-pressed={picks.includes(n)}
                key={n}
                disabled={busy}
                onClick={() =>
                  setPicks((value) =>
                    value.includes(n)
                      ? value.filter((x) => x !== n)
                      : value.length < 5
                        ? [...value, n]
                        : value,
                  )
                }
              >
                {fa(n)}
              </button>
            ))}
          </div>
          <button
            className="button full-button"
            disabled={busy || picks.length !== 5}
            onClick={() => action({ type: 'memory', picks })}
          >
            {level === 0 ? 'ثبت و رفتن به مرحلهٔ بعد' : 'ثبت نهایی'}
          </button>
        </>
      )}
    </>
  );
}
function Chordle({ state, action, busy }) {
  const [slots, setSlots] = useState(Array(5).fill(null)),
    [selected, setSelected] = useState(null),
    [playing, setPlaying] = useState(false),
    [heard, setHeard] = useState(false);
  const timers = useRef([]);
  const { notify } = useArcade();
  const round = state.history.length;
  const labels = ['گیتار', 'پیانو', 'درامز'];
  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    stopAudio();
  }, []);
  useEffect(() => () => clear(), [clear]);
  async function play(index) {
    try {
      await sound(state.puzzle.chords[index].notes, round, index);
    } catch {
      notify('مرورگر اجازهٔ پخش صدا نداد. دوباره روی دکمه بزن.');
    }
  }
  async function sequence() {
    clear();
    try {
      await unlockAudio();
    } catch {
      notify('پخش صدا در دسترس نیست. دوباره امتحان کن.');
      return;
    }
    setPlaying(true);
    setHeard(true);
    state.puzzle.sequences[round].forEach((n, i) =>
      timers.current.push(setTimeout(() => play(n), i * 1100)),
    );
    timers.current.push(setTimeout(() => setPlaying(false), 5500));
  }
  return (
    <>
      <Progress index={round} total={3} score={state.score} max={15} />
      <p className="center-note">
        دور {fa(round + 1)} · {labels[round]}
      </p>
      <button className="button full-button secondary-button" disabled={busy} onClick={sequence}>
        <Icon name="sound" />
        {playing ? 'از اول بشنو' : heard ? 'توالی را دوباره بشنو' : 'توالی امروز را بشنو'}
      </button>
      <div className="music-slots">
        {slots.map((n, i) => (
          <button
            key={i}
            aria-label={'خانهٔ ' + fa(i + 1) + (n === null ? '، خالی' : '، صدای ' + fa(n + 1))}
            disabled={busy || playing}
            className={n === null ? '' : 'filled'}
            onClick={() => {
              if (selected === null) {
                setSlots((v) => v.map((x, j) => (j === i ? null : x)));
              } else {
                setSlots((v) => v.map((x, j) => (j === i ? selected : x)));
                setSelected(null);
              }
            }}
          >
            {n === null ? '·' : fa(n + 1)}
          </button>
        ))}
      </div>
      <p className="center-note">
        {selected === null ? 'یک صدا را انتخاب کن، بعد روی خانه‌اش بزن.' : 'حالا روی یک خانه بزن.'}
      </p>
      <div className="sound-grid">
        {state.puzzle.chords.map((c, i) => (
          <button
            key={c.name}
            disabled={busy || playing}
            aria-label={'صدای ' + fa(i + 1)}
            aria-pressed={selected === i}
            className={selected === i ? 'selected' : ''}
            onClick={() => {
              play(i);
              setSelected(i);
            }}
          >
            <small>♪</small>
            {fa(i + 1)}
          </button>
        ))}
      </div>
      <button
        className="button full-button"
        disabled={busy || playing || !heard || slots.includes(null)}
        onClick={() => action({ type: 'chords', slots })}
      >
        ثبت ترتیب صداها
      </button>
    </>
  );
}
function Teamdle({ state, action, busy }) {
  const now = useClock(),
    index = state.history.length,
    question = state.puzzle.rounds[index],
    started = state.puzzle.startedAt[index],
    left = started ? remaining(started, 6000, now) : 6000;
  const sent = useRef(false);
  useEffect(() => {
    if (started && left === 0 && !sent.current && !busy) {
      sent.current = true;
      action({ type: 'capital', answer: null });
    }
  }, [left, started, action, busy]);
  return (
    <>
      <Progress index={index} total={4} score={state.score} max={4} />
      <div className="score-tag" style={{ textAlign: 'center', marginBottom: 20 }}>
        {state.puzzle.team === 'coral' || state.puzzle.team === 'red'
          ? '🔴 تیم مرجانی'
          : '🔵 تیم آبی'}
        {isLocal ? ' · تمرین محلی' : ''}
      </div>
      {!started ? (
        <>
          <div className="fact-card">
            <p>سؤال {fa(index + 1)} آماده است.</p>
          </div>
          <p className="center-note">با شروع سؤال، شش ثانیه وقت داری.</p>
          <button
            className="button full-button"
            disabled={busy}
            onClick={() => action({ type: 'start' })}
          >
            شروع سؤال
          </button>
        </>
      ) : (
        <>
          <div className="fact-card">
            <div className="fact-label">پایتخت کدام شهر است؟</div>
            <p>{question.name}</p>
          </div>
          <div className="timer-track">
            <i style={{ width: left / 60 + '%' }} />
          </div>
          <p className="center-note" aria-live="off">
            {fa(Math.ceil(left / 1000))} ثانیه
          </p>
          <div className="capital-choices">
            {question.choices.map((choice) => (
              <button
                key={choice}
                disabled={busy || left === 0}
                onClick={() => action({ type: 'capital', answer: choice })}
              >
                {choice}
              </button>
            ))}
          </div>
          {left === 0 && !busy && (
            <button
              className="button full-button secondary-button"
              onClick={() => action({ type: 'capital', answer: null })}
            >
              ثبت پایان زمان
            </button>
          )}
        </>
      )}
    </>
  );
}
function MiniBoardPreview({ puzzle }) {
  return (
    <div
      className="crossword-board crossword-preview"
      role="img"
      aria-label={'نمای جدول ' + puzzle.title}
      style={{ gridTemplateColumns: 'repeat(' + puzzle.cols + ', var(--cell, 39px))' }}
    >
      {Array.from({ length: puzzle.rows * puzzle.cols }, (_, i) => {
        const row = Math.floor(i / puzzle.cols),
          col = i % puzzle.cols;
        const black = puzzle.blackCells.some(([r, c]) => r === row && c === col);
        const number = puzzle.slots.find((s) => s.row === row && s.col === col)?.number;
        return (
          <span key={i} className={'crossword-cell' + (black ? ' black' : '')}>
            {!black && number && <small>{fa(number)}</small>}
          </span>
        );
      })}
    </div>
  );
}
function CrosswordLibrary() {
  return (
    <div className="crossword-catalog">
      {catalog.crosswords.map((c) => (
        <div className="crossword-card" key={c.id}>
          <div className="mini-grid-preview" aria-hidden="true">
            {Array.from({ length: c.rows * c.cols }, (_, i) => (
              <i
                key={i}
                className={
                  c.blackCells.some(
                    ([r, col]) => r === Math.floor(i / c.cols) && col === i % c.cols,
                  )
                    ? 'black'
                    : ''
                }
              />
            ))}
          </div>
          <div style={{ flex: 1 }}>
            <h2>{c.title}</h2>
            <p>
              {fa(c.rows)} × {fa(c.cols)} · {fa(c.cost)} سکه
            </p>
          </div>
          <Link className="button secondary-button" href={'/classic/crossword?id=' + c.id}>
            باز کن
            <Icon name="arrow" size={15} />
          </Link>
        </div>
      ))}
      <p className="center-note">هر جدول را یک بار باز کن و هر وقت خواستی ادامه بده.</p>
    </div>
  );
}
function Crossword({ state, action, busy }) {
  const p = state.puzzle,
    [cell, setCell] = useState(null),
    [direction, setDirection] = useState('across');
  const slots = p.slots;
  const active = slots.find(
    (slot) =>
      slot.direction === direction &&
      cell &&
      Array.from(
        { length: slot.length },
        (_, i) =>
          slot.row +
          (slot.direction === 'down' ? i : 0) +
          '_' +
          (slot.col + (slot.direction === 'across' ? i : 0)),
      ).includes(cell),
  );
  const select = (key) => {
    if (cell === key) setDirection((d) => (d === 'across' ? 'down' : 'across'));
    else {
      setCell(key);
      const options = slots.filter((s) =>
        Array.from(
          { length: s.length },
          (_, i) =>
            s.row +
            (s.direction === 'down' ? i : 0) +
            '_' +
            (s.col + (s.direction === 'across' ? i : 0)),
        ).includes(key),
      );
      if (!options.some((s) => s.direction === direction) && options[0])
        setDirection(options[0].direction);
    }
  };
  const letter = useCallback(
    async (value) => {
      if (!cell || busy) return;
      const next = await action({ type: 'letter', cell, letter: value });
      if (next && value && active) {
        const [r, c] = cell.split('_').map(Number);
        const nextRow = r + (direction === 'down' ? 1 : 0),
          nextCol = c + (direction === 'across' ? 1 : 0);
        if (
          nextRow < active.row + (direction === 'down' ? active.length : 1) &&
          nextCol < active.col + (direction === 'across' ? active.length : 1)
        )
          setCell(nextRow + '_' + nextCol);
      }
    },
    [cell, busy, action, active, direction],
  );
  useEffect(() => {
    const onKey = (e) => {
      if (busy || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === 'Backspace') {
        e.preventDefault();
        letter('');
      } else if (e.key.length === 1 && KEY_ROWS.join('').includes(normalize(e.key)))
        letter(normalize(e.key));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [letter, busy]);
  if (!p.unlocked)
    return (
      <div className="results">
        <MiniBoardPreview puzzle={p} />
        <h2>{p.title}</h2>
        <p className="center-note">
          ده سرنخ، یک جدول ۵ × ۵.
          <br />
          با {fa(p.cost)} سکه بازش کن؛ برای همیشه مال توست.
        </p>
        <button
          className="button full-button"
          disabled={busy}
          onClick={() => action({ type: 'purchase' })}
        >
          <span className="coin">✦</span>باز کردن جدول · {fa(p.cost)} سکه
        </button>
        <Link href="/classic" className="text-button" style={{ display: 'block' }}>
          بازی کن و سکه جمع کن
        </Link>
      </div>
    );
  const activeCells = active
    ? Array.from(
        { length: active.length },
        (_, i) =>
          active.row +
          (direction === 'down' ? i : 0) +
          '_' +
          (active.col + (direction === 'across' ? i : 0)),
      )
    : [];
  return (
    <>
      <h2 style={{ textAlign: 'center', fontSize: 20 }}>{p.title}</h2>
      <div
        className="crossword-board"
        style={{ gridTemplateColumns: 'repeat(' + p.cols + ', var(--cell, 39px))' }}
      >
        {Array.from({ length: p.rows * p.cols }, (_, i) => {
          const r = Math.floor(i / p.cols),
            c = i % p.cols,
            key = r + '_' + c,
            black = p.blackCells.some(([br, bc]) => br === r && bc === c);
          const number = slots
            .filter((s) => s.row === r && s.col === c)
            .map((s) => s.number)
            .sort((a, b) => a - b)[0];
          return black ? (
            <span className="crossword-cell black" key={key} />
          ) : (
            <button
              key={key}
              disabled={busy}
              className={
                'crossword-cell ' +
                (cell === key ? 'selected' : activeCells.includes(key) ? 'active-slot' : '') +
                ' ' +
                (p.correct[key] === false ? 'bad' : p.correct[key] === true ? 'good' : '')
              }
              onClick={() => select(key)}
              aria-label={
                'ردیف ' + fa(r + 1) + ' ستون ' + fa(c + 1) + ' ' + (p.letters[key] || 'خالی')
              }
            >
              <small>{fa(number || '')}</small>
              {p.letters[key] || ''}
            </button>
          );
        })}
      </div>
      <div className="clue">
        {active
          ? fa(active.number) +
            ' ' +
            (direction === 'across' ? 'افقی' : 'عمودی') +
            ' · ' +
            active.clue
          : 'روی یک خانه یا سرنخ بزن.'}
      </div>
      <Keyboard onLetter={letter} onDelete={() => letter('')} disabled={busy || !cell} />
      <div className="clue-list">
        {['across', 'down'].map((dir) => (
          <div key={dir}>
            <h3>{dir === 'across' ? 'افقی' : 'عمودی'}</h3>
            {slots
              .filter((s) => s.direction === dir)
              .map((s) => (
                <button
                  key={s.number}
                  className={active?.number === s.number && direction === dir ? 'active' : ''}
                  onClick={() => {
                    setCell(s.row + '_' + s.col);
                    setDirection(dir);
                  }}
                >
                  {fa(s.number)}. {s.clue}
                </button>
              ))}
          </div>
        ))}
      </div>
      <button
        className="button full-button"
        disabled={busy}
        onClick={() => action({ type: 'check' })}
      >
        بررسی جواب‌ها
      </button>
    </>
  );
}
function Result({ state }) {
  const { notify, player } = useArcade(),
    timer = useCountdown();
  const meta = gameById(state.game);
  const share = async () => {
    const grid =
      state.game === 'wordle'
        ? state.history
            .map((h) =>
              h.result.map((c) => ({ correct: '🟩', present: '🟨', absent: '⬜' })[c]).join(''),
            )
            .join('\n')
        : '';
    const text =
      'فارسیدل کلاسیک · ' +
      meta.name +
      '\n' +
      state.date +
      '\n' +
      fa(state.score) +
      ' / ' +
      fa(state.max) +
      '\n' +
      grid +
      '\nfarsidle.com/classic/' +
      state.game;
    try {
      await navigator.clipboard.writeText(text);
      notify('نتیجه کپی شد.');
    } catch {
      notify('کپی خودکار در این مرورگر در دسترس نیست.');
    }
  };
  return (
    <div className="results">
      <div className="result-sticker">{state.won ? '✓' : '—'}</div>
      <h2>{state.won ? 'بازی با موفقیت تمام شد' : 'بازی تمام شد'}</h2>
      <p className="center-note">چالش امروز {meta.name} تمام شد.</p>
      <div className="result-score">
        {fa(state.score)}
        <small> / {fa(state.max)}</small>
      </div>
      {state.answer && <div className="result-answer">{state.answer}</div>}
      {state.game === 'colordle' && (
        <div className="color-comparison">
          <div>
            <i style={{ background: state.puzzle.target.hex }} />
            <span>رنگ امروز · {state.puzzle.target.name}</span>
          </div>
          <div>
            <i style={{ background: state.puzzle.guess }} />
            <span>رنگ تو</span>
          </div>
        </div>
      )}
      {state.reward > 0 && (!player?.local || isLocal) && (
        <div className="reward-banner">
          <span className="coin">✦</span>
          {fa(state.reward)} سکه به موجودی اضافه شد.
        </div>
      )}
      {['factle', 'teamdle', 'memorydle', 'chordle'].includes(state.game) && (
        <div className="result-history">
          {state.history.map((h, i) => (
            <div key={i}>
              <span>{h.correct === true ? '✓' : h.correct === false ? '○' : '♪'}</span>
              <span>
                {h.answer ||
                  (state.game === 'memorydle' ? 'مرحلهٔ ' + fa(i + 1) : 'دور ' + fa(i + 1))}
              </span>
              <small>
                {typeof h.score === 'number'
                  ? fa(h.score) + ' / ۵'
                  : h.correct
                    ? 'درست'
                    : 'فرصت بعدی'}
              </small>
            </div>
          ))}
        </div>
      )}
      {state.game === 'teamdle' && isLocal && (
        <p className="local-note">
          این دور تمرین محلی بود. رقابت تیمی و پاداش برد، پس از اتصال نسخهٔ جدید به سرور فعال
          می‌شود.
        </p>
      )}
      <div className="button-row">
        <button className="button secondary-button" onClick={share}>
          <Icon name="share" size={18} />
          اشتراک نتیجه
        </button>
        <Link
          className="button"
          href={
            state.game === 'crossword' ? '/classic/crossword' : '/leaderboard?game=' + state.game
          }
        >
          <Icon name="trophy" size={18} />
          برترین‌ها
        </Link>
      </div>
      <Link className="button full-button ink-button" href="/classic">
        یک بازی دیگر
        <Icon name="arrow" size={18} />
      </Link>
      {state.game !== 'crossword' && (
        <p className="next-reset">
          فرصت بعدی تا<b dir="ltr">{timer === null ? '—' : countdown(timer)}</b>
        </p>
      )}
    </div>
  );
}
