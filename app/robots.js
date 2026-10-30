export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/profile', '/login', '/register', '/reset-password', '/forgot-password'],
    },
    sitemap: 'https://farsidle.com/sitemap.xml',
  };
}
