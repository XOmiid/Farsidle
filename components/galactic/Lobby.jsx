'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/arcade/Shell';
import { useArcade } from '@/components/arcade/Provider';
import { fa } from '@/lib/classic/rules.mjs';
import { call } from '@/lib/galactic/gateway';
import { Access, phaseLabel } from './Common';
export default function Lobby() {
  const { player } = useArcade(),
    router = useRouter();
  const signed = player && !player.local;
  const [list, setList] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [title, setTitle] = useState('جام دوستان'),
    [capacity, setCapacity] = useState(4),
    [isPublic, setPublic] = useState(false),
    [code, setCode] = useState('');
  const refresh = useCallback(async () => {
    try {
      setList(await call('lobbies'));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    if (!signed) return;
    const timer = setInterval(refresh, 10000);
    const initial = setTimeout(refresh, 0);
    return () => {
      clearInterval(timer);
      clearTimeout(initial);
    };
  }, [signed, refresh]);
  async function enter(action, args) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const room = await call(action, args);
      router.push('/galactic/room/' + room.code);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <Shell>
      <div className="galactic">
        <section className="g-hero">
          <div>
            <span className="g-kicker">FARSIDLE / FOOTBALL</span>
            <h1>
              کهکشانی<span>تیم تو. جام شما.</span>
            </h1>
            <p>بازیکنان را انتخاب کنید، تیم‌ها را ببندید و مسابقات را با هم تماشا کنید.</p>
            <div className="g-hero-tags">
              <span>۲ تا ۸ نفر</span>
              <span>انتخاب نوبتی</span>
              <span>مسابقات حذفی</span>
            </div>
          </div>
          <div className="g-orbit" aria-hidden="true">
            <i />
            <i />
            <span>۱۱</span>
            <small>کهکشانی</small>
          </div>
        </section>
        <div className="g-steps">
          <div>
            <b>۰۱</b>
            <span>آرایش و تاکتیک</span>
          </div>
          <div>
            <b>۰۲</b>
            <span>انتخاب یازده بازیکن</span>
          </div>
          <div>
            <b>۰۳</b>
            <span>رقابت تا قهرمانی</span>
          </div>
        </div>
        {!player ? (
          <p role="status">در حال بررسی حساب…</p>
        ) : !signed ? (
          <Access />
        ) : (
          <>
            <div className="g-columns">
              <form
                className="g-panel"
                onSubmit={(e) => {
                  e.preventDefault();
                  enter('create', {
                    p_title: title,
                    p_public: isPublic,
                    p_capacity: Number(capacity),
                  });
                }}
              >
                <span className="g-kicker">میزبان باش</span>
                <h2>یک جام تازه بساز</h2>
                <label>
                  نام اتاق
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    minLength={2}
                    maxLength={40}
                    required
                  />
                </label>
                <label>
                  ظرفیت
                  <select value={capacity} onChange={(e) => setCapacity(e.target.value)}>
                    {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option value={n} key={n}>
                        {fa(n)} نفر
                      </option>
                    ))}
                  </select>
                </label>
                <label className="g-checkbox">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setPublic(e.target.checked)}
                  />
                  اتاق عمومی؛ دیگران هم می‌توانند بپیوندند
                </label>
                <p className="g-muted">اتاق خصوصی فقط با لینک یا کد دعوت در دسترس است.</p>
                <button disabled={busy} className="button ink-button">
                  ساخت اتاق
                </button>
              </form>
              <div className="g-panel">
                <span className="g-kicker">دعوت شدی؟</span>
                <h2>به جمع بپیوند</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    enter('join', { p_code: code });
                  }}
                >
                  <label>
                    کد اتاق
                    <input
                      dir="ltr"
                      autoCapitalize="characters"
                      autoComplete="off"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      required
                      maxLength={24}
                      placeholder="XXXXXXXXXX"
                    />
                  </label>
                  <button className="button" disabled={busy || !code.trim()}>
                    پیوستن به اتاق
                  </button>
                </form>
                <div className="g-session-note">
                  <b>برای بازی وقت بگذار</b>
                  <p>
                    هر انتخاب حداکثر ۶۰ ثانیه و هر مسابقه حدود ۵ دقیقه طول می‌کشد. وقت اضافه و
                    پنالتی زمان بیشتری می‌برند. جام هشت‌نفره، بدون احتساب انتخاب‌ها، حدود ۳۵ دقیقه
                    است.
                  </p>
                </div>
              </div>
            </div>
            {error && (
              <p className="g-error" role="alert">
                {error}
                <button onClick={refresh}>تلاش دوباره</button>
              </p>
            )}
            {!!list?.mine.length && (
              <section className="g-panel">
                <h2>اتاق‌های من</h2>
                <div className="g-room-list">
                  {list.mine.map((r) => (
                    <Link href={'/galactic/room/' + r.code} key={r.code}>
                      <b>{r.title}</b>
                      <span>{phaseLabel[r.phase]}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
            <section className="g-panel">
              <div className="g-section-title">
                <h2>اتاق‌های عمومی</h2>
                <button className="g-text-button" onClick={refresh} disabled={busy}>
                  به‌روزرسانی
                </button>
              </div>
              {!list ? (
                <p className="g-muted">
                  {error ? 'فهرست در دسترس نیست.' : 'در حال دریافت اتاق‌ها…'}
                </p>
              ) : !list.rooms.length ? (
                <p className="g-muted">هنوز اتاق عمومی باز نیست. اولین جام را بساز.</p>
              ) : (
                <div className="g-room-list">
                  {list.rooms.map((r) => (
                    <button
                      disabled={busy || r.count >= r.capacity}
                      key={r.code}
                      onClick={() => enter('join', { p_code: r.code })}
                    >
                      <span>
                        <b>{r.title}</b>
                        <small>میزبان: {r.host}</small>
                      </span>
                      <span>
                        {fa(r.count)} / {fa(r.capacity)} نفر ←
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
        <details className="g-panel g-rules">
          <summary>قوانین و امتیاز بازیکنان</summary>
          <p>
            ترتیب انتخاب رفت‌وبرگشتی است؛ نفر اول تا آخر، سپس از آخر به اول. هر بازیکن تنها عضو یک
            تیم می‌شود. پس از ۶۰ ثانیه، سیستم با توجه به جایگاه‌های خالی انتخاب می‌کند.
          </p>
          <p>
            آرایش و تاکتیک پیش از انتخاب بازیکن تعیین می‌شوند و با شروع انتخاب قفل می‌شوند. استفاده
            از بازیکن در پست دیگر آزاد است، با افت عملکرد مشخص. بعد از تکمیل تیم‌ها، قرعه‌کشی انجام
            می‌شود؛ جای خالی جدول، استراحت است.
          </p>
          <p>
            قدرت خط‌ها، دروازه‌بان، پست بازیکنان، خستگی و تاکتیک بر احتمال اتفاق‌ها اثر دارند؛ نتیجه
            قطعی نیست. زمین بی‌طرف است. تساوی با وقت اضافه و سپس پنالتی تعیین می‌شود.
          </p>
          <p>
            فهرست آغازین شامل بازیکنان واقعی از پنج لیگ بزرگ اروپاست. امتیازها برآورد اختصاصی
            فارسیدل هستند و به EA یا آمار رسمی یک فصل تعلق ندارند. فهرست هر اتاق تا پایان جام ثابت
            می‌ماند.
          </p>
        </details>
      </div>
    </Shell>
  );
}
