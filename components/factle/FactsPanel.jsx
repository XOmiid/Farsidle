"use client";

import { toPersianDigits } from "@/lib/shared/persian";

export default function FactsPanel({ facts, revealedCount }) {
  const revealed = facts.slice(0, revealedCount);
  return (
    <div className="w-full max-w-[420px] flex flex-col gap-2.5 mb-5">
      {revealed.map((fact, i) => (
        <div
          key={i}
          className={`bg-bg-1 border border-green-dim rounded-xl p-3.5 text-right ${
            i === revealed.length - 1 ? "fact-in" : ""
          }`}
        >
          <span className="inline-block bg-green/15 text-green text-[.72rem] font-bold rounded-full px-2 py-0.5 mb-1.5">
            سرنخ {toPersianDigits(i + 1)}
          </span>
          <p className="text-ivory text-[.9rem] leading-6 m-0">{fact}</p>
        </div>
      ))}
    </div>
  );
}
