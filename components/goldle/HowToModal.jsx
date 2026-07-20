"use client";

export default function HowToModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-[rgba(2,8,3,.86)] flex items-center justify-center z-30 p-5 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative bg-bg-1 border border-green-dim rounded-2xl p-[26px_24px] max-w-[340px] w-full text-right">
        <button
          onClick={onClose}
          aria-label="بستن"
          className="absolute top-3 left-3 bg-transparent border-none text-ivory-dim text-xl cursor-pointer"
        >
          ✕
        </button>
        <h2 className="font-display text-2xl text-green m-0 mb-3 text-center">طرز بازی طلادل</h2>

        <p className="text-ivory-dim text-sm leading-7 mb-3">
          با ۱۰۰ طلا شروع می‌کنی. هر روز ۵ سوال داری، از ساده به سخت. تو هر سوال باید کل طلای فعلیت
          رو بین ۴ گزینه تقسیم کنی — می‌تونی همه رو رو یک گزینه بذاری اگه مطمئنی، یا بین چندتا
          تقسیمش کنی اگه شک داری.
        </p>

        <ul className="text-ivory-dim text-sm leading-7 mb-3 pr-4 list-disc space-y-1 text-right">
          <li>فقط طلایی که رو گزینه‌ی درست گذاشتی به سوال بعدی می‌رسه؛ بقیه از دست می‌ره.</li>
          <li>اگه طلات صفر بشه، بازی همون‌جا تموم می‌شه.</li>
          <li>اگه به سوال پنجم برسی، هرچقدر طلا داشته باشی امتیاز نهاییته.</li>
          <li>فقط یک بار در روز می‌تونی بازی کنی؛ سوال‌های امروز برای همه یکسانه.</li>
          <li>بازی جدید هر روز ساعت ۹ شب به وقت ایران منتشر می‌شه.</li>
        </ul>

        <button
          onClick={onClose}
          className="w-full bg-green text-[#04140a] border-none rounded-[9px] py-2.5 font-bold text-[.95rem] cursor-pointer"
        >
          متوجه شدم
        </button>
      </div>
    </div>
  );
}
