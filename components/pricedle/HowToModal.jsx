"use client";

export default function HowToModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-[rgba(2,8,3,.86)] flex items-center justify-center z-30 p-5 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative bg-bg-1 border border-green-dim rounded-2xl p-[26px_24px] max-w-[340px] w-full text-right">
        <button onClick={onClose} aria-label="بستن"
          className="absolute top-3 left-3 bg-transparent border-none text-ivory-dim text-xl cursor-pointer">✕</button>
        <h2 className="font-display text-2xl text-green m-0 mb-3 text-center">طرز بازی قیمتدل</h2>

        <p className="text-ivory-dim text-sm leading-7 mb-3">
          هر روز ۳ سوال از قیمت چیزهای مختلف در ایران در سال‌های گذشته داری. باید حدس بزنی قیمت اون چیز در اون سال چقدر بود — همه قیمت‌ها به تومانه.
        </p>

        <ul className="text-ivory-dim text-sm leading-7 mb-3 pr-4 list-disc space-y-1">
          <li>عدد رو وارد کن و واحد مناسب رو انتخاب کن (تومان / هزار / میلیون / میلیارد).</li>
          <li>نزدیک‌تر به جواب = امتیاز بیشتر — حداکثر ۱۰۰ امتیاز برای هر سوال.</li>
          <li>امتیازدهی بر اساس نسبته، نه اختلاف مطلق — ۲ برابر اشتباه همونقدر اشتباهه که نصف اشتباه.</li>
          <li>جمع امتیاز ۳ سوال حداکثر ۳۰۰ می‌شه.</li>
          <li>بازی جدید هر روز ساعت ۹ شب به وقت ایران.</li>
        </ul>

        <button onClick={onClose}
          className="w-full bg-green text-[#04140a] border-none rounded-[9px] py-2.5 font-bold text-[.95rem] cursor-pointer">
          بزن بریم
        </button>
      </div>
    </div>
  );
}
