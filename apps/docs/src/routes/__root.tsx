import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import appCss from '@/styles/app.css?url';
import { RootProvider } from 'fumadocs-ui/provider/tanstack';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

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
        content: 'https://moneywright.com/og.png',
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:site_name',
        content: 'Moneywright',
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
        content: 'https://moneywright.com/og.png',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.ico', type: 'image/x-icon' },
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

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="flex flex-col min-h-screen">
        <QueryClientProvider client={queryClient}>
          <RootProvider>{children}</RootProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
