import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://neopat-tracker.vercel.app';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/manifest.json', '/icon.svg', '/opengraph-image'],
        disallow: ['/api/', '/api/*', '/settings', '/search'],
      },
      {
        userAgent: 'Googlebot',
        allow: ['/', '/login', '/manifest.json', '/icon.svg', '/opengraph-image'],
        disallow: ['/api/', '/api/*', '/settings', '/search'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
