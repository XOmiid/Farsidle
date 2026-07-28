"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Toast from "@/components/Toast";
import CountdownBar from "@/components/common/CountdownBar";
import MemorydleResultModal from "@/components/memorydle/MemorydleResultModal";
import HowToModal from "@/components/memorydle/HowToModal";
import {
  fetchTodayPuzzle,
  submitAnswers,
  fetchLeaderboard,
  submitScore,
  checkTodayStatus,
} from "@/lib/memorydle/api";
import { msUntilNextRollover, formatCountdown } from "@/lib/shared/time";
import { toPersianDigits } from "@/lib/shared/persian";
import { useAuth } from "@/lib/auth/AuthProvider";
import { translatePostgrestError } from "@/lib/auth/errors";

const SHOW_MS = 2000; // ms each number is visible
const GAP_MS  = 400;  // ms blank between numbers
const MAX_PICKS = 5;

export default function MemorydleGame() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [puzzle, setPuzzle] = useState(null);

  const [level, setLevel] = useState(1);

  // "ready" = waiting for player to tap Start
  // "running" = numbers flashing
  // "pick" = grid shown, player selects
  const [phase, setPhase] = useState("ready");
  const [showingIndex, setShowingIndex] = useState(-1);
  const [currentNum, setCurrentNum] = useState(null);

  const [picks, setPicks] = useState([]);
  const [l1Picks, setL1Picks] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const [result, setResult] = useState(null);
  const [gameOver, setGameOver] = useState(false);

  const timersRef = useRef([]);
  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [howtoOpen, setHowtoOpen] = useState(() => {
    try { return !localStorage.getItem("fa-memorydle-howto-seen"); } catch { return false; }
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
    clearTimers();
  }, [clearTimers]);

  useEffect(() => {
    if (!howtoOpen) {
      try { localStorage.setItem("fa-memorydle-howto-seen", "1"); } catch {}
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
      const [puz, status] = await Promise.all([fetchTodayPuzzle(), checkTodayStatus()]);
      if (cancelled) return;
      if (!puz) { setLoadError(true); setLoading(false); return; }
      setPuzzle(puz);
      setStreak(status.streak || 0);
      setLbSubmitted(!!status.leaderboard_submitted);
      if (status.played) {
        setGameOver(true);
        setResult({ l1_correct: status.l1_correct, l2_correct: status.l2_correct, total_score: status.total_score });
        setLoading(false);
        openResult();
        return;
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [openResult]);

  // Player taps Start → run the sequence manually, no auto-start
  const handleStartSequence = useCallback(() => {
    if (!puzzle) return;
    const sequence = level === 1 ? puzzle.l1_targets : puzzle.l2_targets;
    clearTimers();
    setPhase("running");
    setShowingIndex(0);
    setCurrentNum(sequence[0]);

    const show = (idx) => {
      // after SHOW_MS, blank out
      const t1 = setTimeout(() => {
        setCurrentNum(null);
        setShowingIndex(-1);
        const next = idx + 1;
        if (next >= sequence.length) {
          // sequence done — move to pick
          const t2 = setTimeout(() => setPhase("pick"), GAP_MS);
          timersRef.current.push(t2);
          return;
        }
        // gap then show next
        const t2 = setTimeout(() => {
          setCurrentNum(sequence[next]);
          setShowingIndex(next);
          show(next);
        }, GAP_MS);
        timersRef.current.push(t2);
      }, SHOW_MS);
      timersRef.current.push(t1);
    };

    show(0);
  }, [puzzle, level, clearTimers]);

  const togglePick = useCallback((num) => {
    setPicks((prev) => {
      if (prev.includes(num)) return prev.filter((n) => n !== num);
      if (prev.length >= MAX_PICKS) return prev;
      return [...prev, num];
    });
  }, []);

  const handleSubmitLevel = useCallback(async () => {
    if (picks.length !== MAX_PICKS) { showToast("باید دقیقاً ۵ عدد انتخاب کنی"); return; }

    if (level === 1) {
      setL1Picks(picks);
      setPicks([]);
      setLevel(2);
      setPhase("ready");   // wait for player to tap Start again
      setCurrentNum(null);
      setShowingIndex(-1);
      clearTimers();
      return;
    }

    setSubmitting(true);
    const { data, error } = await submitAnswers(l1Picks, picks);
    setSubmitting(false);
    if (!data || error) { showToast("خطا در ارسال — دوباره امتحان کن"); return; }
    setResult(data);
    setGameOver(true);
    openResult();
  }, [picks, level, l1Picks, showToast, openResult, clearTimers]);

  const handleSubmitScore = useCallback(async () => {
    setSubmitError("");
    const { data: entries, error } = await submitScore();
    if (error || !entries) { setSubmitError(translatePostgrestError(error)); return; }
    setLbSubmitted(true);
    setLeaderboard(entries);
  }, []);

  const grid = puzzle ? (level === 1 ? puzzle.l1_grid : puzzle.l2_grid) : [];

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
      <Header title="مموریدل" onMenuClick={() => setSidebarOpen(true)} right={helpButton} />
      <CountdownBar visible={countdownVisible} text={countdownText} onClick={() => gameOver && openResult()} />
      <Toast message={toastMsg} />

      {!loadError && !gameOver && puzzle && (
        <>
          {/* Level indicator */}
          <div className="w-full max-w-[420px] flex items-center justify-between mb-5 px-1">
            <span className="text-ivory-dim text-[.85rem]">مرحله {toPersianDigits(level)} از ۲</span>
            <div className="flex gap-2">
              {[1, 2].map((l) => (
                <div key={l} className={`w-2.5 h-2.5 rounded-full ${l < level ? "bg-green" : l === level ? "bg-green/60" : "bg-border"}`} />
              ))}
            </div>
          </div>

          {/* READY — waiting for player to press Start */}
          {phase === "ready" && (
            <div className="flex flex-col items-center gap-6 w-full max-w-[420px]">
              <div className="w-40 h-40 rounded-2xl border-2 border-border bg-white/[.03] flex items-center justify-center">
                <span className="text-ivory-dim text-[.85rem] text-center px-4">
                  {level === 1 ? "مرحله ۱: اعداد ۰ تا ۹۹" : "مرحله ۲: اعداد ۱۰۰ تا ۹۹۹"}
                </span>
              </div>
              <p className="text-ivory-dim text-[.9rem] text-center">
                وقتی آماده‌ای، دکمه رو بزن — ۵ عدد یکی‌یکی نشون داده می‌شن
              </p>
              <button
                onClick={handleStartSequence}
                className="w-full bg-green text-[#04140a] border-none rounded-xl py-3 font-bold text-[1rem] cursor-pointer"
              >
                ▶ شروع نمایش اعداد
              </button>
            </div>
          )}

          {/* RUNNING — numbers flashing */}
          {phase === "running" && (
            <div className="flex flex-col items-center gap-6 w-full max-w-[420px]">
              <p className="text-ivory-dim text-[.9rem] text-center">به خاطر بسپار...</p>

              <div className={`w-40 h-40 rounded-2xl border-2 flex items-center justify-center transition-all duration-150 ${
                currentNum !== null ? "border-green bg-green/10" : "border-border bg-white/[.03]"
              }`}>
                {currentNum !== null && (
                  <span className="text-[3.5rem] font-extrabold text-green font-mono">
                    {toPersianDigits(currentNum)}
                  </span>
                )}
              </div>

              {/* Progress dots */}
              <div className="flex gap-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all ${
                    i < showingIndex ? "bg-green" : i === showingIndex ? "bg-green scale-125" : "bg-border"
                  }`} />
                ))}
              </div>
            </div>
          )}

          {/* PICK — grid shown */}
          {phase === "pick" && (
            <div className="flex flex-col items-center gap-4 w-full max-w-[420px]">
              <p className="text-ivory-dim text-[.9rem] text-center">
                {toPersianDigits(picks.length)}/۵ انتخاب شده — اعدادی که دیدی رو پیدا کن
              </p>

              <div className="grid grid-cols-3 gap-2.5 w-full">
                {grid.map((num) => {
                  const selected = picks.includes(num);
                  return (
                    <button
                      key={num}
                      onClick={() => togglePick(num)}
                      className={`h-16 rounded-xl border-2 flex items-center justify-center text-[1.5rem] font-extrabold font-mono transition-all cursor-pointer select-none active:scale-95 ${
                        selected
                          ? "border-yellow bg-yellow/20 text-yellow scale-105"
                          : "border-green-dim bg-bg-1 text-ivory hover:border-green hover:bg-green/5"
                      }`}
                    >
                      {toPersianDigits(num)}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleSubmitLevel}
                disabled={submitting || picks.length !== MAX_PICKS}
                className="w-full bg-green text-[#04140a] border-none rounded-xl py-3 font-bold text-[.95rem] cursor-pointer disabled:opacity-40"
              >
                {submitting ? "در حال بررسی..." : level === 1 ? "ثبت و رفتن به مرحله ۲" : "ثبت نهایی"}
              </button>
            </div>
          )}
        </>
      )}

      {gameOver && !resultOpen && result && (
        <div className="w-full max-w-[420px] flex flex-col items-center gap-3 mt-4">
          <p className="text-green font-bold text-xl">{toPersianDigits(result.total_score ?? (result.l1_correct + result.l2_correct))}/۱۰</p>
          <button onClick={openResult}
            className="bg-green/10 border border-green-dim text-green rounded-xl px-6 py-2.5 font-bold text-[.9rem] cursor-pointer">
            دیدن نتیجه و جدول برترین‌ها
          </button>
        </div>
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <HowToModal open={howtoOpen} onClose={() => setHowtoOpen(false)} />
      <MemorydleResultModal
        open={resultOpen}
        result={result}
        streak={streak}
        leaderboard={leaderboard}
        leaderboardLoading={lbLoading}
        alreadySubmitted={lbSubmitted}
        submitError={submitError}
        onClose={() => setResultOpen(false)}
        onSubmitScore={handleSubmitScore}
      />
    </div>
  );
}
