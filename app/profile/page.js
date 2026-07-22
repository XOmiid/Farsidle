"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Avatar from "@/components/common/Avatar";
import AvatarBuilder from "@/components/common/AvatarBuilder";
import { useAuth } from "@/lib/auth/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { translatePostgrestError } from "@/lib/auth/errors";
import { parseAvatarOptions, randomAvatarOptions } from "@/lib/shared/avatars";
import { fetchCountryList } from "@/lib/shared/countries";
import { ErrorNote, SuccessNote, PrimaryButton } from "@/components/auth/AuthForm";
import PersianDateInput from "@/components/common/PersianDateInput";

export default function ProfilePage() {
  const router = useRouter();
  const { loading, user, profile, refreshProfile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [avatarOptions, setAvatarOptions] = useState(null);
  const [birthDate, setBirthDate] = useState("");
  const [country, setCountry] = useState("");
  const [syncedProfileId, setSyncedProfileId] = useState(null);

  if (profile && profile.id !== syncedProfileId) {
    setSyncedProfileId(profile.id);
    setAvatarOptions(parseAvatarOptions(profile.avatar, profile.username || user?.id));
    setBirthDate(profile.birth_date || "");
    setCountry(profile.country || "");
  }

  const [countryList, setCountryList] = useState([]);
  useEffect(() => {
    fetchCountryList().then(setCountryList);
  }, []);

  const [infoError, setInfoError] = useState("");
  const [infoNotice, setInfoNotice] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user || !avatarOptions) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ivory-dim text-sm">
        در حال بارگذاری...
      </div>
    );
  }

  const handleSaveInfo = async (e) => {
    e.preventDefault();
    setInfoError("");
    setInfoNotice("");
    setSavingInfo(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        avatar: avatarOptions,
        birth_date: birthDate || null,
        country: country || null,
      })
      .eq("id", user.id);
    setSavingInfo(false);

    if (error) {
      setInfoError(translatePostgrestError(error));
      return;
    }
    setInfoNotice("پروفایلت به‌روزرسانی شد.");
    refreshProfile();
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-3 pt-[18px] pb-6">
      <Header title="فارسیدل" onMenuClick={() => setSidebarOpen(true)} />

      <div className="w-full max-w-[420px] mt-4">
        <h1 className="font-display text-2xl text-green text-center mb-6">پروفایل</h1>

        <form onSubmit={handleSaveInfo} className="bg-bg-1 border border-green-dim rounded-2xl p-5 mb-4">
          {/* Username display */}
          <div className="flex items-center justify-between mb-5">
            <Avatar avatarKey={avatarOptions} username={profile?.username} size={56} />
            <div className="text-right">
              <p className="text-[.75rem] text-ivory-dim mb-0.5">نام کاربری</p>
              <p className="text-ivory text-base font-semibold m-0">{profile?.username || "..."}</p>
            </div>
          </div>

          {/* Avatar builder */}
          <div className="mb-5">
            <AvatarBuilder
              options={avatarOptions}
              onChange={setAvatarOptions}
              onRandomize={() => setAvatarOptions(randomAvatarOptions(profile?.username || user?.id))}
            />
          </div>

          <label className="block text-right mb-3.5">
            <span className="block text-[.8rem] text-ivory-dim mb-1.5">تاریخ تولد (اختیاری)</span>
            <PersianDateInput value={birthDate} onChange={setBirthDate} />
          </label>

          <label className="block text-right mb-1">
            <span className="block text-[.8rem] text-ivory-dim mb-1.5">کشور (اختیاری)</span>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full bg-white/[.04] border border-green-dim rounded-[9px] text-ivory text-[.9rem] px-3.5 h-11 text-right focus:outline-none focus:border-green"
            >
              <option value="">انتخاب نشده</option>
              {countryList.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <div className="mt-4">
            <ErrorNote>{infoError}</ErrorNote>
            <SuccessNote>{infoNotice}</SuccessNote>
            <PrimaryButton type="submit" disabled={savingInfo}>
              {savingInfo ? "در حال ذخیره..." : "ذخیره‌ی تغییرات"}
            </PrimaryButton>
          </div>
        </form>

        <div className="flex flex-col gap-2.5 mb-4">
          <Link
            href="/profile/username"
            className="block text-center bg-bg-1 border border-green-dim text-ivory no-underline text-[.9rem] font-semibold py-3 rounded-[9px] hover:bg-green/5 transition-colors"
          >
            تغییر نام کاربری
          </Link>
          <Link
            href="/profile/password"
            className="block text-center bg-bg-1 border border-green-dim text-ivory no-underline text-[.9rem] font-semibold py-3 rounded-[9px] hover:bg-green/5 transition-colors"
          >
            تغییر رمز عبور
          </Link>
        </div>

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