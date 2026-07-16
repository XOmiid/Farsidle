"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/lib/auth/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { translateAuthError } from "@/lib/auth/errors";
import { FormField, ErrorNote, SuccessNote, PrimaryButton } from "@/components/auth/AuthForm";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { loading, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ivory-dim text-sm">
        در حال بارگذاری...
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (newPassword.length < 6) {
      setError("رمز عبور باید حداقل ۶ کاراکتر باشه.");
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);

    if (updateError) {
      setError(translateAuthError(updateError.message));
      return;
    }
    setNotice("رمز عبور با موفقیت تغییر کرد.");
    setNewPassword("");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10">
      <Header title="فارسیدل" onMenuClick={() => setSidebarOpen(true)} />
      <div className="w-full max-w-[360px] bg-bg-1 border border-green-dim rounded-2xl p-6 mt-6">
        <h1 className="font-display text-2xl text-green text-center m-0 mb-5">تغییر رمز عبور</h1>

        <form onSubmit={handleSubmit}>
          <FormField
            label="رمز عبور جدید"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="حداقل ۶ کاراکتر"
            required
          />
          <ErrorNote>{error}</ErrorNote>
          <SuccessNote>{notice}</SuccessNote>
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? "در حال ذخیره..." : "تغییر رمز عبور"}
          </PrimaryButton>
        </form>

        <p className="text-center text-[.82rem] text-ivory-dim mt-4">
          <Link href="/profile" className="text-green no-underline">
            برگشت به پروفایل
          </Link>
        </p>
      </div>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  );
}