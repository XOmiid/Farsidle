"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Toast from "@/components/Toast";
import CountdownBar from "@/components/common/CountdownBar";
import ChordleResultModal from "@/components/chordle/ChordleResultModal";
import HowToModal from "@/components/chordle/HowToModal";
import {
  fetchTodayInfo,
  fetchRoundSequence,
  submitRound,
  fetchLeaderboard,
  submitScore,
  checkTodayStatus,
} from "@/lib/chordle/api";
import { playChord, playSequence, resumeAudio, CHORD_COLORS } from "@/lib/chordle/audio";
import { msUntilNextRollover, formatCountdown } from "@/lib/shared/time";
import { toPersianDigits } from "@/lib/shared/persian";
import { useAuth } from "@/lib/auth/AuthProvider";
import { translatePostgrestError } from "@/lib/auth/errors";

const CHORD_COUNT = 9;
const ROUND_LENGTHS = { 1: 3, 2: 4, 3: 5 };

export default function ChordleGame() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [currentRound, setCurrentRound] = useState(1);
  const [slots, setSlots] = useState([]);       // chord indices in slots, null = empty
  const [sequence, setSequence] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [reveal, setReveal] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [roundsCompleted, setRoundsCompleted] = useState(null);
  const [hasPlayed, setHasPlayed] = useState(false);

  // Tap-to-place state: which chord button is currently selected
  const [selected, setSelected] = useState(null);

  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [howtoOpen, setHowtoOpen] = useState(() => {
    try { return !localStorage.getItem("fa-chordle-howto-seen"); } catch { return false; }
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
      try { localStorage.setItem("fa-chordle-howto-seen", "1"); } catch {}
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

  const initRound = useCallback((round) => {
    setCurrentRound(round);
    setSlots(Array(ROUND_LENGTHS[round]).fill(null));
    setSequence(null);
    setReveal(null);
    setHasPlayed(false);
    setSelected(null);
  }, []);

  // Boot
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const info = await fetchTodayInfo();
      if (cancelled) return;
      if (!info) { setLoadError(true); setLoading(false); return; }

      const status = await checkTodayStatus();
      if (cancelled) return;

      setStreak(status.streak || 0);
      setLbSubmitted(!!status.leaderboard_submitted);

      if (status.played) {
        setGameOver(true);
        setRoundsCompleted(status.rounds_completed);
        setLoading(false);
        openResult();
        return;
      }

      initRound(status.current_round || 1);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [openResult, initRound]);

  const handlePlay = useCallback(async () => {
    resumeAudio();
    if (!sequence) {
      const seq = await fetchRoundSequence(currentRound);
      if (!seq) { showToast("خطا در دریافت توالی"); return; }
      setSequence(seq);
      setPlaying(true);
      setHasPlayed(true);
      await playSequence(seq);
      setPlaying(false);
    } else {
      setPlaying(true);
      await playSequence(sequence);
      setPlaying(false);
    }
  }, [sequence, currentRound, showToast]);

  // Tap a chord button: play its sound + select it for placement
  const handleChordTap = useCallback((chordIndex) => {
    resumeAudio();
    playChord(chordIndex);
    if (reveal) return;
    setSelected((prev) => prev === chordIndex ? null : chordIndex);
  }, [reveal]);

  // Tap a slot:
  //   - if a chord is selected → place it in this slot
  //   - if slot is already filled and nothing is selected → clear it
  //   - if slot is filled and a chord IS selected → replace it
  const handleSlotTap = useCallback((slotIndex) => {
    if (reveal) return;
    const next = [...slots];
    if (selected !== null) {
      next[slotIndex] = selected;
      setSlots(next);
      // auto-advance selection to next empty slot if any
      const nextEmpty = next.findIndex((s, i) => i > slotIndex && s === null);
      if (nextEmpty === -1) setSelected(null); // all filled, deselect
    } else if (next[slotIndex] !== null) {
      next[slotIndex] = null;
      setSlots(next);
    }
  }, [reveal, selected, slots]);

  const handleSubmit = useCallback(async () => {
    if (!hasPlayed) { showToast("اول باید آهنگ رو گوش بدی"); return; }
    if (slots.some((s) => s === null)) { showToast("همه‌ی خانه‌ها باید پر باشن"); return; }
    setSubmitting(true);
    const { data, error } = await submitRound(currentRound, slots);
    setSubmitting(false);
    if (!data || error) { showToast("خطا در ارسال — دوباره امتحان کن"); return; }
    setSelected(null);
    setReveal(data);
  }, [slots, currentRound, hasPlayed, showToast]);

  const handleContinue = useCallback(() => {
    if (!reveal) return;
    if (reveal.game_over) {
      const completed = reveal.correct ? currentRound : currentRound - 1;
      setRoundsCompleted(completed);
      setGameOver(true);
      setReveal(null);
      openResult();
      return;
    }
    initRound(currentRound + 1);
  }, [reveal, currentRound, openResult, initRound]);

  const handleSubmitScore = useCallback(async () => {
    setSubmitError("");
    const { data: entries, error } = await submitScore();
    if (error || !entries) { setSubmitError(translatePostgrestError(error)); return; }
    setLbSubmitted(true);
    setLeaderboard(entries);
  }, []);

  const slotBorderColor = (chordIdx, slotIndex) => {
    if (!reveal) return chordIdx !== null ? CHORD_COLORS[chordIdx] : undefined;
    const correct = reveal.correct_sequence[slotIndex];
    return chordIdx === correct ? "#4ade80" : "#ef4444";
  };

  const helpButton = (
    <button onClick={() => setHowtoOpen(true)} aria-label="راهنما"
      className="w-9 h-9 rounded-full border border-green-dim text-green flex items-center justify-center hover:bg-green/10 flex-shrink-0">
      ؟
    </button>
  );

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-ivory-dim text-sm">
      در حال بارگذاری...
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center px-3 pt-[18px] pb-6">
      <Header title="کوردل" onMenuClick={() => setSidebarOpen(true)} right={helpButton} />

      <CountdownBar visible={countdownVisible} text={countdownText} onClick={() => gameOver && openResult()} />
      <Toast message={toastMsg} />

      {!loadError && !gameOver && (
        <>
          {/* Round indicator */}
          <div className="w-full max-w-[420px] flex items-center justify-between mb-4 px-1">
            <span className="text-ivory-dim text-[.85rem]">دور {toPersianDigits(currentRound)} از ۳</span>
            <div className="flex gap-1.5">
              {[1, 2, 3].map((r) => (
                <div key={r} className={`w-2 h-2 rounded-full ${
                  r < currentRound ? "bg-green" : r === currentRound ? "bg-green/60" : "bg-border"
                }`} />
              ))}
            </div>
          </div>

          {/* Answer slots */}
          <div className="w-full max-w-[420px] mb-5">
            <p className="text-[.78rem] text-ivory-dim mb-2 text-right">
              {selected !== null
                ? "حالا روی یه خانه بزن تا نت رو بذاری"
                : "روی یه نت بزن تا انتخاب بشه"}
            </p>
            <div className="flex gap-2 justify-center">
              {slots.map((chordIdx, i) => (
                <button
                  key={i}
                  onClick={() => handleSlotTap(i)}
                  className="flex-1 aspect-square max-w-[72px] rounded-xl border-2 flex items-center justify-center text-[1.3rem] font-bold transition-all cursor-pointer select-none"
                  style={{
                    borderColor: chordIdx !== null
                      ? slotBorderColor(chordIdx, i)
                      : selected !== null ? "#4ade80" : "#2a3d2e",
                    borderStyle: chordIdx !== null ? "solid" : "dashed",
                    background: chordIdx !== null
                      ? `${slotBorderColor(chordIdx, i)}22`
                      : selected !== null ? "rgba(74,222,128,.08)" : "rgba(255,255,255,.02)",
                    color: chordIdx !== null ? slotBorderColor(chordIdx, i) : "#4ade80",
                  }}
                >
                  {chordIdx !== null
                    ? toPersianDigits(chordIdx)
                    : <span className="text-[.85rem] opacity-40">{toPersianDigits(i + 1)}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Play button */}
          <button
            onClick={handlePlay}
            disabled={playing || !!reveal}
            className="mb-5 flex items-center gap-2 bg-green/10 border border-green-dim text-green rounded-xl px-6 py-2.5 font-bold text-[.9rem] cursor-pointer disabled:opacity-50"
          >
            {playing ? "▶ در حال پخش..." : hasPlayed ? "▶ پخش دوباره" : "▶ پخش توالی"}
          </button>

          {/* 9 chord buttons */}
          <div className="w-full max-w-[420px] mb-5">
            <p className="text-[.78rem] text-ivory-dim mb-2 text-right">نت‌ها — بزن تا انتخاب بشه</p>
            <div className="grid grid-cols-3 gap-2.5">
              {Array.from({ length: CHORD_COUNT }, (_, i) => i + 1).map((idx) => {
                const isSelected = selected === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => handleChordTap(idx)}
                    className="aspect-square rounded-xl border-2 flex items-center justify-center text-[1.4rem] font-extrabold cursor-pointer select-none transition-all active:scale-95"
                    style={{
                      borderColor: CHORD_COLORS[idx],
                      background: isSelected ? CHORD_COLORS[idx] : `${CHORD_COLORS[idx]}22`,
                      color: isSelected ? "#04140a" : CHORD_COLORS[idx],
                      transform: isSelected ? "scale(1.08)" : "scale(1)",
                      boxShadow: isSelected ? `0 0 12px ${CHORD_COLORS[idx]}88` : "none",
                    }}
                  >
                    {toPersianDigits(idx)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reveal feedback */}
          {reveal && (
            <div className={`w-full max-w-[420px] rounded-xl px-4 py-3 text-center mb-4 border ${
              reveal.correct ? "border-green bg-green/10 text-green" : "border-red-500 bg-red-500/10 text-red-400"
            }`}>
              <p className="font-bold text-[.95rem] mb-1">
                {reveal.correct ? "آفرین! درسته ✓" : "اشتباه بود ✗"}
              </p>
              {!reveal.correct && (
                <p className="text-[.8rem] text-ivory-dim">
                  ترتیب درست:{" "}
                  {reveal.correct_sequence.map((idx, i) => (
                    <span key={i} style={{ color: CHORD_COLORS[idx] }} className="font-bold mx-0.5">
                      {toPersianDigits(idx)}
                    </span>
                  ))}
                </p>
              )}
            </div>
          )}

          {/* Submit / Continue */}
          {!reveal ? (
            <button
              onClick={handleSubmit}
              disabled={submitting || !hasPlayed || slots.some(s => s === null)}
              className="w-full max-w-[420px] bg-green text-[#04140a] border-none rounded-xl py-3 font-bold text-[.95rem] cursor-pointer disabled:opacity-40"
            >
              {submitting ? "در حال بررسی..." : "ثبت جواب"}
            </button>
          ) : (
            <button
              onClick={handleContinue}
              className="w-full max-w-[420px] bg-green text-[#04140a] border-none rounded-xl py-3 font-bold text-[.95rem] cursor-pointer"
            >
              {reveal.game_over ? "دیدن نتیجه" : `دور ${toPersianDigits(currentRound + 1)} ←`}
            </button>
          )}
        </>
      )}

      {gameOver && !resultOpen && (
        <div className="w-full max-w-[420px] flex flex-col items-center gap-3 mt-4">
          <p className="text-ivory-dim text-[.9rem]">
            دور تموم کردی: <span className="text-green font-bold">{toPersianDigits(roundsCompleted ?? 0)}/۳</span>
          </p>
          <button onClick={openResult}
            className="bg-green/10 border border-green-dim text-green rounded-xl px-6 py-2.5 font-bold text-[.9rem] cursor-pointer">
            دیدن نتیجه و جدول برترین‌ها
          </button>
        </div>
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <HowToModal open={howtoOpen} onClose={() => setHowtoOpen(false)} />
      <ChordleResultModal
        open={resultOpen}
        roundsCompleted={roundsCompleted}
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
