"use client";

export default function HowToModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-[rgba(2,8,3,.86)] flex items-center justify-center z-30 p-5"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative bg-bg-1 border border-green-dim rounded-2xl p-[26px_24px] max-w-[340px] w-full text-right">
        <button onClick={onClose} className="absolute top-3 left-3 bg-transparent border-none text-ivory-dim text-xl cursor-pointer">✕</button>
        <h2 className="font-display text-2xl text-green m-0 mb-3 text-center">طرز بازی کوردل</h2>
        <p className="text-ivory-dim text-sm leading-7 mb-3">
          هر روز سه دور موسیقی داری — گیتار 🎸، پیانو 🎹، درامز 🥁. هر دور یه توالی از ۵ صدا پخش می‌شه که باید ترتیبشو به خاطر بسپاری.
        </p>
        <ul className="text-ivory-dim text-sm leading-7 mb-3 pr-4 list-disc space-y-1">
          <li>روی «شروع نمایش» بزن تا توالی پخش بشه.</li>
          <li>بعد از پخش، ۹ دکمه صوتی ظاهر می‌شن — روی هر کدوم بزن تا صداش رو بشنوی.</li>
          <li>یه دکمه رو انتخاب کن، بعد روی یه خانه بزن تا اونجا بذاریش.</li>
          <li>هر دور ۵ امتیاز داره — هر خانه‌ی درست یه امتیاز.</li>
          <li>مجموع ۱۵ امتیاز، ضربدر ۱۰ = سکه می‌گیری.</li>
          <li>هر شب ۹ صدا از بانک بزرگ‌تری به‌صورت تصادفی انتخاب می‌شن.</li>
        </ul>
        <button onClick={onClose}
          className="w-full bg-green text-[#04140a] border-none rounded-[9px] py-2.5 font-bold text-[.95rem] cursor-pointer">
          بزن بریم
        </button>
      </div>
    </div>
  );
}
