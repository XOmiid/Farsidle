"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Toast from "@/components/Toast";
import CountdownBar from "@/components/common/CountdownBar";
import HowToModal from "@/components/pricedle/HowToModal";
import PriceInput from "@/components/pricedle/PriceInput";
import GuessReveal from "@/components/pricedle/GuessReveal";
import PricedleResultModal from "@/components/pricedle/PricedleResultModal";
import {
  fetchTodayQuestions,
  submitGuess,
  fetchLeaderboard,
  submitScore,
  checkTodayStatus,
} from "@/lib/pricedle/api";
import { msUntilNextRollover, formatCountdown } from "@/lib/shared/time";
import { toPersianDigits } from "@/lib/shared/persian";
import { useAuth } from "@/lib/auth/AuthProvider";
import { translatePostgrestError } from "@/lib/auth/errors";

const CATEGORY_EMOJI = {
  "بنزین": "⛽",
  "سینما": "🎬",
  "خودرو": "🚗",
  "مسکن": "🏠",
  "اجاره": "🔑",
  "نان": "🍞",
  "حمل‌ونقل": "🚇",
  "موبایل": "📱",
};

export default function PricedleGame() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(1);
  const [totalScore, setTotalScore] = useState(0);
  const [reveal, setReveal] = useState(null); // { score, correct_answer, total_so_far, game_over, guess }
  const [submitting, setSubmitting] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(null);

  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [howtoOpen, setHowtoOpen] = useState(() => {
    try { return !localStorage.getItem("fa-pricedle-howto-seen"); } catch { return false; }
  });

  const [resultOpen, setResultOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [lbSubmitted, setLbSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [streak, setStreak] = useState(0);

  const [countdownVisible, setCountdownVisible] = useState(false);
  const [countdownText, setCountdownText] = useState("۰۰:۰۰:۰۰");
  const countdownRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 1800);
  }, []);

  const startCountdown = useCallback(() => {
    setCountdownVisible(true);
    const tick = () => {
      const ms = msUntilNextRollover();
      setCountdownText(formatCountdown(ms));
      if (ms <= 0) { clearInterval(countdownRef.current); window.location.reload(); }
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
  }, []);

  useEffect(() => () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    if (!howtoOpen) {
      try { localStorage.setItem("fa-pricedle-howto-seen", "1"); } catch {}
    }
  }, [howtoOpen]);

  const openResult = useCallback(async () => {
    setResultOpen(true);
    setLbLoading(true);
    const entries = await fetchLeaderboard();
    setLbLoading(false);
    setLeaderboard(entries);
    startCountdown();
  }, [startCountdown]);

  // Boot
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [qs, status] = await Promise.all([fetchTodayQuestions(), checkTodayStatus()]);
      if (cancelled) return;

      if (!qs) { setLoadError(true); setLoading(false); return; }
      setQuestions(qs);
      setStreak(status.streak || 0);
      setLbSubmitted(!!status.leaderboard_submitted);

      if (status.played) {
        setGameOver(true);
        setFinalScore(status.total_score);
        setLoading(false);
        openResult();
        return;
      }

      setQIndex(status.current_q_index || 1);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [openResult]);

  const handleGuess = useCallback(async (guessToman) => {
    setSubmitting(true);
    const { data, error } = await submitGuess(qIndex, guessToman);
    setSubmitting(false);
    if (!data || error) { showToast("خطا در ارسال — دوباره امتحان کن"); return; }
    setReveal({ ...data, guess: guessToman });
    setTotalScore(data.total_so_far ?? totalScore + data.score);
    if (data.game_over) setFinalScore(data.total_so_far);
  }, [qIndex, showToast, totalScore]);

  const handleContinue = useCallback(() => {
    if (!reveal) return;
    if (reveal.game_over) {
      setGameOver(true);
      setReveal(null);
      openResult();
      return;
    }
    setReveal(null);
    setQIndex((i) => i + 1);
  }, [reveal, openResult]);

  const handleSubmitScore = useCallback(async () => {
    setSubmitError("");
    const { data: entries, error } = await submitScore();
    if (error || !entries) { setSubmitError(translatePostgrestError(error)); return; }
    setLbSubmitted(true);
    setLeaderboard(entries);
  }, []);

  const currentQ = questions[qIndex - 1];
  const emoji = currentQ ? (CATEGORY_EMOJI[currentQ.category] || "🧾") : "🧾";

  const helpButton = (
    <button onClick={() => setHowtoOpen(true)} aria-label="راهنما"
      className="w-9 h-9 rounded-full border border-green-dim text-green flex items-center justify-center hover:bg-green/10 flex-shrink-0">
      ؟
    </button>
  );

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-ivory-dim text-sm">در حال بارگذاری...</div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center px-3 pt-[18px] pb-6">
      <Header title="قیمتدل" onMenuClick={() => setSidebarOpen(true)} right={helpButton} />
      <CountdownBar visible={countdownVisible} text={countdownText} onClick={() => gameOver && openResult()} />
      <Toast message={toastMsg} />

      {!loadError && !gameOver && currentQ && (
        <>
          {/* Progress */}
          <div className="w-full max-w-[420px] flex items-center justify-between mb-4 px-1">
            <span className="text-ivory-dim text-[.85rem]">سوال {toPersianDigits(qIndex)} از ۳</span>
            <div className="flex items-center gap-2">
              <span className="text-green text-[.85rem] font-bold">{toPersianDigits(totalScore)}/۳۰۰</span>
              <div className="flex gap-1.5">
                {[1,2,3].map((r) => (
                  <div key={r} className={`w-2 h-2 rounded-full ${r < qIndex ? "bg-green" : r === qIndex ? "bg-green/60" : "bg-border"}`} />
                ))}
              </div>
            </div>
          </div>

          {/* Question card */}
          {!reveal && (
            <div className="w-full max-w-[420px] bg-bg-1 border border-green-dim rounded-2xl p-5 mb-5 text-center">
              <div className="text-[2.5rem] mb-2">{emoji}</div>
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="text-ivory-dim text-[.78rem] bg-white/[.04] rounded-full px-2.5 py-0.5">
                  {currentQ.category}
                </span>
              </div>
              <p className="text-ivory text-[1rem] leading-8 font-semibold">{currentQ.question_fa}</p>
            </div>
          )}

          {/* Input or Reveal */}
          {!reveal ? (
            <PriceInput onSubmit={handleGuess} disabled={submitting} />
          ) : (
            <GuessReveal
              score={reveal.score}
              correctAnswer={reveal.correct_answer}
              guess={reveal.guess}
              onContinue={handleContinue}
              gameOver={reveal.game_over}
            />
          )}
        </>
      )}

      {gameOver && !resultOpen && (
        <div className="w-full max-w-[420px] flex flex-col items-center gap-3 mt-4">
          <p className="text-ivory-dim text-[.9rem]">
            امتیاز نهایی:{" "}
            <span className="text-green font-bold text-xl">{toPersianDigits(finalScore ?? 0)}/۳۰۰</span>
          </p>
          <button onClick={openResult}
            className="bg-green/10 border border-green-dim text-green rounded-xl px-6 py-2.5 font-bold text-[.9rem] cursor-pointer">
            دیدن نتیجه و جدول برترین‌ها
          </button>
        </div>
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <HowToModal open={howtoOpen} onClose={() => setHowtoOpen(false)} />
      <PricedleResultModal
        open={resultOpen}
        totalScore={finalScore}
        streak={streak}
        leaderboard={leaderboard}
        leaderboardLoading={lbLoading}
        alreadySubmitted={lbSubmitted}
        submitError={submitError}
        onClose={() => setResultOpen(false)}
        onSubmitScore={handleSubmitScore}
        profile={profile}
      />
    </div>
  );
}
