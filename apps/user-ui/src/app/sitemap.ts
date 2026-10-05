import type { MetadataRoute } from 'next';
export const dynamic = 'force-dynamic';
const origin = () => (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
const api = () => process.env.GATEWAY_INTERNAL_URL || process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8080';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = ['', '/products', '/shop', '/offers'].map(path => ({ url: `${origin()}${path}`, changeFrequency: 'daily' }));
  for (let page = 0; ; page++) {
    const response = await fetch(`${api()}/product/api/sitemap-data?page=${page}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Sitemap source unavailable');
    const data = await response.json();
    entries.push(...data.entries.map((entry: any) => ({ url: `${origin()}${entry.path}`, lastModified: new Date(entry.updatedAt), changeFrequency: 'weekly' as const })));
    if (!data.hasMore) break;
    if (entries.length > 49000) throw new Error('Sitemap exceeds single-file limit; configure sitemap shards');
  }
  return entries;
}
