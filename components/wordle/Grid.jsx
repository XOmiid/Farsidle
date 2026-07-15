"use client";

import { MAX_TRIES, cellSizeFor } from "@/lib/wordle/logic";

const STATUS_CLASSES = {
  correct: "bg-green border-green text-[#04140a]",
  present: "bg-yellow border-yellow text-[#2b2205]",
  absent: "bg-red border-red text-[#2b0605]",
};

export default function Grid({ wordLen, guesses, currentGuess, currentRow, revealingRow, shaking }) {
  const size = cellSizeFor(wordLen);
  const rows = Array.from({ length: MAX_TRIES });

  return (
    <div
      className="grid gap-[7px] mb-[22px]"
      style={{ gridTemplateRows: `repeat(${MAX_TRIES}, 1fr)` }}
    >
      {rows.map((_, r) => {
        const committed = guesses[r]; // { guess, result } once locked in
        const isRevealing = revealingRow && revealingRow.row === r;
        const isCurrent = !committed && !isRevealing && r === currentRow;

        return (
          <div
            key={r}
            className={`grid gap-[7px] ${isCurrent && shaking ? "shake-row" : ""}`}
            style={{ gridTemplateColumns: `repeat(${wordLen}, ${size}px)` }}
          >            {Array.from({ length: wordLen }).map((__, c) => {
              let letter = "";
              let status = null;
              let flipDelay = 0;
              let filled = false;

              if (committed) {
                letter = committed.guess[c];
                status = committed.result[c];
                filled = true;
              } else if (isRevealing) {
                letter = revealingRow.guess[c];
                status = revealingRow.result[c];
                flipDelay = c * 220;
                filled = true;
              } else if (isCurrent) {
                letter = currentGuess[c] || "";
                filled = !!letter;
              }

              return (
                <div
                  key={c}
                  className={`flex items-center justify-center border-2 rounded-lg font-bold text-[1.4rem] transition-transform duration-150 ${
                    isRevealing
                      ? `flip-${status}`
                      : status
                      ? STATUS_CLASSES[status]
                      : filled
                      ? "border-[#2f5b34] scale-[1.03]"
                      : "border-border"
                  }`}
                  style={{
                    width: size,
                    height: size,
                    background: !status && !isRevealing ? "rgba(255,255,255,.02)" : undefined,
                    animationDelay: isRevealing ? `${flipDelay}ms` : undefined,
                  }}
                >
                  {letter}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
