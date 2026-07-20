export default function sitemap() {
  const base = "https://farsidle.com";
  const now = new Date();

  return [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/wordle`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/factle`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/colordle`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/mordle`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/moneydle`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/goldle`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];
}