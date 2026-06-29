import { isValidDeckUrl, uid } from './lib'
import type {
  CardData,
  CommanderDeck,
  Group,
  Participant,
  Tier,
  TierAssignment,
  TierList,
} from './types'

export const GROUP_EXPORT_VERSION = '1.0' as const

type ExportedCommander = {
  id: string
  name: string
  imageUrl: string
  artCropUrl?: string
  scryfallId?: string
  isPartner: boolean
  partnerName: string | null
  partnerImageUrl?: string
  partnerArtCropUrl?: string
  partnerScryfallId?: string
  deckUrl?: string
}

type ExportedParticipant = {
  id: string
  name: string
  commanders: ExportedCommander[]
}

type ExportedTierList = {
  id: string
  name: string
  createdAt?: string
  tiers: Tier[]
  assignments: TierAssignment[]
  unassignedOrder?: string[]
}

export type GroupExportFile = {
  version: typeof GROUP_EXPORT_VERSION
  exportedAt: string
  group: {
    id: string
    name: string
    createdAt?: string
    participants: ExportedParticipant[]
    tierLists: ExportedTierList[]
  }
}

export type GroupBundle = {
  group: Group
  tierLists: TierList[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const readRecord = (value: unknown, path: string) => {
  if (!isRecord(value)) throw new Error(`${path} deve ser um objeto.`)
  return value
}

const readArray = (value: unknown, path: string) => {
  if (!Array.isArray(value)) throw new Error(`${path} deve ser uma lista.`)
  return value
}

const readString = (value: unknown, path: string, allowEmpty = false) => {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) {
    throw new Error(`${path} deve ser um texto${allowEmpty ? '' : ' não vazio'}.`)
  }
  return value
}

const readOptionalString = (value: unknown, path: string) => {
  if (value === undefined || value === null) return undefined
  return readString(value, path, true)
}

const assertUnique = (id: string, ids: Set<string>, path: string) => {
  if (ids.has(id)) throw new Error(`${path} contém um ID duplicado.`)
  ids.add(id)
}

const normalizedName = (name: string) => name.trim().toLocaleLowerCase('pt-BR')

const uniqueTaggedName = (name: string, tag: string, existingNames: string[]) => {
  const used = new Set(existingNames.map(normalizedName))
  if (!used.has(normalizedName(name))) return name.trim()

  const tagged = `${name.trim()} (${tag})`
  if (!used.has(normalizedName(tagged))) return tagged

  let index = 2
  while (used.has(normalizedName(`${name.trim()} (${tag} ${index})`))) index += 1
  return `${name.trim()} (${tag} ${index})`
}

const safeFileName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'grupo-commander'

export function createGroupExport(group: Group, tierLists: TierList[]): GroupExportFile {
  const deckIds = new Set(
    group.participants.flatMap((participant) =>
      participant.commanders.map((commander) => commander.id),
    ),
  )

  return {
    version: GROUP_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    group: {
      id: group.id,
      name: group.name,
      createdAt: group.createdAt,
      participants: group.participants.map((participant) => ({
        id: participant.id,
        name: participant.name,
        commanders: participant.commanders.map((deck) => ({
          id: deck.id,
          name: deck.commander.name,
          imageUrl: deck.commander.imageUrl,
          ...(deck.commander.artCropUrl ? { artCropUrl: deck.commander.artCropUrl } : {}),
          ...(deck.commander.scryfallId ? { scryfallId: deck.commander.scryfallId } : {}),
          isPartner: Boolean(deck.partner),
          partnerName: deck.partner?.name ?? null,
          ...(deck.partner?.imageUrl ? { partnerImageUrl: deck.partner.imageUrl } : {}),
          ...(deck.partner?.artCropUrl ? { partnerArtCropUrl: deck.partner.artCropUrl } : {}),
          ...(deck.partner?.scryfallId ? { partnerScryfallId: deck.partner.scryfallId } : {}),
          ...(deck.deckUrl ? { deckUrl: deck.deckUrl } : {}),
        })),
      })),
      tierLists: tierLists
        .filter((tierList) => tierList.groupId === group.id)
        .map((tierList) => {
          const tierIds = new Set(tierList.tiers.map((tier) => tier.id))
          return {
            id: tierList.id,
            name: tierList.name,
            createdAt: tierList.createdAt,
            tiers: tierList.tiers.map((tier) => ({ ...tier })),
            unassignedOrder: (tierList.unassignedOrder ?? []).filter((commanderId) =>
              deckIds.has(commanderId),
            ),
            assignments: tierList.assignments
              .filter(
                (assignment) =>
                  deckIds.has(assignment.commanderId) && tierIds.has(assignment.tierId),
              )
              .map((assignment) => ({ ...assignment })),
          }
        }),
    },
  }
}

export function downloadGroupExport(group: Group, tierLists: TierList[]) {
  const contents = JSON.stringify(createGroupExport(group, tierLists), null, 2)
  const blob = new Blob([contents], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${safeFileName(group.name)}-commander-lab.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function parseGroupExport(raw: string, existingNames: string[]): GroupBundle {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('O arquivo não contém um JSON válido.')
  }

  const root = readRecord(parsed, 'Arquivo')
  const version = readString(root.version, 'version')
  if (version !== GROUP_EXPORT_VERSION) {
    throw new Error(`Versão de arquivo não suportada: ${version}.`)
  }

  const sourceGroup = readRecord(root.group, 'group')
  readString(sourceGroup.id, 'group.id')
  const sourceName = readString(sourceGroup.name, 'group.name').trim()
  const sourceParticipants = readArray(sourceGroup.participants, 'group.participants')
  const sourceTierLists = readArray(sourceGroup.tierLists, 'group.tierLists')

  const participantIds = new Set<string>()
  const commanderIds = new Set<string>()
  const tierListIds = new Set<string>()
  const tierIds = new Set<string>()
  const commanderIdMap = new Map<string, string>()

  const participants: Participant[] = sourceParticipants.map((value, participantIndex) => {
    const path = `group.participants[${participantIndex}]`
    const participant = readRecord(value, path)
    const oldParticipantId = readString(participant.id, `${path}.id`)
    assertUnique(oldParticipantId, participantIds, `${path}.id`)
    const commanders = readArray(participant.commanders, `${path}.commanders`)

    return {
      id: uid('player'),
      name: readString(participant.name, `${path}.name`).trim(),
      commanders: commanders.map((commanderValue, commanderIndex) => {
        const commanderPath = `${path}.commanders[${commanderIndex}]`
        const commander = readRecord(commanderValue, commanderPath)
        const oldCommanderId = readString(commander.id, `${commanderPath}.id`)
        assertUnique(oldCommanderId, commanderIds, `${commanderPath}.id`)

        if (typeof commander.isPartner !== 'boolean') {
          throw new Error(`${commanderPath}.isPartner deve ser verdadeiro ou falso.`)
        }

        const newCommanderId = uid('deck')
        commanderIdMap.set(oldCommanderId, newCommanderId)
        const card: CardData = {
          name: readString(commander.name, `${commanderPath}.name`).trim(),
          imageUrl: readString(commander.imageUrl, `${commanderPath}.imageUrl`, true),
          artCropUrl: readOptionalString(commander.artCropUrl, `${commanderPath}.artCropUrl`) ?? '',
          ...(readOptionalString(commander.scryfallId, `${commanderPath}.scryfallId`)
            ? { scryfallId: String(commander.scryfallId) }
            : {}),
        }

        const deckUrl = readOptionalString(commander.deckUrl, `${commanderPath}.deckUrl`) ?? ''
        if (deckUrl && !isValidDeckUrl(deckUrl)) {
          throw new Error(`${commanderPath}.deckUrl deve ser uma URL HTTP ou HTTPS válida.`)
        }
        const deck: CommanderDeck = { id: newCommanderId, commander: card, deckUrl }
        if (commander.isPartner) {
          deck.partner = {
            name: readString(commander.partnerName, `${commanderPath}.partnerName`).trim(),
            imageUrl: readOptionalString(
              commander.partnerImageUrl,
              `${commanderPath}.partnerImageUrl`,
            ) ?? '',
            artCropUrl: readOptionalString(
              commander.partnerArtCropUrl,
              `${commanderPath}.partnerArtCropUrl`,
            ) ?? '',
            ...(readOptionalString(
              commander.partnerScryfallId,
              `${commanderPath}.partnerScryfallId`,
            )
              ? { scryfallId: String(commander.partnerScryfallId) }
              : {}),
          }
        }
        return deck
      }),
    }
  })

  const groupId = uid('group')
  const tierLists: TierList[] = sourceTierLists.map((value, listIndex) => {
    const path = `group.tierLists[${listIndex}]`
    const sourceList = readRecord(value, path)
    const oldListId = readString(sourceList.id, `${path}.id`)
    assertUnique(oldListId, tierListIds, `${path}.id`)
    const sourceTiers = readArray(sourceList.tiers, `${path}.tiers`)
    const tierIdMap = new Map<string, string>()

    const tiers: Tier[] = sourceTiers.map((tierValue, tierIndex) => {
      const tierPath = `${path}.tiers[${tierIndex}]`
      const sourceTier = readRecord(tierValue, tierPath)
      const oldTierId = readString(sourceTier.id, `${tierPath}.id`)
      assertUnique(oldTierId, tierIds, `${tierPath}.id`)
      const color = readString(sourceTier.color, `${tierPath}.color`)
      if (!/^#[0-9a-f]{6}$/i.test(color)) {
        throw new Error(`${tierPath}.color deve ser uma cor hexadecimal válida.`)
      }

      const id = uid('tier')
      tierIdMap.set(oldTierId, id)
      const sourceOrder = sourceTier.order === undefined
        ? []
        : readArray(sourceTier.order, `${tierPath}.order`)
      const seenOrderIds = new Set<string>()
      const order = sourceOrder.map((commanderIdValue, orderIndex) => {
        const oldCommanderId = readString(
          commanderIdValue,
          `${tierPath}.order[${orderIndex}]`,
        )
        if (seenOrderIds.has(oldCommanderId)) {
          throw new Error(`${tierPath}.order contém um comandante duplicado.`)
        }
        seenOrderIds.add(oldCommanderId)
        const commanderId = commanderIdMap.get(oldCommanderId)
        if (!commanderId) throw new Error(`${tierPath}.order referencia um comandante inexistente.`)
        return commanderId
      })
      return {
        id,
        name: readString(sourceTier.name, `${tierPath}.name`).trim(),
        color,
        order,
      }
    })

    const assignedCommanderIds = new Set<string>()
    const assignments = readArray(sourceList.assignments, `${path}.assignments`).map(
      (assignmentValue, assignmentIndex): TierAssignment => {
        const assignmentPath = `${path}.assignments[${assignmentIndex}]`
        const sourceAssignment = readRecord(assignmentValue, assignmentPath)
        const oldCommanderId = readString(
          sourceAssignment.commanderId,
          `${assignmentPath}.commanderId`,
        )
        const oldTierId = readString(sourceAssignment.tierId, `${assignmentPath}.tierId`)
        const commanderId = commanderIdMap.get(oldCommanderId)
        const tierId = tierIdMap.get(oldTierId)

        if (!commanderId) {
          throw new Error(`${assignmentPath} referencia um comandante inexistente.`)
        }
        if (!tierId) throw new Error(`${assignmentPath} referencia um tier inexistente.`)
        if (assignedCommanderIds.has(oldCommanderId)) {
          throw new Error(`${assignmentPath} duplica a classificação de um comandante.`)
        }
        assignedCommanderIds.add(oldCommanderId)
        return { commanderId, tierId }
      },
    )

    const seenUnassignedIds = new Set<string>()
    const unassignedOrder = (
      sourceList.unassignedOrder === undefined
        ? []
        : readArray(sourceList.unassignedOrder, `${path}.unassignedOrder`)
    ).map((commanderIdValue, orderIndex) => {
      const oldCommanderId = readString(
        commanderIdValue,
        `${path}.unassignedOrder[${orderIndex}]`,
      )
      if (seenUnassignedIds.has(oldCommanderId)) {
        throw new Error(`${path}.unassignedOrder contém um comandante duplicado.`)
      }
      seenUnassignedIds.add(oldCommanderId)
      const commanderId = commanderIdMap.get(oldCommanderId)
      if (!commanderId) throw new Error(`${path}.unassignedOrder referencia um comandante inexistente.`)
      return commanderId
    })

    return {
      id: uid('tierlist'),
      groupId,
      name: readString(sourceList.name, `${path}.name`).trim(),
      tiers,
      assignments,
      unassignedOrder,
      createdAt: readOptionalString(sourceList.createdAt, `${path}.createdAt`) || new Date().toISOString(),
    }
  })

  return {
    group: {
      id: groupId,
      name: uniqueTaggedName(sourceName, 'importado', existingNames),
      participants,
      createdAt: new Date().toISOString(),
    },
    tierLists,
  }
}

export function cloneGroupBundle(
  sourceGroup: Group,
  allTierLists: TierList[],
  existingNames: string[],
): GroupBundle {
  const commanderIdMap = new Map<string, string>()
  const groupId = uid('group')
  const participants = sourceGroup.participants.map((participant): Participant => ({
    id: uid('player'),
    name: participant.name,
    commanders: participant.commanders.map((deck): CommanderDeck => {
      const id = uid('deck')
      commanderIdMap.set(deck.id, id)
      return {
        id,
        commander: { ...deck.commander },
        deckUrl: deck.deckUrl,
        ...(deck.partner ? { partner: { ...deck.partner } } : {}),
      }
    }),
  }))

  const tierLists = allTierLists
    .filter((tierList) => tierList.groupId === sourceGroup.id)
    .map((tierList): TierList => {
      const tierIdMap = new Map<string, string>()
      const tiers = tierList.tiers.map((tier) => {
        const id = uid('tier')
        tierIdMap.set(tier.id, id)
        return {
          ...tier,
          id,
          order: (tier.order ?? []).flatMap((commanderId) => {
            const mappedId = commanderIdMap.get(commanderId)
            return mappedId ? [mappedId] : []
          }),
        }
      })

      return {
        id: uid('tierlist'),
        groupId,
        name: tierList.name,
        tiers,
        assignments: tierList.assignments.flatMap((assignment) => {
          const commanderId = commanderIdMap.get(assignment.commanderId)
          const tierId = tierIdMap.get(assignment.tierId)
          return commanderId && tierId ? [{ commanderId, tierId }] : []
        }),
        unassignedOrder: (tierList.unassignedOrder ?? []).flatMap((commanderId) => {
          const mappedId = commanderIdMap.get(commanderId)
          return mappedId ? [mappedId] : []
        }),
        createdAt: new Date().toISOString(),
      }
    })

  return {
    group: {
      id: groupId,
      name: uniqueTaggedName(sourceGroup.name, 'cópia', existingNames),
      participants,
      createdAt: new Date().toISOString(),
    },
    tierLists,
  }
}
