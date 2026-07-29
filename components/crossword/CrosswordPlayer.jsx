"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Toast from "@/components/Toast";
import { fetchCrossword, saveLetter, checkCrossword } from "@/lib/crossword/api";
import { supabase } from "@/lib/supabaseClient";
import { toPersianDigits } from "@/lib/shared/persian";

const PERSIAN_LETTERS = "ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی";

// Build a lookup: for each cell, which slots pass through it
function buildCellSlotMap(slots) {
  const map = {}; // "row_col" -> [{slot, letterIndex}]
  slots.forEach((slot) => {
    for (let i = 0; i < slot.length; i++) {
      const r = slot.direction === "across" ? slot.row : slot.row + i;
      const c = slot.direction === "across" ? slot.col + i : slot.col;
      const key = `${r}_${c}`;
      if (!map[key]) map[key] = [];
      map[key].push({ slot, letterIndex: i });
    }
  });
  return map;
}

function buildBlackSet(blackCells) {
  return new Set(blackCells.map(([r, c]) => `${r}_${c}`));
}

// Get the slot number label for a cell (the smallest slot number starting at this cell)
function getCellNumber(slots, row, col) {
  const starting = slots.filter(
    (s) => s.row === row && s.col === col
  );
  if (!starting.length) return null;
  return Math.min(...starting.map((s) => s.number));
}

export default function CrosswordPlayer({ id }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [puzzle, setPuzzle] = useState(null);
  const [error, setError] = useState("");

  // grid[row][col] = letter string or ""
  const [grid, setGrid] = useState([]);
  // correctness per cell after check: "row_col" -> true|false|null
  const [correctMap, setCorrectMap] = useState({});
  const [checked, setChecked] = useState(false);
  const [solved, setSolved] = useState(false);

  // Selection
  const [selectedCell, setSelectedCell] = useState(null); // [row, col]
  const [direction, setDirection] = useState("across");
  const [activeSlot, setActiveSlot] = useState(null); // the currently highlighted slot

  const [checking, setChecking] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2000);
  }, []);

  // Boot — wait for auth session before fetching
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Wait for Supabase to restore session from localStorage
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!session) {
        setError("برای بازی کردن باید وارد حساب بشی");
        setLoading(false);
        return;
      }

      const { data, error: err } = await fetchCrossword(id);
      if (cancelled) return;
      if (err || !data) {
        const msg = err?.message || "";
        if (msg.includes("باز نکردی") || err?.code === "42501") {
          setError("این جدول رو هنوز باز نکردی — برگرد و آن رو خریداری کن");
        } else {
          setError("خطا در بارگذاری جدول");
        }
        setLoading(false);
        return;
      }

      // Build initial grid from saved progress
      const g = Array.from({ length: data.rows }, () =>
        Array(data.cols).fill("")
      );
      if (data.progress) {
        Object.entries(data.progress).forEach(([key, letter]) => {
          const [r, c] = key.split("_").map(Number);
          if (g[r]) g[r][c] = letter;
        });
      }

      setPuzzle(data);
      setGrid(g);
      setSolved(data.completed);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  const blackSet = puzzle ? buildBlackSet(puzzle.black_cells) : new Set();
  const cellSlotMap = puzzle ? buildCellSlotMap(puzzle.slots) : {};

  // Find the active slot based on selected cell + direction
  useEffect(() => {
    if (!selectedCell || !puzzle) { setActiveSlot(null); return; }
    const [r, c] = selectedCell;
    const key = `${r}_${c}`;
    const cellSlots = cellSlotMap[key] || [];
    const matching = cellSlots.find((cs) => cs.slot.direction === direction);
    if (matching) {
      setActiveSlot(matching.slot);
    } else {
      // fallback: pick the other direction
      const other = cellSlots.find((cs) => cs.slot.direction !== direction);
      if (other) {
        setDirection(other.slot.direction);
        setActiveSlot(other.slot);
      } else {
        setActiveSlot(null);
      }
    }
  }, [selectedCell, direction, puzzle]);

  const handleCellClick = useCallback((r, c) => {
    if (!puzzle) return;
    const key = `${r}_${c}`;
    if (blackSet.has(key)) return;

    if (selectedCell && selectedCell[0] === r && selectedCell[1] === c) {
      // Toggle direction on re-click
      setDirection((d) => d === "across" ? "down" : "across");
    } else {
      setSelectedCell([r, c]);
      // Keep direction if cell has a slot in that direction, else switch
      const cellSlots = cellSlotMap[key] || [];
      const hasCurrentDir = cellSlots.some((cs) => cs.slot.direction === direction);
      if (!hasCurrentDir && cellSlots.length > 0) {
        setDirection(cellSlots[0].slot.direction);
      }
    }
    setChecked(false);
    setCorrectMap({});
  }, [puzzle, selectedCell, blackSet, cellSlotMap, direction]);

  // Move to next empty cell in the active slot
  const moveToNext = useCallback((fromRow, fromCol) => {
    if (!activeSlot) return;
    const { direction: dir, row, col, length } = activeSlot;
    let idx = dir === "across" ? fromCol - col : fromRow - row;
    idx++;
    if (idx < length) {
      const nr = dir === "across" ? row : row + idx;
      const nc = dir === "across" ? col + idx : col;
      setSelectedCell([nr, nc]);
    }
  }, [activeSlot]);

  const moveToPrev = useCallback((fromRow, fromCol) => {
    if (!activeSlot) return;
    const { direction: dir, row, col } = activeSlot;
    let idx = dir === "across" ? fromCol - col : fromRow - row;
    idx--;
    if (idx >= 0) {
      const nr = dir === "across" ? row : row + idx;
      const nc = dir === "across" ? col + idx : col;
      setSelectedCell([nr, nc]);
    }
  }, [activeSlot]);

  const handleKeyDown = useCallback(async (e) => {
    if (!selectedCell || !puzzle) return;
    const [r, c] = selectedCell;

    // Persian letter input
    const letter = e.key;
    if (PERSIAN_LETTERS.includes(letter) && letter.length === 1) {
      const next = grid.map((row) => [...row]);
      next[r][c] = letter;
      setGrid(next);
      setChecked(false);
      setCorrectMap({});
      await saveLetter(id, r, c, letter);
      moveToNext(r, c);
      return;
    }

    // Backspace
    if (e.key === "Backspace") {
      e.preventDefault();
      if (grid[r][c]) {
        const next = grid.map((row) => [...row]);
        next[r][c] = "";
        setGrid(next);
        await saveLetter(id, r, c, " ");
      } else {
        moveToPrev(r, c);
      }
      setChecked(false);
      setCorrectMap({});
      return;
    }

    // Arrow keys
    if (e.key === "ArrowRight")  { e.preventDefault(); setSelectedCell([r, Math.max(0, c - 1)]); }
    if (e.key === "ArrowLeft")   { e.preventDefault(); setSelectedCell([r, Math.min(puzzle.cols - 1, c + 1)]); }
    if (e.key === "ArrowUp")     { e.preventDefault(); setSelectedCell([Math.max(0, r - 1), c]); }
    if (e.key === "ArrowDown")   { e.preventDefault(); setSelectedCell([Math.min(puzzle.rows - 1, r + 1), c]); }
  }, [selectedCell, puzzle, grid, id, moveToNext, moveToPrev]);

  // On-screen Persian keyboard input
  const handleLetterTap = useCallback(async (letter) => {
    if (!selectedCell || !puzzle) return;
    const [r, c] = selectedCell;
    const next = grid.map((row) => [...row]);
    next[r][c] = letter;
    setGrid(next);
    setChecked(false);
    setCorrectMap({});
    await saveLetter(id, r, c, letter);
    moveToNext(r, c);
  }, [selectedCell, puzzle, grid, id, moveToNext]);

  const handleDelete = useCallback(async () => {
    if (!selectedCell || !puzzle) return;
    const [r, c] = selectedCell;
    if (grid[r][c]) {
      const next = grid.map((row) => [...row]);
      next[r][c] = "";
      setGrid(next);
      await saveLetter(id, r, c, " ");
    } else {
      moveToPrev(r, c);
    }
    setChecked(false);
    setCorrectMap({});
  }, [selectedCell, puzzle, grid, id, moveToPrev]);

  const handleCheck = useCallback(async () => {
    setChecking(true);
    const { data, error: err } = await checkCrossword(id);
    setChecking(false);
    if (err || !data) { showToast("خطا در بررسی"); return; }
    setCorrectMap(data.correct_cells || {});
    setChecked(true);
    if (data.fully_correct) {
      setSolved(true);
      showToast("🎉 آفرین! جدول رو حل کردی!");
    } else {
      showToast("خانه‌های اشتباه قرمز شدن");
    }
  }, [id, showToast]);

  // Is a cell in the active slot?
  const isInActiveSlot = useCallback((r, c) => {
    if (!activeSlot) return false;
    const { direction: dir, row, col, length } = activeSlot;
    if (dir === "across") return r === row && c >= col && c < col + length;
    return c === col && r >= row && r < row + length;
  }, [activeSlot]);

  // Cell color
  const getCellStyle = (r, c) => {
    const key = `${r}_${c}`;
    const isSel = selectedCell && selectedCell[0] === r && selectedCell[1] === c;
    const isActive = isInActiveSlot(r, c);

    if (checked && correctMap[key] !== undefined) {
      return correctMap[key]
        ? "bg-green/20 border-green text-green"
        : "bg-red-500/20 border-red-400 text-red-300";
    }
    if (isSel) return "bg-yellow/20 border-yellow text-ivory";
    if (isActive) return "bg-green/10 border-green/50 text-ivory";
    return "bg-white/[.04] border-border text-ivory";
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-ivory-dim text-sm">
      در حال بارگذاری...
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-5">
      <p className="text-red-400 text-center">{error}</p>
      <div className="flex gap-3">
        <button onClick={() => router.push("/crossword")}
          className="bg-green/10 border border-green-dim text-green rounded-xl px-5 py-2.5 font-bold text-[.9rem] cursor-pointer">
          بازگشت
        </button>
        {error.includes("وارد") && (
          <button onClick={() => router.push("/login")}
            className="bg-green text-[#04140a] border-none rounded-xl px-5 py-2.5 font-bold text-[.9rem] cursor-pointer">
            ورود
          </button>
        )}
      </div>
    </div>
  );

  const cellSize = Math.min(52, Math.floor((Math.min(typeof window !== "undefined" ? window.innerWidth : 380, 420) - 32) / puzzle.cols));

  return (
    <div
      className="min-h-screen flex flex-col items-center px-3 pt-[18px] pb-6"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      style={{ outline: "none" }}
    >
      <Header title={puzzle.title} onMenuClick={() => setSidebarOpen(true)} />
      <Toast message={toastMsg} />

      {solved && (
        <div className="w-full max-w-[420px] bg-green/10 border border-green rounded-xl px-4 py-2.5 text-green text-center font-bold text-[.9rem] mb-3">
          ✓ این جدول رو حل کردی!
        </div>
      )}

      {/* Grid */}
      <div className="mb-4" dir="ltr">
        <div
          className="grid gap-[2px]"
          style={{
            gridTemplateColumns: `repeat(${puzzle.cols}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${puzzle.rows}, ${cellSize}px)`,
          }}
        >
          {Array.from({ length: puzzle.rows }, (_, r) =>
            Array.from({ length: puzzle.cols }, (_, c) => {
              const key = `${r}_${c}`;
              const isBlack = blackSet.has(key);
              const cellNum = isBlack ? null : getCellNumber(puzzle.slots, r, c);
              const letter = !isBlack ? (grid[r]?.[c] || "") : null;

              if (isBlack) {
                return (
                  <div key={key}
                    className="bg-[#0a1a0d] rounded-[3px]"
                    style={{ width: cellSize, height: cellSize }}
                  />
                );
              }

              return (
                <div
                  key={key}
                  onClick={() => handleCellClick(r, c)}
                  className={`relative rounded-[3px] border flex items-center justify-center cursor-pointer select-none transition-colors ${getCellStyle(r, c)}`}
                  style={{ width: cellSize, height: cellSize }}
                >
                  {cellNum !== null && (
                    <span className="absolute top-[1px] right-[2px] text-[8px] text-ivory-dim leading-none font-bold">
                      {toPersianDigits(cellNum)}
                    </span>
                  )}
                  <span className="text-[1.1rem] font-bold leading-none">
                    {letter}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Active clue */}
      {activeSlot && (
        <div className="w-full max-w-[420px] bg-white/[.04] border border-green-dim rounded-xl px-4 py-2.5 text-right mb-3">
          <span className="text-ivory-dim text-[.72rem] ml-1">
            {toPersianDigits(activeSlot.number)}
            {activeSlot.direction === "across" ? " افقی" : " عمودی"} —
          </span>
          <span className="text-ivory text-[.88rem]"> {activeSlot.clue}</span>
        </div>
      )}

      {/* On-screen Persian keyboard */}
      <div className="w-full max-w-[420px] mb-3" dir="rtl">
        <div className="flex flex-wrap gap-1.5 justify-center mb-1.5">
          {Array.from(PERSIAN_LETTERS).map((l) => (
            <button
              key={l}
              onClick={() => handleLetterTap(l)}
              className="w-9 h-9 rounded-lg border border-green-dim bg-white/[.04] text-ivory text-[.95rem] font-bold cursor-pointer hover:bg-green/10 hover:border-green active:scale-95 transition-all flex-shrink-0"
            >
              {l}
            </button>
          ))}
        </div>
        <button
          onClick={handleDelete}
          className="w-full border border-border bg-white/[.03] text-ivory-dim rounded-lg py-2 text-[.85rem] cursor-pointer hover:bg-white/[.06]"
        >
          ⌫ حذف
        </button>
      </div>

      {/* Clue list toggle */}
      <ClueList slots={puzzle.slots} onClueClick={(slot) => {
        setSelectedCell([slot.row, slot.col]);
        setDirection(slot.direction);
      }} />

      {/* Check button */}
      {!solved && (
        <button
          onClick={handleCheck}
          disabled={checking}
          className="w-full max-w-[420px] bg-green text-[#04140a] border-none rounded-xl py-3 font-bold text-[.95rem] cursor-pointer disabled:opacity-40 mt-3"
        >
          {checking ? "در حال بررسی..." : "بررسی جواب‌ها"}
        </button>
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  );
}

function ClueList({ slots, onClueClick }) {
  const [open, setOpen] = useState(false);
  const across = slots.filter((s) => s.direction === "across").sort((a, b) => a.number - b.number);
  const down   = slots.filter((s) => s.direction === "down").sort((a, b) => a.number - b.number);

  return (
    <div className="w-full max-w-[420px] mt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between bg-white/[.03] border border-border rounded-xl px-4 py-2.5 text-ivory-dim text-[.85rem] cursor-pointer"
      >
        <span>لیست سرنخ‌ها</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-2 bg-bg-1 border border-border rounded-xl p-4 flex flex-col gap-4 text-right">
          <div>
            <p className="text-green text-[.8rem] font-bold mb-2">افقی</p>
            {across.map((s) => (
              <button key={s.number + "a"} onClick={() => onClueClick(s)}
                className="w-full text-right text-ivory-dim text-[.8rem] py-1 hover:text-ivory bg-transparent border-none cursor-pointer">
                <span className="text-ivory font-bold ml-1">{toPersianDigits(s.number)}.</span>
                {s.clue}
              </button>
            ))}
          </div>
          <div>
            <p className="text-green text-[.8rem] font-bold mb-2">عمودی</p>
            {down.map((s) => (
              <button key={s.number + "d"} onClick={() => onClueClick(s)}
                className="w-full text-right text-ivory-dim text-[.8rem] py-1 hover:text-ivory bg-transparent border-none cursor-pointer">
                <span className="text-ivory font-bold ml-1">{toPersianDigits(s.number)}.</span>
                {s.clue}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
