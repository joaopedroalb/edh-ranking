import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { GroupDetails, GroupStats } from './components/GroupDetails'
import { GroupEditor } from './components/GroupEditor'
import { Home } from './components/Home'
import { Icon } from './components/Icon'
import { TierWorkspace } from './components/TierWorkspace'
import { useStore } from './store'
import { useTheme } from './theme'

type Toast = { message: string; type: 'success' | 'error' }
type Notify = (message: string, type?: Toast['type']) => void

const groupPath = (groupId: string) => `/group/${groupId}`
const tierListPath = (groupId: string, tierListId: string) =>
  `${groupPath(groupId)}/tierlist/${tierListId}`

export default function App() {
  const { storageWarning, dismissStorageWarning } = useStore()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const [toast, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), toast.type === 'error' ? 5200 : 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const notify: Notify = (message, type = 'success') => setToast({ message, type })

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/" aria-label="Commander Lab — página inicial">
          <span className="brand__mark"><Icon name="spark" /></span>
          <span><strong>Commander</strong><em>Lab</em></span>
        </Link>
        <nav>
          <NavLink to="/" end>Grupos</NavLink>
          <button
            className="theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            <span>{theme === 'dark' ? 'Claro' : 'Escuro'}</span>
          </button>
        </nav>
      </header>

      {storageWarning && (
        <div className="storage-warning" role="alert">
          <span>{storageWarning}</span>
          <button type="button" onClick={dismissStorageWarning} aria-label="Fechar aviso"><Icon name="x" /></button>
        </div>
      )}

      <Routes>
        <Route path="/" element={<HomeRoute notify={notify} />} />
        <Route path="/group/new" element={<NewGroupRoute notify={notify} />} />
        <Route path="/group/:id/edit" element={<EditGroupRoute notify={notify} />} />
        <Route path="/group/:id/stats" element={<GroupStatsRoute />} />
        <Route path="/group/:groupId/tierlist/new" element={<NewTierListRoute />} />
        <Route path="/group/:groupId/tierlist/:tierListId" element={<TierListRoute />} />
        <Route path="/group/:id" element={<GroupDetailsRoute />} />
        <Route path="*" element={<NotFound />} />
      </Routes>

      {toast && (
        <div className={`toast toast--${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
          <span>{toast.type === 'error' ? '!' : '✓'}</span>{toast.message}
        </div>
      )}
    </div>
  )
}

function HomeRoute({ notify }: { notify: Notify }) {
  const navigate = useNavigate()
  return (
    <Home
      onCreate={() => navigate('/group/new')}
      onOpen={(group) => navigate(groupPath(group.id))}
      onEdit={(group) => navigate(`${groupPath(group.id)}/edit`)}
      onTierList={(group) => navigate(groupPath(group.id))}
      onNotify={notify}
    />
  )
}

function NewGroupRoute({ notify }: { notify: Notify }) {
  const navigate = useNavigate()
  return (
    <GroupEditor
      onCancel={() => navigate('/')}
      onSaved={(message) => {
        navigate('/')
        notify(message)
      }}
    />
  )
}

function EditGroupRoute({ notify }: { notify: Notify }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { groups } = useStore()
  const group = groups.find((item) => item.id === id)
  if (!group) return <NotFound message="Este grupo não existe ou foi removido." />

  return (
    <GroupEditor
      key={group.id}
      group={group}
      onCancel={() => navigate(groupPath(group.id))}
      onSaved={(message) => {
        navigate('/')
        notify(message)
      }}
    />
  )
}

function GroupDetailsRoute() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { groups, tierLists } = useStore()
  const group = groups.find((item) => item.id === id)
  if (!group) return <NotFound message="Este grupo não existe ou foi removido." />
  const lists = tierLists.filter((list) => list.groupId === group.id)

  return (
    <GroupDetails
      group={group}
      tierLists={lists}
      onBack={() => navigate('/')}
      onEdit={() => navigate(`${groupPath(group.id)}/edit`)}
      onStats={() => navigate(`${groupPath(group.id)}/stats`)}
      onCreateTierList={() => navigate(`${groupPath(group.id)}/tierlist/new`)}
      onOpenTierList={(tierListId) => navigate(tierListPath(group.id, tierListId))}
    />
  )
}

function GroupStatsRoute() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { groups, tierLists } = useStore()
  const group = groups.find((item) => item.id === id)
  if (!group) return <NotFound message="Este grupo não existe ou foi removido." />

  return (
    <GroupStats
      group={group}
      tierLists={tierLists.filter((list) => list.groupId === group.id)}
      onBack={() => navigate(groupPath(group.id))}
      onOpenTierList={(tierListId) => navigate(tierListPath(group.id, tierListId))}
    />
  )
}

function NewTierListRoute() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const { groups } = useStore()
  const group = groups.find((item) => item.id === groupId)
  if (!group) return <NotFound message="Este grupo não existe ou foi removido." />

  return (
    <TierWorkspace
      group={group}
      createMode
      onBack={() => navigate(groupPath(group.id))}
      onEditGroup={() => navigate(`${groupPath(group.id)}/edit`)}
      onOpenTierList={(tierListId) => navigate(tierListPath(group.id, tierListId))}
      onCreateTierList={() => navigate(`${groupPath(group.id)}/tierlist/new`)}
      onDeleted={(tierListId) =>
        navigate(tierListId ? tierListPath(group.id, tierListId) : groupPath(group.id))
      }
    />
  )
}

function TierListRoute() {
  const { groupId, tierListId } = useParams()
  const navigate = useNavigate()
  const { groups, tierLists } = useStore()
  const group = groups.find((item) => item.id === groupId)
  const tierList = tierLists.find(
    (item) => item.id === tierListId && item.groupId === groupId,
  )
  if (!group || !tierList) return <NotFound message="Esta tier list não existe ou foi removida." />

  return (
    <TierWorkspace
      group={group}
      selectedTierListId={tierList.id}
      onBack={() => navigate(groupPath(group.id))}
      onEditGroup={() => navigate(`${groupPath(group.id)}/edit`)}
      onOpenTierList={(nextTierListId) => navigate(tierListPath(group.id, nextTierListId))}
      onCreateTierList={() => navigate(`${groupPath(group.id)}/tierlist/new`)}
      onDeleted={(nextTierListId) =>
        navigate(nextTierListId ? tierListPath(group.id, nextTierListId) : groupPath(group.id))
      }
    />
  )
}

function NotFound({ message = 'A página que você procura não existe.' }: { message?: string }) {
  return (
    <main className="page not-found-page">
      <div className="not-found-card panel">
        <span>404</span>
        <Icon name="cards" />
        <h1>Página fora da mesa</h1>
        <p>{message}</p>
        <Link className="button button--primary" to="/">
          <Icon name="arrow-left" /> Voltar para os grupos
        </Link>
      </div>
    </main>
  )
}
