"use client";

import { useState } from "react";
import {
  JALALI_MONTHS,
  isoToJalali,
  jalaliToIso,
  daysInJalaliMonth,
  currentJalaliYear,
} from "@/lib/shared/jalali";

const THIS_YEAR = currentJalaliYear();
const YEARS = Array.from({ length: 101 }, (_, i) => THIS_YEAR - i);

export default function PersianDateInput({ value, onChange }) {
  const parsed = isoToJalali(value);

  const [day, setDay] = useState(parsed?.jd ?? "");
  const [month, setMonth] = useState(parsed?.jm ?? "");
  const [year, setYear] = useState(parsed?.jy ?? "");

  // Keep local selects in sync if the parent's value changes externally
  // (e.g. loading a saved profile after the component already mounted).
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    const p = isoToJalali(value);
    setDay(p?.jd ?? "");
    setMonth(p?.jm ?? "");
    setYear(p?.jy ?? "");
  }

  const maxDay = month && year ? daysInJalaliMonth(Number(year), Number(month)) : 31;
  const dayOptions = Array.from({ length: maxDay }, (_, i) => i + 1);

  const commit = (d, m, y) => {
    if (d && m && y) {
      const clampedDay = Math.min(Number(d), daysInJalaliMonth(Number(y), Number(m)));
      onChange(jalaliToIso(Number(y), Number(m), clampedDay));
    } else {
      onChange("");
    }
  };

  const handleDay = (e) => {
    const v = e.target.value;
    setDay(v);
    commit(v, month, year);
  };
  const handleMonth = (e) => {
    const v = e.target.value;
    setMonth(v);
    commit(day, v, year);
  };
  const handleYear = (e) => {
    const v = e.target.value;
    setYear(v);
    commit(day, month, v);
  };

  const selectClass =
    "bg-white/[.04] border border-green-dim rounded-[9px] text-ivory text-[.9rem] px-2.5 h-11 text-center focus:outline-none focus:border-green";

  return (
    <div className="flex gap-2">
      <select value={day} onChange={handleDay} className={`${selectClass} flex-1`}>
        <option value="">روز</option>
        {dayOptions.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      <select value={month} onChange={handleMonth} className={`${selectClass} flex-[1.6]`}>
        <option value="">ماه</option>
        {JALALI_MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>

      <select value={year} onChange={handleYear} className={`${selectClass} flex-1`}>
        <option value="">سال</option>
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
