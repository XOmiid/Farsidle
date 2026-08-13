export default function sitemap() {
  const base = "https://farsidle.com";
  const now = new Date();

  return [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/wordle`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/factle`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/colordle`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/chordle`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/memorydle`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/crossword`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/store`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/teamdle`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
  ];
}