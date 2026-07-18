"use client";

import { toPersianDigits } from "@/lib/shared/persian";

export default function StreakBadge({ streak, className = "" }) {
  if (!streak || streak < 2) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 text-yellow font-bold text-[.8rem] ${className}`}>
      🔥{toPersianDigits(streak)}
    </span>
  );
}
