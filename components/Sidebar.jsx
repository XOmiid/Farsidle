"use client";

import Link from "next/link";
import { games } from "@/lib/games";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function Sidebar({ open, onClose }) {
  const { loading, user, profile, signOut } = useAuth();

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />
      <aside
        className={`fixed top-0 right-0 h-full w-72 max-w-[85vw] bg-bg-1 border-l border-green-dim z-50 p-5 overflow-y-auto transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-green m-0">منو</h2>
          <button
            onClick={onClose}
            aria-label="بستن"
            className="text-ivory-dim text-xl leading-none hover:text-ivory transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Account */}
        <div className="mb-5 pb-5 border-b border-border">
          {loading ? null : user ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green/15 border border-green-dim text-green flex items-center justify-center font-bold flex-shrink-0">
                {(profile?.username || "؟")[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-ivory text-sm font-semibold truncate">
                  {profile?.username || "بدون نام کاربری"}
                </div>
                <div className="flex gap-3 mt-1">
                  <Link href="/profile" onClick={onClose} className="text-green text-xs no-underline">
                    پروفایل
                  </Link>
                  <button
                    onClick={() => {
                      signOut();
                      onClose();
                    }}
                    className="text-red text-xs bg-transparent border-none cursor-pointer p-0"
                  >
                    خروج
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link
                href="/login"
                onClick={onClose}
                className="flex-1 text-center bg-green/10 border border-green-dim text-green no-underline text-sm font-semibold py-2 rounded-lg hover:bg-green/20 transition-colors"
              >
                ورود
              </Link>
              <Link
                href="/register"
                onClick={onClose}
                className="flex-1 text-center bg-green text-[#04140a] no-underline text-sm font-bold py-2 rounded-lg"
              >
                ثبت‌نام
              </Link>
            </div>
          )}
        </div>

        <h3 className="font-display text-lg text-green m-0 mb-3">بازی‌ها</h3>

        <nav className="flex flex-col gap-2">
          {games.map((g) =>
            g.status === "live" ? (
              <Link
                key={g.slug}
                href={g.href}
                onClick={onClose}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-green/10 border border-green-dim text-ivory text-sm no-underline hover:bg-green/20 transition-colors"
              >
                <span>{g.icon}</span>
                <span>{g.title}</span>
              </Link>
            ) : (
              <div
                key={g.slug}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/[.02] border border-border text-ivory-dim text-sm opacity-60"
              >
                <span>{g.icon}</span>
                <span>
                  {g.title} <em className="not-italic text-xs">(به‌زودی)</em>
                </span>
              </div>
            )
          )}
        </nav>

        <p className="text-[.8rem] text-ivory-dim leading-7 mt-3">
          بازی‌های بیشتر به‌زودی اضافه می‌شن 👀
        </p>

        <div className="mt-6">
          <h4 className="font-display font-normal text-base text-ivory-dim m-0 mb-2">پشتیبانی</h4>
          <a
            href="https://telegram.me/Farsidle_support_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center bg-green text-[#04140a] no-underline font-bold text-sm py-2.5 rounded-lg"
          >
            تماس با پشتیبانی
          </a>
        </div>
      </aside>
    </>
  );
}
