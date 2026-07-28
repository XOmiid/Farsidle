"use client";

import CoinDisplay from "@/components/common/CoinDisplay";

export default function Header({ title, onMenuClick, right }) {
  return (
    <header className="w-full max-w-[480px] flex items-center justify-between mb-4 px-1 relative">
      {/* Left — coins + store */}
      <CoinDisplay />

      {/* Center — page title */}
      {title && (
        <h1 className="font-display text-[1.4rem] text-green m-0 absolute left-1/2 -translate-x-1/2 pointer-events-none">
          {title}
        </h1>
      )}

      {/* Right — extra button + hamburger */}
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
