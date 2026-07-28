"use client";

export default function HowToModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-[rgba(2,8,3,.86)] flex items-center justify-center z-30 p-5 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative bg-bg-1 border border-green-dim rounded-2xl p-[26px_24px] max-w-[340px] w-full text-right">
        <button onClick={onClose} aria-label="بستن"
          className="absolute top-3 left-3 bg-transparent border-none text-ivory-dim text-xl cursor-pointer">✕</button>
        <h2 className="font-display text-2xl text-green m-0 mb-3 text-center">طرز بازی مموریدل</h2>
        <p className="text-ivory-dim text-sm leading-7 mb-3">
          هر روز دو مرحله حافظه داری. توی هر مرحله ۵ عدد یکی‌یکی بهت نشون داده می‌شه — باید به خاطر بسپاریشون.
        </p>
        <ul className="text-ivory-dim text-sm leading-7 mb-3 pr-4 list-disc space-y-1">
          <li>هر عدد ۲ ثانیه نشون داده می‌شه، بعد ناپدید می‌شه.</li>
          <li>بعد از دیدن همه، ۱۵ عدد روی صفحه ظاهر می‌شه — باید همون ۵ تایی که دیدی رو پیدا کنی.</li>
          <li>دقیقاً ۵ تا انتخاب کن، بیشتر نمی‌شه.</li>
          <li>هر عدد درست = یک امتیاز. حداکثر ۱۰ امتیاز (۵ مرحله اول + ۵ مرحله دوم).</li>
          <li>مرحله ۱: اعداد ۰ تا ۹۹ — مرحله ۲: اعداد ۱۰۰ تا ۹۹۹.</li>
          <li>همه امروز یه سری اعداد یکسان دارن.</li>
        </ul>
        <button onClick={onClose}
          className="w-full bg-green text-[#04140a] border-none rounded-[9px] py-2.5 font-bold text-[.95rem] cursor-pointer">
          بزن بریم
        </button>
      </div>
    </div>
  );
}
