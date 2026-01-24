/**
 * Message content components for chat
 */

import { useState } from 'react'
import { MessageResponse } from '@/components/ai-elements/message'
import { QueryDataTable } from '@/components/ai-elements/query-data-table'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseContentWithDataTables } from './utils'

/**
 * Component to render content with data tables
 */
export function MessageContentWithDataTables({ content }: { content: string }) {
  const parts = parseContentWithDataTables(content)

  return (
    <>
      {parts.map((part, index) => {
        if (part.type === 'data-table') {
          return <QueryDataTable key={`table-${index}`} queryId={part.queryId} className="my-4" />
        }
        return <MessageResponse key={`text-${index}`}>{part.content}</MessageResponse>
      })}
    </>
  )
}

/**
 * Collapsible reasoning component
 */
export function ReasoningCollapsible({
  label,
  content,
  isActive: _isActive,
}: {
  label: string
  content: string
  isActive: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
        <span>{label}</span>
        <ChevronDown
          className={cn('size-3.5 transition-transform', isOpen ? 'rotate-180' : 'rotate-0')}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
        <MessageResponse>{content}</MessageResponse>
      </CollapsibleContent>
    </Collapsible>
  )
}
