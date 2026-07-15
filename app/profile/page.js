"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/lib/auth/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { translateAuthError } from "@/lib/auth/errors";
import { FormField, ErrorNote, SuccessNote, PrimaryButton } from "@/components/auth/AuthForm";

const USERNAME_RE = /^[a-zA-Z0-9_\u0600-\u06FF]{3,20}$/;

export default function ProfilePage() {
  const router = useRouter();
  const { loading, user, profile, refreshProfile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [username, setUsername] = useState("");
  const [syncedProfileId, setSyncedProfileId] = useState(null);
  if (profile && profile.id !== syncedProfileId) {
    setSyncedProfileId(profile.id);
    setUsername(profile.username || "");
  }
  const [usernameError, setUsernameError] = useState("");
  const [usernameNotice, setUsernameNotice] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

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

  const handleSaveUsername = async (e) => {
    e.preventDefault();
    setUsernameError("");
    setUsernameNotice("");

    if (!USERNAME_RE.test(username)) {
      setUsernameError("نام کاربری باید بین ۳ تا ۲۰ کاراکتر (حروف فارسی/انگلیسی، عدد یا _) باشه.");
      return;
    }

    setSavingUsername(true);
    const { error } = await supabase.from("profiles").update({ username }).eq("id", user.id);
    setSavingUsername(false);

    if (error) {
      setUsernameError(translateAuthError(error.message));
      return;
    }
    setUsernameNotice("نام کاربری با موفقیت به‌روزرسانی شد.");
    refreshProfile();
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordNotice("");

    if (newPassword.length < 6) {
      setPasswordError("رمز عبور باید حداقل ۶ کاراکتر باشه.");
      return;
    }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);

    if (error) {
      setPasswordError(translateAuthError(error.message));
      return;
    }
    setPasswordNotice("رمز عبور با موفقیت تغییر کرد.");
    setNewPassword("");
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-3 pt-[18px] pb-6">
      <Header title="فارسیدل" onMenuClick={() => setSidebarOpen(true)} />

      <div className="w-full max-w-[400px] mt-4">
        <h1 className="font-display text-2xl text-green text-center mb-6">پروفایل</h1>

        <div className="bg-bg-1 border border-green-dim rounded-2xl p-5 mb-4">
          <p className="text-[.8rem] text-ivory-dim mb-1.5">ایمیل</p>
          <p className="text-ivory text-sm mb-0">{user.email}</p>
        </div>

        <form onSubmit={handleSaveUsername} className="bg-bg-1 border border-green-dim rounded-2xl p-5 mb-4">
          <FormField
            label="نام کاربری (تو جدول برترین‌ها نشون داده می‌شه)"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <ErrorNote>{usernameError}</ErrorNote>
          <SuccessNote>{usernameNotice}</SuccessNote>
          <PrimaryButton type="submit" disabled={savingUsername}>
            {savingUsername ? "در حال ذخیره..." : "ذخیره‌ی نام کاربری"}
          </PrimaryButton>
        </form>

        <form onSubmit={handleChangePassword} className="bg-bg-1 border border-green-dim rounded-2xl p-5 mb-4">
          <FormField
            label="رمز عبور جدید"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="حداقل ۶ کاراکتر"
            required
          />
          <ErrorNote>{passwordError}</ErrorNote>
          <SuccessNote>{passwordNotice}</SuccessNote>
          <PrimaryButton type="submit" disabled={savingPassword}>
            {savingPassword ? "در حال ذخیره..." : "تغییر رمز عبور"}
          </PrimaryButton>
        </form>

        <p className="text-center text-[.78rem] text-ivory-dim mb-4">
          اشتراک ویژه به‌زودی از همین صفحه قابل فعال‌سازیه 👀
        </p>

        <button
          onClick={async () => {
            await signOut();
            router.push("/");
          }}
          className="w-full bg-transparent border border-red/40 text-red rounded-[9px] py-2.5 font-bold text-[.9rem] cursor-pointer"
        >
          خروج از حساب
        </button>
      </div>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  );
}
