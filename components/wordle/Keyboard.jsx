"use client";

import { ALPHABET_ROWS } from "@/lib/wordle/logic";

const STATUS_CLASSES = {
  correct: "bg-green border-green text-[#04140a]",
  present: "bg-yellow border-yellow text-[#2b2205]",
  absent: "bg-red border-red text-[#f8dcdc]",
};

export default function Keyboard({ keyStatus, disabled, onLetter, onEnter, onDelete }) {
  return (
    <div
      className={`w-full max-w-[520px] flex flex-col gap-[7px] items-center transition-opacity duration-200 ${
        disabled ? "opacity-35 pointer-events-none" : ""
      }`}
    >
      {/* Rows are rendered mirrored (reversed) to match the real iOS Persian keyboard layout. */}
      {ALPHABET_ROWS.map((row, i) => (
        <div key={i} className="flex gap-[5px] w-full justify-center">
          {[...row].reverse().map((letter) => (
            <button
              key={letter}
              onClick={() => onLetter(letter)}
              className={`key flex-1 max-w-[38px] h-[46px] bg-bg-2 border border-border rounded-[7px] text-ivory text-base font-semibold flex items-center justify-center select-none transition-[.12s] active:scale-[.92] ${
                keyStatus[letter] ? STATUS_CLASSES[keyStatus[letter]] : ""
              }`}
            >
              {letter}
            </button>
          ))}
        </div>
      ))}
      <div className="flex gap-[5px] w-full justify-center">
        <button
          onClick={onDelete}
          className="key flex-1 max-w-[88px] h-[46px] bg-bg-2 border border-border rounded-[7px] text-ivory text-[.78rem] font-bold flex items-center justify-center select-none transition-[.12s] active:scale-[.92]"
        >
          ⌫ حذف
        </button>
        <button
          onClick={onEnter}
          className="key flex-1 max-w-[88px] h-[46px] bg-bg-2 border border-border rounded-[7px] text-ivory text-[.78rem] font-bold flex items-center justify-center select-none transition-[.12s] active:scale-[.92]"
        >
          ورود
        </button>
      </div>
    </div>
  );
}
