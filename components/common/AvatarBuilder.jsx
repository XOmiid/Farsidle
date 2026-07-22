"use client";

import { TOON_OPTIONS, TOON_LABELS, TOON_COLOR_NAMES, buildAvatarUrl } from "@/lib/shared/avatars";

const SECTIONS = [
  { key: "hair", label: "مو" },
  { key: "rearHair", label: "موی پشت" },
  { key: "eyes", label: "چشم" },
  { key: "eyebrows", label: "ابرو" },
  { key: "mouth", label: "دهان" },
  { key: "beard", label: "ریش/سبیل" },
  { key: "clothes", label: "لباس" },
];

const COLOR_SECTIONS = [
  { key: "skinColor", label: "رنگ پوست" },
  { key: "hairColor", label: "رنگ مو" },
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
      title={TOON_COLOR_NAMES[hex] || hex}
      className={`w-7 h-7 rounded-full border-2 cursor-pointer transition-transform ${
        active ? "border-green scale-110" : "border-transparent hover:scale-105"
      }`}
      style={{ background: `#${hex}` }}
    />
  );
}

export default function AvatarBuilder({ options, onChange }) {
  const previewUrl = buildAvatarUrl(options, 300);

  return (
    <div className="w-full flex flex-col gap-5">
      {/* Live preview */}
      <div className="flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt="پیش‌نمایش آواتار"
          className="w-36 h-36 rounded-2xl border-2 border-green-dim bg-bg-1"
        />
      </div>

      {/* Feature selectors */}
      {SECTIONS.map(({ key, label }) => (
        <div key={key}>
          <p className="text-[.78rem] text-ivory-dim mb-2">{label}</p>
          <div className="flex flex-wrap gap-2">
            {TOON_OPTIONS[key].map((val) => (
              <OptionButton
                key={val}
                label={TOON_LABELS[key]?.[val] || val}
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
          <p className="text-[.78rem] text-ivory-dim mb-2">{label}</p>
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
  );
}
