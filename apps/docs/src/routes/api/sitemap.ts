import { createFileRoute } from '@tanstack/react-router';
import { source } from '@/lib/source';

const SITE_URL = 'https://moneywright.com';

function generateSitemap(): string {
  const pages = source.getPages();
  const now = new Date().toISOString().split('T')[0];

  const urls: { loc: string; priority: string; changefreq: string }[] = [
    // Landing page - highest priority
    { loc: SITE_URL, priority: '1.0', changefreq: 'weekly' },
  ];

  // Add all documentation pages
  for (const page of pages) {
    urls.push({
      loc: `${SITE_URL}${page.url}`,
      priority: page.url === '/docs' ? '0.9' : '0.8',
      changefreq: 'weekly',
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return xml;
}

export const Route = createFileRoute('/api/sitemap')({
  server: {
    handlers: {
      GET: async () => {
        const sitemap = generateSitemap();
        return new Response(sitemap, {
          headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
          },
        });
      },
    },
  },
});
