"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Toast from "@/components/Toast";
import CountdownBar from "@/components/common/CountdownBar";
import ChordleResultModal from "@/components/chordle/ChordleResultModal";
import HowToModal from "@/components/chordle/HowToModal";
import { fetchTodayPuzzle, submitRound, fetchLeaderboard, submitScore, checkTodayStatus } from "@/lib/chordle/api";
import { playSound, playSequence, resumeAudio, CHORD_POOL, DRUM_KIT, CHORD_COLORS } from "@/lib/chordle/audio";
import { msUntilNextRollover, formatCountdown } from "@/lib/shared/time";
import { toPersianDigits } from "@/lib/shared/persian";
import { useAuth } from "@/lib/auth/AuthProvider";
import { translatePostgrestError } from "@/lib/auth/errors";

const ROUNDS = [
  { round: 1, instrument: "guitar", label: "گیتار", emoji: "🎸" },
  { round: 2, instrument: "piano",  label: "پیانو", emoji: "🎹" },
  { round: 3, instrument: "drums",  label: "درامز",  emoji: "🥁" },
];

export default function ChordleGame() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [puzzle, setPuzzle] = useState(null);

  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState("ready"); // ready | running | pick
  const [selected, setSelected] = useState(null); // which button is selected
  const [slots, setSlots] = useState([null, null, null, null, null]);
  const [reveal, setReveal] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [totalScore, setTotalScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(null);

  const cancelRef = useRef(null);
  const timersRef = useRef([]);
  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (cancelRef.current) { cancelRef.current(); cancelRef.current = null; }
  }, []);

  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef(null);
  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 1800);
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [howtoOpen, setHowtoOpen] = useState(() => {
    try { return !localStorage.getItem("fa-chordle-v2-howto-seen"); } catch { return false; }
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
    if (!howtoOpen) { try { localStorage.setItem("fa-chordle-v2-howto-seen", "1"); } catch {} }
  }, [howtoOpen]);

  const openResult = useCallback(async () => {
    setResultOpen(true);
    setLbLoading(true);
    const entries = await fetchLeaderboard();
    setLbLoading(false);
    setLeaderboard(entries);
    startCountdown();
  }, [startCountdown]);

  const initRound = useCallback((r) => {
    setRound(r);
    setPhase("ready");
    setSelected(null);
    setSlots([null, null, null, null, null]);
    setReveal(null);
    clearTimers();
  }, [clearTimers]);

  // Boot
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [puz, status] = await Promise.all([fetchTodayPuzzle(), checkTodayStatus()]);
      if (cancelled) return;
      if (!puz) { setLoading(false); return; }
      setPuzzle(puz);
      setStreak(status.streak || 0);
      setLbSubmitted(!!status.leaderboard_submitted);
      if (status.played) {
        setGameOver(true);
        setFinalScore(status.total_score);
        setLoading(false);
        openResult();
        return;
      }
      initRound(status.current_round || 1);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [openResult, initRound]);

  // Get the sequence for the current round
  const getSequence = useCallback(() => {
    if (!puzzle) return [];
    if (round === 1) return puzzle.guitar_seq;
    if (round === 2) return puzzle.piano_seq;
    return puzzle.drums_seq;
  }, [puzzle, round]);

  // Get the instrument for the current round
  const instrument = ROUNDS[round - 1]?.instrument;

  // For guitar/piano: map sequence index (1-9) to actual chord ID from pool
  const getActualId = useCallback((idx) => {
    if (instrument === "drums") return idx;
    return puzzle?.chord_ids?.[idx - 1] ?? idx;
  }, [instrument, puzzle]);

  const handleStartSequence = useCallback(() => {
    resumeAudio();
    const seq = getSequence();
    clearTimers();
    setPhase("running");

    // Play each element in sequence
    const GAP = instrument === "drums" ? 0.6 : 1.3;
    seq.forEach((idx, i) => {
      const t = setTimeout(() => {
        const actualId = getActualId(idx);
        playSound(actualId, instrument);
      }, i * GAP * 1000);
      timersRef.current.push(t);
    });

    const total = seq.length * GAP * 1000;
    const doneTimer = setTimeout(() => setPhase("pick"), total);
    timersRef.current.push(doneTimer);
  }, [getSequence, instrument, getActualId, clearTimers]);

  const handleButtonTap = useCallback((buttonIdx) => {
    // buttonIdx is 1-9 (the slot index in the nightly selection)
    resumeAudio();
    const actualId = getActualId(buttonIdx);
    playSound(actualId, instrument);
    if (phase !== "pick" || reveal) return;
    setSelected((prev) => prev === buttonIdx ? null : buttonIdx);
  }, [phase, reveal, instrument, getActualId]);

  const handlePause = useCallback(() => {
    clearTimers();
    setPhase("ready");
  }, [clearTimers]);

  const handleRestart = useCallback(async () => {
    clearTimers();
    setPhase("ready");
    // small gap then restart
    await new Promise((r) => setTimeout(r, 150));
    handleStartSequence();
  }, [clearTimers, handleStartSequence]);
  
  const handleSlotClick = useCallback((slotIdx) => {
    if (phase !== "pick" || reveal) return;
  
    const next = [...slots];
  
    if (selected !== null) {
      next[slotIdx] = selected;
      setSlots(next);
  
      const nextEmpty = next.findIndex(
        (s, i) => i > slotIdx && s === null
      );
  
      if (nextEmpty === -1) setSelected(null);
    } else if (next[slotIdx] !== null) {
      next[slotIdx] = null;
      setSlots(next);
    }
  }, [phase, reveal, selected, slots]);

  const handleSubmit = useCallback(async () => {
    if (slots.some((s) => s === null)) { showToast("همه خانه‌ها باید پر باشن"); return; }
    setSubmitting(true);
    const { data, error } = await submitRound(round, slots);
    setSubmitting(false);
    if (!data || error) { showToast("خطا در ارسال"); return; }
    setSelected(null);
    setTotalScore((prev) => prev + data.round_score);
    setReveal(data);
    if (data.game_over) setFinalScore(totalScore + data.round_score);
  }, [slots, round, showToast, totalScore]);

  const handleContinue = useCallback(() => {
    if (!reveal) return;
    if (reveal.game_over) {
      setGameOver(true);
      openResult();
      return;
    }
    initRound(round + 1);
  }, [reveal, round, openResult, initRound]);

  const handleSubmitScore = useCallback(async () => {
    setSubmitError("");
    const { data: entries, error } = await submitScore();
    if (error || !entries) { setSubmitError(translatePostgrestError(error)); return; }
    setLbSubmitted(true);
    setLeaderboard(entries);
  }, []);

  const roundInfo = ROUNDS[round - 1];
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
      <Header title="کوردل" onMenuClick={() => setSidebarOpen(true)} right={helpButton} />
      <CountdownBar visible={countdownVisible} text={countdownText} onClick={() => gameOver && openResult()} />
      <Toast message={toastMsg} />

      {!gameOver && puzzle && (
        <>
          {/* Round + score indicator */}
          <div className="w-full max-w-[420px] flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2">
              <span className="text-[1.3rem]">{roundInfo?.emoji}</span>
              <span className="text-ivory text-[.9rem] font-bold">{roundInfo?.label}</span>
              <span className="text-ivory-dim text-[.78rem]">دور {toPersianDigits(round)} از ۳</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green font-bold text-[.85rem]">{toPersianDigits(totalScore)}/۱۵</span>
              <div className="flex gap-1.5">
                {[1,2,3].map((r) => (
                  <div key={r} className={`w-2 h-2 rounded-full ${r < round ? "bg-green" : r === round ? "bg-green/60" : "bg-border"}`} />
                ))}
              </div>
            </div>
          </div>

          {/* Answer slots */}
          <div className="w-full max-w-[420px] mb-4">
            <p className="text-[.75rem] text-ivory-dim mb-2 text-right">
              {phase === "pick" && selected !== null ? "روی یه خانه بزن" : phase === "pick" ? "یه دکمه انتخاب کن" : "‌"}
            </p>
            <div className="flex gap-2 justify-center">
              {slots.map((val, i) => {
                const color = val !== null ? CHORD_COLORS[val - 1] : undefined;
                const revealColor = reveal
                  ? reveal.correct_slots[i] ? "#4ade80" : "#ef4444"
                  : color;
                return (
                  <button key={i} onClick={() => handleSlotClick(i)}
                    className="flex-1 aspect-square max-w-[64px] rounded-xl border-2 flex items-center justify-center text-[1.2rem] font-bold transition-all cursor-pointer select-none"
                    style={{
                      borderColor: revealColor ?? (phase === "pick" && selected !== null ? "#4ade80" : "#2a3d2e"),
                      borderStyle: val !== null || reveal ? "solid" : "dashed",
                      background: revealColor ? `${revealColor}22` : "rgba(255,255,255,.02)",
                      color: revealColor ?? "#4ade80",
                    }}>
                    {val !== null ? toPersianDigits(val) : <span className="text-[.8rem] opacity-30">{toPersianDigits(i + 1)}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Playback controls */}
          {(phase === "ready" || phase === "running") && (
            <div className="flex gap-2 mb-4 w-full max-w-[420px]">
              {phase === "ready" ? (
                <>
                  <button onClick={handleStartSequence}
                    className="flex-1 flex items-center justify-center gap-2 bg-green/10 border border-green-dim text-green rounded-xl px-4 py-2.5 font-bold text-[.9rem] cursor-pointer">
                    ▶ شروع نمایش — {roundInfo?.label} {roundInfo?.emoji}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={handlePause}
                    className="flex-1 flex items-center justify-center gap-2 bg-yellow/10 border border-yellow text-yellow rounded-xl px-4 py-2.5 font-bold text-[.9rem] cursor-pointer">
                    ⏸ توقف
                  </button>
                  <button onClick={handleRestart}
                    className="flex-1 flex items-center justify-center gap-2 bg-white/[.04] border border-border text-ivory-dim rounded-xl px-4 py-2.5 font-bold text-[.9rem] cursor-pointer">
                    ↩ از اول
                  </button>
                </>
              )}
            </div>
          )}

          {/* 9 sound buttons */}
          {phase === "pick" && !reveal && (
            <div className="w-full max-w-[420px] mb-4">
              {/* Replay button */}
              <button onClick={handleStartSequence}
                className="w-full flex items-center justify-center gap-2 bg-white/[.04] border border-border text-ivory-dim rounded-xl px-4 py-2 font-bold text-[.82rem] cursor-pointer mb-3 hover:border-green-dim hover:text-green transition-colors">
                ↩ شنیدن دوباره
              </button>
              <div className="grid grid-cols-3 gap-2.5">
                {Array.from({ length: 9 }, (_, i) => i + 1).map((idx) => {
                  const isSelected = selected === idx;
                  const color = instrument === "drums"
                    ? DRUM_KIT[idx]?.color
                    : CHORD_COLORS[idx - 1];
                  const label = instrument === "drums"
                    ? DRUM_KIT[idx]?.name
                    : toPersianDigits(idx);
                  return (
                    <button key={idx} onClick={() => handleButtonTap(idx)}
                      className="aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 cursor-pointer select-none transition-all active:scale-95"
                      style={{
                        borderColor: color,
                        background: isSelected ? color : `${color}22`,
                        color: isSelected ? "#04140a" : color,
                        transform: isSelected ? "scale(1.08)" : "scale(1)",
                        boxShadow: isSelected ? `0 0 12px ${color}88` : "none",
                      }}>
                      {instrument === "drums" ? (
                        <>
                          <span className="text-[.6rem] font-semibold leading-tight text-center px-1">{label}</span>
                          <span className="text-[.55rem] opacity-70">{toPersianDigits(idx)}</span>
                        </>
                      ) : (
                        <span className="text-[1.4rem] font-extrabold">{label}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reveal feedback */}
          {reveal && (
            <div className="w-full max-w-[420px] rounded-xl px-4 py-3 text-center mb-3 border border-green-dim bg-white/[.03]">
              <p className="font-bold text-[.95rem] mb-1 text-ivory">
                {toPersianDigits(reveal.round_score)} از ۵ درست
                {reveal.round_score === 5 ? " 🎯" : reveal.round_score === 0 ? " 😅" : " 👍"}
              </p>
              <div className="flex gap-1.5 justify-center mt-1">
                {reveal.correct_slots.map((ok, i) => (
                  <span key={i} className={ok ? "text-green" : "text-red-400"}>
                    {ok ? "✓" : "✗"}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Submit / Continue */}
          {phase === "pick" && !reveal ? (
            <button onClick={handleSubmit}
              disabled={submitting || slots.some(s => s === null)}
              className="w-full max-w-[420px] bg-green text-[#04140a] border-none rounded-xl py-3 font-bold text-[.95rem] cursor-pointer disabled:opacity-40">
              {submitting ? "در حال بررسی..." : "ثبت جواب"}
            </button>
          ) : reveal ? (
            <button onClick={handleContinue}
              className="w-full max-w-[420px] bg-green text-[#04140a] border-none rounded-xl py-3 font-bold text-[.95rem] cursor-pointer">
              {reveal.game_over ? "دیدن نتیجه" : `دور ${toPersianDigits(round + 1)} — ${ROUNDS[round]?.emoji} ${ROUNDS[round]?.label} ←`}
            </button>
          ) : null}
        </>
      )}

      {gameOver && !resultOpen && (
        <div className="flex flex-col items-center gap-3 mt-4">
          <p className="text-green font-bold text-xl">{toPersianDigits(finalScore ?? 0)}/۱۵</p>
          <button onClick={openResult}
            className="bg-green/10 border border-green-dim text-green rounded-xl px-6 py-2.5 font-bold cursor-pointer">
            دیدن نتیجه
          </button>
        </div>
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <HowToModal open={howtoOpen} onClose={() => setHowtoOpen(false)} />
      <ChordleResultModal
        open={resultOpen} finalScore={finalScore} streak={streak}
        leaderboard={leaderboard} leaderboardLoading={lbLoading}
        alreadySubmitted={lbSubmitted} submitError={submitError}
        onClose={() => setResultOpen(false)}
        onSubmitScore={handleSubmitScore} profile={profile}
      />
    </div>
  );
}
