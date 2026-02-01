import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from '@tanstack/react-router';
import type * as React from 'react';
import appCss from '@/styles/app.css?url';
import { RootProvider } from 'fumadocs-ui/provider/tanstack';
import { PostHogProvider, PostHogPageView } from '@/lib/analytics';

const SITE_URL = 'https://moneywright.com';

// JSON-LD structured data for Organization
const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Moneywright',
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  description: 'Privacy-first personal finance manager. Self-hostable and open source.',
  sameAs: ['https://github.com/moneywright/moneywright'],
};

// JSON-LD structured data for WebSite (enables sitelinks search box)
const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Moneywright',
  url: SITE_URL,
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/docs?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

// JSON-LD structured data for SoftwareApplication
const softwareSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Moneywright',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'macOS, Windows, Linux',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  description:
    'Privacy-first personal finance manager. Upload any bank statement, track expenses and investments, get AI-powered insights.',
  featureList: [
    'Bank statement parsing',
    'Expense tracking',
    'Investment portfolio management',
    'AI-powered financial insights',
    'Self-hostable',
    'Open source',
  ],
};

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Moneywright - Private, AI-Powered Personal Finance',
      },
      {
        name: 'description',
        content:
          'Privacy-first personal finance manager. Upload any bank statement, track expenses and investments, get AI-powered insights. Self-hostable and open source.',
      },
      {
        name: 'theme-color',
        content: '#0a0a0b',
      },
      // Open Graph
      {
        property: 'og:title',
        content: 'Moneywright - Private, AI-Powered Personal Finance',
      },
      {
        property: 'og:description',
        content:
          'Privacy-first personal finance manager. Upload any bank statement, track expenses and investments, get AI-powered insights. Self-hostable and open source.',
      },
      {
        property: 'og:image',
        content: `${SITE_URL}/og.png`,
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:site_name',
        content: 'Moneywright',
      },
      {
        property: 'og:url',
        content: SITE_URL,
      },
      // Twitter Card
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        name: 'twitter:title',
        content: 'Moneywright - Private, AI-Powered Personal Finance',
      },
      {
        name: 'twitter:description',
        content:
          'Privacy-first personal finance manager. Upload any bank statement, track expenses and investments, get AI-powered insights. Self-hostable and open source.',
      },
      {
        name: 'twitter:image',
        content: `${SITE_URL}/og.png`,
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.ico', type: 'image/x-icon' },
    ],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify(organizationSchema),
      },
      {
        type: 'application/ld+json',
        children: JSON.stringify(websiteSchema),
      },
      {
        type: 'application/ld+json',
        children: JSON.stringify(softwareSchema),
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function CanonicalLink() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const canonicalUrl = `${SITE_URL}${pathname === '/' ? '' : pathname}`;

  return <link rel="canonical" href={canonicalUrl} />;
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning lang="en">
      <head>
        <HeadContent />
        <CanonicalLink />
      </head>
      <body className="flex flex-col min-h-screen">
        <PostHogProvider>
          <RootProvider>
            <PostHogPageView />
            {children}
          </RootProvider>
        </PostHogProvider>
        <Scripts />
      </body>
    </html>
  );
}
