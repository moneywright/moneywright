import { useEffect } from 'react';
import { useRouter } from '@tanstack/react-router';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';

const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

// Initialize PostHog only on client side
if (typeof window !== 'undefined' && POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false, // We'll capture manually on route changes
    capture_pageleave: true,
    persistence: 'localStorage',
  });
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!POSTHOG_KEY) {
    return <>{children}</>;
  }

  return <PHProvider client={posthog}>{children}</PHProvider>;
}

export function PostHogPageView() {
  const router = useRouter();

  useEffect(() => {
    if (!POSTHOG_KEY) return;

    // Capture initial page view
    posthog.capture('$pageview', {
      $current_url: window.location.href,
    });

    // Subscribe to route changes
    const unsubscribe = router.subscribe('onResolved', () => {
      posthog.capture('$pageview', {
        $current_url: window.location.href,
      });
    });

    return () => {
      unsubscribe();
    };
  }, [router]);

  return null;
}

// Analytics event helpers
export const analytics = {
  track: (event: string, properties?: Record<string, unknown>) => {
    if (typeof window !== 'undefined' && POSTHOG_KEY) {
      posthog.capture(event, properties);
    }
  },

  trackDownload: (platform: string, version?: string | null) => {
    analytics.track('download_clicked', {
      platform,
      version: version ?? undefined,
      source: 'docs',
    });
  },

  trackDocsNavigation: (page: string) => {
    analytics.track('docs_navigation', {
      page,
    });
  },

  trackCTAClick: (ctaName: string, location: string) => {
    analytics.track('cta_clicked', {
      cta_name: ctaName,
      location,
    });
  },
};

export { posthog };
