import type { AppData, CardData, CommanderDeck, Group, Participant, TierList } from './types'

export const STORAGE_KEY = 'commander-lab-data-v1'

export const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const emptyCard = (): CardData => ({ name: '', imageUrl: '' })

export const createDeck = (): CommanderDeck => ({
  id: uid('deck'),
  commander: emptyCard(),
})

export const createParticipant = (): Participant => ({
  id: uid('player'),
  name: '',
  commanders: [],
})

export const createGroup = (): Group => ({
  id: uid('group'),
  name: '',
  participants: [],
  createdAt: new Date().toISOString(),
})

export const DEFAULT_TIERS = [
  { name: 'S', color: '#f25f5c' },
  { name: 'A', color: '#f3a950' },
  { name: 'B', color: '#f2cf5b' },
  { name: 'C', color: '#75bd8d' },
]

export const createTierList = (groupId: string, name: string): TierList => ({
  id: uid('tierlist'),
  groupId,
  name: name.trim(),
  tiers: DEFAULT_TIERS.map((tier) => ({ ...tier, id: uid('tier') })),
  assignments: [],
  createdAt: new Date().toISOString(),
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isString = (value: unknown): value is string => typeof value === 'string'

const isCard = (value: unknown): value is CardData =>
  isRecord(value) && isString(value.name) && isString(value.imageUrl)

const isDeck = (value: unknown): value is CommanderDeck =>
  isRecord(value) &&
  isString(value.id) &&
  isCard(value.commander) &&
  (value.partner === undefined || isCard(value.partner))

const isParticipant = (value: unknown): value is Participant =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.name) &&
  Array.isArray(value.commanders) &&
  value.commanders.every(isDeck)

const isGroup = (value: unknown): value is Group =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.name) &&
  isString(value.createdAt) &&
  Array.isArray(value.participants) &&
  value.participants.every(isParticipant)

const isTierList = (value: unknown): value is TierList =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.groupId) &&
  isString(value.name) &&
  isString(value.createdAt) &&
  Array.isArray(value.tiers) &&
  value.tiers.every(
    (tier) =>
      isRecord(tier) && isString(tier.id) && isString(tier.name) && isString(tier.color),
  ) &&
  Array.isArray(value.assignments) &&
  value.assignments.every(
    (assignment) =>
      isRecord(assignment) &&
      isString(assignment.commanderId) &&
      isString(assignment.tierId),
  )

export const readStoredData = (): { data: AppData; warning: string } => {
  const empty: AppData = { groups: [], tierLists: [] }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { data: empty, warning: '' }

    const parsed: unknown = JSON.parse(raw)
    if (
      !isRecord(parsed) ||
      !Array.isArray(parsed.groups) ||
      !parsed.groups.every(isGroup) ||
      !Array.isArray(parsed.tierLists) ||
      !parsed.tierLists.every(isTierList)
    ) {
      return {
        data: empty,
        warning: 'Os dados salvos estavam em um formato inválido e foram reiniciados.',
      }
    }

    return { data: parsed as AppData, warning: '' }
  } catch {
    return {
      data: empty,
      warning: 'Não foi possível ler os dados locais. Um novo espaço foi iniciado.',
    }
  }
}

export const deckLabel = (deck: CommanderDeck) =>
  deck.partner?.name
    ? `${deck.commander.name} + ${deck.partner.name}`
    : deck.commander.name || 'Comandante sem nome'

