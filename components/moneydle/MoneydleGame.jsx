"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Toast from "@/components/Toast";
import CountdownBar from "@/components/common/CountdownBar";
import HowToModal from "@/components/moneydle/HowToModal";
import RankList from "@/components/moneydle/RankList";
import MoneydleResultModal from "@/components/moneydle/MoneydleResultModal";
import {
  fetchTodayCurrencies,
  submitRanking,
  fetchTodayLeaderboard,
  submitScore,
  checkTodayStatus,
  fetchTodayReveal,
} from "@/lib/moneydle/api";
import { msUntilNextRollover, formatCountdown } from "@/lib/shared/time";
import { useAuth } from "@/lib/auth/AuthProvider";
import { translatePostgrestError } from "@/lib/auth/errors";
import { toPersianDigits } from "@/lib/shared/persian";
import { currencyFlag } from "@/lib/moneydle/flags";

export default function MoneydleGame() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [remoteOnly, setRemoteOnly] = useState(false);

  const [items, setItems] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [score, setScore] = useState(null);
  const [submittedOrder, setSubmittedOrder] = useState(null);
  const [correctOrder, setCorrectOrder] = useState(null);
  const [streak, setStreak] = useState(0);

  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [howtoOpen, setHowtoOpen] = useState(false);

  const [resultOpen, setResultOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [leaderboardSubmitted, setLeaderboardSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [countdownVisible, setCountdownVisible] = useState(false);
  const [countdownText, setCountdownText] = useState("۰۰:۰۰:۰۰");
  const countdownInterval = useRef(null);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 1600);
  }, []);

  const startCountdown = useCallback(() => {
    setCountdownVisible(true);
    const tick = () => {
      const ms = msUntilNextRollover();
      setCountdownText(formatCountdown(ms));
      if (ms <= 0) {
        clearInterval(countdownInterval.current);
        window.location.reload();
      }
    };
    tick();
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    countdownInterval.current = setInterval(tick, 1000);
  }, []);

  const openResult = useCallback(async () => {
    setResultOpen(true);
    setLeaderboardLoading(true);
    const entries = await fetchTodayLeaderboard();
    setLeaderboardLoading(false);
    setLeaderboard(entries);

    const idx = profile?.username ? entries.findIndex((e) => e.name === profile.username) : -1;
    setHighlightIndex(idx);
    startCountdown();
  }, [startCountdown, profile]);

  useEffect(() => {
    return () => {
      if (countdownInterval.current) clearInterval(countdownInterval.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // Boot
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const currencies = await fetchTodayCurrencies();
      if (cancelled) return;
      if (!currencies) {
        setLoadError(true);
        setLoading(false);
        return;
      }
      setItems(currencies);

      const status = await checkTodayStatus();
      if (cancelled) return;

      setStreak(status.streak || 0);
      setLeaderboardSubmitted(!!status.leaderboard_submitted);

      if (status.played) {
        setGameOver(true);
        setRemoteOnly(true);
        setScore(status.score);
        const reveal = await fetchTodayReveal();
        if (cancelled) return;
        setCorrectOrder(reveal);
        setLoading(false);
        openResult();
        return;
      }

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitting || items.length === 0) return;
    setSubmitting(true);
    const orderedIds = items.map((it) => it.currency_id);
    const { data, error } = await submitRanking(orderedIds);
    setSubmitting(false);

    if (error || !data) {
      showToast("ثبت نشد، دوباره امتحان کن");
      return;
    }

    setGameOver(true);
    setScore(data.score);
    setSubmittedOrder(items);
    setCorrectOrder(data.correct_order);
    openResult();
  }, [submitting, items, openResult, showToast]);

  const handleSubmitScore = useCallback(async () => {
    setSubmitError("");
    const { data: entries, error } = await submitScore();
    if (error || !entries) {
      setSubmitError(translatePostgrestError(error));
      return;
    }
    setLeaderboardSubmitted(true);
    setLeaderboard(entries);
    const idx = profile?.username ? entries.findIndex((e) => e.name === profile.username) : -1;
    setHighlightIndex(idx);
  }, [profile]);

  const helpButton = (
    <button
      onClick={() => setHowtoOpen(true)}
      aria-label="راهنما"
      className="w-9 h-9 rounded-full border border-green-dim text-green flex items-center justify-center hover:bg-green/10 transition-colors flex-shrink-0"
    >
      ؟
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col items-center px-3 pt-[18px] pb-6">
      <Header title="پولدل" onMenuClick={() => setSidebarOpen(true)} right={helpButton} />

      <p className="text-center text-ivory-dim text-[.85rem] mb-3.5 px-2.5">
        {loading
          ? "در حال بارگذاری..."
          : loadError
          ? "اتصال به سرور برقرار نشد، صفحه رو دوباره باز کن"
          : remoteOnly
          ? "امروز قبلاً این بازی رو انجام دادی"
          : "از باارزش‌ترین به کم‌ارزش‌ترین مرتب‌شون کن:"}
      </p>

      <CountdownBar
        visible={countdownVisible}
        text={countdownText}
        onClick={() => gameOver && openResult()}
      />

      <Toast message={toastMsg} />

      {!loading && !loadError && !gameOver && (
        <>
          <RankList items={items} onReorder={setItems} disabled={submitting} />
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-6 bg-green text-[#04140a] border-none rounded-xl px-8 py-3 font-bold text-[1rem] cursor-pointer disabled:opacity-50"
          >
            {submitting ? "در حال ثبت..." : "ثبت نهایی"}
          </button>
        </>
      )}

      {!loading && !loadError && gameOver && score !== null && (
        <div className="w-full flex flex-col items-center gap-3">
          <p className="text-ivory-dim text-[.9rem]">
            امتیازت: <span className="text-green font-bold">{score}/۵</span>
          </p>

          {correctOrder && correctOrder.length > 0 && (
            <div className="w-full max-w-[420px] flex flex-col gap-1.5 mt-1">
              {correctOrder.map((c, i) => (
                <div
                  key={c.code}
                  className="flex items-center gap-2.5 bg-bg-1 border border-green-dim rounded-lg px-3 py-2 text-[.85rem]"
                >
                  <span className="text-green-dim font-bold min-w-[16px]">{toPersianDigits(i + 1)}</span>
                  <span className="text-base flex-shrink-0">{currencyFlag(c.code)}</span>
                  <span className="flex-1 text-ivory text-right">{c.name_fa}</span>
                  <span className="text-ivory-dim text-[.72rem]" dir="ltr">
                    {c.code}
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={openResult}
            className="mt-2 bg-green/10 border border-green-dim text-green rounded-xl px-6 py-2.5 font-bold text-[.9rem] cursor-pointer"
          >
            دیدن نتیجه و جدول برترین‌ها
          </button>
        </div>
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <HowToModal open={howtoOpen} onClose={() => setHowtoOpen(false)} />
      <MoneydleResultModal
        open={resultOpen}
        score={score}
        submittedOrder={submittedOrder}
        correctOrder={correctOrder}
        streak={streak}
        leaderboard={leaderboard}
        leaderboardLoading={leaderboardLoading}
        highlightIndex={highlightIndex}
        alreadySubmitted={leaderboardSubmitted}
        submitError={submitError}
        onClose={() => setResultOpen(false)}
        onSubmitScore={handleSubmitScore}
      />
    </div>
  );
}
