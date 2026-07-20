"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Toast from "@/components/Toast";
import CountdownBar from "@/components/common/CountdownBar";
import HowToModal from "@/components/colordle/HowToModal";
import ColorPicker from "@/components/colordle/ColorPicker";
import RevealBox from "@/components/colordle/RevealBox";
import ColordleResultModal from "@/components/colordle/ColordleResultModal";
import {
  fetchTodayPuzzle,
  reveal,
  submitGuess,
  fetchTodayLeaderboard,
  submitScore,
  checkTodayStatus,
} from "@/lib/colordle/api";
import { msUntilNextRollover, formatCountdown } from "@/lib/shared/time";
import { useAuth } from "@/lib/auth/AuthProvider";
import { translatePostgrestError } from "@/lib/auth/errors";
import { rgbToHex } from "@/lib/colordle/logic";
import { toPersianDigits } from "@/lib/shared/persian";

const REVEAL_MS = 10000;
const DEFAULT_RGB = { r: 128, g: 128, b: 128 };

export default function ColordleGame() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // 'preReveal' | 'revealing' | 'guessing' | 'done'
  const [phase, setPhase] = useState("preReveal");
  const [target, setTarget] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(10);
  const revealTimerRef = useRef(null);

  const [pick, setPick] = useState(DEFAULT_RGB);
  const [submitting, setSubmitting] = useState(false);

  const [score, setScore] = useState(null);
  const [finalGuess, setFinalGuess] = useState(null);
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
      if (revealTimerRef.current) clearInterval(revealTimerRef.current);
    };
  }, []);

  const startRevealCountdown = useCallback((remainingMs) => {
    if (revealTimerRef.current) clearInterval(revealTimerRef.current);
    setSecondsLeft(Math.ceil(remainingMs / 1000));
    const endAt = Date.now() + remainingMs;
    revealTimerRef.current = setInterval(() => {
      const left = endAt - Date.now();
      if (left <= 0) {
        clearInterval(revealTimerRef.current);
        setSecondsLeft(0);
        setPhase("guessing");
        return;
      }
      setSecondsLeft(Math.ceil(left / 1000));
    }, 200);
  }, []);

  // Boot
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const puzzle = await fetchTodayPuzzle();
      if (cancelled) return;
      if (!puzzle) {
        setLoadError(true);
        setLoading(false);
        return;
      }

      const status = await checkTodayStatus();
      if (cancelled) return;

      setStreak(status.streak || 0);
      setLeaderboardSubmitted(!!status.leaderboard_submitted);

      if (status.played) {
        setPhase("done");
        setScore(status.score);
        setTarget({ r: status.target_r, g: status.target_g, b: status.target_b });
        setLoading(false);
        openResult();
        return;
      }

      if (status.revealed && status.revealed_at) {
        const revealedData = await reveal();
        if (cancelled) return;
        if (revealedData) {
          const elapsed = Math.max(0, Date.now() - new Date(revealedData.revealed_at).getTime());
          if (elapsed < REVEAL_MS) {
            setTarget({ r: revealedData.target_r, g: revealedData.target_g, b: revealedData.target_b });
            setPhase("revealing");
            startRevealCountdown(REVEAL_MS - elapsed);
          } else {
            setPhase("guessing");
          }
        } else {
          setPhase("guessing");
        }
      } else {
        setPhase("preReveal");
      }

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReveal = useCallback(async () => {
    const data = await reveal();
    if (!data) {
      showToast("نمایش رنگ ناموفق بود، دوباره امتحان کن");
      return;
    }
    const elapsed = Math.max(0, Date.now() - new Date(data.revealed_at).getTime());
    setTarget({ r: data.target_r, g: data.target_g, b: data.target_b });
    if (elapsed < REVEAL_MS) {
      setPhase("revealing");
      startRevealCountdown(REVEAL_MS - elapsed);
    } else {
      setPhase("guessing");
    }
  }, [showToast, startRevealCountdown]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    const { data, error } = await submitGuess(pick.r, pick.g, pick.b);
    setSubmitting(false);

    if (error || !data) {
      showToast("ثبت نشد، دوباره امتحان کن");
      return;
    }

    setPhase("done");
    setScore(data.score);
    setTarget({ r: data.target_r, g: data.target_g, b: data.target_b });
    setFinalGuess(pick);
    setStreak(data.streak || 0);
    openResult();
  }, [submitting, pick, openResult, showToast]);

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

  const subtitle = loading
    ? "در حال بارگذاری..."
    : loadError
    ? "اتصال به سرور برقرار نشد، صفحه رو دوباره باز کن"
    : phase === "preReveal"
    ? "آماده‌ای؟ رنگ امروز رو نشونت می‌دیم"
    : phase === "revealing"
    ? "رنگ امروز اینه:"
    : phase === "guessing"
    ? "حالا با اسلایدرها همین رنگ رو بساز"
    : "امروز قبلاً این بازی رو انجام دادی";

  return (
    <div className="min-h-screen flex flex-col items-center px-3 pt-[18px] pb-6">
      <Header title="رنگدل" onMenuClick={() => setSidebarOpen(true)} right={helpButton} />

      <p className="text-center text-ivory-dim text-[.85rem] mb-3.5 px-2.5">{subtitle}</p>

      <CountdownBar
        visible={countdownVisible}
        text={countdownText}
        onClick={() => phase === "done" && openResult()}
      />

      <Toast message={toastMsg} />

      {!loading && !loadError && (phase === "preReveal" || phase === "revealing") && (
        <RevealBox phase={phase} target={target} secondsLeft={secondsLeft} onReveal={handleReveal} />
      )}

      {!loading && !loadError && phase === "guessing" && (
        <>
          <RevealBox phase="guessing" />
          <ColorPicker r={pick.r} g={pick.g} b={pick.b} onChange={setPick} disabled={submitting} />
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-6 bg-green text-[#04140a] border-none rounded-xl px-8 py-3 font-bold text-[1rem] cursor-pointer disabled:opacity-50"
          >
            {submitting ? "در حال ثبت..." : "ثبت نهایی"}
          </button>
        </>
      )}

      {!loading && !loadError && phase === "done" && (
        <div className="w-full flex flex-col items-center gap-3">
          {target && (
            <div
              className="w-full max-w-[380px] h-40 rounded-2xl border-2 border-green-dim"
              style={{ background: rgbToHex(target.r, target.g, target.b) }}
            />
          )}
          {score !== null && (
            <p className="text-ivory-dim text-[.9rem]">
              امتیازت: <span className="text-green font-bold">{toPersianDigits(score)}/۱۰</span>
            </p>
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
      <ColordleResultModal
        open={resultOpen}
        score={score}
        target={target}
        guess={finalGuess}
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
