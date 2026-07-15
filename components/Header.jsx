'use client';

import Link from 'next/link';

export default function Header({ onMenuClick, title = 'فارسیدل', right = null }) {
  return (
    <header className="w-full max-w-[480px] flex items-center justify-between mb-1.5">
      <button
        onClick={onMenuClick}
        aria-label="منو"
        className="w-9 h-9 rounded-full border border-green-dim text-green flex items-center justify-center hover:bg-green/10 transition-colors flex-shrink-0"
      >
        ☰
      </button>

      <Link href="/" className="no-underline">
        <h1 className="font-display text-[2.1rem] leading-none tracking-wide text-green m-0 [text-shadow:0_0_18px_rgba(34,197,94,0.3)]">
          {title}
        </h1>
      </Link>

      {right ?? <span className="w-9 h-9 flex-shrink-0" />}
    </header>
  );
}
