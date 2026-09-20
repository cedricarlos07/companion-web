/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Agent, Approval, AppNotification, AgentRunState } from '@/types'
import { AGENTS } from '@/data/workspace'
import { APPROVALS } from '@/data/workspace'
import { NOTIFICATIONS } from '@/data/workspace'

export interface Toast {
  id: number
  message: string
  tone: 'success' | 'info' | 'error'
}

interface AppStore {
  agents: Agent[]
  approvals: Approval[]
  notifications: AppNotification[]
  toasts: Toast[]
  setAgentStatus: (agentId: string, status: AgentRunState) => void
  decideApproval: (approvalId: string, decision: 'approved' | 'rejected') => void
  /** Hydrate les approbations depuis l'API réelle (badge sidebar, dashboards). */
  setApprovals: (list: Approval[]) => void
  dismissNotification: (notificationId: string) => void
  markNotificationsRead: () => void
  pushToast: (message: string, tone?: Toast['tone']) => void
}

const StoreContext = createContext<AppStore | null>(null)

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>(AGENTS)
  const [approvals, setApprovalsList] = useState<Approval[]>(APPROVALS)
  const [notifications, setNotifications] = useState<AppNotification[]>(NOTIFICATIONS)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastSeq = useRef(0)

  const pushToast = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = ++toastSeq.current
    setToasts((t) => [...t, { id, message, tone }])
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id))
    }, 3200)
  }, [])

  const setAgentStatus = useCallback((agentId: string, status: AgentRunState) => {
    setAgents((list) =>
      list.map((a) =>
        a.id === agentId
          ? { ...a, status, lastActivity: status === 'paused' ? a.lastActivity : "À l'instant" }
          : a,
      ),
    )
  }, [])

  const decideApproval = useCallback(
    (approvalId: string, decision: 'approved' | 'rejected') => {
      setApprovalsList((list) =>
        list.map((a) => (a.id === approvalId ? { ...a, status: decision } : a)),
      )
    },
    [],
  )

  const setApprovals = useCallback((list: Approval[]) => {
    setApprovalsList(list)
  }, [])

  const dismissNotification = useCallback((notificationId: string) => {
    setNotifications((list) => list.filter((n) => n.id !== notificationId))
  }, [])

  const markNotificationsRead = useCallback(() => {
    setNotifications((list) => list.map((n) => ({ ...n, read: true })))
  }, [])

  const value = useMemo<AppStore>(
    () => ({
      agents,
      approvals,
      notifications,
      toasts,
      setAgentStatus,
      decideApproval,
      setApprovals,
      dismissNotification,
      markNotificationsRead,
      pushToast,
    }),
    [
      agents,
      approvals,
      notifications,
      toasts,
      setAgentStatus,
      decideApproval,
      setApprovals,
      dismissNotification,
      markNotificationsRead,
      pushToast,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useAppStore(): AppStore {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useAppStore must be used inside <AppStoreProvider>')
  return ctx
}
