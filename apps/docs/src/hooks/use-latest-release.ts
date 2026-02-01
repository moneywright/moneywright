import { useState, useEffect } from 'react';

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface Release {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
  assets: ReleaseAsset[];
}

export interface PlatformDownloads {
  macos: string | null;
  macosIntel: string | null;
  windows: string | null;
  linux: string | null;
  releasesUrl: string;
  version: string | null;
}

const GITHUB_API = 'https://api.github.com/repos/moneywright/moneywright/releases/latest';
const RELEASES_URL = 'https://github.com/moneywright/moneywright/releases';

const DEFAULT_DATA: PlatformDownloads = {
  macos: null,
  macosIntel: null,
  windows: null,
  linux: null,
  releasesUrl: RELEASES_URL,
  version: null,
};

function parseAssets(assets: ReleaseAsset[]): Omit<PlatformDownloads, 'releasesUrl' | 'version'> {
  let macos: string | null = null;
  let macosIntel: string | null = null;
  let windows: string | null = null;
  let linux: string | null = null;

  for (const asset of assets) {
    const name = asset.name.toLowerCase();

    // macOS ARM64 (.dmg with aarch64)
    if (name.endsWith('.dmg') && name.includes('aarch64')) {
      macos = asset.browser_download_url;
    }
    // macOS Intel (.dmg with x64)
    else if (name.endsWith('.dmg') && name.includes('x64')) {
      macosIntel = asset.browser_download_url;
    }
    // Windows (.exe)
    else if (name.endsWith('.exe') && !name.endsWith('.exe.sig')) {
      windows = asset.browser_download_url;
    }
    // Linux DEB
    else if (name.endsWith('.deb')) {
      linux = asset.browser_download_url;
    }
  }

  return { macos, macosIntel, windows, linux };
}

export function useLatestRelease() {
  const [data, setData] = useState<PlatformDownloads>(DEFAULT_DATA);

  useEffect(() => {
    // Only fetch on client side
    if (typeof window === 'undefined') return;

    let cancelled = false;

    async function fetchRelease() {
      try {
        const response = await fetch(GITHUB_API, {
          headers: {
            Accept: 'application/vnd.github.v3+json',
          },
        });

        if (!response.ok) return;

        const release: Release = await response.json();
        const assets = parseAssets(release.assets);

        if (!cancelled) {
          setData({
            ...assets,
            releasesUrl: release.html_url || RELEASES_URL,
            version: release.tag_name,
          });
        }
      } catch {
        // Silently fail, keep default data
      }
    }

    fetchRelease();

    return () => {
      cancelled = true;
    };
  }, []);

  return { data };
}

export function getDownloadUrl(
  downloads: PlatformDownloads,
  platform: 'macos' | 'windows' | 'linux'
): string {
  switch (platform) {
    case 'macos':
      return downloads.macos || downloads.macosIntel || downloads.releasesUrl;
    case 'windows':
      return downloads.windows || downloads.releasesUrl;
    case 'linux':
      return downloads.linux || downloads.releasesUrl;
    default:
      return downloads.releasesUrl;
  }
}
