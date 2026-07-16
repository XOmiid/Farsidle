"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Toast from "@/components/Toast";
import CountdownBar from "@/components/common/CountdownBar";
import ResultModal from "@/components/common/ResultModal";
import HowToModal from "@/components/factle/HowToModal";
import FactsPanel from "@/components/factle/FactsPanel";
import GuessInput from "@/components/factle/GuessInput";
import GuessHistory from "@/components/factle/GuessHistory";
import { MAX_TRIES, countriesMatch } from "@/lib/factle/logic";
import { fetchTodayPuzzle, fetchCountryList, fetchTodayLeaderboard, submitScore, checkTodayStatus, recordAttempt } from "@/lib/factle/api";
import { loadState, saveState } from "@/lib/factle/storage";
import { msUntilNextRollover, formatCountdown } from "@/lib/shared/time";

export default function FactleGame() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [answer, setAnswer] = useState("");
  const [facts, setFacts] = useState([]);
  const [countryList, setCountryList] = useState([]);

  const [guesses, setGuesses] = useState([]); // wrong guesses only
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [remoteOnly, setRemoteOnly] = useState(false);

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

  const openResult = useCallback(
    async (didWin) => {
      setResultOpen(true);
      setLeaderboardLoading(true);
      const entries = await fetchTodayLeaderboard();
      setLeaderboardLoading(false);
      setLeaderboard(entries);

      if (didWin && stateRef.current?.leaderboardSubmitted) {
        const idx = entries.findIndex((e) => e.solved_at === stateRef.current.leaderboardSolvedAt);
        setHighlightIndex(idx);
      } else {
        setHighlightIndex(-1);
      }
      startCountdown();
    },
    [startCountdown]
  );

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
      const [puzzle, countries] = await Promise.all([fetchTodayPuzzle(), fetchCountryList()]);
      if (cancelled) return;

      setCountryList(countries);

      if (!puzzle) {
        setLoadError(true);
        setLoading(false);
        return;
      }

      setAnswer(puzzle.country_name);
      setFacts(puzzle.facts);

      const saved = loadState();
      const serverStatus = await checkTodayStatus();
      if (cancelled) return;

      const localMatches = saved && saved.date_key === puzzle.date_key;

      let s;
      if (localMatches && saved.gameOver) {
        s = saved;
      } else if (serverStatus.played) {
        s = {
          date_key: puzzle.date_key,
          guesses: [],
          gameOver: true,
          won: serverStatus.won,
          leaderboardSubmitted: false,
          leaderboardSolvedAt: null,
          remoteOnly: true,
        };
        saveState(s);
      } else if (localMatches) {
        s = saved;
      } else {
        s = {
          date_key: puzzle.date_key,
          guesses: [],
          gameOver: false,
          won: false,
          leaderboardSubmitted: false,
          leaderboardSolvedAt: null,
        };
        saveState(s);
      }
      stateRef.current = s;
      setRemoteOnly(!!s.remoteOnly);

      setGuesses(s.guesses);
      setGameOver(s.gameOver);
      setWon(s.won);
      setLeaderboardSubmitted(!!s.leaderboardSubmitted);
      setLoading(false);

      if (s.gameOver) openResult(s.won);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGuess = useCallback(
    (name) => {
      if (gameOver) return;

      if (countriesMatch(name, answer)) {
        setGameOver(true);
        setWon(true);
        persist({ guesses, gameOver: true, won: true });
        recordAttempt(true, guesses.length + 1);
        openResult(true);
        return;
      }

      const newGuesses = [...guesses, name];
      setGuesses(newGuesses);

      if (newGuesses.length >= MAX_TRIES) {
        setGameOver(true);
        setWon(false);
        persist({ guesses: newGuesses, gameOver: true, won: false });
        recordAttempt(false, newGuesses.length);
        openResult(false);
      } else {
        persist({ guesses: newGuesses });
        showToast("اشتباه بود! سرنخ بعدی رو ببین");
      }
    },
    [gameOver, guesses, answer, persist, openResult, showToast]
  );

  const handleSubmitScore = useCallback(async () => {
    setSubmitError("");
    const { data: entries, error } = await submitScore(guesses.length + 1);
    if (error || !entries) {
      setSubmitError(error?.message?.includes("وارد حساب") ? error.message : "ثبت نشد، دوباره امتحان کن");
      return;
    }
    const added = entries[entries.length - 1];
    const solvedAt = added ? added.solved_at : null;
    setLeaderboardSubmitted(true);
    persist({ leaderboardSubmitted: true, leaderboardSolvedAt: solvedAt });
    setLeaderboard(entries);
    setHighlightIndex(entries.length - 1);
  }, [guesses.length, persist]);

  const revealedCount = Math.min(guesses.length + 1, MAX_TRIES);

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
      <Header title="فکتل" onMenuClick={() => setSidebarOpen(true)} right={helpButton} />

      <p className="text-center text-ivory-dim text-[.85rem] mb-3.5 px-2.5">
        {loading
          ? "در حال بارگذاری..."
          : loadError
          ? "اتصال به سرور برقرار نشد، صفحه رو دوباره باز کن"
          : remoteOnly
          ? "امروز قبلاً این بازی رو انجام دادی"
          : "این سرنخ‌ها مال کدوم کشوره؟"}
      </p>

      <CountdownBar
        visible={countdownVisible}
        text={countdownText}
        onClick={() => gameOver && openResult(won)}
      />

      <Toast message={toastMsg} />

      {!loading && !loadError && !remoteOnly && (
        <>
          <FactsPanel facts={facts} revealedCount={revealedCount} />
          <GuessInput
            countryList={countryList}
            guessedNames={guesses}
            disabled={gameOver}
            onGuess={handleGuess}
          />
          <div className="mt-4 w-full flex flex-col items-center">
            <GuessHistory guesses={guesses} />
          </div>
        </>
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <HowToModal open={howtoOpen} onClose={() => setHowtoOpen(false)} />
      <ResultModal
        open={resultOpen}
        won={won}
        answer={answer}
        tries={won ? guesses.length + 1 : guesses.length}
        leaderboard={leaderboard}
        leaderboardLoading={leaderboardLoading}
        highlightIndex={highlightIndex}
        alreadySubmitted={leaderboardSubmitted}
        submitError={submitError}
        onClose={() => setResultOpen(false)}
        onSubmitScore={handleSubmitScore}
        emptyLeaderboardNoun="کشور"
        loseAnswerText="کشور درست این بود"
      />
    </div>
  );
}
