"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Toast from "@/components/Toast";
import CountdownBar from "@/components/common/CountdownBar";
import HowToModal from "@/components/colordle/HowToModal";
import ColorPicker from "@/components/colordle/ColorPicker";
import ColordleResultModal from "@/components/colordle/ColordleResultModal";
import {
  fetchTodayPuzzle,
  submitGuess,
  fetchTodayLeaderboard,
  submitScore,
  checkTodayStatus,
} from "@/lib/colordle/api";
import { loadState, saveState } from "@/lib/colordle/storage";
import { msUntilNextRollover, formatCountdown } from "@/lib/shared/time";
import { useAuth } from "@/lib/auth/AuthProvider";
import { translatePostgrestError } from "@/lib/auth/errors";

const DEFAULT_RGB = { r: 128, g: 128, b: 128 };

export default function ColordleGame() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [colorName, setColorName] = useState("");

  const [pick, setPick] = useState(DEFAULT_RGB);
  const [gameOver, setGameOver] = useState(false);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [score, setScore] = useState(null);
  const [target, setTarget] = useState(null);
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
      const puzzle = await fetchTodayPuzzle();
      if (cancelled) return;
      if (!puzzle) {
        setLoadError(true);
        setLoading(false);
        return;
      }

      setColorName(puzzle.color_name);

      const saved = loadState();
      const serverStatus = await checkTodayStatus();
      if (cancelled) return;

      const localMatches = saved && saved.date_key === puzzle.date_key;

      let s;
      if (localMatches && saved.gameOver) {
        s = saved;
        // Server is the source of truth for whether the score was
        // posted to the leaderboard (could've been done from another
        // device, or the local flag could be stale).
        s.leaderboardSubmitted = serverStatus.played
          ? serverStatus.leaderboard_submitted
          : !!s.leaderboardSubmitted;
      } else if (serverStatus.played) {
        s = {
          date_key: puzzle.date_key,
          gameOver: true,
          score: serverStatus.score,
          target: { r: serverStatus.target_r, g: serverStatus.target_g, b: serverStatus.target_b },
          guess: null,
          remoteOnly: true,
          leaderboardSubmitted: serverStatus.leaderboard_submitted,
        };
        saveState(s);
      } else if (localMatches) {
        s = saved;
      } else {
        s = {
          date_key: puzzle.date_key,
          gameOver: false,
          score: null,
          target: null,
          guess: null,
          leaderboardSubmitted: false,
        };
        saveState(s);
      }
      stateRef.current = s;

      setGameOver(s.gameOver);
      setRemoteOnly(!!s.remoteOnly);
      setScore(s.score);
      setTarget(s.target);
      setFinalGuess(s.guess);
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

  const handleSubmit = useCallback(async () => {
    if (gameOver || submitting) return;
    setSubmitting(true);
    const { data, error } = await submitGuess(pick.r, pick.g, pick.b);
    setSubmitting(false);

    if (error || !data) {
      showToast("ثبت نشد، دوباره امتحان کن");
      return;
    }

    const newTarget = { r: data.target_r, g: data.target_g, b: data.target_b };
    setGameOver(true);
    setScore(data.score);
    setTarget(newTarget);
    setFinalGuess(pick);
    setStreak(data.streak || 0);
    persist({ gameOver: true, score: data.score, target: newTarget, guess: pick });
    openResult();
  }, [gameOver, submitting, pick, persist, openResult, showToast]);

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

  return (
    <div className="min-h-screen flex flex-col items-center px-3 pt-[18px] pb-6">
      <Header title="رنگدل" onMenuClick={() => setSidebarOpen(true)} right={helpButton} />

      <p className="text-center text-ivory-dim text-[.85rem] mb-3.5 px-2.5">
        {loading
          ? "در حال بارگذاری..."
          : loadError
          ? "اتصال به سرور برقرار نشد، صفحه رو دوباره باز کن"
          : remoteOnly
          ? "امروز قبلاً این بازی رو انجام دادی"
          : "این رنگ رو با اسلایدرها بساز:"}
      </p>

      <CountdownBar
        visible={countdownVisible}
        text={countdownText}
        onClick={() => gameOver && openResult()}
      />

      <Toast message={toastMsg} />

      {!loading && !loadError && !gameOver && (
        <>
          <h2 className="font-display text-xl text-ivory mb-4">{colorName}</h2>
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

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <HowToModal open={howtoOpen} onClose={() => setHowtoOpen(false)} />
      <ColordleResultModal
        open={resultOpen}
        colorName={colorName}
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
