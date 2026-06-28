export type CardData = {
  name: string
  imageUrl: string
  artCropUrl?: string
  scryfallId?: string
}

export type CommanderDeck = {
  id: string
  commander: CardData
  partner?: CardData
}

export type Participant = {
  id: string
  name: string
  commanders: CommanderDeck[]
}

export type Group = {
  id: string
  name: string
  participants: Participant[]
  createdAt: string
}

export type Tier = {
  id: string
  name: string
  color: string
  order?: string[]
}

export type TierAssignment = {
  commanderId: string
  tierId: string
}

export type TierList = {
  id: string
  groupId: string
  name: string
  tiers: Tier[]
  assignments: TierAssignment[]
  createdAt: string
}

export type AppData = {
  groups: Group[]
  tierLists: TierList[]
}
