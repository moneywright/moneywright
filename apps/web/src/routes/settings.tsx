/**
 * Settings page - Manage AI providers, profiles, and account
 */

import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks'
import { getLLMSettings, getLLMProviders, getProfiles, getUserSessions } from '@/lib/api'
import { AppLayout } from '@/components/domain/app-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Loader2 } from 'lucide-react'

import {
  AIProvidersSection,
  ProfilesSection,
  AccountSection,
  SessionsSection,
  DangerZoneSection,
  AboutSection,
} from '@/components/settings'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const { user, logout, authEnabled } = useAuth()

  // LLM Settings queries
  const { data: llmSettings, isLoading: llmLoading } = useQuery({
    queryKey: ['llm-settings'],
    queryFn: getLLMSettings,
  })

  const { data: providers } = useQuery({
    queryKey: ['llm-providers'],
    queryFn: getLLMProviders,
  })

  // Profiles query
  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: getProfiles,
  })

  // Sessions query
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: getUserSessions,
    enabled: authEnabled,
  })

  const isLoading = llmLoading || profilesLoading

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <PageHeader title="Settings" description="Manage your AI providers, profiles, and account" />

      <div className="max-w-4xl space-y-6">
        {/* AI Providers Section */}
        <AIProvidersSection settings={llmSettings} providers={providers} />

        {/* Profiles Section */}
        <ProfilesSection profiles={profiles} />

        {/* Account Section - only show when auth is enabled */}
        {authEnabled && <AccountSection user={user} />}

        {/* Sessions - only show when auth is enabled */}
        {authEnabled && <SessionsSection sessions={sessions} isLoading={sessionsLoading} />}

        {/* Danger Zone - only show when auth is enabled */}
        {authEnabled && <DangerZoneSection onLogout={logout} />}

        {/* About Section */}
        <AboutSection />
      </div>
    </AppLayout>
  )
}
