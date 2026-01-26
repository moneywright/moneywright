import { useQuery } from '@tanstack/react-query';

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
  linuxDeb: string | null;
  releasesUrl: string;
  version: string | null;
}

const GITHUB_API = 'https://api.github.com/repos/moneywright/moneywright/releases/latest';
const RELEASES_URL = 'https://github.com/moneywright/moneywright/releases';

function parseAssets(assets: ReleaseAsset[]): Omit<PlatformDownloads, 'releasesUrl' | 'version'> {
  let macos: string | null = null;
  let macosIntel: string | null = null;
  let windows: string | null = null;
  let linux: string | null = null;
  let linuxDeb: string | null = null;

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
    // Linux AppImage
    else if (name.endsWith('.appimage')) {
      linux = asset.browser_download_url;
    }
    // Linux DEB
    else if (name.endsWith('.deb')) {
      linuxDeb = asset.browser_download_url;
    }
  }

  return { macos, macosIntel, windows, linux, linuxDeb };
}

async function fetchLatestRelease(): Promise<PlatformDownloads> {
  const response = await fetch(GITHUB_API, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch release');
  }

  const release: Release = await response.json();
  const assets = parseAssets(release.assets);

  return {
    ...assets,
    releasesUrl: release.html_url || RELEASES_URL,
    version: release.tag_name,
  };
}

export function useLatestRelease() {
  return useQuery({
    queryKey: ['github-release', 'latest'],
    queryFn: fetchLatestRelease,
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    retry: 2,
    placeholderData: {
      macos: null,
      macosIntel: null,
      windows: null,
      linux: null,
      linuxDeb: null,
      releasesUrl: RELEASES_URL,
      version: null,
    },
  });
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
      return downloads.linux || downloads.linuxDeb || downloads.releasesUrl;
    default:
      return downloads.releasesUrl;
  }
}
