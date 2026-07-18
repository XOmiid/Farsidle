"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Toast from "@/components/Toast";
import CountdownBar from "@/components/common/CountdownBar";
import HowToModal from "@/components/duel/HowToModal";
import DuelCard from "@/components/duel/DuelCard";
import DuelResultModal from "@/components/duel/DuelResultModal";
import {
  fetchTodayPairs,
  submitAnswer,
  finalize,
  fetchTodayLeaderboard,
  submitScore,
  checkTodayStatus,
} from "@/lib/duel/api";
import { loadState, saveState } from "@/lib/duel/storage";
import { msUntilNextRollover, formatCountdown } from "@/lib/shared/time";
import { toPersianDigits } from "@/lib/shared/persian";
import { useAuth } from "@/lib/auth/AuthProvider";
import { translatePostgrestError } from "@/lib/auth/errors";

export default function DuelGame() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [dateKey, setDateKey] = useState(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [choice, setChoice] = useState(null); // 'a' | 'b' | null
  const [reveal, setReveal] = useState(null); // { correct, value_a, value_b }
  const [runningScore, setRunningScore] = useState(0);
  const [answering, setAnswering] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const [gameOver, setGameOver] = useState(false);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [score, setScore] = useState(null);
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

  const stateRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 1600);
  }, []);

  const persist = useCallback((patch) => {
    stateRef.current = { ...stateRef.current, ...patch };
    saveState(stateRef.current);
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
      const pairs = await fetchTodayPairs();
      if (cancelled) return;
      if (!pairs) {
        setLoadError(true);
        setLoading(false);
        return;
      }

      setQuestions(pairs);
      setDateKey(pairs[0].date_key);

      const saved = loadState();
      const serverStatus = await checkTodayStatus();
      if (cancelled) return;

      const localMatches = saved && saved.date_key === pairs[0].date_key;

      let s;
      if (localMatches && saved.gameOver) {
        s = saved;
        s.leaderboardSubmitted = serverStatus.played
          ? serverStatus.leaderboard_submitted
          : !!s.leaderboardSubmitted;
      } else if (serverStatus.played) {
        s = {
          date_key: pairs[0].date_key,
          gameOver: true,
          score: serverStatus.score,
          remoteOnly: true,
          leaderboardSubmitted: serverStatus.leaderboard_submitted,
        };
        saveState(s);
      } else {
        s = { date_key: pairs[0].date_key, gameOver: false, score: null, leaderboardSubmitted: false };
        saveState(s);
      }
      stateRef.current = s;

      setGameOver(s.gameOver);
      setRemoteOnly(!!s.remoteOnly);
      setScore(s.score);
      setLeaderboardSubmitted(!!s.leaderboardSubmitted);
      setStreak(serverStatus.streak || 0);
      setLoading(false);

      if (s.gameOver) openResult();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChoice = useCallback(
    async (side) => {
      if (choice || answering) return;
      setAnswering(true);
      const q = questions[currentIndex];
      const result = await submitAnswer(q.q_index, side);
      setAnswering(false);

      if (!result) {
        showToast("ثبت نشد، دوباره امتحان کن");
        return;
      }

      setChoice(side);
      setReveal(result);
      if (result.correct) setRunningScore((s) => s + 1);
    },
    [choice, answering, questions, currentIndex, showToast]
  );

  const handleContinue = useCallback(async () => {
    const isLast = currentIndex === questions.length - 1;
    setChoice(null);
    setReveal(null);

    if (!isLast) {
      setCurrentIndex((i) => i + 1);
      return;
    }

    setFinalizing(true);
    const { data: finalScore, streak: newStreak, error } = await finalize();
    setFinalizing(false);

    if (error || finalScore === null) {
      showToast("ثبت نتیجه ناموفق بود، صفحه رو دوباره باز کن");
      return;
    }

    setGameOver(true);
    setScore(finalScore);
    setStreak(newStreak || 0);
    persist({ gameOver: true, score: finalScore });
    openResult();
  }, [currentIndex, questions.length, persist, openResult, showToast]);

  const handleSubmitScore = useCallback(async () => {
    setSubmitError("");
    const { data: entries, error } = await submitScore();
    if (error || !entries) {
      setSubmitError(translatePostgrestError(error));
      return;
    }
    setLeaderboardSubmitted(true);
    persist({ leaderboardSubmitted: true });
    setLeaderboard(entries);
    const idx = profile?.username ? entries.findIndex((e) => e.name === profile.username) : -1;
    setHighlightIndex(idx);
  }, [persist, profile]);

  const helpButton = (
    <button
      onClick={() => setHowtoOpen(true)}
      aria-label="راهنما"
      className="w-9 h-9 rounded-full border border-green-dim text-green flex items-center justify-center hover:bg-green/10 transition-colors flex-shrink-0"
    >
      ؟
    </button>
  );

  const q = questions[currentIndex];

  return (
    <div className="min-h-screen flex flex-col items-center px-3 pt-[18px] pb-6">
      <Header title="موردل" onMenuClick={() => setSidebarOpen(true)} right={helpButton} />

      <p className="text-center text-ivory-dim text-[.85rem] mb-3.5 px-2.5">
        {loading
          ? "در حال بارگذاری..."
          : loadError
          ? "اتصال به سرور برقرار نشد، صفحه رو دوباره باز کن"
          : remoteOnly
          ? "امروز قبلاً این بازی رو انجام دادی"
          : `سوال ${toPersianDigits(currentIndex + 1)} از ${toPersianDigits(questions.length)} — کدوم عدد بزرگ‌تره؟`}
      </p>

      <CountdownBar
        visible={countdownVisible}
        text={countdownText}
        onClick={() => gameOver && openResult()}
      />

      <Toast message={toastMsg} />

      {!loading && !loadError && !gameOver && q && (
        <div className="w-full flex flex-col items-center gap-3">
          <DuelCard
            prompt={q.prompt_a}
            unit={q.unit_a}
            value={reveal ? reveal.value_a : null}
            state={
              !choice ? "idle" : choice === "a" ? (reveal.correct ? "correct" : "incorrect") : "dim"
            }
            onClick={() => handleChoice("a")}
          />
          <span className="text-ivory-dim text-xs">در مقابل</span>
          <DuelCard
            prompt={q.prompt_b}
            unit={q.unit_b}
            value={reveal ? reveal.value_b : null}
            state={
              !choice ? "idle" : choice === "b" ? (reveal.correct ? "correct" : "incorrect") : "dim"
            }
            onClick={() => handleChoice("b")}
          />

          {choice && (
            <button
              onClick={handleContinue}
              disabled={finalizing}
              className="mt-2 bg-green text-[#04140a] border-none rounded-xl px-8 py-2.5 font-bold text-[.95rem] cursor-pointer disabled:opacity-50"
            >
              {finalizing
                ? "در حال ثبت..."
                : currentIndex === questions.length - 1
                ? "دیدن نتیجه"
                : "سوال بعدی"}
            </button>
          )}

          <p className="text-ivory-dim text-[.78rem] mt-1">
            درست تا الان: {toPersianDigits(runningScore)}
          </p>
        </div>
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <HowToModal open={howtoOpen} onClose={() => setHowtoOpen(false)} />
      <DuelResultModal
        open={resultOpen}
        score={score}
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
