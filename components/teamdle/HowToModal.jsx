"use client";

import { useState } from "react";

export default function TeamdleHowToModal({ open, onClose }) {
  const [confirmed, setConfirmed] = useState(false);
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-[rgba(2,8,3,.92)] flex items-center justify-center z-40 p-4">
      <div className="bg-bg-1 border-2 border-yellow rounded-2xl max-w-[400px] w-full max-h-[90vh] flex flex-col overflow-hidden">

        {/* Warning header */}
        <div className="bg-yellow/15 border-b border-yellow px-5 py-3 flex items-center gap-2 flex-shrink-0">
          <span className="text-[1.4rem]">⚠️</span>
          <div>
            <p className="text-yellow font-extrabold text-[.95rem] leading-tight">حتماً بخوان!</p>
            <p className="text-yellow/80 text-[.72rem]">قوانین بازی تیمدل — قبل از شروع</p>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-5 py-4 text-right">

          {/* Team assignment */}
          <div className="mb-4">
            <p className="text-green font-bold text-[.88rem] mb-1">🔴🔵 تیم‌بندی خودکار</p>
            <p className="text-ivory-dim text-[.82rem] leading-6">
              وقتی وارد بازی بشی، سیستم به‌صورت خودکار تو رو به تیم قرمز یا آبی اضافه می‌کنه.
              تیم‌ها به‌صورت متناوب پر می‌شن تا اعداد برابر باشن. <span className="text-yellow font-semibold">تیمت رو نمی‌تونی عوض کنی.</span>
            </p>
          </div>

          {/* How it works */}
          <div className="mb-4">
            <p className="text-green font-bold text-[.88rem] mb-1">🌍 طرز بازی</p>
            <ul className="text-ivory-dim text-[.82rem] leading-7 space-y-1">
              <li>• هر روز ۴ سوال داری — اسم کشور نشون داده می‌شه</li>
              <li>• باید از ۲ گزینه، پایتخت اصلی رو انتخاب کنی</li>
              <li>• ۶ ثانیه وقت داری — اگه وقت تموم بشه، اشتباه حساب می‌شه</li>
              <li>• هر جواب درست = ۱ امتیاز (حداکثر ۴ امتیاز)</li>
            </ul>
          </div>

          {/* Matching questions */}
          <div className="mb-4">
            <p className="text-green font-bold text-[.88rem] mb-1">🤝 سوالات هم‌تراز</p>
            <p className="text-ivory-dim text-[.82rem] leading-6">
              اولین بازیکن تیم قرمز و اولین بازیکن تیم آبی <span className="text-ivory font-semibold">همان ۴ کشور</span> را می‌بینند.
              دومین بازیکن هر تیم هم با هم یکسانند. این طراحی رقابت را منصفانه می‌کند.
            </p>
          </div>

          {/* Winning */}
          <div className="mb-4">
            <p className="text-green font-bold text-[.88rem] mb-1">🏆 برنده و جوایز</p>
            <ul className="text-ivory-dim text-[.82rem] leading-7 space-y-1">
              <li>• تیم با امتیاز کل بیشتر برنده می‌شه</li>
              <li>• هر بازیکن تیم برنده: <span className="text-yellow font-bold">۱۵۰ سکه</span></li>
              <li>• در صورت مساوی: هر بازیکن <span className="text-yellow font-bold">۷۵ سکه</span></li>
              <li>• نتیجه‌ی دیروز فردا صبح به‌صورت پاپ‌آپ نشون داده می‌شه</li>
            </ul>
          </div>

          {/* Important warning */}
          <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-3 mb-4">
            <p className="text-red-400 font-bold text-[.82rem] mb-1">🚨 مهم</p>
            <p className="text-red-300 text-[.78rem] leading-6">
              بعد از ورود به بازی، سوالات امروزت ثبت می‌شه و تیمت مشخص می‌شه.
              نمی‌تونی دوباره بازی کنی یا تیم را عوض کنی.
              <span className="font-bold"> مطمئن باش آماده‌ای!</span>
            </p>
          </div>

          {/* Confirm checkbox */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-green flex-shrink-0" />
            <span className="text-ivory text-[.82rem] leading-6">
              قوانین رو خوندم و قبول دارم. می‌دونم که بعد از ورود به بازی تیمم ثابت می‌مونه.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={!confirmed}
            className="w-full bg-green text-[#04140a] border-none rounded-xl py-3 font-extrabold text-[.95rem] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {confirmed ? "فهمیدم، بزن بریم!" : "ابتدا تأیید کن ↑"}
          </button>
        </div>
      </div>
    </div>
  );
}
