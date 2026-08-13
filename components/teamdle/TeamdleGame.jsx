"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Toast from "@/components/Toast";
import TeamdleHowToModal from "@/components/teamdle/HowToModal";
import YesterdayResultPopup from "@/components/teamdle/YesterdayResultPopup";
import { joinTeamdle, submitAnswers, fetchLeaderboard, fetchYesterdayResult, checkTodayStatus } from "@/lib/teamdle/api";
import { toPersianDigits } from "@/lib/shared/persian";
import { useAuth } from "@/lib/auth/AuthProvider";

const QUESTION_TIME = 6; // seconds

const TEAM_CONFIG = {
  red:  { label: "تیم قرمز", emoji: "🔴", color: "#ef4444", bg: "bg-red-500/10",  border: "border-red-400" },
  blue: { label: "تیم آبی",  emoji: "🔵", color: "#3b82f6", bg: "bg-blue-500/10", border: "border-blue-400" },
};

export default function TeamdleGame() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  // Game state
  const [team, setTeam] = useState(null);
  const [countries, setCountries] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(null);
  const [phase, setPhase] = useState("waiting"); // waiting | playing | done

  // Timer
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const timerRef = useRef(null);

  // UI
  const [chosen, setChosen] = useState(null);
  const [showResult, setShowResult] = useState(false); // brief reveal after answering
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef(null);

  // Modals
  const [howtoOpen, setHowtoOpen] = useState(false);
  const [yesterdayResult, setYesterdayResult] = useState(null);
  const [showYesterday, setShowYesterday] = useState(false);

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2000);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // Shuffle choices: capital vs decoy, random order
  const getChoices = useCallback((country) => {
    const choices = [
      { text: country.capital, isCapital: true },
      { text: country.decoy,   isCapital: false },
    ];
    return Math.random() > 0.5 ? choices : [choices[1], choices[0]];
  }, []);

  const [currentChoices, setCurrentChoices] = useState([]);

  // Start timer for current question
  const startTimer = useCallback(() => {
    clearTimer();
    setTimeLeft(QUESTION_TIME);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearTimer]);

  // Move to next question or finish
  const advanceQuestion = useCallback((newAnswers) => {
    const nextIdx = questionIndex + 1;
    if (nextIdx >= countries.length) {
      // All done — submit
      setPhase("submitting");
      setGameOver(true);
    } else {
      setTimeout(() => {
        setQuestionIndex(nextIdx);
        setChosen(null);
        setShowResult(false);
        setCurrentChoices(getChoices(countries[nextIdx]));
        startTimer();
      }, 800); // brief pause to show result
    }
  }, [questionIndex, countries, getChoices, startTimer]);

  // Handle answer (chosen or timed out)
  const handleAnswer = useCallback((choiceText, timedOut = false) => {
    if (chosen !== null || showResult) return;
    clearTimer();

    const country = countries[questionIndex];
    const isCorrect = !timedOut && choiceText === country.capital;

    setChosen(timedOut ? null : choiceText);
    setShowResult(true);

    const newAnswer = {
      country_id: String(country.id),
      chosen: timedOut ? "" : choiceText,
      correct: isCorrect,
      timed_out: timedOut,
    };
    const newAnswers = [...answers, newAnswer];
    setAnswers(newAnswers);

    if (questionIndex + 1 >= countries.length) {
      // Last question — submit after brief reveal
      setTimeout(async () => {
        setPhase("submitting");
        const { data } = await submitAnswers(newAnswers);
        setScore(data?.score ?? newAnswers.filter(a => a.correct).length);
        setGameOver(true);
        setPhase("done");
        // Auto-load leaderboard
        setLbLoading(true);
        const lb = await fetchLeaderboard();
        setLeaderboard(lb);
        setLbLoading(false);
        setShowLeaderboard(true);
      }, 900);
    } else {
      advanceQuestion(newAnswers);
    }
  }, [chosen, showResult, clearTimer, countries, questionIndex, answers, advanceQuestion]);

  // Timer expiry
  useEffect(() => {
    if (phase !== "playing") return;
    if (timeLeft === 0) {
      handleAnswer("", true);
    }
  }, [timeLeft, phase, handleAnswer]);

  // Cleanup
  useEffect(() => () => {
    clearTimer();
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, [clearTimer]);

  // Boot
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const [status, yesterday] = await Promise.all([
        checkTodayStatus(),
        fetchYesterdayResult(),
      ]);
      if (cancelled) return;

      // Show yesterday's result popup
      if (yesterday?.played) {
        setYesterdayResult(yesterday);
        setShowYesterday(true);
      }

      if (status?.played) {
        setTeam(status.team);
        setScore(status.score);
        setGameOver(true);
        setPhase("done");
        setLbLoading(true);
        const lb = await fetchLeaderboard();
        if (!cancelled) {
          setLeaderboard(lb);
          setLbLoading(false);
          setShowLeaderboard(true);
        }
      } else if (status?.joined) {
        setTeam(status.team);
        setPhase("waiting");
      }

      // Show how-to on first visit
      const seen = (() => { try { return !!localStorage.getItem("fa-teamdle-howto-seen"); } catch { return false; } })();
      if (!seen) setHowtoOpen(true);

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const handleJoin = useCallback(async () => {
    if (!user) { showToast("برای بازی باید وارد حساب بشی"); return; }
    setJoining(true);
    const { data, error } = await joinTeamdle();
    setJoining(false);
    if (!data || error) { showToast("خطا در ورود به بازی"); return; }
    setTeam(data.team);
    setCountries(data.countries);
    setCurrentChoices(getChoices(data.countries[0]));
    setQuestionIndex(0);
    setAnswers([]);
    setPhase("playing");
    startTimer();
  }, [user, getChoices, startTimer, showToast]);

  const teamCfg = team ? TEAM_CONFIG[team] : null;
  const country = countries[questionIndex];
  const progressPct = ((QUESTION_TIME - timeLeft) / QUESTION_TIME) * 100;

  const helpButton = (
    <button onClick={() => setHowtoOpen(true)} aria-label="راهنما"
      className="w-9 h-9 rounded-full border border-green-dim text-green flex items-center justify-center hover:bg-green/10 flex-shrink-0">
      ؟
    </button>
  );

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-ivory-dim">در حال بارگذاری...</div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center px-3 pt-[18px] pb-8">
      <Header title="تیمدل" onMenuClick={() => setSidebarOpen(true)} right={helpButton} />
      <Toast message={toastMsg} />

      {/* Team badge */}
      {team && (
        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border mb-4 ${teamCfg.border} ${teamCfg.bg}`}
          style={{ borderColor: teamCfg.color }}>
          <span className="text-[1.1rem]">{teamCfg.emoji}</span>
          <span className="font-bold text-[.88rem]" style={{ color: teamCfg.color }}>{teamCfg.label}</span>
        </div>
      )}

      {/* ── WAITING: not joined yet ── */}
      {phase === "waiting" && !gameOver && (
        <div className="flex flex-col items-center gap-5 w-full max-w-[380px] mt-6">
          <div className="text-center">
            <p className="text-[2.5rem] mb-2">🌍</p>
            <h2 className="font-display text-[1.4rem] text-green mb-1">تیمدل</h2>
            <p className="text-ivory-dim text-[.85rem] leading-6">
              هر روز در مقابل تیم مقابل بازی کن.<br/>
              پایتخت‌ها رو بشناس، تیمت رو پیش ببر!
            </p>
          </div>

          {!user ? (
            <div className="w-full bg-white/[.04] border border-border rounded-xl p-4 text-center">
              <p className="text-ivory-dim text-[.85rem] mb-3">برای بازی باید وارد حساب بشی</p>
              <a href="/login" className="inline-block bg-green text-[#04140a] no-underline rounded-xl px-6 py-2.5 font-bold text-[.9rem]">
                ورود به حساب
              </a>
            </div>
          ) : (
            <button onClick={handleJoin} disabled={joining}
              className="w-full bg-green text-[#04140a] border-none rounded-xl py-3.5 font-extrabold text-[1rem] cursor-pointer disabled:opacity-50">
              {joining ? "در حال ورود..." : "ورود به بازی و دریافت تیم"}
            </button>
          )}

          <button onClick={() => setHowtoOpen(true)}
            className="text-green text-[.82rem] underline bg-transparent border-none cursor-pointer">
            راهنمای بازی رو بخون
          </button>
        </div>
      )}

      {/* ── PLAYING ── */}
      {phase === "playing" && country && (
        <div className="w-full max-w-[400px] flex flex-col items-center gap-4 mt-2">

          {/* Progress dots */}
          <div className="flex gap-2">
            {countries.map((_, i) => (
              <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all ${
                i < questionIndex ? "bg-green" :
                i === questionIndex ? "bg-green/70 scale-125" : "bg-border"
              }`} />
            ))}
          </div>

          {/* Question number */}
          <p className="text-ivory-dim text-[.8rem]">
            سوال {toPersianDigits(questionIndex + 1)} از {toPersianDigits(countries.length)}
          </p>

          {/* Country name */}
          <div className="w-full bg-white/[.04] border border-green-dim rounded-2xl px-6 py-5 text-center">
            <p className="text-ivory-dim text-[.78rem] mb-1">پایتخت کدام شهر است؟</p>
            <h2 className="font-display text-[2rem] text-ivory">{country.name_fa}</h2>
          </div>

          {/* Timer bar */}
          <div className="w-full h-2 bg-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                timeLeft > 3 ? "bg-green" : timeLeft > 1 ? "bg-yellow" : "bg-red-500"
              }`}
              style={{ width: `${((timeLeft) / QUESTION_TIME) * 100}%` }}
            />
          </div>
          <p className={`text-[.82rem] font-bold -mt-2 ${
            timeLeft > 3 ? "text-ivory-dim" : timeLeft > 1 ? "text-yellow" : "text-red-400"
          }`}>
            {toPersianDigits(timeLeft)} ثانیه
          </p>

          {/* Choices */}
          <div className="w-full flex flex-col gap-3">
            {currentChoices.map((choice, i) => {
              let btnClass = "w-full py-4 rounded-xl border-2 font-bold text-[1rem] cursor-pointer transition-all ";
              if (!showResult) {
                btnClass += chosen === choice.text
                  ? "border-green bg-green/20 text-green"
                  : "border-border bg-white/[.03] text-ivory hover:border-green-dim";
              } else {
                if (choice.isCapital) {
                  btnClass += "border-green bg-green/20 text-green"; // correct answer
                } else if (chosen === choice.text && !choice.isCapital) {
                  btnClass += "border-red-400 bg-red-500/10 text-red-400"; // wrong choice
                } else {
                  btnClass += "border-border bg-white/[.03] text-ivory-dim opacity-50";
                }
              }
              return (
                <button key={i} onClick={() => !showResult && handleAnswer(choice.text)}
                  disabled={showResult}
                  className={btnClass}>
                  {choice.text}
                  {showResult && choice.isCapital && " ✓"}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SUBMITTING ── */}
      {phase === "submitting" && (
        <div className="flex flex-col items-center gap-3 mt-10">
          <p className="text-ivory-dim">در حال ثبت نتیجه...</p>
        </div>
      )}

      {/* ── DONE ── */}
      {phase === "done" && (
        <div className="w-full max-w-[400px] flex flex-col items-center gap-4 mt-2">

          {/* Score */}
          <div className={`w-full rounded-2xl border-2 px-6 py-5 text-center ${teamCfg?.border} ${teamCfg?.bg}`}>
            <p className="text-[.85rem] mb-1" style={{ color: teamCfg?.color }}>
              {teamCfg?.emoji} {teamCfg?.label}
            </p>
            <div className="text-[3.5rem] font-extrabold text-ivory leading-none my-1">
              {score !== null ? toPersianDigits(score) : "—"}
              <span className="text-xl text-ivory-dim">/۴</span>
            </div>
            <p className="text-ivory-dim text-[.78rem] mt-1">امتیاز امروز تو</p>
          </div>

          {/* Leaderboard toggle */}
          <button onClick={() => setShowLeaderboard(!showLeaderboard)}
            className="w-full bg-white/[.04] border border-border text-ivory rounded-xl py-2.5 font-bold text-[.88rem] cursor-pointer hover:border-green-dim transition-colors">
            {showLeaderboard ? "بستن جدول" : "دیدن جدول تیم‌ها"}
          </button>

          {/* Leaderboard */}
          {showLeaderboard && (
            <TeamLeaderboard entries={leaderboard} loading={lbLoading} myTeam={team} />
          )}
        </div>
      )}

      {/* Modals */}
      <TeamdleHowToModal open={howtoOpen} onClose={() => {
        setHowtoOpen(false);
        try { localStorage.setItem("fa-teamdle-howto-seen", "1"); } catch {}
      }} />

      <YesterdayResultPopup result={yesterdayResult}
        open={showYesterday} onClose={() => setShowYesterday(false)} />

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  );
}

// ── Team Leaderboard ──────────────────────────────────────────────────────
function TeamLeaderboard({ entries, loading, myTeam }) {
  if (loading) return (
    <div className="w-full flex flex-col gap-2">
      {[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-white/[.03] animate-pulse" />)}
    </div>
  );
  if (!entries.length) return (
    <p className="text-ivory-dim text-[.82rem] text-center py-3">هنوز کسی بازی نکرده</p>
  );

  // Group by team
  const redPlayers  = entries.filter(e => e.team === "red");
  const bluePlayers = entries.filter(e => e.team === "blue");
  const redTotal    = redPlayers[0]?.team_score ?? 0;
  const blueTotal   = bluePlayers[0]?.team_score ?? 0;

  return (
    <div className="w-full flex flex-col gap-3">
      {[
        { team: "red",  cfg: TEAM_CONFIG.red,  players: redPlayers,  total: redTotal },
        { team: "blue", cfg: TEAM_CONFIG.blue, players: bluePlayers, total: blueTotal },
      ].map(({ team, cfg, players, total }) => (
        <div key={team} className={`rounded-2xl border-2 overflow-hidden ${cfg.border}`}
          style={{ borderColor: cfg.color }}>
          {/* Team header */}
          <div className={`flex items-center justify-between px-4 py-2.5 ${cfg.bg}`}>
            <div className="flex items-center gap-2">
              <span className="text-[1.1rem]">{cfg.emoji}</span>
              <span className="font-bold text-[.88rem]" style={{ color: cfg.color }}>{cfg.label}</span>
              {team === myTeam && <span className="text-[.65rem] text-green bg-green/10 border border-green-dim rounded-full px-1.5 py-0.5">تیم تو</span>}
            </div>
            <span className="font-extrabold text-[1.1rem]" style={{ color: cfg.color }}>
              {toPersianDigits(Number(total))}
            </span>
          </div>
          {/* Players */}
          <div className="divide-y divide-border/50">
            {players.length === 0 ? (
              <p className="text-ivory-dim text-[.78rem] text-center py-3">هنوز کسی بازی نکرده</p>
            ) : players.map((p, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-ivory-dim text-[.72rem] w-4">{toPersianDigits(i + 1)}</span>
                  <span className="text-ivory text-[.85rem]">{p.player_name}</span>
                </div>
                <span className="text-green font-bold text-[.85rem]">
                  {toPersianDigits(p.player_score)}/۴
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
