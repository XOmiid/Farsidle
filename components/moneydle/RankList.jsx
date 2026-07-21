"use client";

import { toPersianDigits } from "@/lib/shared/persian";
import { currencyFlag } from "@/lib/moneydle/flags";

export default function RankList({ items, onReorder, disabled }) {
  const move = (index, dir) => {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= items.length) return;
    const next = [...items];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    onReorder(next);
  };

  return (
    <div className="w-full max-w-[420px] flex flex-col gap-2">
      {items.map((item, i) => (
        <div
          key={item.currency_id}
          className="flex items-center gap-3 bg-bg-1 border border-green-dim rounded-xl px-3.5 py-3"
        >
          <span className="text-green font-extrabold text-[.9rem] min-w-[20px] text-center">
            {toPersianDigits(i + 1)}
          </span>
          <span className="text-xl flex-shrink-0">{currencyFlag(item.code)}</span>
          <div className="flex-1 text-right">
            <div className="text-ivory text-[.95rem] font-semibold">{item.name_fa}</div>
            <div className="text-ivory-dim text-[.72rem]" dir="ltr">
              {item.code}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => move(i, -1)}
              disabled={disabled || i === 0}
              className="w-7 h-7 rounded-lg bg-white/[.04] border border-green-dim text-green flex items-center justify-center disabled:opacity-25 cursor-pointer disabled:cursor-default"
              aria-label="بالا"
            >
              ▲
            </button>
            <button
              onClick={() => move(i, 1)}
              disabled={disabled || i === items.length - 1}
              className="w-7 h-7 rounded-lg bg-white/[.04] border border-green-dim text-green flex items-center justify-center disabled:opacity-25 cursor-pointer disabled:cursor-default"
              aria-label="پایین"
            >
              ▼
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
