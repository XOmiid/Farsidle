"use client";

import { toPersianDigits } from "@/lib/shared/persian";

export default function DuelCard({ prompt, unit, value, state, onClick }) {
  // state: 'idle' | 'correct' | 'incorrect' | 'dim'
  const stateClasses = {
    idle: "border-green-dim bg-bg-1 hover:bg-green/10 cursor-pointer",
    correct: "border-green bg-green/15",
    incorrect: "border-red bg-red/10",
    dim: "border-border bg-white/[.02] opacity-60",
  };

  return (
    <button
      onClick={onClick}
      disabled={state !== "idle"}
      className={`w-full max-w-[420px] rounded-2xl border-2 p-5 text-center transition-colors ${stateClasses[state]}`}
    >
      <p className="text-ivory text-[1.05rem] leading-7 m-0 mb-2">{prompt}</p>
      {value !== null && value !== undefined && (
        <p className="text-2xl font-extrabold text-green m-0">
          {toPersianDigits(value)}
          {unit && <span className="text-sm text-ivory-dim mr-1.5">{unit}</span>}
        </p>
      )}
    </button>
  );
}
