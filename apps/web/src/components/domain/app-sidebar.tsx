import { useNavigate, useLocation } from '@tanstack/react-router'
import { useAuth, useUpdateChecker } from '@/hooks'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  LayoutDashboard,
  FileText,
  Wallet,
  Building2,
  TrendingUp,
  MessageSquare,
  Settings,
  ChevronUp,
  LogOut,
  Moon,
  Sun,
  Check,
  Repeat,
  Shield,
  Landmark,
  Download,
  X,
} from 'lucide-react'

// Main navigation items
const mainNavItems = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    href: '/',
  },
  {
    title: 'Ask Penny',
    icon: MessageSquare,
    href: '/chat',
  },
  {
    title: 'Accounts',
    icon: Building2,
    href: '/accounts',
  },
  {
    title: 'Statements',
    icon: FileText,
    href: '/statements',
  },
  {
    title: 'Transactions',
    icon: Wallet,
    href: '/transactions',
  },
  {
    title: 'Subscriptions',
    icon: Repeat,
    href: '/subscriptions',
  },
  {
    title: 'Investments',
    icon: TrendingUp,
    href: '/investments',
  },
  {
    title: 'Insurance',
    icon: Shield,
    href: '/insurance',
  },
  {
    title: 'Loans',
    icon: Landmark,
    href: '/loans',
  },
]

// Settings items
const settingsNavItems = [
  {
    title: 'Settings',
    icon: Settings,
    href: '/settings',
  },
]

export function AppSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, authEnabled, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const { updateAvailable, isReady, restartToUpdate, dismissUpdate } = useUpdateChecker()

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || 'U'

  const isDark = theme === 'dark'

  const renderNavItem = (item: (typeof mainNavItems)[0] & { disabled?: boolean }) => {
    const isActive = location.pathname === item.href
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton
          onClick={() => !item.disabled && navigate({ to: item.href })}
          disabled={item.disabled}
          className={cn(
            'relative h-10 transition-all duration-200',
            item.disabled && 'opacity-40 cursor-not-allowed',
            isActive && 'text-foreground font-medium',
            !isActive &&
              !item.disabled &&
              'text-muted-foreground hover:text-foreground hover:bg-surface-hover'
          )}
        >
          {/* Active indicator bar */}
          {isActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.75 h-5 rounded-r-full bg-primary" />
          )}
          <item.icon className={cn('h-4.5 w-4.5', isActive && 'text-primary')} />
          <span className="text-sm">{item.title}</span>
          {item.disabled && (
            <span className="ml-auto px-1.5 py-0.5 text-[10px] font-medium rounded bg-muted text-muted-foreground">
              Soon
            </span>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <Sidebar className="border-r border-(--border-subtle)">
      {/* Logo Header */}
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full" />
            <img src="/logo.png" alt="Moneywright" className="relative h-8 w-8" />
          </div>
          <span className="text-lg font-semibold font-display tracking-tight">Moneywright</span>
        </div>
      </SidebarHeader>

      <SidebarSeparator className="mx-0 w-full bg-(--border-subtle)" />

      <SidebarContent className="px-2 py-2">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">{mainNavItems.map(renderNavItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Settings */}
        <SidebarGroup className="mt-4">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">{settingsNavItems.map(renderNavItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Update Ready Banner - only shown when update is downloaded and ready for restart */}
      {updateAvailable && isReady && (
        <div className="mx-2 mb-2">
          <div className="group relative overflow-hidden rounded-xl bg-gradient-to-b from-zinc-800/90 to-zinc-900/95 p-3 shadow-lg shadow-black/20 ring-1 ring-white/[0.08] backdrop-blur-sm">
            {/* Subtle shimmer effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />

            {/* Accent line at top */}
            <div className="absolute top-0 left-3 right-3 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />

            {/* Dismiss button */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                dismissUpdate()
              }}
              className="absolute top-2 right-2 z-10 p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] active:bg-white/[0.08] transition-all duration-150 cursor-pointer"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="relative flex items-center gap-3 pr-6">
              {/* Icon */}
              <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
                <Download className="h-4 w-4 text-emerald-400" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-medium text-zinc-200">Update Ready</p>
                  <span className="px-1.5 py-0.5 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 rounded">
                    v{updateAvailable.new_version}
                  </span>
                </div>
                <button
                  onClick={restartToUpdate}
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-emerald-400 transition-colors duration-200 group/btn cursor-pointer"
                >
                  <span>Restart to install</span>
                  <svg
                    className="h-3 w-3 transition-transform duration-200 group-hover/btn:translate-x-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SidebarSeparator className="mx-0 w-full bg-(--border-subtle)" />

      {/* Footer */}
      <SidebarFooter className="px-2 py-3">
        {authEnabled ? (
          /* User dropdown when auth is enabled */
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton className="h-auto py-2.5 px-2 hover:bg-surface-hover transition-colors">
                    <Avatar className="h-9 w-9 border border-(--border-subtle)">
                      <AvatarImage src={user?.picture || undefined} alt={user?.name || 'User'} />
                      <AvatarFallback className="text-xs bg-surface-elevated">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start text-left flex-1 min-w-0">
                      <span className="text-sm font-medium truncate w-full">
                        {user?.name || 'User'}
                      </span>
                      <span className="text-xs text-muted-foreground truncate w-full">
                        {user?.email}
                      </span>
                    </div>
                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  className="w-[--radix-popper-anchor-width] mb-1"
                  align="start"
                >
                  <DropdownMenuItem
                    onClick={() => setTheme(isDark ? 'light' : 'dark')}
                    className="cursor-pointer"
                  >
                    {isDark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                    {isDark ? 'Light Mode' : 'Dark Mode'}
                    {isDark && <Check className="ml-auto h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => navigate({ to: '/settings' })}
                    className="cursor-pointer"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => logout()}
                    className="text-destructive focus:text-destructive cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : (
          /* Simple theme switch when auth is disabled */
          <div className="flex items-center justify-between px-3 py-2">
            <Label
              htmlFor="theme-switch"
              className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer"
            >
              {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              Dark Mode
            </Label>
            <Switch
              id="theme-switch"
              checked={isDark}
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
