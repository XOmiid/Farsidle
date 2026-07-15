"use client";

export default function GuessHistory({ guesses }) {
  if (!guesses.length) return null;
  return (
    <div className="w-full max-w-[420px] flex flex-wrap gap-2 mb-5 justify-center">
      {guesses.map((g, i) => (
        <span
          key={`${g}-${i}`}
          className="flex items-center gap-1.5 bg-red/10 border border-red/30 text-red text-[.8rem] rounded-full px-3 py-1"
        >
          ✗ {g}
        </span>
      ))}
    </div>
  );
}
