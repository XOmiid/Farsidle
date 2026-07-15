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
        <h2 className="font-display text-2xl text-green m-0 mb-3 text-center">طرز بازی</h2>

        <p className="text-ivory-dim text-sm leading-7 mb-3">
          هر روز یک کلمه‌ی فارسی جدید هست که همه با هم حدس می‌زنن، در ۶ تلاش. طول کلمه هر روز فرق
          می‌کنه. بعد از هر حدس، رنگ خونه‌ها بهت نشون میده چقدر به جواب نزدیکی.
        </p>

        <div className="flex gap-1.5 justify-center my-3.5">
          {["س", "ت", "ا", "ر", "ه"].map((ch, i) => (
            <div
              key={i}
              className={`w-[42px] h-[42px] flex items-center justify-center rounded-lg border-2 font-bold text-lg ${
                i === 0 ? "bg-green border-green text-[#04140a]" : "border-border"
              }`}
              style={{ background: i === 0 ? undefined : "rgba(255,255,255,.02)" }}
            >
              {ch}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2.5 my-2.5 text-[.85rem] text-ivory-dim">
          <span className="w-[26px] h-[26px] rounded-md flex-shrink-0 bg-green" />
          <span>حرف درست و در جای درست قرار داره.</span>
        </div>

        <div className="flex gap-1.5 justify-center my-3.5">
          {["پ", "ر", "و", "ا", "ز"].map((ch, i) => (
            <div
              key={i}
              className={`w-[42px] h-[42px] flex items-center justify-center rounded-lg border-2 font-bold text-lg ${
                i === 1 ? "bg-yellow border-yellow text-[#2b2205]" : "border-border"
              }`}
              style={{ background: i === 1 ? undefined : "rgba(255,255,255,.02)" }}
            >
              {ch}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2.5 my-2.5 text-[.85rem] text-ivory-dim">
          <span className="w-[26px] h-[26px] rounded-md flex-shrink-0 bg-yellow" />
          <span>حرف در کلمه هست، اما جاش اشتباهه.</span>
        </div>

        <div className="flex gap-1.5 justify-center my-3.5">
          {["ک", "ت", "ا", "ب", "ی"].map((ch, i) => (
            <div
              key={i}
              className={`w-[42px] h-[42px] flex items-center justify-center rounded-lg border-2 font-bold text-lg ${
                i === 2 ? "bg-red border-red text-[#2b0605]" : "border-border"
              }`}
              style={{ background: i === 2 ? undefined : "rgba(255,255,255,.02)" }}
            >
              {ch}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2.5 my-2.5 text-[.85rem] text-ivory-dim">
          <span className="w-[26px] h-[26px] rounded-md flex-shrink-0 bg-red" />
          <span>حرف اصلاً در کلمه وجود نداره.</span>
        </div>

        <ul className="text-ivory-dim text-sm leading-7 mb-3 pr-4 list-disc space-y-1 text-right">
          <li>فقط یک بار در روز می‌تونی بازی کنی؛ کلمه‌ی امروز برای همه یکسانه.</li>
          <li>حروف «آ» و «ا» یکی حساب می‌شن، فقط با دکمه‌ی «ا» تایپ کن.</li>
          <li>بازی جدید هر روز ساعت ۹ شب به وقت ایران منتشر می‌شه؛ یعنی کلمه همون موقع عوض می‌شه.</li>
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
