"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Toast from "@/components/Toast";
import CountdownBar from "@/components/common/CountdownBar";
import HowToModal from "@/components/goldle/HowToModal";
import BettingPanel from "@/components/goldle/BettingPanel";
import GoldleResultModal from "@/components/goldle/GoldleResultModal";
import {
  fetchTodayQuestions,
  submitBet,
  fetchTodayLeaderboard,
  submitScore,
  checkTodayStatus,
  fetchTodayReveal,
} from "@/lib/goldle/api";
import { msUntilNextRollover, formatCountdown } from "@/lib/shared/time";
import { toPersianDigits } from "@/lib/shared/persian";
import { useAuth } from "@/lib/auth/AuthProvider";
import { translatePostgrestError } from "@/lib/auth/errors";

export default function GoldleGame() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(1); // 1-5
  const [gold, setGold] = useState(100);
  const [bets, setBets] = useState({ a: 0, b: 0, c: 0, d: 0 });
  const [reveal, setReveal] = useState(null); // { correct_choice, gold_after, game_over }
  const [submitting, setSubmitting] = useState(false);

  const [gameOver, setGameOver] = useState(false);
  const [finalGold, setFinalGold] = useState(null);
  const [revealQuestions, setRevealQuestions] = useState(null);
  const [questionsReached, setQuestionsReached] = useState(null);
  const [streak, setStreak] = useState(0);

  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [howtoOpen, setHowtoOpen] = useState(() => {
    try {
      if (typeof window === "undefined") return false;
      const seen = localStorage.getItem("fa-goldle-howto-seen");
      return !seen;
    } catch (e) {
      return false;
    }
  });

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

  // Mark the instructions as seen so they don't auto-open again next
  // time — the initial open/closed state itself is decided once, up
  // front, by the lazy useState initializer above.
  useEffect(() => {
    if (!howtoOpen) return;
    try {
      localStorage.setItem("fa-goldle-howto-seen", "1");
    } catch (e) {
      // ignore
    }
  }, [howtoOpen]);

  // Boot
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const qs = await fetchTodayQuestions();
      if (cancelled) return;
      if (!qs) {
        setLoadError(true);
        setLoading(false);
        return;
      }
      setQuestions(qs);

      const status = await checkTodayStatus();
      if (cancelled) return;

      setStreak(status.streak || 0);
      setLeaderboardSubmitted(!!status.leaderboard_submitted);

      if (status.played) {
        setGameOver(true);
        setFinalGold(status.final_gold);
        setQuestionsReached(status.questions_reached);
        const reveal = await fetchTodayReveal();
        if (cancelled) return;
        setRevealQuestions(reveal);
        setLoading(false);
        openResult();
        return;
      }

      setQIndex(status.current_q_index || 1);
      setGold(status.current_gold ?? 100);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentQuestion = questions[qIndex - 1];

  const handleSubmitBet = useCallback(async () => {
    const total = (bets.a || 0) + (bets.b || 0) + (bets.c || 0) + (bets.d || 0);
    if (total !== gold) {
      showToast("باید کل طلات رو تخصیص بدی");
      return;
    }
    setSubmitting(true);
    const { data, error } = await submitBet(qIndex, bets.a || 0, bets.b || 0, bets.c || 0, bets.d || 0, gold);
    setSubmitting(false);

    if (error || !data) {
      showToast("ثبت نشد، دوباره امتحان کن");
      return;
    }

    // Just show the reveal for now — finishing (gameOver) only happens once
    // they click "continue" below, so the reveal animation always has a
    // chance to actually display before anything else changes.
    setReveal(data);
  }, [bets, gold, qIndex, showToast]);

  const handleContinue = useCallback(async () => {
    if (reveal?.game_over) {
      setFinalGold(reveal.gold_after);
      setQuestionsReached(qIndex);
      setGameOver(true);
      setReveal(null);
      const revealData = await fetchTodayReveal();
      setRevealQuestions(revealData);
      return;
    }
    setGold(reveal.gold_after);
    setQIndex((i) => i + 1);
    setBets({ a: 0, b: 0, c: 0, d: 0 });
    setReveal(null);
  }, [reveal, qIndex]);

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
      <Header title="طلادل" onMenuClick={() => setSidebarOpen(true)} right={helpButton} />

      <div className="w-full max-w-[420px] flex items-center justify-between mb-3.5 px-1">
        <span className="text-ivory-dim text-[.85rem]">
          {!loading && !loadError && !gameOver && `سوال ${toPersianDigits(qIndex)} از ۵`}
        </span>
        <span className="text-green font-bold text-[.9rem]">
          {!loading && !loadError && !gameOver && `${toPersianDigits(gold)} طلا`}
        </span>
      </div>

      <CountdownBar
        visible={countdownVisible}
        text={countdownText}
        onClick={() => gameOver && openResult()}
      />

      <Toast message={toastMsg} />

      {!loading && !loadError && !gameOver && currentQuestion && (
        <>
          <BettingPanel
            question={currentQuestion}
            totalGold={gold}
            bets={bets}
            onChangeBets={setBets}
            disabled={submitting || !!reveal}
            reveal={reveal}
          />

          {!reveal && (
            <button
              onClick={handleSubmitBet}
              disabled={submitting}
              className="mt-5 bg-green text-[#04140a] border-none rounded-xl px-8 py-3 font-bold text-[1rem] cursor-pointer disabled:opacity-50"
            >
              {submitting ? "در حال ثبت..." : "ثبت شرط"}
            </button>
          )}

          {reveal && (
            <div className="mt-5 flex flex-col items-center gap-2">
              <p className={`font-bold text-[1rem] ${reveal.gold_after > 0 ? "text-green" : "text-red"}`}>
                {reveal.gold_after > 0
                  ? `${toPersianDigits(reveal.gold_after)} طلا رسید به سوال بعد`
                  : "طلات تموم شد"}
              </p>
              <button
                onClick={handleContinue}
                className="bg-green text-[#04140a] border-none rounded-xl px-8 py-3 font-bold text-[1rem] cursor-pointer"
              >
                {reveal.game_over ? "دیدن نتیجه" : "سوال بعدی"}
              </button>
            </div>
          )}
        </>
      )}

      {!loading && !loadError && gameOver && (
        <div className="w-full flex flex-col items-center gap-3">
          <p className="text-ivory-dim text-[.9rem]">
            طلای نهایی: <span className="text-green font-bold">{toPersianDigits(finalGold)}</span>
          </p>

          {revealQuestions && revealQuestions.length > 0 && (
            <div className="w-full max-w-[420px] flex flex-col gap-2.5 mt-1">
              {revealQuestions.map((q, i) => (
                <div key={i} className="bg-bg-1 border border-green-dim rounded-xl p-3 text-right">
                  <p className="text-ivory text-[.85rem] mb-2">
                    {toPersianDigits(i + 1)}. {q.question_fa}
                  </p>
                  <p className="text-green text-[.82rem] font-semibold">
                    ✓ {q[`choice_${q.correct_choice}`]}
                  </p>
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
      <GoldleResultModal
        open={resultOpen}
        finalGold={finalGold}
        questionsReached={questionsReached}
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
