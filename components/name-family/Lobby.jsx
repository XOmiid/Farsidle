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
  'نام رستوران',
  'نام کافه',
  'باشگاه فوتبال',
  'فوتبالیست',
  'برند',
  'نوشیدنی',
  'شیرینی',
  'بازیگر',
  'خواننده',
  'بازی ویدیویی',
  'کتاب',
  'ساز',
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
      <div className="galactic nf-screen" dir="rtl">
        <header className="g-hero nf-hero">
          <div className="nf-hero-copy">
            <span className="g-kicker">FARSIDLE / PERSIAN WORDS</span>
            <h1>
              اسم و فامیل<span>یک حرف، چند جواب، یک رقابت دوستانه.</span>
            </h1>
            <p>با دوستانتان جواب بنویسید، برای پاسخ‌ها رأی بدهید و امتیاز جمع کنید.</p>
            <div className="g-hero-tags">
              <span>۲ تا ۸ نفر</span>
              <span>موضوع‌های انتخابی</span>
              <span>بازی گروهی</span>
            </div>
          </div>
          <div className="g-orbit nf-orbit" aria-hidden="true">
            <i />
            <i />
            <span>ا</span>
            <small>اسم و فامیل</small>
          </div>
        </header>

        <div className="g-steps nf-steps" aria-label="مراحل بازی">
          <div>
            <b>۰۱</b>
            <span>اتاق و موضوع‌ها را تنظیم کنید</span>
          </div>
          <div>
            <b>۰۲</b>
            <span>با حرف مشترک جواب بنویسید</span>
          </div>
          <div>
            <b>۰۳</b>
            <span>جواب‌ها را بررسی کنید</span>
          </div>
        </div>

        {error && signedIn && <p className="nf-error" role="alert">{error}</p>}

        {!signedIn ? (
          <section className="g-panel nf-card nf-access-card">
            <div>
              <span className="g-kicker">بازی با دوستان</span>
              <h2>برای ساخت اتاق وارد حساب شوید</h2>
              <p>با حساب کاربری می‌توانید اتاق بسازید، دوستانتان را دعوت کنید و امتیازها را ثبت کنید.</p>
            </div>
            <div className="g-actions">
              <Link className="button ink-button" href="/login?next=%2Fname-family">
                ورود
              </Link>
              <Link className="button" href="/register?next=%2Fname-family">
                ساخت حساب
              </Link>
            </div>
          </section>
        ) : (
          <>
            <div className="nf-lobby-layout">
              <main className="nf-lobby-main">
                <form
                  className="g-panel nf-card nf-create-card"
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
                  <header className="nf-card-heading">
                    <span className="nf-step-number">۰۱</span>
                    <div>
                      <span className="g-kicker">تنظیم بازی</span>
                      <h2>ساخت اتاق</h2>
                      <p>موضوع‌ها و زمان هر دور را مطابق جمع خودتان انتخاب کنید.</p>
                    </div>
                  </header>

                  <div className="nf-form-grid">
                    <label className="nf-field nf-field-wide">
                      نام اتاق
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength="40"
                        required
                      />
                    </label>
                    <label className="nf-field">
                      ظرفیت بازیکنان
                      <select value={capacity} onChange={(e) => setCapacity(e.target.value)}>
                        {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                    <label className="nf-field">
                      تعداد دورها
                      <select value={rounds} onChange={(e) => setRounds(e.target.value)}>
                        {[1, 3, 5, 7, 10, 15, 20].map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                    <label className="nf-field nf-field-wide">
                      زمان هر دور
                      <select value={seconds} onChange={(e) => setSeconds(e.target.value)}>
                        <option value="30">۳۰ ثانیه</option>
                        <option value="45">۴۵ ثانیه</option>
                        <option value="60">۶۰ ثانیه</option>
                        <option value="90">۹۰ ثانیه</option>
                        <option value="120">۱۲۰ ثانیه</option>
                        <option value="0">بدون محدودیت؛ پایان با «استپ»</option>
                      </select>
                    </label>
                    <label className="g-checkbox nf-public-toggle">
                      <input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} />
                      <span>
                        <strong>اتاق عمومی</strong>
                        <small>اتاق در فهرست بازی‌ها نمایش داده می‌شود.</small>
                      </span>
                    </label>
                  </div>

                  <section className="nf-topic-section" aria-labelledby="nf-topics-title">
                    <div className="nf-section-heading">
                      <div>
                        <span className="g-kicker">انتخاب موضوع</span>
                        <h3 id="nf-topics-title">دسته‌های بازی</h3>
                      </div>
                      <span className="nf-topic-count">{fa(cats.length)} از ۲۰ انتخاب</span>
                    </div>
                    <div className="nf-topic-grid">
                      {CATS.map((category) => {
                        const selected = cats.includes(category);
                        return (
                          <button
                            type="button"
                            key={category}
                            className={'button nf-topic-chip' + (selected ? ' is-selected' : '')}
                            aria-pressed={selected}
                            disabled={!selected && cats.length >= 20}
                            onClick={() =>
                              setCats((current) =>
                                current.includes(category)
                                  ? current.filter((item) => item !== category)
                                  : current.length < 20
                                    ? [...current, category]
                                    : current,
                              )
                            }
                          >
                            <span aria-hidden="true">{selected ? '✓' : '+'}</span>
                            {category}
                          </button>
                        );
                      })}
                    </div>
                    <p className="g-muted">حداقل ۴ موضوع انتخاب کنید. با فلش‌ها ترتیب بررسی پاسخ‌ها را مشخص کنید.</p>

                    <div className="nf-order-heading">
                      <h3>ترتیب بررسی</h3>
                      <span>از بالا به پایین</span>
                    </div>
                    <ol className="nf-order-list" aria-label="ترتیب ستون‌های انتخاب‌شده">
                      {cats.map((category, index) => (
                        <li key={category}>
                          <strong>
                            <span className="nf-order-index">{fa(index + 1)}</span>
                            {category}
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
                  </section>

                  <button className="button ink-button nf-primary-action" disabled={busy || cats.length < 4}>
                    {busy ? 'در حال ساخت…' : 'ساخت اتاق و دعوت دوستان'}
                  </button>
                </form>

                <section className="g-panel nf-card nf-public-card" aria-labelledby="nf-public-lobbies">
                  <header className="nf-card-heading compact">
                    <span className="nf-step-number">۰۲</span>
                    <div>
                      <span className="g-kicker">بازی‌های در دسترس</span>
                      <h2 id="nf-public-lobbies">اتاق‌های عمومی</h2>
                      <p>به اتاقی بپیوندید که هنوز بازی را شروع نکرده است.</p>
                    </div>
                  </header>
                  {lobbies.length ? (
                    <div className="nf-lobbies">
                      {lobbies.map((lobby) => (
                        <article className="nf-lobby-card" key={lobby.code}>
                          <div className="nf-lobby-info">
                            <h3>{lobby.title}</h3>
                            <p>
                              {fa(lobby.players)} از {fa(lobby.capacity)} بازیکن
                              <span> · </span>{fa(lobby.rounds)} دور
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
                    <p className="nf-empty-state">{lobbyError || 'در حال حاضر اتاق عمومی در دسترس نیست.'}</p>
                  )}
                </section>
              </main>

              <aside className="nf-lobby-side">
                <section className="g-panel nf-card nf-join-card">
                  <span className="g-kicker">دعوت خصوصی</span>
                  <h2>پیوستن با کد</h2>
                  <p>کد اتاق را از سازنده بگیرید و وارد کنید.</p>
                  <form
                    className="nf-join-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      act('join', { p_code: code });
                    }}
                  >
                    <label className="nf-field">
                      کد دعوت
                      <input
                        dir="ltr"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        maxLength="8"
                        required
                        autoCapitalize="characters"
                      />
                    </label>
                    <button className="button" disabled={busy || !code.trim()}>
                      پیوستن به اتاق
                    </button>
                  </form>
                </section>

                <section className="g-panel nf-card nf-scoring-card">
                  <span className="g-kicker">امتیازدهی</span>
                  <h2>هر جواب ارزش خودش را دارد</h2>
                  <div className="nf-points-grid">
                    <div><b>۲۰</b><span>تنها پاسخِ پرشده، اگر درست باشد</span></div>
                    <div><b>۱۰</b><span>پاسخ درست و یکتا</span></div>
                    <div><b>۵</b><span>پاسخ درست تکراری</span></div>
                    <div><b>۰</b><span>پاسخ خالی یا نادرست</span></div>
                  </div>
                  <p className="g-muted">فاصله‌ها و شکل‌های رایج حروف فارسی یکسان‌سازی می‌شوند. غلط املایی واضحِ نزدیک به پاسخ پذیرفته‌شده هم امتیاز تکراری می‌گیرد.</p>
                </section>

                <details className="nf-guide">
                  <summary>راهنمای بازی</summary>
                  <ol>
                    <li>اتاق بسازید یا با کد دعوت وارد اتاق دوستان شوید؛ میزبان بازی را شروع می‌کند.</li>
                    <li>در هر دور، همه با یک حرف تصادفی فارسی خانه‌های انتخاب‌شده را پر می‌کنند.</li>
                    <li>پاسخ‌ها هنگام نوشتن خودکار ذخیره می‌شوند. پس از «استپ»، ۵ ثانیه برای تکمیل پاسخ‌ها فرصت دارید.</li>
                    <li>بازیکنان به پاسخ دیگران رأی می‌دهند. اگر یک غلط املایی واضح با پاسخ درست دیگری جور باشد، پاسخ‌ها هم‌ارز حساب می‌شوند.</li>
                    <li>پاسخ یکتای درست ۱۰، پاسخ تکراری ۵ و تنها پاسخِ پرشده، اگر درست باشد در یک موضوع ۲۰ امتیاز دارد.</li>
                  </ol>
                </details>
              </aside>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
