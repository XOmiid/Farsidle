"use client";

import { useState } from "react";
import { rgbToHex, hexToRgb } from "@/lib/colordle/logic";
import { toPersianDigits } from "@/lib/shared/persian";

const CHANNELS = [
  { key: "r", label: "قرمز", track: "linear-gradient(to left, #ff0000, #000000)" },
  { key: "g", label: "سبز", track: "linear-gradient(to left, #00ff00, #000000)" },
  { key: "b", label: "آبی", track: "linear-gradient(to left, #0000ff, #000000)" },
];

export default function ColorPicker({ r, g, b, onChange, disabled }) {
  const [hexInput, setHexInput] = useState(rgbToHex(r, g, b));
  const [syncedRgb, setSyncedRgb] = useState(`${r},${g},${b}`);
  const currentRgbKey = `${r},${g},${b}`;
  if (currentRgbKey !== syncedRgb) {
    setSyncedRgb(currentRgbKey);
    setHexInput(rgbToHex(r, g, b));
  }

  const handleSlider = (key, value) => {
    onChange({ r, g, b, [key]: Number(value) });
  };

  const handleHexSubmit = () => {
    const parsed = hexToRgb(hexInput);
    if (parsed) onChange(parsed);
    else setHexInput(rgbToHex(r, g, b));
  };

  return (
    <div className="w-full max-w-[380px] flex flex-col items-center gap-4">
      <div
        className="w-full h-28 rounded-2xl border-2 border-green-dim shadow-inner"
        style={{ background: rgbToHex(r, g, b) }}
      />

      <div className="w-full flex flex-col gap-3">
        {CHANNELS.map((c) => (
          <div key={c.key} className="flex items-center gap-3">
            <span className="text-ivory-dim text-[.8rem] w-10 flex-shrink-0">{c.label}</span>
            <input
              type="range"
              min={0}
              max={255}
              value={{ r, g, b }[c.key]}
              disabled={disabled}
              onChange={(e) => handleSlider(c.key, e.target.value)}
              style={{ background: c.track }}
              className="flex-1 h-2 rounded-full appearance-none cursor-pointer disabled:opacity-40 accent-white"
            />
            <span className="text-ivory text-[.8rem] w-9 text-left flex-shrink-0 tabular-nums">
              {toPersianDigits({ r, g, b }[c.key])}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 w-full">
        <span className="text-ivory-dim text-[.8rem] flex-shrink-0">کد رنگ:</span>
        <input
          type="text"
          dir="ltr"
          value={hexInput}
          disabled={disabled}
          onChange={(e) => setHexInput(e.target.value)}
          onBlur={handleHexSubmit}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleHexSubmit();
          }}
          className="flex-1 bg-white/[.04] border border-green-dim rounded-lg text-ivory text-[.85rem] px-3 h-9 text-center tracking-wider focus:outline-none focus:border-green disabled:opacity-40"
        />
      </div>
    </div>
  );
}
