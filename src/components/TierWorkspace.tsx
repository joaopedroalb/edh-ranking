import html2canvas from 'html2canvas'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createTierList, deckLabel, uid } from '../lib'
import { fetchCardArtwork, type CardArtLookup } from '../scryfall'
import { useStore } from '../store'
import type { CommanderDeck, Group, Participant, TierList } from '../types'
import { Icon } from './Icon'

type Props = {
  group: Group
  selectedTierListId?: string
  createMode?: boolean
  onBack: () => void
  onEditGroup: () => void
  onOpenTierList: (tierListId: string) => void
  onCreateTierList: () => void
  onDeleted: (nextTierListId?: string) => void
}

type DeckOwner = { deck: CommanderDeck; participant: Participant }

const EXTRA_TIER_COLORS = ['#89a8f5', '#b58be3', '#e17c9c', '#63b8ae', '#87929f']
const exportImageCache = new Map<string, Promise<string>>()

const imageUrlAsDataUrl = (url: string) => {
  if (url.startsWith('data:')) return Promise.resolve(url)
  const cached = exportImageCache.get(url)
  if (cached) return cached

  const request = fetch(url, { cache: 'force-cache', mode: 'cors' })
    .then((response) => {
      if (!response.ok) throw new Error(`Falha ao carregar arte (${response.status})`)
      return response.blob()
    })
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () =>
            typeof reader.result === 'string'
              ? resolve(reader.result)
              : reject(new Error('Imagem inválida'))
          reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler imagem'))
          reader.readAsDataURL(blob)
        }),
    )
    .catch((error) => {
      exportImageCache.delete(url)
      throw error
    })

  exportImageCache.set(url, request)
  return request
}

export function TierWorkspace({
  group,
  selectedTierListId,
  createMode = false,
  onBack,
  onEditGroup,
  onOpenTierList,
  onCreateTierList,
  onDeleted,
}: Props) {
  const { tierLists, upsertGroup, upsertTierList, deleteTierList } = useStore()
  const groupLists = tierLists.filter((list) => list.groupId === group.id)
  const [newListName, setNewListName] = useState('')
  const [createError, setCreateError] = useState('')
  const [artworkLoading, setArtworkLoading] = useState(false)
  const artworkHydrationStarted = useRef(false)
  const selected = groupLists.find((list) => list.id === selectedTierListId)

  const allDecks = useMemo(
    () =>
      group.participants.flatMap((participant) =>
        participant.commanders.map((deck) => ({ deck, participant })),
      ),
    [group],
  )

  useEffect(() => {
    if (artworkHydrationStarted.current) return
    const lookups: CardArtLookup[] = group.participants.flatMap((participant) =>
      participant.commanders.flatMap((deck) => [
        ...(!deck.commander.artCropUrl && deck.commander.name
          ? [{
              key: `${deck.id}:commander`,
              name: deck.commander.name,
              scryfallId: deck.commander.scryfallId,
            }]
          : []),
        ...(deck.partner && !deck.partner.artCropUrl && deck.partner.name
          ? [{
              key: `${deck.id}:partner`,
              name: deck.partner.name,
              scryfallId: deck.partner.scryfallId,
            }]
          : []),
      ]),
    )
    if (lookups.length === 0) return

    artworkHydrationStarted.current = true
    setArtworkLoading(true)
    void fetchCardArtwork(lookups)
      .then((artwork) => {
        if (artwork.size === 0) return
        let changed = false
        const participants = group.participants.map((participant) => ({
          ...participant,
          commanders: participant.commanders.map((deck) => {
            const commanderArtwork = artwork.get(`${deck.id}:commander`)
            const partnerArtwork = artwork.get(`${deck.id}:partner`)
            if (!commanderArtwork && !partnerArtwork) return deck
            changed = true
            return {
              ...deck,
              commander: commanderArtwork
                ? {
                    ...deck.commander,
                    imageUrl: deck.commander.imageUrl || commanderArtwork.imageUrl,
                    artCropUrl: commanderArtwork.artCropUrl,
                  }
                : deck.commander,
              ...(deck.partner
                ? {
                    partner: partnerArtwork
                      ? {
                          ...deck.partner,
                          imageUrl: deck.partner.imageUrl || partnerArtwork.imageUrl,
                          artCropUrl: partnerArtwork.artCropUrl,
                        }
                      : deck.partner,
                  }
                : {}),
            }
          }),
        }))
        if (changed) upsertGroup({ ...group, participants })
      })
      .catch(() => undefined)
      .finally(() => setArtworkLoading(false))
  }, [group, upsertGroup])

  const createList = () => {
    if (!newListName.trim()) {
      setCreateError('Dê um nome para a tier list.')
      return
    }
    const list = createTierList(group.id, newListName)
    upsertTierList(list)
    setNewListName('')
    setCreateError('')
    onOpenTierList(list.id)
  }

  const removeList = (list: TierList) => {
    if (!window.confirm(`Excluir a tier list “${list.name}”?`)) return
    const next = groupLists.find((candidate) => candidate.id !== list.id)
    deleteTierList(list.id)
    onDeleted(next?.id)
  }

  return (
    <main className="tier-page">
      <div className="tier-topbar">
        <button className="back-link back-link--light" type="button" onClick={onBack}>
          <Icon name="arrow-left" /> Detalhes
        </button>
        <div className="tier-topbar__group">
          <span>{group.name.slice(0, 1).toUpperCase()}</span>
          <div><small>Grupo atual</small><strong>{group.name}</strong></div>
        </div>
        <button className="button button--topbar" type="button" onClick={onEditGroup}>
          <Icon name="edit" /> Editar grupo
        </button>
      </div>

      <div className="tier-layout">
        <aside className="tier-sidebar">
          <div className="tier-sidebar__heading">
            <div>
              <p className="eyebrow">Coleções</p>
              <h2>Tier lists</h2>
            </div>
            <button
              className="icon-button icon-button--accent"
              type="button"
              onClick={onCreateTierList}
              aria-label="Nova tier list"
              title="Nova tier list"
            >
              <Icon name="plus" />
            </button>
          </div>
          <nav className="tier-list-nav" aria-label="Tier lists do grupo">
            {groupLists.map((list) => (
              <button
                className={selected?.id === list.id && !createMode ? 'is-active' : ''}
                type="button"
                key={list.id}
                onClick={() => onOpenTierList(list.id)}
              >
                <span className="nav-list-icon"><Icon name="layers" /></span>
                <span><strong>{list.name}</strong><small>{list.tiers.length} tiers</small></span>
                <Icon name="chevron-right" />
              </button>
            ))}
          </nav>
          <div className="tier-sidebar__summary">
            <Icon name="cards" />
            <span><strong>{allDecks.length} decks</strong><small>{group.participants.length} jogadores</small></span>
          </div>
        </aside>

        <section className="tier-content">
          {createMode || !selected ? (
            <CreateTierList
              value={newListName}
              error={createError}
              hasLists={groupLists.length > 0}
              onChange={(value) => {
                setNewListName(value)
                setCreateError('')
              }}
              onCancel={() =>
                groupLists[0] ? onOpenTierList(groupLists[0].id) : onBack()
              }
              onCreate={createList}
            />
          ) : (
            <TierListEditor
              key={selected.id}
              tierList={selected}
              allDecks={allDecks}
              participants={group.participants}
              artworkLoading={artworkLoading}
              onChange={upsertTierList}
              onDelete={() => removeList(selected)}
            />
          )}
        </section>
      </div>
    </main>
  )
}

function CreateTierList({
  value,
  error,
  hasLists,
  onChange,
  onCancel,
  onCreate,
}: {
  value: string
  error: string
  hasLists: boolean
  onChange: (value: string) => void
  onCancel: () => void
  onCreate: () => void
}) {
  return (
    <div className="create-tier-wrap">
      <div className="create-tier-card">
        <div className="create-tier-card__icon"><Icon name="layers" /></div>
        <p className="eyebrow">Nova classificação</p>
        <h1>O que vamos julgar hoje?</h1>
        <p>Você começa com os tiers S, A, B e C, mas pode mudar tudo depois.</p>
        <div className="field">
          <label htmlFor="tier-list-name">Nome da tier list</label>
          <input
            id="tier-list-name"
            value={value}
            autoFocus
            placeholder="Ex: Grau de safadeza"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && onCreate()}
          />
          {error && <small className="field-error">{error}</small>}
        </div>
        <div className="default-tiers-preview">
          {['S', 'A', 'B', 'C'].map((name) => <span key={name}>{name}</span>)}
        </div>
        <div className="create-tier-card__actions">
          {hasLists && <button className="button button--ghost" type="button" onClick={onCancel}>Cancelar</button>}
          <button className="button button--primary" type="button" onClick={onCreate}>
            Criar tier list <Icon name="chevron-right" />
          </button>
        </div>
      </div>
    </div>
  )
}

function TierListEditor({
  tierList,
  allDecks,
  participants,
  artworkLoading,
  onChange,
  onDelete,
}: {
  tierList: TierList
  allDecks: DeckOwner[]
  participants: Participant[]
  artworkLoading: boolean
  onChange: (tierList: TierList) => void
  onDelete: () => void
}) {
  const [draggedId, setDraggedId] = useState('')
  const [generatingImage, setGeneratingImage] = useState(false)
  const [imageGenerationStatus, setImageGenerationStatus] = useState('')
  const [shareError, setShareError] = useState('')
  const sharePreviewRef = useRef<HTMLDivElement>(null)

  const decksForTier = (tierId: string) => {
    const tier = tierList.tiers.find((item) => item.id === tierId)
    const assigned = allDecks.filter(({ deck }) =>
      tierList.assignments.some(
        (assignment) => assignment.commanderId === deck.id && assignment.tierId === tierId,
      ),
    )
    const ownerById = new Map(assigned.map((owner) => [owner.deck.id, owner]))
    const ordered = (tier?.order ?? []).flatMap((commanderId) => {
      const owner = ownerById.get(commanderId)
      if (!owner) return []
      ownerById.delete(commanderId)
      return [owner]
    })
    return [...ordered, ...assigned.filter(({ deck }) => ownerById.has(deck.id))]
  }

  const assignDeck = (commanderId: string, tierId: string, beforeCommanderId?: string) => {
    const tiersWithoutCommander = tierList.tiers.map((tier) => ({
      ...tier,
      order: (tier.order ?? []).filter((id) => id !== commanderId),
    }))

    const nextTiers = tiersWithoutCommander.map((tier) => {
      if (tier.id !== tierId) return tier
      const currentOrder = decksForTier(tierId)
        .map(({ deck }) => deck.id)
        .filter((id) => id !== commanderId)
      const insertIndex = beforeCommanderId ? currentOrder.indexOf(beforeCommanderId) : -1
      if (insertIndex >= 0) currentOrder.splice(insertIndex, 0, commanderId)
      else currentOrder.push(commanderId)
      return { ...tier, order: currentOrder }
    })

    onChange({
      ...tierList,
      tiers: nextTiers,
      assignments: [
        ...tierList.assignments.filter((item) => item.commanderId !== commanderId),
        ...(tierId ? [{ commanderId, tierId }] : []),
      ],
    })
  }

  const moveWithinTier = (commanderId: string, tierId: string, direction: -1 | 1) => {
    const order = decksForTier(tierId).map(({ deck }) => deck.id)
    const currentIndex = order.indexOf(commanderId)
    const targetIndex = currentIndex + direction
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= order.length) return
    ;[order[currentIndex], order[targetIndex]] = [order[targetIndex], order[currentIndex]]
    onChange({
      ...tierList,
      tiers: tierList.tiers.map((tier) =>
        tier.id === tierId ? { ...tier, order } : tier,
      ),
    })
  }

  const generateImage = async () => {
    if (!sharePreviewRef.current) return
    setGeneratingImage(true)
    setImageGenerationStatus('Preparando artes…')
    setShareError('')
    try {
      await document.fonts?.ready
      const images = Array.from(sharePreviewRef.current.querySelectorAll('img'))
      const uniqueSources = [...new Set(images.map((image) => image.currentSrc || image.src))]
      const localSources = new Map<string, string>()
      let failedImages = 0

      for (let index = 0; index < uniqueSources.length; index += 6) {
        const batch = uniqueSources.slice(index, index + 6)
        const results = await Promise.allSettled(batch.map(imageUrlAsDataUrl))
        results.forEach((result, resultIndex) => {
          if (result.status === 'fulfilled') localSources.set(batch[resultIndex], result.value)
          else failedImages += 1
        })
        setImageGenerationStatus(
          `Carregando artes… ${Math.min(index + batch.length, uniqueSources.length)}/${uniqueSources.length}`,
        )
      }

      images.forEach((image) => {
        const localSource = localSources.get(image.currentSrc || image.src)
        if (localSource) image.src = localSource
      })

      await Promise.all(
        images.map((image) => image.decode?.().catch(() => undefined) ?? Promise.resolve()),
      )

      if (uniqueSources.length > 0 && failedImages === uniqueSources.length) {
        throw new Error('Nenhuma arte pôde ser preparada')
      }

      setImageGenerationStatus('Renderizando PNG…')

      const canvas = await html2canvas(sharePreviewRef.current, {
        backgroundColor: '#101914',
        logging: false,
        scale: 2,
        useCORS: true,
        windowWidth: 1200,
      })
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => value ? resolve(value) : reject(new Error('PNG vazio')), 'image/png')
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const safeName = tierList.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9-_]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase() || 'tier-list'
      link.href = url
      link.download = `${safeName}-commander-lab.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch {
      setShareError('Não foi possível carregar as artes para o PNG. Verifique a conexão e tente novamente.')
    } finally {
      setGeneratingImage(false)
      setImageGenerationStatus('')
    }
  }

  const addTier = () => {
    const color = EXTRA_TIER_COLORS[tierList.tiers.length % EXTRA_TIER_COLORS.length]
    onChange({
      ...tierList,
      tiers: [...tierList.tiers, { id: uid('tier'), name: `Tier ${tierList.tiers.length + 1}`, color, order: [] }],
    })
  }

  const removeTier = (tierId: string) => {
    const hasAssignments = tierList.assignments.some((item) => item.tierId === tierId)
    if (hasAssignments && !window.confirm('Os decks deste tier voltarão para “Não classificados”. Continuar?')) return
    onChange({
      ...tierList,
      tiers: tierList.tiers.filter((tier) => tier.id !== tierId),
      assignments: tierList.assignments.filter((item) => item.tierId !== tierId),
    })
  }

  const unassigned = allDecks.filter(
    ({ deck }) => !tierList.assignments.some((assignment) => assignment.commanderId === deck.id),
  )

  return (
    <div className="tier-editor">
      <header className="tier-editor__header">
        <div>
          <p className="eyebrow">Classificação em andamento</p>
          <input
            className="title-input"
            aria-label="Nome da tier list"
            value={tierList.name}
            onChange={(event) => onChange({ ...tierList, name: event.target.value })}
          />
          <p>Arraste para ordenar ou use as setas e o seletor em cada carta.</p>
        </div>
        <div className="tier-editor__header-actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={generateImage}
            disabled={generatingImage || artworkLoading}
          >
            {generatingImage || artworkLoading
              ? <span className="input-loader input-loader--inline" />
              : <Icon name="download" />}
            {artworkLoading
              ? 'Buscando art crops…'
              : generatingImage
                ? imageGenerationStatus || 'Gerando imagem…'
                : 'Gerar imagem'}
          </button>
          <div className="autosave-badge"><span /> Salvo automaticamente</div>
        </div>
      </header>

      {shareError && <div className="alert alert--error share-error" role="alert">{shareError}</div>}

      {allDecks.length === 0 ? (
        <div className="workspace-empty panel">
          <Icon name="cards" />
          <h2>Nenhum deck neste grupo</h2>
          <p>Edite o grupo e adicione comandantes para começar a classificação.</p>
        </div>
      ) : (
        <>
          <section className="tier-board-section">
            <div className="subsection-heading">
              <div><span>01</span><div><h2>Distribua os decks</h2><p>O topo vale mais pontos na média.</p></div></div>
              <button className="button button--secondary" type="button" onClick={addTier}>
                <Icon name="plus" /> Adicionar tier
              </button>
            </div>

            <div className="tier-board">
              {tierList.tiers.map((tier) => {
                const tierDecks = decksForTier(tier.id)
                return (
                <div
                  className="tier-row"
                  key={tier.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    const deckId = event.dataTransfer.getData('text/plain') || draggedId
                    if (deckId) assignDeck(deckId, tier.id)
                    setDraggedId('')
                  }}
                >
                  <div className="tier-label" style={{ '--tier-color': tier.color } as React.CSSProperties}>
                    <input
                      type="color"
                      value={tier.color}
                      aria-label={`Cor do tier ${tier.name}`}
                      onChange={(event) =>
                        onChange({
                          ...tierList,
                          tiers: tierList.tiers.map((item) =>
                            item.id === tier.id ? { ...item, color: event.target.value } : item,
                          ),
                        })
                      }
                    />
                    <textarea
                      className="tier-name-input"
                      value={tier.name}
                      aria-label="Nome do tier"
                      title={tier.name || 'Tier sem nome'}
                      rows={Math.max(1, Math.ceil(Math.max(tier.name.length, 1) / 6))}
                      onChange={(event) =>
                        onChange({
                          ...tierList,
                          tiers: tierList.tiers.map((item) =>
                            item.id === tier.id ? { ...item, name: event.target.value } : item,
                          ),
                        })
                      }
                    />
                    <button type="button" onClick={() => removeTier(tier.id)} aria-label={`Remover tier ${tier.name}`}>
                      <Icon name="trash" />
                    </button>
                  </div>
                  <div className="tier-dropzone">
                    {tierDecks.map((owner, orderIndex) => (
                      <DeckTile
                        key={owner.deck.id}
                        owner={owner}
                        tiers={tierList.tiers}
                        currentTier={tier.id}
                        onAssign={(tierId) => assignDeck(owner.deck.id, tierId)}
                        onDragStart={() => setDraggedId(owner.deck.id)}
                        onDragEnd={() => setDraggedId('')}
                        onDropBefore={(commanderId) => {
                          if (commanderId !== owner.deck.id) {
                            assignDeck(commanderId, tier.id, owner.deck.id)
                          }
                          setDraggedId('')
                        }}
                        canMoveUp={orderIndex > 0}
                        canMoveDown={orderIndex < tierDecks.length - 1}
                        onMoveUp={() => moveWithinTier(owner.deck.id, tier.id, -1)}
                        onMoveDown={() => moveWithinTier(owner.deck.id, tier.id, 1)}
                      />
                    ))}
                    {tierDecks.length === 0 && <span className="drop-hint">Solte decks aqui</span>}
                  </div>
                </div>
                )
              })}

              <div
                className="tier-row tier-row--unassigned"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  const deckId = event.dataTransfer.getData('text/plain') || draggedId
                  if (deckId) assignDeck(deckId, '')
                  setDraggedId('')
                }}
              >
                <div className="tier-label"><span className="unassigned-icon"><Icon name="cards" /></span><strong>Não classificados</strong></div>
                <div className="tier-dropzone">
                  {unassigned.map((owner) => (
                    <DeckTile
                      key={owner.deck.id}
                      owner={owner}
                      tiers={tierList.tiers}
                      currentTier=""
                      onAssign={(tierId) => assignDeck(owner.deck.id, tierId)}
                      onDragStart={() => setDraggedId(owner.deck.id)}
                      onDragEnd={() => setDraggedId('')}
                    />
                  ))}
                  {unassigned.length === 0 && <span className="drop-hint">Todos os decks foram classificados</span>}
                </div>
              </div>
            </div>
          </section>

          <StatsPanel tierList={tierList} participants={participants} />
        </>
      )}

      <TierSharePreview
        containerRef={sharePreviewRef}
        tierList={tierList}
        tierDecks={tierList.tiers.map((tier) => ({ tier, decks: decksForTier(tier.id) }))}
        unassigned={unassigned}
      />

      <div className="tier-danger-zone">
        <button className="text-button text-button--danger" type="button" onClick={onDelete}>
          <Icon name="trash" /> Excluir esta tier list
        </button>
      </div>
    </div>
  )
}

function DeckTile({
  owner,
  tiers,
  currentTier,
  onAssign,
  onDragStart,
  onDragEnd,
  onDropBefore,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
}: {
  owner: DeckOwner
  tiers: TierList['tiers']
  currentTier: string
  onAssign: (tierId: string) => void
  onDragStart: () => void
  onDragEnd?: () => void
  onDropBefore?: (commanderId: string) => void
  canMoveUp?: boolean
  canMoveDown?: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
}) {
  const { deck, participant } = owner
  return (
    <article
      className="deck-tile"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', deck.id)
        event.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        if (!onDropBefore) return
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(event) => {
        if (!onDropBefore) return
        event.preventDefault()
        event.stopPropagation()
        const commanderId = event.dataTransfer.getData('text/plain')
        if (commanderId) onDropBefore(commanderId)
      }}
    >
      <div className={`deck-tile__art ${deck.partner ? 'has-partner' : ''}`}>
        {deck.commander.artCropUrl || deck.commander.imageUrl ? (
          <img src={deck.commander.artCropUrl || deck.commander.imageUrl} alt="" />
        ) : <Icon name="cards" />}
        {deck.partner && (
          deck.partner.artCropUrl || deck.partner.imageUrl
            ? <img src={deck.partner.artCropUrl || deck.partner.imageUrl} alt="" />
            : <span className="partner-art-placeholder">+</span>
        )}
        <span className="drag-grip">⠿</span>
        {currentTier && (
          <span className="deck-order-controls" aria-label="Ordenar comandante">
            <button
              type="button"
              disabled={!canMoveUp}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onMoveUp}
              aria-label={`Mover ${deckLabel(deck)} para cima`}
              title="Mover para cima"
            >↑</button>
            <button
              type="button"
              disabled={!canMoveDown}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onMoveDown}
              aria-label={`Mover ${deckLabel(deck)} para baixo`}
              title="Mover para baixo"
            >↓</button>
          </span>
        )}
      </div>
      <div className="deck-tile__body">
        <strong title={deckLabel(deck)}>{deckLabel(deck)}</strong>
        <span>{participant.name}</span>
        <select
          value={currentTier}
          aria-label={`Tier de ${deckLabel(deck)}`}
          onChange={(event) => onAssign(event.target.value)}
        >
          <option value="">Sem tier</option>
          {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
        </select>
      </div>
    </article>
  )
}

function TierSharePreview({
  containerRef,
  tierList,
  tierDecks,
  unassigned,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>
  tierList: TierList
  tierDecks: Array<{ tier: TierList['tiers'][number]; decks: DeckOwner[] }>
  unassigned: DeckOwner[]
}) {
  return (
    <div className="tier-share-preview" ref={containerRef} aria-hidden="true">
      <header className="tier-share-preview__header">
        <div><span>COMMANDER LAB</span><h1>{tierList.name}</h1></div>
        <small>Tier list de Commander</small>
      </header>
      <div className="tier-share-preview__board">
        {tierDecks.map(({ tier, decks }) => (
          <div className="share-tier-row" key={tier.id}>
            <div className="share-tier-label" style={{ '--share-tier-color': tier.color } as React.CSSProperties}>
              {tier.name}
            </div>
            <div className="share-tier-decks">
              {decks.map((owner) => <ShareDeck key={owner.deck.id} owner={owner} />)}
              {decks.length === 0 && <span className="share-tier-empty">—</span>}
            </div>
          </div>
        ))}
        {unassigned.length > 0 && (
          <div className="share-tier-row share-tier-row--unassigned">
            <div className="share-tier-label">Não classificados</div>
            <div className="share-tier-decks">
              {unassigned.map((owner) => <ShareDeck key={owner.deck.id} owner={owner} />)}
            </div>
          </div>
        )}
      </div>
      <footer>Organize · Classifique · Compare <strong>commander lab</strong></footer>
    </div>
  )
}

function ShareDeck({ owner: { deck, participant } }: { owner: DeckOwner }) {
  const commanderArt = deck.commander.artCropUrl || deck.commander.imageUrl
  const partnerArt = deck.partner?.artCropUrl || deck.partner?.imageUrl
  return (
    <div className={`share-deck ${deck.partner ? 'has-partner' : ''}`}>
      <div className="share-deck__art">
        {commanderArt ? <img crossOrigin="anonymous" src={commanderArt} alt="" /> : <span>?</span>}
        {deck.partner && (
          partnerArt ? <img crossOrigin="anonymous" src={partnerArt} alt="" /> : <span>+</span>
        )}
      </div>
      <strong>{deckLabel(deck)}</strong>
      <small>{participant.name}</small>
    </div>
  )
}

function StatsPanel({ tierList, participants }: { tierList: TierList; participants: Participant[] }) {
  const stats = participants.map((participant) => {
    const scores = participant.commanders.flatMap((deck) => {
      const assignment = tierList.assignments.find((item) => item.commanderId === deck.id)
      if (!assignment) return []
      const tierIndex = tierList.tiers.findIndex((tier) => tier.id === assignment.tierId)
      return tierIndex < 0 ? [] : [tierList.tiers.length - tierIndex]
    })
    const average = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0
    const distribution = tierList.tiers.map((tier) => ({
      tier,
      count: participant.commanders.filter((deck) =>
        tierList.assignments.some(
          (item) => item.commanderId === deck.id && item.tierId === tier.id,
        ),
      ).length,
    }))
    return { participant, average, assigned: scores.length, distribution }
  }).sort((a, b) => b.average - a.average || b.assigned - a.assigned || a.participant.name.localeCompare(b.participant.name))

  const hasAssignments = tierList.assignments.length > 0

  return (
    <section className="stats-section">
      <div className="subsection-heading">
        <div><span>02</span><div><h2>Placar da mesa</h2><p>Média baseada na posição dos tiers.</p></div></div>
        <div className="score-legend">Top tier = {tierList.tiers.length} pts</div>
      </div>

      {!hasAssignments ? (
        <div className="stats-empty"><Icon name="chart" /><p>Classifique pelo menos um deck para revelar o ranking.</p></div>
      ) : (
        <div className="stats-grid">
          <div className="ranking-card panel">
            <div className="ranking-card__title"><Icon name="chart" /><div><span>Ranking geral</span><small>Por média de pontos</small></div></div>
            <div className="ranking-list">
              {stats.map((item, index) => (
                <div className="ranking-row" key={item.participant.id}>
                  <span className={`rank-position rank-${index + 1}`}>{index + 1}</span>
                  <span className="player-avatar">{item.participant.name.slice(0, 1).toUpperCase()}</span>
                  <span className="ranking-name"><strong>{item.participant.name}</strong><small>{item.assigned} {item.assigned === 1 ? 'deck avaliado' : 'decks avaliados'}</small></span>
                  <span className="ranking-score">{item.assigned ? item.average.toFixed(2) : '—'}<small>média</small></span>
                </div>
              ))}
            </div>
          </div>

          <div className="distribution-card panel">
            <div className="ranking-card__title"><Icon name="layers" /><div><span>Distribuição</span><small>Decks de cada jogador por tier</small></div></div>
            <div className="distribution-list">
              {stats.map((item) => (
                <div className="distribution-row" key={item.participant.id}>
                  <strong>{item.participant.name}</strong>
                  <div className="distribution-tiers">
                    {item.distribution.map(({ tier, count }) => (
                      <span key={tier.id} title={`${tier.name}: ${count}`} style={{ '--dot-color': tier.color } as React.CSSProperties}>
                        <i /> {tier.name} <b>{count}</b>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
