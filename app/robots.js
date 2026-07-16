export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/profile", "/reset-password"],
    },
    sitemap: "https://farsidle.com/sitemap.xml",
  };
}
