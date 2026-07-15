"use client";

export default function Toast({ message }) {
  return (
    <div
      className={`min-h-[28px] bg-green text-[#04140a] font-bold text-sm px-3.5 py-1 rounded-lg mb-2.5 pointer-events-none transition-all duration-150 ${
        message ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1.5"
      }`}
    >
      {message || "\u00A0"}
    </div>
  );
}
