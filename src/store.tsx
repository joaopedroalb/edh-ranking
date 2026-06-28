import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { readStoredData, STORAGE_KEY } from './lib'
import type { AppData, Group, TierList } from './types'

type StoreValue = AppData & {
  storageWarning: string
  dismissStorageWarning: () => void
  addGroupBundle: (group: Group, tierLists: TierList[]) => void
  upsertGroup: (group: Group) => void
  deleteGroup: (groupId: string) => void
  upsertTierList: (tierList: TierList) => void
  deleteTierList: (tierListId: string) => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(readStoredData, [])
  const [data, setData] = useState<AppData>(initial.data)
  const [storageWarning, setStorageWarning] = useState(initial.warning)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      setStorageWarning('O navegador bloqueou o salvamento local. As alterações podem ser perdidas.')
    }
  }, [data])

  const addGroupBundle = useCallback((group: Group, tierLists: TierList[]) => {
    setData((current) => ({
      groups: [...current.groups, group],
      tierLists: [...current.tierLists, ...tierLists],
    }))
  }, [])

  const upsertGroup = useCallback((group: Group) => {
    setData((current) => {
      const exists = current.groups.some((item) => item.id === group.id)
      return {
        ...current,
        groups: exists
          ? current.groups.map((item) => (item.id === group.id ? group : item))
          : [...current.groups, group],
      }
    })
  }, [])

  const deleteGroup = useCallback((groupId: string) => {
    setData((current) => ({
      groups: current.groups.filter((group) => group.id !== groupId),
      tierLists: current.tierLists.filter((list) => list.groupId !== groupId),
    }))
  }, [])

  const upsertTierList = useCallback((tierList: TierList) => {
    setData((current) => {
      const exists = current.tierLists.some((item) => item.id === tierList.id)
      return {
        ...current,
        tierLists: exists
          ? current.tierLists.map((item) => (item.id === tierList.id ? tierList : item))
          : [...current.tierLists, tierList],
      }
    })
  }, [])

  const deleteTierList = useCallback((tierListId: string) => {
    setData((current) => ({
      ...current,
      tierLists: current.tierLists.filter((list) => list.id !== tierListId),
    }))
  }, [])

  const value = useMemo<StoreValue>(
    () => ({
      ...data,
      storageWarning,
      dismissStorageWarning: () => setStorageWarning(''),
      addGroupBundle,
      upsertGroup,
      deleteGroup,
      upsertTierList,
      deleteTierList,
    }),
    [
      data,
      storageWarning,
      addGroupBundle,
      upsertGroup,
      deleteGroup,
      upsertTierList,
      deleteTierList,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const context = useContext(StoreContext)
  if (!context) throw new Error('useStore precisa ser usado dentro de StoreProvider')
  return context
}
