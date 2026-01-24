/**
 * Conversation history sidebar component
 */

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { MessageSquare, History, Trash2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from './utils'
import type { ChatConversation } from '@/lib/api'

interface ConversationHistoryProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversations: ChatConversation[] | undefined
  isLoading: boolean
  currentConversationId: string | undefined
  onSelectConversation: (id: string) => void
  onDeleteConversation: (id: string, e: React.MouseEvent) => void
}

export function ConversationHistory({
  open,
  onOpenChange,
  conversations,
  isLoading,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
}: ConversationHistoryProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon">
          <History className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80">
        <SheetHeader>
          <SheetTitle>Chat History</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : conversations?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No conversations yet</p>
          ) : (
            conversations?.map((conv) => (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={cn(
                  'group flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors',
                  conv.id === currentConversationId ? 'bg-primary/10' : 'hover:bg-muted'
                )}
              >
                <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{conv.title || 'New conversation'}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(conv.updatedAt)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => onDeleteConversation(conv.id, e)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
