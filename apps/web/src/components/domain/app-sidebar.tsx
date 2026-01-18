import { useNavigate, useLocation } from '@tanstack/react-router'
import { useAuthContext } from '@/routes/__root'
import { useTheme } from '@/hooks/useTheme'
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
  ChevronDown,
  LogOut,
  Moon,
  Sun,
  Check,
  Cpu,
} from 'lucide-react'

const navItems = [
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

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Moneywright" className="h-8 w-8" />
          <span className="text-xl font-semibold">Moneywright</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => !item.disabled && navigate({ to: item.href })}
                      disabled={item.disabled}
                      className={`h-10 ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''} ${isActive ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : ''}`}
                    >
                      <item.icon className="h-5 w-5" />
                      <span className="text-[15px]">{item.title}</span>
                      {item.disabled && (
                        <span className="ml-auto text-[10px] text-muted-foreground">Soon</span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-2 pb-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="h-auto py-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user?.picture || undefined} alt={user?.name || 'User'} />
                    <AvatarFallback className="text-sm">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-left">
                    <span className="text-sm font-medium truncate max-w-[140px]">
                      {user?.name || 'Local User'}
                    </span>
                    <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                      {user?.email || 'No authentication'}
                    </span>
                  </div>
                  <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-[--radix-popper-anchor-width]">
                <DropdownMenuItem onClick={() => setTheme(isDark ? 'light' : 'dark')}>
                  {isDark ? <Moon className="mr-2 h-4 w-4" /> : <Sun className="mr-2 h-4 w-4" />}
                  Dark Mode
                  {isDark && <Check className="ml-auto h-4 w-4 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: '/settings' })}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                {authEnabled && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => logout()}
                      className="text-destructive focus:text-destructive"
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
