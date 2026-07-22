"use client";

import { useState } from "react";
import { TOON_OPTIONS, buildAvatarUrl } from "@/lib/shared/avatars";

// Generic numbered labels — "مو ۱", "مو ۲" etc.
// The visual itself tells you what it looks like; the name doesn't need to.
function numberedLabel(index) {
  const persian = ["۱","۲","۳","۴","۵","۶","۷","۸","۹","۱۰"];
  return persian[index] || String(index + 1);
}

const SECTIONS = [
  { key: "hair",      label: "مو" },
  { key: "rearHair",  label: "موی پشت" },
  { key: "eyes",      label: "چشم" },
  { key: "eyebrows",  label: "ابرو" },
  { key: "mouth",     label: "دهان" },
  { key: "beard",     label: "ریش/سبیل" },
  { key: "clothes",   label: "لباس" },
];

const COLOR_SECTIONS = [
  { key: "skinColor",    label: "رنگ پوست" },
  { key: "hairColor",    label: "رنگ مو" },
  { key: "clothesColor", label: "رنگ لباس" },
];

function OptionButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-[.78rem] font-medium border transition-colors cursor-pointer ${
        active
          ? "bg-green text-[#04140a] border-green"
          : "bg-white/[.04] text-ivory-dim border-border hover:border-green-dim"
      }`}
    >
      {label}
    </button>
  );
}

function ColorSwatch({ hex, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-7 h-7 rounded-full border-2 cursor-pointer transition-transform ${
        active ? "border-green scale-110" : "border-transparent hover:scale-105"
      }`}
      style={{ background: `#${hex}` }}
    />
  );
}

export default function AvatarBuilder({ options, onChange, onRandomize }) {
  const [open, setOpen] = useState(false);
  const previewUrl = buildAvatarUrl(options, 300);

  return (
    <div className="w-full flex flex-col items-center gap-3">
      {/* Always-visible avatar preview */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewUrl}
        alt="آواتار"
        className="w-28 h-28 rounded-2xl border-2 border-green-dim bg-bg-1"
      />

      {/* Toggle + randomize row */}
      <div className="w-full flex gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex-1 flex items-center justify-between bg-white/[.04] border border-green-dim text-ivory rounded-[9px] px-4 py-2.5 text-[.88rem] cursor-pointer hover:bg-green/5 transition-colors"
        >
          <span>{open ? "بستن ویرایش" : "ویرایش آواتار"}</span>
          <span className="text-green text-sm">{open ? "▲" : "▼"}</span>
        </button>
        {onRandomize && (
          <button
            type="button"
            onClick={onRandomize}
            className="bg-white/[.04] border border-border text-ivory-dim rounded-[9px] px-3 py-2.5 text-[.82rem] cursor-pointer hover:border-green-dim transition-colors flex-shrink-0"
            title="آواتار تصادفی"
          >
            🎲
          </button>
        )}
      </div>

      {/* Collapsible builder */}
      {open && (
        <div className="w-full flex flex-col gap-4 pt-1">
          {/* Feature selectors */}
          {SECTIONS.map(({ key, label }) => (
            <div key={key}>
              <p className="text-[.78rem] text-ivory-dim mb-2 text-right">{label}</p>
              <div className="flex flex-wrap gap-2">
                {TOON_OPTIONS[key].map((val, i) => (
                  <OptionButton
                    key={val}
                    label={`${label} ${numberedLabel(i)}`}
                    active={options[key] === val}
                    onClick={() => onChange({ ...options, [key]: val })}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Color pickers */}
          {COLOR_SECTIONS.map(({ key, label }) => (
            <div key={key}>
              <p className="text-[.78rem] text-ivory-dim mb-2 text-right">{label}</p>
              <div className="flex flex-wrap gap-2.5">
                {TOON_OPTIONS[key].map((hex) => (
                  <ColorSwatch
                    key={hex}
                    hex={hex}
                    active={options[key] === hex}
                    onClick={() => onChange({ ...options, [key]: hex })}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
