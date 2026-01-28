/**
 * About section component - displays app version and links
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Info, Github, Globe, FileText } from 'lucide-react'

// Get app version - returns build-time version or 'dev' in development
function getVersion(): string {
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
}

export function AboutSection() {
  return (
    <Card className="border-border-subtle hover:border-border-hover transition-colors animate-fade-in">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          About
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-elevated p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-card border border-border-subtle">
              <Info className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Version</p>
              <p className="truncate text-sm font-medium">v{getVersion()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-elevated p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-card border border-border-subtle">
              <Github className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Source</p>
              <a
                href="https://github.com/moneywright/moneywright"
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-sm font-medium text-primary hover:underline"
              >
                GitHub
              </a>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-elevated p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-card border border-border-subtle">
              <Globe className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Website</p>
              <a
                href="https://moneywright.com"
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-sm font-medium text-primary hover:underline"
              >
                moneywright.com
              </a>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-elevated p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-card border border-border-subtle">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Documentation
              </p>
              <a
                href="https://moneywright.com/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-sm font-medium text-primary hover:underline"
              >
                Docs
              </a>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
