"use client";

import { rgbToHex } from "@/lib/colordle/logic";
import { toPersianDigits } from "@/lib/shared/persian";

export default function RevealBox({ phase, target, secondsLeft, onReveal }) {
  if (phase === "preReveal") {
    return (
      <div className="w-full max-w-[380px] flex flex-col items-center gap-4">
        <div className="w-full h-40 rounded-2xl border-2 border-dashed border-green-dim flex items-center justify-center text-4xl">
          🎨
        </div>
        <button
          onClick={onReveal}
          className="bg-green text-[#04140a] border-none rounded-xl px-8 py-3 font-bold text-[1rem] cursor-pointer"
        >
          نمایش رنگ (۱۰ ثانیه)
        </button>
        <p className="text-ivory-dim text-[.78rem] text-center">
          فقط یک بار می‌تونی رنگ رو ببینی، خوب نگاش کن!
        </p>
      </div>
    );
  }

  if (phase === "revealing") {
    return (
      <div className="w-full max-w-[380px] flex flex-col items-center gap-4">
        <div
          className="w-full h-40 rounded-2xl border-2 border-green shadow-[0_0_24px_rgba(34,197,94,.35)]"
          style={{ background: target ? rgbToHex(target.r, target.g, target.b) : "transparent" }}
        />
        <div className="text-3xl font-extrabold text-green tabular-nums">
          {toPersianDigits(secondsLeft)}
        </div>
        <p className="text-ivory-dim text-[.8rem]">رنگ رو خوب به خاطر بسپار...</p>
      </div>
    );
  }

  // phase === "guessing"
  return (
    <div className="w-full max-w-[380px] flex flex-col items-center gap-2 mb-2">
      <div className="w-full h-24 rounded-2xl border-2 border-dashed border-green-dim flex items-center justify-center text-ivory-dim text-[.85rem]">
        از حافظه‌ات بسازش
      </div>
    </div>
  );
}
