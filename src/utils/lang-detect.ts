export function detectLanguage(text: string): "ar" | "en" | "mixed" {
  const ar = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const en = (text.match(/[a-zA-Z]/g) || []).length;
  const ratio = ar / (ar + en + 1);
  if (ratio > 0.5) return "ar";
  if (ratio < 0.15) return "en";
  return "mixed";
}
