"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { games } from "@/lib/games";
import { checkTodayStatus as checkWordleStatus } from "@/lib/wordle/api";
import { checkTodayStatus as checkFactleStatus } from "@/lib/factle/api";

const STATUS_CHECKERS = {
  wordle: checkWordleStatus,
  factle: checkFactleStatus,
};

export default function HomePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [playedToday, setPlayedToday] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        Object.entries(STATUS_CHECKERS).map(async ([slug, check]) => {
          const status = await check();
          return [slug, status.played];
        })
      );
      if (cancelled) return;
      setPlayedToday(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center px-3 pt-[18px] pb-6">
      <Header onMenuClick={() => setSidebarOpen(true)} />

      <p className="text-center text-ivory-dim text-[.85rem] mb-6 px-2.5">
        خانه‌ی بازی‌های کلمه‌ای فارسی — یک کلمه‌ی جدید هر روز
      </p>

      <div className="w-full max-w-[480px] flex flex-col gap-3">
        {games.map((g) => (
          <GameCard key={g.slug} game={g} played={!!playedToday[g.slug]} />
        ))}
      </div>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  );
}

function GameCard({ game, played }) {
  const isLive = game.status === "live";
  const content = (
    <div
      className={`flex items-center gap-4 p-4 rounded-2xl border transition-colors ${
        isLive
          ? "border-green-dim bg-green/5 hover:bg-green/10"
          : "border-border bg-white/[.02] opacity-60"
      }`}
    >
      <span className="text-3xl">{game.icon}</span>
      <div className="flex-1 text-right">
        <div className="font-display text-lg text-ivory flex items-center gap-2 justify-start">
          {played && (
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green text-[#04140a] text-[11px] font-bold flex-shrink-0"
              title="امروز بازی کردی"
            >
              ✓
            </span>
          )}
          {game.title}
        </div>
        <div className="text-xs text-ivory-dim mt-0.5">{game.tagline}</div>
      </div>
      {!isLive && (
        <span className="text-[10px] px-2 py-1 rounded-full bg-yellow-dim/30 text-yellow flex-shrink-0">
          به‌زودی
        </span>
      )}
    </div>
  );

  return isLive ? (
    <Link href={game.href} className="no-underline">
      {content}
    </Link>
  ) : (
    <div>{content}</div>
  );
}