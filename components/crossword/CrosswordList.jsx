"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { fetchCrosswordList, purchaseCrossword } from "@/lib/crossword/api";
import { toPersianDigits } from "@/lib/shared/persian";
import { useAuth } from "@/lib/auth/AuthProvider";
import { supabase } from "@/lib/supabaseClient";

function CoinBalance() {
  const [balance, setBalance] = useState(null);
  useEffect(() => {
    supabase.rpc("get_coin_balance").then(({ data }) => {
      if (data?.[0]) setBalance(Number(data[0].balance));
    });
  }, []);
  if (balance === null) return null;
  return <span className="text-yellow text-[.82rem]">🪙 {toPersianDigits(balance)}</span>;
}

export default function CrosswordListPage() {
  const { user } = useAuth();
  const [crosswords, setCrosswords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await fetchCrosswordList();
    setCrosswords(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleUnlock = async (cw) => {
    if (!user) { setError("برای خرید باید وارد حساب بشی"); return; }
    setPurchasing(cw.id);
    setError("");
    const { data, error: err } = await purchaseCrossword(cw.id);
    setPurchasing(null);
    if (err) {
      const msg = err.message || "";
      if (msg.includes("سکه کافی")) setError("سکه کافی نداری — امشب بیشتر بازی کن!");
      else if (msg.includes("وارد")) setError("ابتدا وارد حساب بشو");
      else setError("خطا — دوباره امتحان کن");
      return;
    }
    await load(); // refresh list
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-3 pt-[18px] pb-10">
      <Header title="مینی جدول" onMenuClick={() => setSidebarOpen(true)} />

      <p className="text-ivory-dim text-[.85rem] text-center mb-6 max-w-[380px]">
        جدول‌های کلمات فارسی — هر جدول رو با سکه باز کن و حل کن
      </p>

      {user && (
        <div className="flex items-center gap-1.5 mb-5 text-[.82rem] text-ivory-dim">
          موجودی: <CoinBalance />
        </div>
      )}

      {error && (
        <div className="w-full max-w-[400px] bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 text-red-400 text-[.82rem] text-center mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3 w-full max-w-[400px]">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-white/[.03] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3 w-full max-w-[400px]">
          {crosswords.map((cw) => (
            <div key={cw.id}
              className="bg-bg-1 border border-green-dim rounded-2xl px-5 py-4 flex items-center justify-between gap-3">

              {/* Info */}
              <div className="flex flex-col gap-1 text-right">
                <span className="text-ivory font-bold text-[.95rem]">{cw.title}</span>
                <span className="text-ivory-dim text-[.75rem]">
                  {toPersianDigits(cw.rows)} × {toPersianDigits(cw.cols)}
                </span>
                {cw.completed && (
                  <span className="text-green text-[.72rem] font-semibold">✓ حل شده</span>
                )}
              </div>

              {/* Action */}
              <div className="flex-shrink-0">
                {cw.unlocked || cw.completed ? (
                  <Link href={`/crossword/${cw.id}`}
                    className="bg-green text-[#04140a] no-underline rounded-xl px-4 py-2 font-bold text-[.85rem]">
                    {cw.completed ? "دیدن دوباره" : "بازی"}
                  </Link>
                ) : (
                  <button
                    onClick={() => handleUnlock(cw)}
                    disabled={purchasing === cw.id}
                    className="flex flex-col items-center gap-0.5 bg-yellow/10 border border-yellow text-yellow rounded-xl px-4 py-2 font-bold text-[.82rem] cursor-pointer disabled:opacity-50"
                  >
                    <span>{purchasing === cw.id ? "..." : "باز کن"}</span>
                    <span className="text-[.7rem] font-normal">🪙 {toPersianDigits(cw.coin_cost)}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  );
}
