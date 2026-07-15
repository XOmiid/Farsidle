"use client";

export default function CountdownBar({ visible, text, onClick }) {
  if (!visible) return null;
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-2 bg-green/[.08] border border-green-dim text-green text-[.82rem] font-semibold px-3.5 py-[7px] rounded-[20px] mb-3.5 cursor-pointer"
    >
      🏆 دیدن نتیجه · کلمه‌ی بعدی تا <b className="font-extrabold tracking-wider">{text}</b>
    </div>
  );
}
