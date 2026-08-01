"use client";

import Link from "next/link";
import { games } from "@/lib/games";
import { useAuth } from "@/lib/auth/AuthProvider";
import Avatar from "@/components/common/Avatar";

export default function Sidebar({ open, onClose }) {
  const { loading, user, profile, signOut } = useAuth();

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panel — dir="ltr" so right-0 + translate-x-full always means "slide off to the right visually" */}
      <aside
        dir="ltr"
        className={`fixed top-0 right-0 h-full w-72 max-w-[85vw] bg-bg-1 border-l border-green-dim z-50 p-5 overflow-y-auto transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header row — close button on the left (visually) in LTR context */}
        <div dir="rtl" className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-green m-0">منو</h2>
          <button
            onClick={onClose}
            aria-label="بستن"
            className="text-ivory-dim text-xl leading-none hover:text-ivory transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Account section */}
        <div dir="rtl" className="mb-5 pb-5 border-b border-border">
          {loading ? null : user ? (
            <div className="flex items-center gap-3">
              <Avatar avatarKey={profile?.avatar} username={profile?.username} size={40} />
              <div className="flex-1 min-w-0">
                <div className="text-ivory text-sm font-semibold truncate">
                  {profile?.username || "بدون نام کاربری"}
                </div>
                <div className="flex gap-3 mt-1">
                  <Link href="/profile" onClick={onClose} className="text-green text-xs no-underline">
                    پروفایل
                  </Link>
                  <button
                    onClick={() => { signOut(); onClose(); }}
                    className="text-red text-xs bg-transparent border-none cursor-pointer p-0"
                  >
                    خروج
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link href="/login" onClick={onClose}
                className="flex-1 text-center bg-green/10 border border-green-dim text-green no-underline text-sm font-semibold py-2 rounded-lg hover:bg-green/20 transition-colors">
                ورود
              </Link>
              <Link href="/register" onClick={onClose}
                className="flex-1 text-center bg-green text-[#04140a] no-underline text-sm font-bold py-2 rounded-lg">
                ثبت‌نام
              </Link>
            </div>
          )}
        </div>

        {/* Store — greyed out, coming soon */}
        <div dir="rtl" className="mb-5 pb-5 border-b border-border">
          <Link
            href="/store"
            onClick={onClose}
            className="w-full flex items-center gap-2 text-right text-ivory-dim text-sm py-2 no-underline hover:text-ivory transition-colors"
          >
            <span>🏪</span>
            <span className="font-semibold">فروشگاه</span>
            <span className="text-[.65rem] mr-auto text-yellow opacity-80">به‌زودی</span>
          </Link>
        </div>

        {/* Games list */}
        <nav dir="rtl">
          <p className="text-ivory-dim text-xs mb-3 font-semibold">بازی‌ها</p>
          <ul className="list-none p-0 m-0 flex flex-col gap-1">
            {games.map((g) =>
              g.status === "live" ? (
                <li key={g.slug}>
                  <Link
                    href={g.href}
                    onClick={onClose}
                    className="flex items-center gap-2.5 text-ivory no-underline text-sm py-2 px-2 rounded-lg hover:bg-green/10 hover:text-green transition-colors"
                  >
                    <span className="text-base">{g.icon}</span>
                    <span>{g.title}</span>
                  </Link>
                </li>
              ) : (
                <li key={g.slug}>
                  <span className="flex items-center gap-2.5 text-border text-sm py-2 px-2 rounded-lg opacity-50 cursor-not-allowed">
                    <span className="text-base">{g.icon}</span>
                    <span>{g.title}</span>
                    <span className="text-[10px] mr-auto">به‌زودی</span>
                  </span>
                </li>
              )
            )}
          </ul>
        </nav>
      </aside>
    </>
  );
}
