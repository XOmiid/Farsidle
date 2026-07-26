"use client";

import { useState } from "react";
import { toPersianDigits } from "@/lib/shared/persian";

const UNITS = [
  { label: "تومان", multiplier: 1 },
  { label: "هزار تومان", multiplier: 1_000 },
  { label: "میلیون تومان", multiplier: 1_000_000 },
  { label: "میلیارد تومان", multiplier: 1_000_000_000 },
];

export default function PriceInput({ onSubmit, disabled }) {
  const [amount, setAmount] = useState("");
  const [unitIndex, setUnitIndex] = useState(1); // default: هزار تومان

  const tomanValue = Math.round(parseFloat(amount || "0") * UNITS[unitIndex].multiplier);

  const handleSubmit = () => {
    if (!amount || tomanValue <= 0) return;
    onSubmit(tomanValue);
  };

  const formatted = tomanValue > 0
    ? toPersianDigits(tomanValue.toLocaleString("fa-IR"))
    : null;

  return (
    <div className="w-full max-w-[420px] flex flex-col gap-3">
      {/* Amount + unit row */}
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={amount}
          placeholder="مقدار"
          disabled={disabled}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 bg-white/[.04] border border-green-dim rounded-[9px] text-ivory text-[1rem] px-3 h-12 text-center focus:outline-none focus:border-green disabled:opacity-40"
        />
        <select
          value={unitIndex}
          disabled={disabled}
          onChange={(e) => setUnitIndex(Number(e.target.value))}
          className="bg-white/[.04] border border-green-dim rounded-[9px] text-ivory text-[.85rem] px-3 h-12 focus:outline-none focus:border-green disabled:opacity-40 cursor-pointer"
        >
          {UNITS.map((u, i) => (
            <option key={i} value={i}>{u.label}</option>
          ))}
        </select>
      </div>

      {/* Live preview in تومان */}
      {formatted && (
        <p className="text-center text-ivory-dim text-[.82rem]">
          = {formatted} تومان
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={disabled || !amount || tomanValue <= 0}
        className="w-full bg-green text-[#04140a] border-none rounded-xl py-3 font-bold text-[.95rem] cursor-pointer disabled:opacity-40"
      >
        ثبت حدس
      </button>
    </div>
  );
}
