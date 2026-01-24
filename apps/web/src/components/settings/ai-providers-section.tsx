/**
 * AI Providers section component
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProviderCard } from './provider-card'
import { PROVIDER_ORDER, type LLMSettings, type LLMProviders } from './types'

interface AIProvidersSectionProps {
  settings: LLMSettings | undefined
  providers: LLMProviders | undefined
}

export function AIProvidersSection({ settings, providers }: AIProvidersSectionProps) {
  const configuredCount = providers?.filter((p) => p.isConfigured).length || 0

  return (
    <Card className="border-border-subtle hover:border-border-hover transition-colors animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            AI Providers
          </CardTitle>
          {configuredCount > 0 && (
            <span className="text-xs text-muted-foreground">{configuredCount} configured</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PROVIDER_ORDER.map((code) => (
            <ProviderCard key={code} code={code} settings={settings} providers={providers} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
