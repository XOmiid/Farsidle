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
        <h2 className="font-display text-2xl text-green m-0 mb-3 text-center">طرز بازی رنگدل</h2>

        <p className="text-ivory-dim text-sm leading-7 mb-3">
          دکمه‌ی «نمایش رنگ» رو بزن تا رنگ امروز رو برای ۱۰ ثانیه ببینی. بعدش رنگ محو می‌شه و باید
          با سه اسلایدر قرمز، سبز و آبی، از حافظه‌ات همون رنگ رو بسازی.
        </p>

        <ul className="text-ivory-dim text-sm leading-7 mb-3 pr-4 list-disc space-y-1 text-right">
          <li>فقط یک بار می‌تونی رنگ رو ببینی، پس خوب نگاش کن.</li>
          <li>بعد از محو شدن رنگ، هر چقدر خواستی وقت داری تا با اسلایدرها حدست رو بسازی.</li>
          <li>بعد از ثبت نهایی، امتیازی بین صفر تا ده بر اساس نزدیکیت به رنگ واقعی می‌گیری.</li>
          <li>فقط یک بار در روز می‌تونی بازی کنی؛ رنگ امروز برای همه یکسانه.</li>
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
