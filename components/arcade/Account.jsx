'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Shell, { Dialog } from './Shell';
import { Icon } from './Art';
import { useArcade } from './Provider';
import { updateProfile, claimDaily, resetLocal, getSupabase, isLocal } from '@/lib/classic/gateway';
import { fa, dateKey } from '@/lib/classic/rules.mjs';
import OptionalDetails from './OptionalDetails';
import {
  profileDetails,
  sendRecoveryCode,
  resendAccountCode,
  verifyAccountCode,
} from '@/lib/classic/account.mjs';
import { gameById } from '@/lib/classic/catalog';
const AVATARS = ['◉', '◇', '△', '□', '○', '⬡', '◎', '◈'];
export function authError(error) {
  return (
    {
      invalid_credentials: 'ایمیل یا رمز عبور درست نیست.',
      email_not_confirmed: 'اول ایمیلت را تأیید کن.',
      user_already_exists: 'این ایمیل قبلاً ثبت‌نام کرده است.',
      weak_password: 'رمز قوی‌تری با حداقل هشت حرف و عدد انتخاب کن.',
      otp_expired: 'کد منقضی شده؛ دوباره درخواست بده.',
      over_email_send_rate_limit: 'کمی صبر کن و دوباره درخواست بده.',
      same_password: 'رمز جدید باید با رمز قبلی فرق کند.',
    }[error?.code] || 'انجام نشد. اطلاعات را بررسی کن و دوباره امتحان کن.'
  );
}
export default function Profile() {
  const { player, reload, notify } = useArcade();
  const [name, setName] = useState(''),
    [avatar, setAvatar] = useState(null),
    [birthDate, setBirthDate] = useState(null),
    [country, setCountry] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [reset, setReset] = useState(false);
  const router = useRouter();
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await updateProfile(
        name || player.name,
        avatar || player.avatar,
        profileDetails({
          birthDate: birthDate ?? player.birthDate,
          country: country ?? player.country,
        }),
      );
      await reload();
      notify('پروفایل ذخیره شد.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function claim() {
    setBusy(true);
    try {
      await claimDaily();
      await reload();
      notify('۲۵ سکه به موجودی اضافه شد.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell>
      <div className="profile-wrap">
        <div className="page-heading">
          <div className="eyebrow">حساب کاربری</div>
          <h1>پروفایل</h1>
          <p>اطلاعات حساب، موجودی و نتایج بازی‌ها.</p>
        </div>
        {player ? (
          <>
            <section className="profile-card">
              <div className="profile-balance">
                <div>
                  <p>موجودی سکه</p>
                  <strong>
                    ✦ {fa(player.balance)}{' '}
                    <small style={{ fontSize: 12, fontWeight: 400 }}>سکه</small>
                  </strong>
                </div>
                <button
                  className="button"
                  disabled={busy || player.claim === dateKey() || (!isLocal && player.local)}
                  onClick={claim}
                >
                  {player.claim === dateKey() ? 'دریافت شد ✓' : '۲۵ سکهٔ امروز'}
                </button>
              </div>
              <form onSubmit={save}>
                <div className="profile-avatar">{avatar || player.avatar}</div>
                <label className="field-label" htmlFor="player-name">
                  نام نمایشی
                </label>
                <input
                  className="input"
                  id="player-name"
                  value={name}
                  placeholder={player.name}
                  maxLength={20}
                  onChange={(e) => {
                    setName(e.target.value);
                  }}
                />
                <OptionalDetails
                  prefix="profile"
                  birthDate={birthDate ?? player.birthDate ?? ''}
                  country={country ?? player.country ?? ''}
                  onBirthDate={setBirthDate}
                  onCountry={setCountry}
                />
                <span className="field-label">نشان پروفایل</span>
                <div className="avatar-options">
                  {AVATARS.map((a) => (
                    <button
                      type="button"
                      key={a}
                      className={a === (avatar || player.avatar) ? 'selected' : ''}
                      aria-pressed={a === (avatar || player.avatar)}
                      aria-label={'آواتار ' + a}
                      onClick={() => setAvatar(a)}
                    >
                      {a}
                    </button>
                  ))}
                </div>
                {error && (
                  <p className="field-error" role="alert">
                    {error}
                  </p>
                )}
                <button
                  className="button full-button secondary-button"
                  disabled={busy}
                  type="submit"
                >
                  {busy ? 'در حال ذخیره…' : 'ذخیرهٔ پروفایل'}
                </button>
              </form>
            </section>
            {isLocal && (
              <div className="local-note">
                <strong>این، نسخهٔ پیش‌نمایش است.</strong>پیشرفت و سکه‌ها فقط در همین مرورگر ذخیره
                می‌شوند و به حساب اصلی یا سایت فعلی منتقل نمی‌شوند. می‌توانی بدون ثبت‌نام، همهٔ
                بازی‌ها را امتحان کنی. پنج‌هزار سکهٔ آزمایشی هم برای بررسی جدول‌ها در دسترس است.
              </div>
            )}
            {!isLocal && player.local && (
              <div className="local-note">
                <strong>حالت مهمان</strong>بازی‌ها را می‌توانی بدون ورود امتحان کنی. برای ذخیرهٔ
                نتایج در حساب، دریافت سکه و حضور در جدول امتیازها وارد شو.
              </div>
            )}
            <section className="profile-card">
              <h2 style={{ fontSize: 18 }}>نتایج اخیر</h2>
              {player.results?.length ? (
                player.results
                  .slice()
                  .reverse()
                  .slice(0, 12)
                  .map((r, i) => (
                    <div className="history-row" key={i}>
                      <span>
                        {gameById(r.game)?.name} <small>· {fa(r.date)}</small>
                      </span>
                      <strong>
                        {fa(r.score)} / {fa(r.max)}
                      </strong>
                    </div>
                  ))
              ) : (
                <div className="empty-state">
                  <p>هنوز نتیجه‌ای ثبت نشده است.</p>
                  <Link
                    href="/classic"
                    className="button secondary-button"
                    style={{ marginTop: 16 }}
                  >
                    انتخاب بازی
                  </Link>
                </div>
              )}
            </section>
            {isLocal ? (
              <button className="text-button" onClick={() => setReset(true)}>
                بازنشانی پیش‌نمایش این دستگاه
              </button>
            ) : player.local ? (
              <Link href="/login" className="button full-button">
                ورود به حساب اصلی
              </Link>
            ) : (
              <div className="button-row">
                <Link href="/profile/password" className="button secondary-button">
                  تغییر رمز عبور
                </Link>
                <button
                  className="text-button"
                  onClick={async () => {
                    const client = await getSupabase();
                    await client.auth.signOut();
                    await reload();
                    router.push('/');
                  }}
                >
                  <Icon name="logout" size={17} />
                  خروج
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="loading-state">
            <i className="loading-dot" />
            در حال بارگذاری…
            {isLocal && (
              <button className="text-button" onClick={() => setReset(true)}>
                بازنشانی ذخیرهٔ محلی
              </button>
            )}
          </div>
        )}
      </div>
      {reset && (
        <Dialog title="شروع دوبارهٔ پیش‌نمایش؟" onClose={() => setReset(false)}>
          <p>
            فقط پیشرفت، نام و سکه‌های همین نسخه در این مرورگر پاک می‌شود. حساب اصلی‌ات تغییری
            نمی‌کند.
          </p>
          <div className="button-row">
            <button
              className="button"
              onClick={() => {
                resetLocal();
                reload();
                setReset(false);
                setName('');
                setBirthDate(null);
                setCountry(null);
                notify('پیش‌نمایش از نو آماده است.');
              }}
            >
              بله، از نو شروع کن
            </button>
            <button className="text-button" onClick={() => setReset(false)}>
              انصراف
            </button>
          </div>
        </Dialog>
      )}
    </Shell>
  );
}
export function Auth({ mode = 'login' }) {
  const router = useRouter(),
    { reload } = useArcade();
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [name, setName] = useState(''),
    [birthDate, setBirthDate] = useState(''),
    [country, setCountry] = useState(''),
    [token, setToken] = useState(''),
    [step, setStep] = useState('form'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [cooldown, setCooldown] = useState(0);
  const [ready, setReady] = useState(false);
  const titles = {
    login: 'ورود به حساب',
    register: 'ساخت حساب کاربری',
    forgot: 'بازیابی رمز عبور',
    reset: 'رمز عبور جدید',
    password: 'تغییر رمز عبور',
  };
  useEffect(() => {
    if (isLocal || !['reset', 'password'].includes(mode)) return;
    let active = true;
    let subscription;
    getSupabase()
      .then((c) => {
        subscription = c.auth.onAuthStateChange((_event, session) => {
          if (active) setReady(!!session);
        }).data.subscription;
        return c.auth.getSession();
      })
      .then(({ data }) => {
        if (active) setReady(!!data.session);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [mode]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const client = await getSupabase();
      let result;
      if (step === 'code') {
        result = await verifyAccountCode(client, mode, email, token);
        if (result.error) throw result.error;
        await reload();
        router.push(mode === 'forgot' ? '/reset-password' : '/classic');
        return;
      }
      if (mode === 'login') result = await client.auth.signInWithPassword({ email, password });
      if (mode === 'register') {
        if (!/^[a-zA-Z0-9_آ-ی]{3,20}$/.test(name))
          throw new Error('نام کاربری باید ۳ تا ۲۰ حرف، عدد یا زیرخط باشد.');
        const details = profileDetails({ birthDate, country });
        result = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin + '/classic',
            data: { username: name, birth_date: details.birthDate, country: details.country },
          },
        });
      }
      if (mode === 'forgot') result = await sendRecoveryCode(client, email, window.location.origin);
      if (['reset', 'password'].includes(mode)) {
        if (!ready) throw new Error('ابتدا وارد حساب شو یا کد بازیابی را تأیید کن.');
        result = await client.auth.updateUser({ password });
      }
      if (result?.error) throw result.error;
      if (mode === 'forgot' || (mode === 'register' && !result.data.session)) {
        setStep('code');
        setCooldown(60);
        setNotice('کد تأیید به ایمیلت فرستاده شد. پوشهٔ اسپم را هم بررسی کن.');
      } else if (['reset', 'password'].includes(mode)) {
        setNotice('رمز عبور با موفقیت تغییر کرد.');
        setPassword('');
      } else {
        await reload();
        router.push('/classic');
      }
    } catch (e) {
      setError(e.code ? authError(e) : e.message);
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    if (cooldown > 0 || busy) return;
    setBusy(true);
    try {
      const client = await getSupabase();
      const result = await resendAccountCode(client, mode, email, window.location.origin);
      if (result.error) throw result.error;
      setCooldown(60);
      setNotice('کد تازه فرستاده شد.');
    } catch (e) {
      setError(authError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell back="/profile" title="پروفایل">
      <div className="profile-wrap">
        <div className="page-heading">
          <h1>{titles[mode]}</h1>
        </div>
        <div className="profile-card">
          {isLocal ? (
            <>
              <div className="local-note">
                <strong>حساب‌ها در نسخهٔ پیش‌نمایش محلی‌اند.</strong>برای امتحان کردن بازی‌ها به
                ایمیل و رمز عبور نیازی نداری. نام و نشان پروفایل را در پروفایل انتخاب کن.
              </div>
              <Link className="button full-button" href="/profile">
                رفتن به پروفایل
              </Link>
            </>
          ) : (
            <>
              <div className="auth-tabs">
                <Link className={mode === 'login' ? 'active' : ''} href="/login">
                  ورود
                </Link>
                <Link className={mode === 'register' ? 'active' : ''} href="/register">
                  ثبت‌نام
                </Link>
              </div>
              <form onSubmit={submit}>
                {step === 'code' ? (
                  <>
                    <p className="center-note">کد ایمیل‌شده به {email} را وارد کن.</p>
                    <label className="field-label" htmlFor="otp">
                      کد تأیید
                    </label>
                    <input
                      id="otp"
                      className="input"
                      dir="ltr"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={token}
                      onChange={(e) =>
                        setToken(
                          e.target.value
                            .replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))
                            .replace(/[^0-9]/g, ''),
                        )
                      }
                      required
                      maxLength={10}
                    />
                  </>
                ) : (
                  <>
                    {mode === 'register' && (
                      <>
                        <label className="field-label" htmlFor="username">
                          نام کاربری
                        </label>
                        <input
                          id="username"
                          className="input"
                          autoComplete="username"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          maxLength={20}
                        />
                      </>
                    )}
                    {['login', 'register', 'forgot'].includes(mode) && (
                      <>
                        <label className="field-label" htmlFor="email">
                          ایمیل
                        </label>
                        <input
                          id="email"
                          className="input"
                          dir="ltr"
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </>
                    )}
                    {mode !== 'forgot' && (
                      <>
                        <label className="field-label" htmlFor="password">
                          {['reset', 'password'].includes(mode) ? 'رمز جدید' : 'رمز عبور'}
                        </label>
                        <input
                          id="password"
                          className="input"
                          dir="ltr"
                          type="password"
                          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                          minLength={mode === 'login' ? 6 : 8}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </>
                    )}
                  </>
                )}
                {mode === 'register' && step === 'form' && (
                  <OptionalDetails
                    prefix="register"
                    birthDate={birthDate}
                    country={country}
                    onBirthDate={setBirthDate}
                    onCountry={setCountry}
                  />
                )}
                {error && (
                  <p className="field-error" role="alert">
                    {error}
                  </p>
                )}
                {notice && (
                  <p className="status-note" role="status">
                    {notice}
                  </p>
                )}
                <button
                  className="button full-button"
                  disabled={busy || (['reset', 'password'].includes(mode) && !ready)}
                >
                  {busy
                    ? 'یک لحظه…'
                    : step === 'code'
                      ? 'تأیید کد'
                      : mode === 'forgot'
                        ? 'ارسال کد بازیابی'
                        : ['reset', 'password'].includes(mode)
                          ? 'ذخیرهٔ رمز'
                          : mode === 'register'
                            ? 'ثبت‌نام'
                            : 'ورود'}
                </button>
              </form>
              {step === 'code' && (
                <button className="text-button" disabled={busy || cooldown > 0} onClick={resend}>
                  {cooldown > 0 ? 'ارسال دوباره تا ' + fa(cooldown) + ' ثانیه' : 'ارسال دوبارهٔ کد'}
                </button>
              )}
              {mode === 'login' && (
                <Link
                  className="text-button"
                  style={{ display: 'block', textAlign: 'center' }}
                  href="/forgot-password"
                >
                  رمز عبور را فراموش کردی؟
                </Link>
              )}
              {['reset', 'password'].includes(mode) && !ready && (
                <Link className="text-button" href="/forgot-password">
                  شروع بازیابی رمز
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}
