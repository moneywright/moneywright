'use client';

import { useLatestRelease } from '@/hooks/use-latest-release';

const RELEASES_URL = 'https://github.com/moneywright/moneywright/releases/latest';

export function DownloadTable() {
  const { data: downloads } = useLatestRelease();

  const platforms = [
    {
      name: 'macOS (Apple Silicon)',
      description: 'M1, M2, M3, M4 Macs',
      url: downloads?.macos,
    },
    {
      name: 'macOS (Intel)',
      description: 'Older Macs (pre-2020)',
      url: downloads?.macosIntel,
    },
    {
      name: 'Windows',
      description: 'Windows 10/11',
      url: downloads?.windows,
    },
    {
      name: 'Linux (DEB)',
      description: 'Ubuntu, Debian',
      url: downloads?.linux,
    },
  ];

  return (
    <div className="my-4 not-prose">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-fd-muted/50 border-b border-fd-border">
            <tr>
              <th className="text-left py-3 px-4 font-medium">Platform</th>
              <th className="text-left py-3 px-4 font-medium">Download</th>
            </tr>
          </thead>
          <tbody>
            {platforms.map(({ name, description, url }, index) => (
              <tr key={name} className={index > 0 ? 'border-t border-fd-border' : ''}>
                <td className="py-3 px-4">
                  <div className="font-medium">{name}</div>
                  <div className="text-fd-muted-foreground text-xs">{description}</div>
                </td>
                <td className="py-3 px-4">
                  <a
                    href={url || RELEASES_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-fd-primary hover:underline font-medium"
                  >
                    {url ? 'Download' : 'View releases'}
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-fd-muted-foreground mt-3">
        {downloads?.version && <span>Latest version: <strong>{downloads.version}</strong> · </span>}
        <a
          href={downloads?.releasesUrl || RELEASES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-fd-primary hover:underline"
        >
          View all releases →
        </a>
      </p>
    </div>
  );
}
