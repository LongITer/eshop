import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  return { rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/profile', '/inbox', '/checkout', '/order/', '/notifications'] }, sitemap: `${origin}/sitemap.xml` };
}
