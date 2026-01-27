import { useState } from 'react'
import {
  TrendingUp,
  MoreVertical,
  Trash2,
  Clock,
  XCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import type { InvestmentSource, Statement, Profile } from '@/lib/api'
import { ProfileBadge } from '@/components/ui/profile-badge'

interface InvestmentSourceCardProps {
  source: InvestmentSource
  countryCode: string
  statement?: Statement
  onDelete: () => void
  /** Profiles list for showing profile badge in family view */
  profiles?: Profile[]
  /** Whether to show profile badge (family view mode) */
  showProfileBadge?: boolean
}

export function InvestmentSourceCard({
  source,
  countryCode,
  statement,
  onDelete,
  profiles,
  showProfileBadge,
}: InvestmentSourceCardProps) {
  const [logoError, setLogoError] = useState(false)

  const logoPath = source.sourceType
    ? `/institutions/${countryCode}/${source.sourceType}.svg`
    : null

  const isProcessing = statement?.status === 'parsing' || statement?.status === 'pending'
  const isFailed = statement?.status === 'failed'

  const displayName =
    source.sourceName ||
    source.sourceType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  const lastUpdated = source.lastStatementDate
    ? new Date(source.lastStatementDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  const maskedIdentifier = source.accountIdentifier
    ? source.accountIdentifier.length > 4
      ? `••••${source.accountIdentifier.slice(-4)}`
      : source.accountIdentifier
    : null

  // Processing or failed state
  if (isProcessing || isFailed) {
    return (
      <div
        className={cn(
          'relative rounded-2xl p-5 overflow-hidden',
          isFailed
            ? 'bg-linear-to-br from-red-50 via-red-50/50 to-zinc-100 dark:bg-linear-to-br dark:from-red-950/30 dark:via-zinc-900 dark:to-zinc-900 border-2 border-dashed border-red-300 dark:border-red-700'
            : 'bg-linear-to-br from-emerald-50 via-emerald-50/50 to-zinc-100 dark:bg-linear-to-br dark:from-emerald-950/30 dark:via-zinc-900 dark:to-zinc-900 border-2 border-dashed border-emerald-300 dark:border-emerald-700',
          'shadow-[4px_4px_10px_rgba(0,0,0,0.1),-4px_-4px_10px_rgba(255,255,255,0.9)]',
          'dark:shadow-[4px_4px_12px_rgba(0,0,0,0.5)]'
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
              isFailed ? 'bg-red-100 dark:bg-red-900/50' : 'bg-emerald-100 dark:bg-emerald-900/50'
            )}
          >
            {isFailed ? (
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            ) : (
              <Clock className="h-5 w-5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3
              className={cn(
                'font-semibold text-sm',
                isFailed
                  ? 'text-red-700 dark:text-red-300'
                  : 'text-emerald-700 dark:text-emerald-300'
              )}
            >
              {isFailed ? 'Parsing Failed' : 'Processing Investment Statement'}
            </h3>
            <p
              className={cn(
                'text-xs truncate',
                isFailed
                  ? 'text-red-600/70 dark:text-red-400/70'
                  : 'text-emerald-600/70 dark:text-emerald-400/70'
              )}
            >
              {displayName}
            </p>
          </div>
        </div>

        <div className="mt-4">
          {isFailed ? (
            <p className="text-xs text-red-600/80 dark:text-red-400/80">
              {statement?.errorMessage || 'Failed to parse the investment statement.'}
            </p>
          ) : (
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">
              Extracting holdings from your statement. This may take a minute.
            </p>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isProcessing && !isFailed ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-emerald-500" />
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  {statement?.status === 'parsing' ? 'Parsing...' : 'Awaiting processing...'}
                </span>
              </>
            ) : isFailed ? (
              <>
                <AlertTriangle className="h-3 w-3 text-red-500" />
                <span className="text-xs text-red-600 dark:text-red-400">Parsing failed</span>
              </>
            ) : null}
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-8 px-3 text-xs',
                  isFailed
                    ? 'text-red-600 hover:text-red-700 hover:bg-red-100 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/50'
                    : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:text-emerald-300 dark:hover:bg-emerald-900/50'
                )}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Investment Source?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete this investment source and all associated holdings and snapshots.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={onDelete}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative rounded-2xl p-5 overflow-hidden transition-all duration-300 hover:scale-[1.02]',
        'bg-linear-to-br from-emerald-50 via-white to-zinc-100',
        'dark:bg-linear-to-br dark:from-emerald-950/20 dark:via-zinc-800 dark:to-zinc-900',
        'shadow-[4px_4px_10px_rgba(0,0,0,0.1),-4px_-4px_10px_rgba(255,255,255,0.9)]',
        'dark:shadow-[4px_4px_12px_rgba(0,0,0,0.5)]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {logoPath && !logoError ? (
            <img
              src={logoPath}
              alt={source.sourceType}
              className="h-10 w-10 object-contain shrink-0"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-emerald-100/50 dark:bg-emerald-900/30 shrink-0">
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-zinc-800 dark:text-zinc-100 truncate text-sm">
                {displayName}
              </h3>
              {showProfileBadge && profiles && (
                <ProfileBadge profileId={source.profileId} profiles={profiles} />
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              {source.sourceType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {maskedIdentifier && (
            <span className="text-sm font-mono font-medium text-zinc-600 dark:text-zinc-300">
              {maskedIdentifier}
            </span>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    className="text-destructive"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Investment Source?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete all holdings, snapshots, and statements associated with this
                      source. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={onDelete}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          {lastUpdated ? `Last updated ${lastUpdated}` : 'Not synced yet'}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Active</span>
        </div>
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {source.currency}
        </span>
      </div>
    </div>
  )
}
