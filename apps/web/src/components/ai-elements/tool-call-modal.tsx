import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'
import { CodeBlockContainer, CodeBlockContent } from '@/components/ai-elements/code-block'

interface ToolCallModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  toolName: string
  args: unknown
  result: unknown
}

function JsonCodeBlock({ data }: { data: unknown }) {
  const [copied, setCopied] = useState(false)
  const jsonString = JSON.stringify(data, null, 2)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative w-full h-[350px] overflow-hidden rounded-md border bg-background">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 z-10 h-7 w-7 bg-background/50 hover:bg-background/80"
        onClick={handleCopy}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </Button>
      <div className="h-full w-full overflow-auto p-4 [&_pre]:!whitespace-pre-wrap [&_pre]:!break-words [&_pre]:!overflow-x-hidden [&_code]:!whitespace-pre-wrap [&_code]:!break-words [&_.shiki]:!overflow-x-hidden">
        <CodeBlockContent code={jsonString} language="json" showLineNumbers={false} />
      </div>
    </div>
  )
}

export function ToolCallModal({ open, onOpenChange, toolName, args, result }: ToolCallModalProps) {
  const hasResult = result !== undefined && result !== null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm font-medium">{toolName}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="input" className="w-full min-h-0 flex-1 flex flex-col">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="input">Input</TabsTrigger>
            <TabsTrigger value="output" disabled={!hasResult}>
              Output {!hasResult && '(pending)'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="input" className="mt-4 min-h-0 flex-1">
            <JsonCodeBlock data={args} />
          </TabsContent>

          <TabsContent value="output" className="mt-4 min-h-0 flex-1">
            {hasResult ? (
              <JsonCodeBlock data={result} />
            ) : (
              <CodeBlockContainer
                language="json"
                className="h-[350px] flex items-center justify-center"
              >
                <span className="text-muted-foreground text-sm">Waiting for result...</span>
              </CodeBlockContainer>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
