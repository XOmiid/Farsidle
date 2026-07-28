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

// Phases:
//  memorize  — numbers shown one by one
//  pick      — grid shown, player selects
//  result    — both levels scored, modal shown
const SHOW_MS = 2000;  // how long each number is displayed
const GAP_MS  = 400;   // black gap between numbers
const MAX_PICKS = 5;

export default function MemorydleGame() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [puzzle, setPuzzle] = useState(null);

  // which level are we on: 1 or 2
  const [level, setLevel] = useState(1);

  // memorize phase
  const [phase, setPhase] = useState("memorize"); // "memorize" | "pick" | "done"
  const [showingIndex, setShowingIndex] = useState(-1); // which target is flashing
  const [currentNum, setCurrentNum] = useState(null);  // the number displayed now
  const [memDone, setMemDone] = useState(false); // finished showing all 5

  // pick phase
  const [picks, setPicks] = useState([]);           // selected numbers this level
  const [l1Picks, setL1Picks] = useState([]);       // saved l1 selections
  const [submitting, setSubmitting] = useState(false);

  // result
  const [result, setResult] = useState(null); // { l1_correct, l2_correct, total_score, l1_targets, l2_targets }
  const [gameOver, setGameOver] = useState(false);

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
  }, []);

  useEffect(() => {
    if (!howtoOpen) {
      try { localStorage.setItem("fa-memorydle-howto-seen", "1"); } catch {}
    }
  }, [howtoOpen]);

  const openResult = useCallback(async (res) => {
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
        setResult({
          l1_correct: status.l1_correct,
          l2_correct: status.l2_correct,
          total_score: status.total_score,
        });
        setLoading(false);
        openResult();
        return;
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [openResult]);

  // Run the memorize sequence when level/phase changes to memorize
  useEffect(() => {
    if (!puzzle || phase !== "memorize") return;
    const sequence = level === 1 ? puzzle.l1_targets : puzzle.l2_targets;
    if (!sequence) return;
    let idx = 0;
    setShowingIndex(0);
    setCurrentNum(sequence[0]);

    const next = () => {
      idx++;
      if (idx >= sequence.length) {
        setCurrentNum(null);
        setShowingIndex(-1);
        setMemDone(true);
        return;
      }
      setCurrentNum(null);
      setShowingIndex(-1);
      setTimeout(() => {
        setCurrentNum(sequence[idx]);
        setShowingIndex(idx);
        setTimeout(next, SHOW_MS);
      }, GAP_MS);
    };
    const t = setTimeout(next, SHOW_MS);
    return () => clearTimeout(t);
  }, [puzzle, phase, level]);

  const handleStartPicking = useCallback(() => {
    setPicks([]);
    setPhase("pick");
  }, []);

  const togglePick = useCallback((num) => {
    setPicks((prev) => {
      if (prev.includes(num)) return prev.filter((n) => n !== num);
      if (prev.length >= MAX_PICKS) return prev; // locked at 5
      return [...prev, num];
    });
  }, []);

  const handleSubmitLevel = useCallback(async () => {
    if (picks.length !== MAX_PICKS) {
      showToast(`باید دقیقاً ۵ عدد انتخاب کنی`);
      return;
    }

    if (level === 1) {
      // Save level 1 picks, move to level 2 memorize
      setL1Picks(picks);
      setPicks([]);
      setLevel(2);
      setPhase("memorize");
      setMemDone(false);
      setShowingIndex(-1);
      setCurrentNum(null);
      return;
    }

    // Level 2 — submit both levels together
    setSubmitting(true);
    const { data, error } = await submitAnswers(l1Picks, picks);
    setSubmitting(false);
    if (!data || error) { showToast("خطا در ارسال — دوباره امتحان کن"); return; }
    setResult(data);
    setGameOver(true);
    openResult(data);
  }, [picks, level, l1Picks, showToast, openResult]);

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
      <CountdownBar visible={countdownVisible} text={countdownText} onClick={() => gameOver && openResult(result)} />
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

          {/* MEMORIZE PHASE */}
          {phase === "memorize" && (
            <div className="flex flex-col items-center gap-6 w-full max-w-[420px]">
              <p className="text-ivory-dim text-[.9rem] text-center">
                {memDone
                  ? "آماده‌ای؟ حالا باید اعداد رو پیدا کنی"
                  : `این ۵ عدد رو به خاطر بسپار`}
              </p>

              {/* Number display square */}
              <div className={`w-40 h-40 rounded-2xl border-2 flex items-center justify-center transition-all duration-200 ${
                currentNum !== null
                  ? "border-green bg-green/10"
                  : "border-border bg-white/[.03]"
              }`}>
                {currentNum !== null ? (
                  <span className="text-[3.5rem] font-extrabold text-green font-mono">
                    {toPersianDigits(currentNum)}
                  </span>
                ) : memDone ? (
                  <span className="text-ivory-dim text-[.85rem] text-center px-4">وقتی آماده شدی شروع کن</span>
                ) : (
                  <span className="text-border text-[.85rem]">...</span>
                )}
              </div>

              {/* Dot progress */}
              {!memDone && (
                <div className="flex gap-2">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all ${
                      i < showingIndex ? "bg-green" : i === showingIndex ? "bg-green scale-125" : "bg-border"
                    }`} />
                  ))}
                </div>
              )}

              {memDone && (
                <button
                  onClick={handleStartPicking}
                  className="w-full bg-green text-[#04140a] border-none rounded-xl py-3 font-bold text-[.95rem] cursor-pointer"
                >
                  شروع انتخاب
                </button>
              )}
            </div>
          )}

          {/* PICK PHASE */}
          {phase === "pick" && (
            <div className="flex flex-col items-center gap-4 w-full max-w-[420px]">
              <p className="text-ivory-dim text-[.9rem] text-center">
                {toPersianDigits(picks.length)}/۵ عدد انتخاب شده
              </p>

              {/* 15-number grid — 3 columns × 5 rows */}
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
          <p className="text-green font-bold text-xl">{toPersianDigits(result.total_score ?? result.l1_correct + result.l2_correct)}/۱۰</p>
          <button onClick={() => openResult(result)}
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
