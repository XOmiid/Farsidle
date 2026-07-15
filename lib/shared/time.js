import { toPersianDigits } from "@/lib/shared/persian";

// Game day rolls over at 21:00 Asia/Tehran — matches the
// current_game_date_key() Postgres function shared by every game.
export function tehranNow() {
  const str = new Date().toLocaleString("en-US", { timeZone: "Asia/Tehran" });
  return new Date(str);
}

export function msUntilNextRollover() {
  const now = tehranNow();
  const rollover = new Date(now);
  rollover.setHours(21, 0, 0, 0);
  if (rollover <= now) rollover.setDate(rollover.getDate() + 1);
  return rollover - now;
}

export function formatCountdown(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return toPersianDigits(`${h}:${m}:${s}`);
}
