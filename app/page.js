"use client";

import { useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { games } from "@/lib/games";

export default function HomePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center px-3 pt-[18px] pb-6">
      <Header onMenuClick={() => setSidebarOpen(true)} />

      <p className="text-center text-ivory-dim text-[.85rem] mb-6 px-2.5">
        خانه‌ی بازی‌های کلمه‌ای فارسی — یک کلمه‌ی جدید هر روز
      </p>

      <div className="w-full max-w-[480px] flex flex-col gap-3">
        {games.map((g) => (
          <GameCard key={g.slug} game={g} />
        ))}
      </div>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  );
}

function GameCard({ game }) {
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
        <div className="font-display text-lg text-ivory">{game.title}</div>
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
