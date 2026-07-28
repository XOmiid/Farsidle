"use client";

import Link from "next/link";
import CoinDisplay from "@/components/common/CoinDisplay";

export default function Header({ title, onMenuClick, right }) {
  return (
    // dir="ltr" forces left=visually-left, right=visually-right regardless of RTL
    <header
      dir="ltr"
      className="w-full max-w-[480px] flex items-center justify-between mb-4 px-1 relative"
    >
      {/* Top left — Coins */}
      <div className="flex items-center">
        <CoinDisplay />
      </div>

      {/* Center — page title */}
      {title ? (
        <Link
          href="/"
          className="font-display text-[1.4rem] text-green no-underline absolute left-1/2 -translate-x-1/2"
        >
          {title}
        </Link>
      ) : (
        <span className="font-display text-[1.4rem] text-green absolute left-1/2 -translate-x-1/2">
          فارسیدل
        </span>
      )}

      {/* Top right — ? + Hamburger */}
      <div className="flex items-center gap-2">
        {right}
        <button
          onClick={onMenuClick}
          aria-label="منو"
          className="w-9 h-9 rounded-full border border-green-dim text-green flex items-center justify-center hover:bg-green/10 flex-shrink-0"
        >
          ☰
        </button>
      </div>
    </header>
  );
}