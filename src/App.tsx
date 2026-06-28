import { useEffect, useState } from 'react'
import { GroupEditor } from './components/GroupEditor'
import { Home } from './components/Home'
import { Icon } from './components/Icon'
import { TierWorkspace } from './components/TierWorkspace'
import { useStore } from './store'

type View =
  | { name: 'home' }
  | { name: 'group'; groupId?: string }
  | { name: 'tiers'; groupId: string }

type Toast = { message: string; type: 'success' | 'error' }

export default function App() {
  const { groups, storageWarning, dismissStorageWarning } = useStore()
  const [view, setView] = useState<View>({ name: 'home' })
  const [toast, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), toast.type === 'error' ? 5200 : 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const notify = (message: string, type: Toast['type'] = 'success') => {
    setToast({ message, type })
  }

  const goHomeWithMessage = (message: string) => {
    setView({ name: 'home' })
    notify(message)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const activeGroup = view.name !== 'home'
    ? groups.find((group) => group.id === view.groupId)
    : undefined

  return (
    <div className="app-shell">
      {view.name !== 'tiers' && (
        <header className="site-header">
          <button className="brand" type="button" onClick={() => setView({ name: 'home' })}>
            <span className="brand__mark"><Icon name="spark" /></span>
            <span><strong>Commander</strong><em>Lab</em></span>
          </button>
          <nav>
            <button className={view.name === 'home' ? 'is-active' : ''} type="button" onClick={() => setView({ name: 'home' })}>Grupos</button>
          </nav>
        </header>
      )}

      {storageWarning && (
        <div className="storage-warning" role="alert">
          <span>{storageWarning}</span>
          <button type="button" onClick={dismissStorageWarning} aria-label="Fechar aviso"><Icon name="x" /></button>
        </div>
      )}

      {view.name === 'home' && (
        <Home
          onCreate={() => setView({ name: 'group' })}
          onEdit={(group) => setView({ name: 'group', groupId: group.id })}
          onTierList={(group) => setView({ name: 'tiers', groupId: group.id })}
          onNotify={notify}
        />
      )}

      {view.name === 'group' && (
        <GroupEditor
          key={activeGroup?.id ?? 'new'}
          group={activeGroup}
          onCancel={() => setView({ name: 'home' })}
          onSaved={goHomeWithMessage}
        />
      )}

      {view.name === 'tiers' && activeGroup && (
        <TierWorkspace
          group={activeGroup}
          onBack={() => setView({ name: 'home' })}
          onEditGroup={() => setView({ name: 'group', groupId: activeGroup.id })}
        />
      )}

      {view.name !== 'home' && !activeGroup && view.name !== 'group' && (
        <main className="page"><div className="alert alert--error">Este grupo não existe mais.</div></main>
      )}

      {toast && (
        <div className={`toast toast--${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
          <span>{toast.type === 'error' ? '!' : '✓'}</span>{toast.message}
        </div>
      )}
    </div>
  )
}
