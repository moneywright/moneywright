import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from './app-sidebar'
import { Separator } from '@/components/ui/separator'

interface AppLayoutProps {
  children: React.ReactNode
  title?: string
  description?: string
  /** Hide the header entirely */
  hideHeader?: boolean
}

export function AppLayout({ children, title, description, hideHeader }: AppLayoutProps) {
  const showHeader = !hideHeader && (title || description)

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-[var(--background)]">
        {showHeader && (
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--background)]/95 backdrop-blur-sm px-4">
            <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
            <Separator orientation="vertical" className="mr-2 h-4 bg-[var(--border-subtle)]" />
            <div>
              {title && <h1 className="text-base font-medium">{title}</h1>}
              {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
          </header>
        )}
        <main className="flex-1 overflow-auto p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
