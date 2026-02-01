import { useEffect, useState, createContext, useContext, type ReactNode } from 'react';
import { useRouter } from '@tanstack/react-router';

const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

// PostHog instance will be loaded dynamically
let posthogInstance: typeof import('posthog-js').default | null = null;

const PostHogContext = createContext<typeof import('posthog-js').default | null>(null);

export function PostHogProvider({ children }: { children: ReactNode }) {
  const [posthog, setPosthog] = useState<typeof import('posthog-js').default | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !POSTHOG_KEY) return;

    // Dynamic import to avoid SSR issues
    import('posthog-js').then((ph) => {
      if (!posthogInstance) {
        ph.default.init(POSTHOG_KEY, {
          api_host: POSTHOG_HOST,
          capture_pageview: false,
          capture_pageleave: true,
          persistence: 'localStorage',
        });
        posthogInstance = ph.default;
      }
      setPosthog(posthogInstance);
    });
  }, []);

  return (
    <PostHogContext.Provider value={posthog}>
      {children}
    </PostHogContext.Provider>
  );
}

export function PostHogPageView() {
  const router = useRouter();
  const posthog = useContext(PostHogContext);

  useEffect(() => {
    if (!posthog) return;

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
  }, [router, posthog]);

  return null;
}

// Analytics event helpers
export const analytics = {
  track: (event: string, properties?: Record<string, unknown>) => {
    if (typeof window !== 'undefined' && posthogInstance) {
      posthogInstance.capture(event, properties);
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
