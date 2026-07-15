"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { translateAuthError } from "@/lib/auth/errors";
import { AuthCard, FormField, ErrorNote, SuccessNote, PrimaryButton } from "@/components/auth/AuthForm";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // After verifyOtp(type: 'recovery') succeeds on /forgot-password, a
    // session is already established and persisted by the time we land
    // here — this just confirms it's present before showing the form.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) setReady(true);
    });

    return () => sub?.subscription?.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (password.length < 6) {
      setError("رمز عبور باید حداقل ۶ کاراکتر باشه.");
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      setError(translateAuthError(updateError.message));
      return;
    }

    setNotice("رمز عبورت تغییر کرد! داری منتقل می‌شی...");
    setTimeout(() => router.push("/"), 1500);
  };

  if (!ready) {
    return (
      <AuthCard title="تغییر رمز عبور">
        <p className="text-ivory-dim text-[.85rem] text-center">
          برای تغییر رمز عبور، اول باید کدی که برات فرستادیم رو تایید کنی. از صفحه‌ی{" "}
          <a href="/forgot-password" className="text-green no-underline">
            فراموشی رمز عبور
          </a>{" "}
          شروع کن.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="تغییر رمز عبور">
      <form onSubmit={handleSubmit}>
        <FormField
          label="رمز عبور جدید"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="حداقل ۶ کاراکتر"
          required
        />

        <ErrorNote>{error}</ErrorNote>
        <SuccessNote>{notice}</SuccessNote>

        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? "در حال ذخیره..." : "ذخیره‌ی رمز عبور جدید"}
        </PrimaryButton>
      </form>
    </AuthCard>
  );
}
