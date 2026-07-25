"use client";

export default function HowToModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-[rgba(2,8,3,.86)] flex items-center justify-center z-30 p-5 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative bg-bg-1 border border-green-dim rounded-2xl p-[26px_24px] max-w-[340px] w-full text-right">
        <button onClick={onClose} aria-label="بستن"
          className="absolute top-3 left-3 bg-transparent border-none text-ivory-dim text-xl cursor-pointer">✕</button>
        <h2 className="font-display text-2xl text-green m-0 mb-3 text-center">طرز بازی کوردل</h2>

        <p className="text-ivory-dim text-sm leading-7 mb-3">
          هر روز یه توالی صوتی از نت‌های پیانو برات پخش می‌شه. تو باید همون توالی رو دوباره بسازی.
        </p>

        <ul className="text-ivory-dim text-sm leading-7 mb-3 pr-4 list-disc space-y-1">
          <li>روی «پخش توالی» بزن تا آهنگ رو بشنوی — می‌تونی هر بار که خواستی دوباره گوش بدی.</li>
          <li>روی یه نت بزن تا انتخاب بشه — نت انتخاب‌شده پررنگ می‌شه.</li>
          <li>بعد روی یه خانه بزن تا نت رو اونجا بذاری.</li>
          <li>روی یه خانه‌ی پر بزن (بدون انتخاب نت) تا خالیش کنی.</li>
          <li>دور اول: ۳ نت — دور دوم: ۴ نت — دور سوم: ۵ نت.</li>
          <li>اگه یه دور رو اشتباه بدی، بازی تموم می‌شه.</li>
        </ul>

        <button onClick={onClose}
          className="w-full bg-green text-[#04140a] border-none rounded-[9px] py-2.5 font-bold text-[.95rem] cursor-pointer">
          بزن بریم
        </button>
      </div>
    </div>
  );
}
