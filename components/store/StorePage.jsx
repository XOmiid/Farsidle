"use client";

import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { useState } from "react";

const ITEMS = [
  {
    id: "xbox",
    title: "Xbox Gift Card",
    subtitle: "$10",
    icon: "🎮",
    color: "#107C10",
  },
  {
    id: "playstation",
    title: "PlayStation Gift Card",
    subtitle: "$10",
    icon: "🎮",
    color: "#003087",
  },
  {
    id: "steam",
    title: "Steam Gift Card",
    subtitle: "$10",
    icon: "🖥️",
    color: "#1b2838",
  },
  {
    id: "appstore",
    title: "App Store Gift Card",
    subtitle: "$10",
    icon: "📱",
    color: "#0071e3",
  },
  {
    id: "googleplay",
    title: "Google Play Gift Card",
    subtitle: "$10",
    icon: "▶️",
    color: "#01875f",
  },
  {
    id: "twitter",
    title: "Twitter / X Premium",
    subtitle: "یک ماه",
    icon: "𝕏",
    color: "#000000",
  },
  {
    id: "telegram",
    title: "Telegram Premium",
    subtitle: "یک ماه",
    icon: "✈️",
    color: "#229ED9",
  },
];

export default function StorePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center px-3 pt-[18px] pb-10">
      <Header title="فروشگاه" onMenuClick={() => setSidebarOpen(true)} />

      <p className="text-ivory-dim text-[.85rem] text-center mb-2 max-w-[380px]">
        با سکه‌هایی که از بازی‌ها جمع می‌کنی، جوایز واقعی بگیر
      </p>
      <div className="flex items-center gap-1.5 mb-6 text-[.78rem] bg-yellow/10 border border-yellow/30 text-yellow rounded-full px-3 py-1">
        <span>🚧</span>
        <span>فروشگاه به‌زودی فعال می‌شه</span>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-[420px]">
        {ITEMS.map((item) => (
          <div
            key={item.id}
            className="bg-bg-1 border border-border rounded-2xl p-4 flex flex-col items-center gap-2 text-center opacity-70"
          >
            {/* Icon */}
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-[1.6rem]"
              style={{ background: `${item.color}22`, border: `1px solid ${item.color}44` }}
            >
              {item.icon}
            </div>

            {/* Title */}
            <div>
              <p className="text-ivory text-[.82rem] font-semibold leading-tight">{item.title}</p>
              <p className="text-ivory-dim text-[.72rem] mt-0.5">{item.subtitle}</p>
            </div>

            {/* Coming soon badge */}
            <span className="text-[.68rem] bg-white/[.05] border border-border text-ivory-dim rounded-full px-2.5 py-0.5">
              به‌زودی
            </span>
          </div>
        ))}
      </div>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  );
}
