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
        <h2 className="font-display text-2xl text-green m-0 mb-3 text-center">طرز بازی پولدل</h2>

        <p className="text-ivory-dim text-sm leading-7 mb-3">
          هر روز ۵ ارز از کشورهای مختلف نشونت داده می‌شه. باید حدس بزنی کدوم یکی از همه باارزش‌تره
          و کدوم کم‌ارزش‌تر، و اونا رو از بیشترین به کمترین ارزش (نسبت به دلار) مرتب کنی.
        </p>

        <ul className="text-ivory-dim text-sm leading-7 mb-3 pr-4 list-disc space-y-1 text-right">
          <li>با دکمه‌های بالا/پایین کنار هر ارز، ترتیبشون رو عوض کن.</li>
          <li>هر چقدر خواستی وقت داری، فقط یک بار می‌تونی نهایی کنی.</li>
          <li>برای هر ارزی که تو جای درست بذاری، یک امتیاز می‌گیری؛ امتیاز نهایی از ۵.</li>
          <li>فقط یک بار در روز می‌تونی بازی کنی؛ ارزهای امروز برای همه یکسانه.</li>
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
