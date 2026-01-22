import { useNavigate, useLocation } from '@tanstack/react-router'
import { useAuthContext } from '@/routes/__root'
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
import {
  LayoutDashboard,
  FileText,
  Wallet,
  Building2,
  TrendingUp,
  PieChart,
  MessageSquare,
  Settings,
  ChevronUp,
  LogOut,
  Moon,
  Sun,
  Check,
  Cpu,
} from 'lucide-react'

// Main navigation items
const mainNavItems = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    href: '/',
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
    title: 'Investments',
    icon: TrendingUp,
    href: '/investments',
  },
]

// Upcoming features
const upcomingNavItems = [
  {
    title: 'Analytics',
    icon: PieChart,
    href: '/analytics',
    disabled: true,
  },
  {
    title: 'AI Chat',
    icon: MessageSquare,
    href: '/chat',
    disabled: true,
  },
]

// Settings items
const settingsNavItems = [
  {
    title: 'LLM Settings',
    icon: Cpu,
    href: '/settings/llm',
  },
  {
    title: 'Settings',
    icon: Settings,
    href: '/settings',
  },
]

export function AppSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, authEnabled, logout } = useAuthContext()
  const { theme, setTheme } = useTheme()

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

      <SidebarSeparator className="mx-4 bg-(--border-subtle)" />

      <SidebarContent className="px-2 py-2">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">{mainNavItems.map(renderNavItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Upcoming Features */}
        <SidebarGroup className="mt-4">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">{upcomingNavItems.map(renderNavItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Settings */}
        <SidebarGroup className="mt-4">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">{settingsNavItems.map(renderNavItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator className="mx-4 bg-(--border-subtle)" />

      {/* User Footer */}
      <SidebarFooter className="px-2 py-3">
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
                      {user?.name || 'Local User'}
                    </span>
                    <span className="text-xs text-muted-foreground truncate w-full">
                      {user?.email || 'No authentication'}
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
                {authEnabled && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => logout()}
                      className="text-destructive focus:text-destructive cursor-pointer"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
