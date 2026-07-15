"use client";

import { useMemo, useState } from "react";
import { normalizeCountryName } from "@/lib/factle/logic";

export default function GuessInput({ countryList, guessedNames, disabled, onGuess }) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);

  const guessedSet = useMemo(
    () => new Set(guessedNames.map(normalizeCountryName)),
    [guessedNames]
  );

  const suggestions = useMemo(() => {
    const q = normalizeCountryName(value);
    if (!q) return [];
    return countryList
      .filter((c) => !guessedSet.has(normalizeCountryName(c)))
      .filter((c) => normalizeCountryName(c).includes(q))
      .slice(0, 6);
  }, [value, countryList, guessedSet]);

  const submit = (name) => {
    if (disabled) return;
    onGuess(name);
    setValue("");
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (suggestions.length >= 1) {
      submit(suggestions[0]);
      return;
    }
    const exact = countryList.find((c) => normalizeCountryName(c) === normalizeCountryName(value));
    if (exact && !guessedSet.has(normalizeCountryName(exact))) submit(exact);
  };

  return (
    <div className="relative w-full max-w-[420px]">
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="اسم یه کشور رو تایپ کن..."
        className="w-full bg-white/[.04] border border-green-dim rounded-xl text-ivory text-[.95rem] px-4 h-12 text-right placeholder:text-ivory-dim focus:outline-none focus:border-green disabled:opacity-40"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-20 top-[calc(100%+6px)] right-0 left-0 bg-bg-1 border border-green-dim rounded-xl overflow-hidden shadow-lg">
          {suggestions.map((c) => (
            <button
              key={c}
              onMouseDown={() => submit(c)}
              className="w-full text-right px-4 py-2.5 text-sm text-ivory hover:bg-green/10 transition-colors"
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
