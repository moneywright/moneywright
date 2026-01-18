import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from './app-sidebar'
import { Separator } from '@/components/ui/separator'

interface AppLayoutProps {
  children: React.ReactNode
  title?: string
  description?: string
}

export function AppLayout({ children, title, description }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {(title || description) && (
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div>
              {title && <h1 className="text-lg font-semibold">{title}</h1>}
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
          </header>
        )}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
