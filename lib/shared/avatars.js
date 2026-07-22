// All available toon-head options, sourced directly from the style's
// definition JSON. These are the ONLY valid values per field.

export const TOON_OPTIONS = {
  hair: ["bun", "sideComed", "spiky", "undercut"],
  rearHair: ["none", "longStraight", "longWavy", "neckHigh", "shoulderHigh"],
  beard: ["none", "chin", "chinMoustache", "fullBeard", "longBeard", "moustacheTwirl"],
  eyes: ["bow", "happy", "humble", "wide", "wink"],
  eyebrows: ["angry", "happy", "neutral", "raised", "sad"],
  mouth: ["agape", "angry", "laugh", "sad", "smile"],
  clothes: ["dress", "openJacket", "shirt", "tShirt", "turtleNeck"],
  hairColor: ["2c1b18", "d6b370", "724133", "a55728", "b58143"],
  skinColor: ["5c3829", "f1c3a5", "a36b4f", "c68e7a", "b98e6a"],
  clothesColor: ["151613", "0b3286", "545454", "147f3c", "f97316", "ec4899", "731ac3", "b11f1f", "e8e9e6", "eab308"],
  backgroundColor: ["b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf", "c3e6cb", "ffeeba", "f8d7da", "e2e3e5", "0a0a0a", "1a2744", "1a3a1a", "2d1b4e"],
};

export const TOON_LABELS = {
  hair: { bun: "گوجه", sideComed: "شانه‌زده", spiky: "تیغه‌ای", undercut: "اندرکات" },
  rearHair: { none: "بدون", longStraight: "بلند صاف", longWavy: "بلند موج‌دار", neckHigh: "تا گردن", shoulderHigh: "تا شانه" },
  beard: { none: "بدون", chin: "ریش چانه", chinMoustache: "ریش و سبیل", fullBeard: "ریش کامل", longBeard: "ریش بلند", moustacheTwirl: "سبیل پیچ" },
  eyes: { bow: "کماندار", happy: "شاد", humble: "فروتن", wide: "گشاد", wink: "چشمک" },
  eyebrows: { angry: "عصبانی", happy: "شاد", neutral: "خنثی", raised: "بالارفته", sad: "غمگین" },
  mouth: { agape: "باز", angry: "عصبانی", laugh: "خندان", sad: "غمگین", smile: "لبخند" },
  clothes: { dress: "پیراهن", openJacket: "کت باز", shirt: "پیراهن رسمی", tShirt: "تی‌شرت", turtleNeck: "یقه اسکی" },
};

export const TOON_COLOR_NAMES = {
  "2c1b18": "مشکی", "d6b370": "طلایی", "724133": "قهوه‌ای تیره",
  "a55728": "قهوه‌ای", "b58143": "بلوند",
  "5c3829": "تیره", "f1c3a5": "روشن", "a36b4f": "متوسط",
  "c68e7a": "هلویی", "b98e6a": "گندمی",
  "151613": "مشکی", "0b3286": "سرمه‌ای", "545454": "خاکستری",
  "147f3c": "سبز", "f97316": "نارنجی", "ec4899": "صورتی",
  "731ac3": "بنفش", "b11f1f": "قرمز", "e8e9e6": "سفید", "eab308": "زرد",
  "b6e3f4": "آبی روشن", "c0aede": "بنفش روشن", "d1d4f9": "یاسی",
  "ffd5dc": "صورتی روشن", "ffdfbf": "هلویی", "c3e6cb": "سبز روشن",
  "ffeeba": "زرد روشن", "f8d7da": "قرمز روشن", "e2e3e5": "خاکستری روشن",
  "0a0a0a": "مشکی", "1a2744": "آبی تیره", "1a3a1a": "سبز تیره", "2d1b4e": "بنفش تیره",
};

function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) | 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
  };
}

export function randomAvatarOptions(seed = "farsidle") {
  const rng = seededRandom(String(seed));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  return {
    hair: pick(TOON_OPTIONS.hair),
    rearHair: pick(TOON_OPTIONS.rearHair),
    beard: rng() > 0.6 ? pick(TOON_OPTIONS.beard.filter(b => b !== "none")) : "none",
    eyes: pick(TOON_OPTIONS.eyes),
    eyebrows: pick(TOON_OPTIONS.eyebrows),
    mouth: pick(TOON_OPTIONS.mouth),
    clothes: pick(TOON_OPTIONS.clothes),
    hairColor: pick(TOON_OPTIONS.hairColor),
    skinColor: pick(TOON_OPTIONS.skinColor),
    clothesColor: pick(TOON_OPTIONS.clothesColor),
    backgroundColor: pick(TOON_OPTIONS.backgroundColor),
  };
}

export function buildAvatarUrl(options, size = 128) {
  if (!options) return null;
  const params = new URLSearchParams();
  params.set("size", size);
  if (options.hair) params.set("hairVariant", options.hair);
  if (options.rearHair && options.rearHair !== "none") params.set("rearHairVariant", options.rearHair);
  if (options.rearHair === "none") params.set("rearHairProbability", "0");
  if (options.beard && options.beard !== "none") {
    params.set("beardVariant", options.beard);
    params.set("beardProbability", "100");
  } else {
    params.set("beardProbability", "0");
  }
  if (options.eyes) params.set("eyesVariant", options.eyes);
  if (options.eyebrows) params.set("eyebrowsVariant", options.eyebrows);
  if (options.mouth) params.set("mouthVariant", options.mouth);
  if (options.clothes) params.set("clothesVariant", options.clothes);
  if (options.hairColor) params.set("hairColor", options.hairColor);
  if (options.skinColor) params.set("skinColor", options.skinColor);
  if (options.clothesColor) params.set("clothesColor", options.clothesColor);
  if (options.backgroundColor) params.set("backgroundColor", options.backgroundColor);
  return `https://api.dicebear.com/10.x/toon-head/svg?${params.toString()}`;
}

export function parseAvatarOptions(storedAvatar, fallbackSeed = "") {
  if (!storedAvatar) return randomAvatarOptions(fallbackSeed);
  if (typeof storedAvatar === "object") return storedAvatar;
  try {
    const parsed = JSON.parse(storedAvatar);
    if (typeof parsed === "object" && parsed !== null) return parsed;
  } catch (e) { /* old string value */ }
  return randomAvatarOptions(fallbackSeed);
}