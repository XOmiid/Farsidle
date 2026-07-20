import { toJalaali, toGregorian, jalaaliMonthLength } from "jalaali-js";

export const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

// Gregorian ISO date string ('YYYY-MM-DD') -> { jy, jm, jd } | null
export function isoToJalali(iso) {
  if (!iso) return null;
  const [gy, gm, gd] = iso.split("-").map(Number);
  if (!gy || !gm || !gd) return null;
  const { jy, jm, jd } = toJalaali(gy, gm, gd);
  return { jy, jm, jd };
}

// { jy, jm, jd } -> Gregorian ISO date string ('YYYY-MM-DD')
export function jalaliToIso(jy, jm, jd) {
  const { gy, gm, gd } = toGregorian(jy, jm, jd);
  const pad = (n) => String(n).padStart(2, "0");
  return `${gy}-${pad(gm)}-${pad(gd)}`;
}

export function daysInJalaliMonth(jy, jm) {
  return jalaaliMonthLength(jy, jm);
}

export function currentJalaliYear() {
  const now = new Date();
  const { jy } = toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return jy;
}
