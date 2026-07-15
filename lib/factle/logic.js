export const MAX_TRIES = 6;

// Loose normalization so trivial typing differences (آ vs ا, extra
// spaces, ZWNJ) don't block an otherwise-correct guess when matched
// against the picked country from the autocomplete list.
export function normalizeCountryName(str) {
  return String(str)
    .trim()
    .replace(/\u200c/g, " ") // ZWNJ -> space
    .replace(/آ/g, "ا")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ");
}

export function countriesMatch(a, b) {
  return normalizeCountryName(a) === normalizeCountryName(b);
}
