'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Shell from '@/components/arcade/Shell';
import { useArcade } from '@/components/arcade/Provider';
import { getSupabase } from '@/lib/classic/gateway';
const CATS = [
  'اسم',
  'فامیل',
  'رنگ',
  'غذا',
  'حیوان',
  'کشور',
  'شهر',
  'ماشین',
  'اشیا',
  'میوه',
  'گل',
  'شغل',
  'ورزش',
  'فیلم',
  'اعضای بدن',
  'لباس',
];
const fa = (n) => new Intl.NumberFormat('fa-IR').format(n);
export default function Lobby() {
  const { player } = useArcade(),
    router = useRouter(),
    [cats, setCats] = useState(CATS.slice(0, 10)),
    [title, setTitle] = useState('اسم و فامیل دوستان'),
    [capacity, setCapacity] = useState(4),
    [rounds, setRounds] = useState(5),
    [seconds, setSeconds] = useState(60),
    [pub, setPub] = useState(false),
    [code, setCode] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [lobbies, setLobbies] = useState([]),
    [lobbyError, setLobbyError] = useState('');
  const signedIn = Boolean(player && !player.local);
  function moveCategory(index, direction) {
    setCats((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  const refreshLobbies = useCallback(async () => {
    if (!signedIn) return;
    try {
      const sb = await getSupabase();
      const { data, error } = await sb.rpc('name_family_lobbies');
      if (error) throw error;
      setLobbies(data || []);
      setLobbyError('');
    } catch (e) {
      setLobbyError(e.message);
    }
  }, [signedIn]);
  useEffect(() => {
    const initial = setTimeout(refreshLobbies, 0);
    const timer = setInterval(refreshLobbies, 8000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [refreshLobbies]);
  async function act(fn, args) {
    setBusy(true);
    setError('');
    try {
      const sb = await getSupabase();
      const { data, error } = await sb.rpc('name_family_' + fn, args);
      if (error) throw error;
      if (fn === 'create' || fn === 'join') router.push('/name-family/room/' + data.code);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell>
      <section className="g-panel" dir="rtl">
        <span className="g-kicker">بازی گروهی فارسی</span>
        <h1>اسم و فامیل</h1>
        <p>با یک حرف مشترک، خانه‌ها را پر کنید؛ بعد جواب‌ها را با هم بررسی کنید.</p>
        {!signedIn ? (
          <>
            <p>برای ساخت اتاق یا پیوستن به بازی گروهی وارد حساب شوید.</p>
            <div className="g-actions">
              <Link className="button ink-button" href="/login?next=%2Fname-family">
                ورود
              </Link>
              <Link className="button" href="/register?next=%2Fname-family">
                ساخت حساب
              </Link>
            </div>
          </>
        ) : (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                act('create', {
                  p_title: title,
                  p_public: pub,
                  p_capacity: +capacity,
                  p_categories: cats,
                  p_rounds: +rounds,
                  p_seconds: +seconds,
                });
              }}
            >
              <label>
                نام اتاق
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength="40"
                  required
                />
              </label>
              <label>
                ظرفیت
                <select value={capacity} onChange={(e) => setCapacity(e.target.value)}>
                  {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label>
                تعداد دور
                <select value={rounds} onChange={(e) => setRounds(e.target.value)}>
                  {[1, 3, 5, 7, 10, 15, 20].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label>
                زمان هر دور
                <select value={seconds} onChange={(e) => setSeconds(e.target.value)}>
                  <option value="30">۳۰ ثانیه</option>
                  <option value="45">۴۵ ثانیه</option>
                  <option value="60">۶۰ ثانیه</option>
                  <option value="90">۹۰ ثانیه</option>
                  <option value="120">۱۲۰ ثانیه</option>
                  <option value="0">تا زمانی که کسی «استپ» بزند</option>
                </select>
              </label>
              <label>
                <input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} />{' '}
                اتاق عمومی
              </label>
              <h2>ستون‌های بازی</h2>
              <p>ترتیب این فهرست، ترتیب بررسی ستون‌ها را در پایان هر دور مشخص می‌کند.</p>
              <ol className="nf-order-list" aria-label="ترتیب ستون‌های انتخاب‌شده">
                {cats.map((category, index) => (
                  <li key={category}>
                    <strong>
                      {fa(index + 1)}. {category}
                    </strong>
                    <span className="nf-order-actions">
                      <button
                        type="button"
                        className="button"
                        aria-label={'انتقال ' + category + ' به بالاتر'}
                        disabled={index === 0}
                        onClick={() => moveCategory(index, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="button"
                        aria-label={'انتقال ' + category + ' به پایین‌تر'}
                        disabled={index === cats.length - 1}
                        onClick={() => moveCategory(index, 1)}
                      >
                        ↓
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
              <div className="g-mode-choice">
                {CATS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    aria-pressed={cats.includes(c)}
                    onClick={() =>
                      setCats((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]))
                    }
                  >
                    {c}
                  </button>
                ))}
              </div>
              <button className="button ink-button" disabled={busy || cats.length < 4}>
                ساخت اتاق
              </button>
            </form>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                act('join', { p_code: code });
              }}
            >
              <label>
                کد دعوت
                <input dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} required />
              </label>
              <button className="button" disabled={busy}>
                پیوستن به اتاق
              </button>
            </form>
            <section aria-labelledby="nf-public-lobbies">
              <h2 id="nf-public-lobbies">اتاق‌های عمومی</h2>
              <p>به یکی از اتاق‌هایی بپیوندید که هنوز بازی را شروع نکرده‌اند.</p>
              {lobbies.length ? (
                <div className="nf-lobbies">
                  {lobbies.map((lobby) => (
                    <article className="nf-lobby-card" key={lobby.code}>
                      <div>
                        <h3>{lobby.title}</h3>
                        <p>
                          {fa(lobby.players)} از {fa(lobby.capacity)} بازیکن · {fa(lobby.rounds)}{' '}
                          دور
                        </p>
                        <small>{lobby.categories.join('، ')}</small>
                      </div>
                      <button
                        className="button"
                        disabled={busy || lobby.players >= lobby.capacity}
                        onClick={() => act('join', { p_code: lobby.code })}
                      >
                        پیوستن
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <p>{lobbyError || 'در حال حاضر اتاق عمومی در دسترس نیست.'}</p>
              )}
            </section>
          </>
        )}
        {error && <p role="alert">{error}</p>}
        <p>
          پاسخ یکتای درست ۱۰، تنها پاسخ درست در ستون ۲۰، پاسخ تکراری ۵ و پاسخ نادرست صفر امتیاز
          می‌گیرد.
        </p>
        <details className="nf-guide">
          <summary>راهنمای بازی</summary>
          <ol>
            <li>اتاق بسازید یا با کد دعوت وارد اتاق دوستان شوید؛ میزبان بازی را شروع می‌کند.</li>
            <li>در هر دور، همه با یک حرف تصادفی فارسی خانه‌های انتخاب‌شده را پر می‌کنند.</li>
            <li>
              پاسخ‌ها هنگام نوشتن خودکار ذخیره می‌شوند. با زدن «استپ»، دیگران ۵ ثانیه برای تکمیل
              پاسخ‌ها فرصت دارند؛ زمان دور هم آن را می‌بندد.
            </li>
            <li>
              پاسخ هر نفر را بازیکنان دیگر بررسی می‌کنند. هر بازیکن فقط به پاسخ دیگران رأی می‌دهد و
              اکثریت لازم است.
            </li>
            <li>
              برای جواب درست و یکتا ۱۰، جواب درست تکراری ۵ و تنها جواب ثبت‌شدهٔ درست در ستون ۲۰
              امتیاز می‌گیرید.
            </li>
          </ol>
        </details>
      </section>
    </Shell>
  );
}
