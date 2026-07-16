"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { translateAuthError } from "@/lib/auth/errors";
import { AuthCard, FormField, OtpField, ErrorNote, SuccessNote, PrimaryButton } from "@/components/auth/AuthForm";
import { fetchCountryList } from "@/lib/shared/countries";

const USERNAME_RE = /^[a-zA-Z0-9_\u0600-\u06FF]{3,20}$/;
const RESEND_COOLDOWN = 30;

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState("form"); // 'form' | 'code'

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [country, setCountry] = useState("");
  const [countryList, setCountryList] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    fetchCountryList().then(setCountryList);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!USERNAME_RE.test(username)) {
      setError("نام کاربری باید بین ۳ تا ۲۰ کاراکتر (حروف فارسی/انگلیسی، عدد یا _) باشه.");
      return;
    }
    if (password.length < 6) {
      setError("رمز عبور باید حداقل ۶ کاراکتر باشه.");
      return;
    }

    setSubmitting(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, birth_date: birthDate || null, country: country || null } },
    });
    setSubmitting(false);

    if (signUpError) {
      setError(translateAuthError(signUpError.message));
      return;
    }

    if (data.session) {
      router.push("/");
      return;
    }

    setStep("code");
    setCooldown(RESEND_COOLDOWN);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    if (code.length !== 8) {
      setError("کد رو کامل وارد کن.");
      return;
    }

    setVerifying(true);
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    setVerifying(false);

    if (verifyError) {
      setError(translateAuthError(verifyError.message));
      return;
    }
    if (data.session) {
      router.push("/");
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError("");
    setNotice("");
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email });
    if (resendError) {
      setError(translateAuthError(resendError.message));
      return;
    }
    setNotice("کد جدید فرستاده شد.");
    setCooldown(RESEND_COOLDOWN);
  };

  if (step === "code") {
    return (
      <AuthCard title="تایید ایمیل">
        <p className="text-ivory-dim text-[.85rem] text-center mb-4">
          یه کد به {email} فرستادیم. کد رو وارد کن:
        </p>
        <form onSubmit={handleVerify}>
          <OtpField label="کد تایید" value={code} onChange={setCode} />

          <ErrorNote>{error}</ErrorNote>
          <SuccessNote>{notice}</SuccessNote>

          <PrimaryButton type="submit" disabled={verifying}>
            {verifying ? "در حال بررسی..." : "تایید و ورود"}
          </PrimaryButton>
        </form>

        <button
          onClick={handleResend}
          disabled={cooldown > 0}
          className="w-full text-center text-[.82rem] text-green bg-transparent border-none mt-4 cursor-pointer disabled:opacity-40 disabled:cursor-default"
        >
          {cooldown > 0 ? `ارسال دوباره‌ی کد (${cooldown})` : "ارسال دوباره‌ی کد"}
        </button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="ثبت‌نام">
      <form onSubmit={handleSubmit} className="overflow-x-hidden">
        <FormField
          label="نام کاربری (تو جدول برترین‌ها نشون داده می‌شه)"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="مثلاً ali_r"
          required
        />
        <FormField
          label="ایمیل"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
        <FormField
          label="رمز عبور"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="حداقل ۶ کاراکتر"
          required
        />

        <label className="block text-right mb-3.5">
          <span className="block text-[.8rem] text-ivory-dim mb-1.5">تاریخ تولد (اختیاری)</span>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
            className="w-full max-w-full min-w-0 box-border bg-white/[.04] border border-green-dim rounded-[9px] text-ivory text-[.9rem] px-3.5 h-11 text-right focus:outline-none focus:border-green"
          />
        </label>

        <label className="block text-right mb-3.5">
          <span className="block text-[.8rem] text-ivory-dim mb-1.5">کشور (اختیاری)</span>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full bg-white/[.04] border border-green-dim rounded-[9px] text-ivory text-[.9rem] px-3.5 h-11 text-right focus:outline-none focus:border-green"
          >
            <option value="">انتخاب نشده</option>
            {countryList.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <ErrorNote>{error}</ErrorNote>

        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? "در حال ثبت‌نام..." : "ثبت‌نام"}
        </PrimaryButton>
      </form>

      <p className="text-center text-[.82rem] text-ivory-dim mt-4">
        حساب داری؟{" "}
        <Link href="/login" className="text-green no-underline">
          وارد شو
        </Link>
      </p>
    </AuthCard>
  );
}