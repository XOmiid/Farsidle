"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Toast from "@/components/Toast";
import Grid from "@/components/wordle/Grid";
import Keyboard from "@/components/wordle/Keyboard";
import CountdownBar from "@/components/common/CountdownBar";
import HowToModal from "@/components/wordle/HowToModal";
import ResultModal from "@/components/common/ResultModal";
import {
  ALPHABET_FLAT,
  MAX_TRIES,
  evaluateGuess,
  normalizeInput,
  toPersianDigits,
  msUntilNextRollover,
  formatCountdown,
} from "@/lib/wordle/logic";
import { fetchTodayPuzzle, fetchTodayLeaderboard, submitScore } from "@/lib/wordle/api";
import { loadState, saveState } from "@/lib/wordle/storage";

export default function WordleGame() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [answer, setAnswer] = useState("");
  const [wordLen, setWordLen] = useState(5);

  const [guesses, setGuesses] = useState([]); // committed rows: [{ guess, result }]
  const [currentGuess, setCurrentGuess] = useState("");
  const [currentRow, setCurrentRow] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [keyStatus, setKeyStatus] = useState({});
  const [revealingRow, setRevealingRow] = useState(null);
  const [locked, setLocked] = useState(false);
  const [shaking, setShaking] = useState(false);

  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [howtoOpen, setHowtoOpen] = useState(false);

  const [resultOpen, setResultOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [leaderboardSubmitted, setLeaderboardSubmitted] = useState(false);

  const [countdownVisible, setCountdownVisible] = useState(false);
  const [countdownText, setCountdownText] = useState("۰۰:۰۰:۰۰");
  const countdownInterval = useRef(null);

  const stateRef = useRef(null); // mirrors what's persisted to localStorage

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

  const openResult = useCallback(async (didWin) => {
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
  }, [startCountdown]);

  useEffect(() => {
    return () => {
      if (countdownInterval.current) clearInterval(countdownInterval.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // Boot: fetch today's server-assigned puzzle, then resume or start local state
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

      setAnswer(puzzle.word);
      setWordLen(puzzle.length);

      const saved = loadState();
      let s;
      if (saved && saved.date_key === puzzle.date_key) {
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

      const committed = s.guesses.map((g) => ({ guess: g, result: evaluateGuess(g, puzzle.word) }));
      setGuesses(committed);

      const rank = { absent: 0, present: 1, correct: 2 };
      const nextKeyStatus = {};
      committed.forEach(({ guess, result }) => {
        for (let c = 0; c < guess.length; c++) {
          const letter = guess[c];
          const status = result[c];
          const prev = nextKeyStatus[letter];
          if (!prev || rank[status] > rank[prev]) nextKeyStatus[letter] = status;
        }
      });
      setKeyStatus(nextKeyStatus);

      setCurrentRow(s.guesses.length);
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

  const handleLetter = useCallback(
    (letter) => {
      if (gameOver || locked) return;
      setCurrentGuess((prev) => (prev.length < wordLen ? prev + letter : prev));
    },
    [gameOver, locked, wordLen]
  );

  const deleteLetter = useCallback(() => {
    if (gameOver || locked) return;
    setCurrentGuess((prev) => prev.slice(0, -1));
  }, [gameOver, locked]);

  const submitGuess = useCallback(() => {
    if (gameOver || locked) return;
    if (currentGuess.length < wordLen) {
      showToast("حروف بیشتری وارد کن");
      setShaking(true);
      setTimeout(() => setShaking(false), 350);
      return;
    }

    const guessValue = currentGuess;
    const result = evaluateGuess(guessValue, answer);
    const isWin = result.every((s) => s === "correct");
    const isLastRow = currentRow === MAX_TRIES - 1;

    setLocked(true);
    setRevealingRow({ row: currentRow, guess: guessValue, result });

    const newGuesses = [...(stateRef.current?.guesses || []), guessValue];
    persist({ guesses: newGuesses });

    setTimeout(() => {
      setGuesses((prev) => [...prev, { guess: guessValue, result }]);
      setKeyStatus((prev) => {
        const rank = { absent: 0, present: 1, correct: 2 };
        const next = { ...prev };
        for (let c = 0; c < guessValue.length; c++) {
          const letter = guessValue[c];
          const status = result[c];
          const p = next[letter];
          if (!p || rank[status] > rank[p]) next[letter] = status;
        }
        return next;
      });
      setRevealingRow(null);
      setLocked(false);
      setCurrentGuess("");

      if (isWin) {
        setGameOver(true);
        setWon(true);
        persist({ gameOver: true, won: true });
        openResult(true);
      } else if (isLastRow) {
        setGameOver(true);
        setWon(false);
        persist({ gameOver: true, won: false });
        openResult(false);
      } else {
        setCurrentRow((r) => r + 1);
      }
    }, wordLen * 220 + 400);
  }, [gameOver, locked, currentGuess, wordLen, answer, currentRow, persist, showToast, openResult]);

  // Physical keyboard support
  useEffect(() => {
    const onKeyDown = (e) => {
      if (gameOver || locked || resultOpen || howtoOpen) return;
      if (e.key === "Enter") {
        submitGuess();
        return;
      }
      if (e.key === "Backspace") {
        deleteLetter();
        return;
      }
      const ch = normalizeInput(e.key);
      if (ALPHABET_FLAT.includes(ch)) handleLetter(ch);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [gameOver, locked, resultOpen, howtoOpen, submitGuess, deleteLetter, handleLetter]);

  const [submitError, setSubmitError] = useState("");

  const handleSubmitScore = useCallback(async () => {
    setSubmitError("");
    const { data: entries, error } = await submitScore(currentRow + 1);
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
  }, [currentRow, persist]);

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
      <Header title="وردل فارسی" onMenuClick={() => setSidebarOpen(true)} right={helpButton} />

      <p className="text-center text-ivory-dim text-[.85rem] mb-3.5 px-2.5">
        {loading
          ? "در حال بارگذاری..."
          : loadError
          ? "اتصال به سرور برقرار نشد، صفحه رو دوباره باز کن"
          : `کلمه امروز ${toPersianDigits(wordLen)} حرفیه`}
      </p>

      <CountdownBar
        visible={countdownVisible}
        text={countdownText}
        onClick={() => gameOver && openResult(won)}
      />

      <Toast message={toastMsg} />

      {!loading && !loadError && (
        <>
          <Grid
            wordLen={wordLen}
            guesses={guesses}
            currentGuess={currentGuess}
            currentRow={currentRow}
            revealingRow={revealingRow}
            shaking={shaking}
          />
          <Keyboard
            keyStatus={keyStatus}
            disabled={gameOver || locked}
            onLetter={handleLetter}
            onEnter={submitGuess}
            onDelete={deleteLetter}
          />
        </>
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <HowToModal open={howtoOpen} onClose={() => setHowtoOpen(false)} />
      <ResultModal
        open={resultOpen}
        won={won}
        answer={answer}
        tries={currentRow + 1}
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
