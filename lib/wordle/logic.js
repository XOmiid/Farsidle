export { toPersianDigits } from "@/lib/shared/persian";
export { tehranNow, msUntilNextRollover, formatCountdown } from "@/lib/shared/time";

export const ALPHABET_ROWS = [
  ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح", "ج", "چ"],
  ["ش", "س", "ی", "ب", "ل", "ا", "ت", "ن", "م", "ک", "گ"],
  ["ظ", "ط", "ز", "ر", "ذ", "د", "پ", "و", "ژ"],
];
export const ALPHABET_FLAT = ALPHABET_ROWS.flat();
export const MAX_TRIES = 6;

// "آ" is treated the same as "ا" (no separate key on the keyboard),
// and legacy Arabic ي / ك are normalized to Persian ی / ک.
export function canonAnswerChar(ch) {
  if (ch === "آ") return "ا";
  if (ch === "ي") return "ی";
  if (ch === "ك") return "ک";
  return ch;
}
export const normalizeInput = canonAnswerChar;

export function evaluateGuess(guess, answer) {
  const guessArr = [...guess].map(canonAnswerChar);
  const answerArr = [...answer].map(canonAnswerChar);
  const result = new Array(guessArr.length).fill("absent");
  const used = new Array(guessArr.length).fill(false);

  for (let i = 0; i < guessArr.length; i++) {
    if (guessArr[i] === answerArr[i]) {
      result[i] = "correct";
      used[i] = true;
    }
  }
  const remaining = {};
  for (let i = 0; i < answerArr.length; i++) {
    if (!used[i]) remaining[answerArr[i]] = (remaining[answerArr[i]] || 0) + 1;
  }
  for (let i = 0; i < guessArr.length; i++) {
    if (result[i] === "correct") continue;
    const l = guessArr[i];
    if (remaining[l] > 0) {
      result[i] = "present";
      remaining[l]--;
    } else {
      result[i] = "absent";
    }
  }
  return result;
}

export function cellSizeFor(len) {
  if (len <= 4) return 60;
  if (len === 5) return 54;
  return 46;
}
