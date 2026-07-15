"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { translateAuthError } from "@/lib/auth/errors";
import { AuthCard, FormField, ErrorNote, PrimaryButton } from "@/components/auth/AuthForm";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);

    if (signInError) {
      setError(translateAuthError(signInError.message));
      return;
    }
    router.push("/");
  };

  return (
    <AuthCard title="ورود">
      <form onSubmit={handleSubmit}>
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
          placeholder="رمز عبور"
          required
        />

        <ErrorNote>{error}</ErrorNote>

        <p className="text-left mb-3.5 -mt-2">
          <Link href="/forgot-password" className="text-[.78rem] text-green-dim no-underline">
            رمز عبور رو فراموش کردی؟
          </Link>
        </p>

        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? "در حال ورود..." : "ورود"}
        </PrimaryButton>
      </form>

      <p className="text-center text-[.82rem] text-ivory-dim mt-4">
        حساب نداری؟{" "}
        <Link href="/register" className="text-green no-underline">
          ثبت‌نام کن
        </Link>
      </p>
    </AuthCard>
  );
}
