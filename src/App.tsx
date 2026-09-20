import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppStoreProvider } from '@/store/app-store'
import { AppShell } from '@/components/layout/app-shell'
import { ToastViewport } from '@/components/layout/toasts'
import { LoginPage } from '@/pages/login'
import { SetupPage } from '@/pages/setup'
import { HomePage } from '@/pages/home'
import { AskPage } from '@/pages/ask'
import { BrainPage } from '@/pages/brain'
import { MemoryDetailPage } from '@/pages/memory-detail'
import { PeoplePage } from '@/pages/people'
import { EmployeeDetailPage } from '@/pages/employee-detail'
import { RolesPage } from '@/pages/roles'
import { RoleBrainPage } from '@/pages/role-brain'
import { SourcesPage } from '@/pages/sources'
import { NewSourcePage } from '@/pages/source-new'
import { KnowledgeRiskPage } from '@/pages/knowledge-risk'
import { HandoversPage } from '@/pages/handovers'
import { NewHandoverPage } from '@/pages/handover-new'
import { HandoverDetailPage } from '@/pages/handover-detail'
import { InterviewPage } from '@/pages/interview'
import { OnboardingPage } from '@/pages/onboarding'
import { OnboardingDetailPage } from '@/pages/onboarding-detail'
import { AgentsPage } from '@/pages/agents'
import { NewAgentPage } from '@/pages/agent-new'
import { AgentDetailPage } from '@/pages/agent-detail'
import { AutomationsPage } from '@/pages/automations'
import { ApprovalsPage } from '@/pages/approvals'
import { ActivityPage } from '@/pages/activity'
import { IntegrationsPage } from '@/pages/integrations'
import { SettingsPage } from '@/pages/settings'
import { BillingPage } from '@/pages/billing'
import { PortalLayout } from '@/pages/portal/portal-layout'
import { PortalDashboard } from '@/pages/portal/dashboard'
import { PortalLicensePage } from '@/pages/portal/license'
import { PortalDownloadsPage } from '@/pages/portal/downloads'
import { PortalInstancesPage } from '@/pages/portal/instances'
import { PortalInvoicesPage } from '@/pages/portal/invoices'
import { PortalSupportPage } from '@/pages/portal/support'

export default function App() {
  return (
    <AppStoreProvider>
      <BrowserRouter>
        <Routes>
          {/* Standalone surfaces (no app chrome) */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup" element={<SetupPage />} />

          {/* Portail Client KamaLoka — relation post-vente (licence, downloads,
           * instances, factures, support). Séparé de l'application Companion. */}
          <Route path="/portal" element={<PortalLayout />}>
            <Route index element={<PortalDashboard />} />
            <Route path="license" element={<PortalLicensePage />} />
            <Route path="downloads" element={<PortalDownloadsPage />} />
            <Route path="instances" element={<PortalInstancesPage />} />
            <Route path="invoices" element={<PortalInvoicesPage />} />
            <Route path="support" element={<PortalSupportPage />} />
          </Route>

          {/* Main application */}
          <Route element={<AppShell />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/ask" element={<AskPage />} />
            <Route path="/brain" element={<BrainPage />} />
            <Route path="/brain/memory/:id" element={<MemoryDetailPage />} />
            <Route path="/brain/:id" element={<MemoryDetailPage />} />
            <Route path="/people" element={<PeoplePage />} />
            <Route path="/people/:id" element={<EmployeeDetailPage />} />
            <Route path="/roles" element={<RolesPage />} />
            <Route path="/roles/:id" element={<RoleBrainPage />} />
            <Route path="/sources" element={<SourcesPage />} />
            <Route path="/sources/new" element={<NewSourcePage />} />
            <Route path="/knowledge-risk" element={<KnowledgeRiskPage />} />
            <Route path="/handovers" element={<HandoversPage />} />
            <Route path="/handovers/new" element={<NewHandoverPage />} />
            <Route path="/handovers/new/:employeeId" element={<NewHandoverPage />} />
            <Route path="/handovers/:id" element={<HandoverDetailPage />} />
            <Route path="/handovers/:id/interview" element={<InterviewPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/onboarding/:id" element={<OnboardingDetailPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/agents/new" element={<NewAgentPage />} />
            <Route path="/agents/:id" element={<AgentDetailPage />} />
            <Route path="/automations" element={<AutomationsPage />} />
            <Route path="/approvals" element={<ApprovalsPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/integrations" element={<IntegrationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/billing" element={<BillingPage />} />
          </Route>

          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
        <ToastViewport />
      </BrowserRouter>
    </AppStoreProvider>
  )
}
