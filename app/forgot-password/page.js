"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { translateAuthError } from "@/lib/auth/errors";
import { AuthCard, FormField, OtpField, ErrorNote, SuccessNote, PrimaryButton } from "@/components/auth/AuthForm";

const RESEND_COOLDOWN = 30;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState("email"); // 'email' | 'code'

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async () => {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
    if (resetError) {
      setError(translateAuthError(resetError.message));
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);
    const ok = await sendCode();
    setSubmitting(false);

    if (ok) {
      setStep("code");
      setCooldown(RESEND_COOLDOWN);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    if (code.length !== 6) {
      setError("کد باید ۶ رقم باشه.");
      return;
    }

    setVerifying(true);
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "recovery",
    });
    setVerifying(false);

    if (verifyError) {
      setError(translateAuthError(verifyError.message));
      return;
    }
    if (data.session) {
      router.push("/reset-password");
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError("");
    setNotice("");
    const ok = await sendCode();
    if (ok) {
      setNotice("کد جدید فرستاده شد.");
      setCooldown(RESEND_COOLDOWN);
    }
  };

  if (step === "code") {
    return (
      <AuthCard title="کد بازیابی">
        <p className="text-ivory-dim text-[.85rem] text-center mb-4">
          یه کد ۶ رقمی به {email} فرستادیم. کد رو وارد کن:
        </p>
        <form onSubmit={handleVerify}>
          <OtpField label="کد تایید" value={code} onChange={setCode} />

          <ErrorNote>{error}</ErrorNote>
          <SuccessNote>{notice}</SuccessNote>

          <PrimaryButton type="submit" disabled={verifying}>
            {verifying ? "در حال بررسی..." : "تایید کد"}
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
    <AuthCard title="فراموشی رمز عبور">
      <form onSubmit={handleSubmit}>
        <FormField
          label="ایمیل"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />

        <ErrorNote>{error}</ErrorNote>
        <SuccessNote>{notice}</SuccessNote>

        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? "در حال ارسال..." : "ارسال کد بازیابی"}
        </PrimaryButton>
      </form>

      <p className="text-center text-[.82rem] text-ivory-dim mt-4">
        <Link href="/login" className="text-green no-underline">
          برگشت به صفحه‌ی ورود
        </Link>
      </p>
    </AuthCard>
  );
}
