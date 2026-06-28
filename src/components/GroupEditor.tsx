import { useState } from 'react'
import { createDeck, createGroup, createParticipant, emptyCard } from '../lib'
import { useStore } from '../store'
import { downloadGroupExport } from '../transfer'
import type { CardData, CommanderDeck, Group, Participant } from '../types'
import { CardSearch } from './CardSearch'
import { Icon } from './Icon'

type Props = {
  group?: Group
  onCancel: () => void
  onSaved: (message: string) => void
}

const copyGroup = (group: Group) => JSON.parse(JSON.stringify(group)) as Group

export function GroupEditor({ group: savedGroup, onCancel, onSaved }: Props) {
  const { upsertGroup, deleteGroup, tierLists } = useStore()
  const [group, setGroup] = useState<Group>(() =>
    savedGroup ? copyGroup(savedGroup) : createGroup(),
  )
  const [error, setError] = useState('')
  const [expandedParticipantIds, setExpandedParticipantIds] = useState<Set<string>>(
    () => new Set(savedGroup?.participants.map((participant) => participant.id) ?? []),
  )

  const updateParticipant = (participantId: string, update: (item: Participant) => Participant) => {
    setGroup((current) => ({
      ...current,
      participants: current.participants.map((participant) =>
        participant.id === participantId ? update(participant) : participant,
      ),
    }))
  }

  const addParticipant = () => {
    const participant = createParticipant()
    setGroup((current) => ({
      ...current,
      participants: [...current.participants, participant],
    }))
    setExpandedParticipantIds((current) => new Set(current).add(participant.id))
  }

  const removeParticipant = (participantId: string) => {
    setGroup((current) => ({
      ...current,
      participants: current.participants.filter((item) => item.id !== participantId),
    }))
    setExpandedParticipantIds((current) => {
      const next = new Set(current)
      next.delete(participantId)
      return next
    })
  }

  const toggleParticipantDecks = (participantId: string) => {
    setExpandedParticipantIds((current) => {
      const next = new Set(current)
      if (next.has(participantId)) next.delete(participantId)
      else next.add(participantId)
      return next
    })
  }

  const updateDeck = (
    participantId: string,
    deckId: string,
    update: (deck: CommanderDeck) => CommanderDeck,
  ) => {
    updateParticipant(participantId, (participant) => ({
      ...participant,
      commanders: participant.commanders.map((deck) =>
        deck.id === deckId ? update(deck) : deck,
      ),
    }))
  }

  const save = () => {
    if (!group.name.trim()) {
      setError('Dê um nome ao grupo antes de salvar.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (group.participants.some((participant) => !participant.name.trim())) {
      setError('Todo participante precisa ter um nome.')
      return
    }
    if (
      group.participants.some((participant) =>
        participant.commanders.some(
          (deck) => !deck.commander.name.trim() || (deck.partner && !deck.partner.name.trim()),
        ),
      )
    ) {
      setError('Preencha os nomes de todos os comandantes adicionados.')
      return
    }

    const normalized: Group = {
      ...group,
      name: group.name.trim(),
      participants: group.participants.map((participant) => ({
        ...participant,
        name: participant.name.trim(),
        commanders: participant.commanders.map((deck) => ({
          ...deck,
          commander: { ...deck.commander, name: deck.commander.name.trim() },
          ...(deck.partner
            ? { partner: { ...deck.partner, name: deck.partner.name.trim() } }
            : {}),
        })),
      })),
    }
    upsertGroup(normalized)
    onSaved(savedGroup ? 'Grupo atualizado com sucesso.' : 'Grupo criado com sucesso.')
  }

  const removeGroup = () => {
    if (!savedGroup) return
    if (window.confirm(`Excluir “${savedGroup.name}” e todas as suas tier lists?`)) {
      deleteGroup(savedGroup.id)
      onSaved('Grupo excluído.')
    }
  }

  return (
    <main className="page page--editor">
      <div className="page-heading page-heading--compact">
        <button className="back-link" type="button" onClick={onCancel}>
          <Icon name="arrow-left" /> Voltar para grupos
        </button>
        <div>
          <p className="eyebrow">{savedGroup ? 'Configurações do grupo' : 'Novo grupo'}</p>
          <h1>{savedGroup ? 'Editar grupo' : 'Monte sua mesa'}</h1>
          <p>Adicione os jogadores e deixe a Scryfall cuidar das imagens.</p>
        </div>
      </div>

      {error && (
        <div className="alert alert--error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Fechar aviso">
            <Icon name="x" />
          </button>
        </div>
      )}

      <section className="panel group-basics">
        <div className="section-number">01</div>
        <div className="section-copy">
          <h2>Identidade do grupo</h2>
          <p>Um nome fácil de encontrar depois daquela partida longa.</p>
        </div>
        <div className="field group-name-field">
          <label htmlFor="group-name">Nome do grupo <span>*</span></label>
          <input
            id="group-name"
            value={group.name}
            autoFocus
            placeholder="Ex: Jogadores de Quinta"
            onChange={(event) => setGroup((current) => ({ ...current, name: event.target.value }))}
          />
        </div>
      </section>

      <section className="participants-section">
        <div className="section-title-row">
          <div className="section-number">02</div>
          <div className="section-copy">
            <h2>Participantes e decks</h2>
            <p>Cadastre quantos jogadores e comandantes quiser.</p>
          </div>
          <button className="button button--secondary" type="button" onClick={addParticipant}>
            <Icon name="plus" /> Adicionar participante
          </button>
        </div>

        {group.participants.length === 0 ? (
          <div className="mini-empty panel">
            <div className="mini-empty__icon"><Icon name="users" /></div>
            <div>
              <h3>Sua mesa ainda está vazia</h3>
              <p>Adicione o primeiro participante para começar.</p>
            </div>
            <button className="button button--primary" type="button" onClick={addParticipant}>
              <Icon name="plus" /> Adicionar participante
            </button>
          </div>
        ) : (
          <div className="participants-list">
            {group.participants.map((participant, participantIndex) => {
              const decksExpanded = expandedParticipantIds.has(participant.id)
              const decksSectionId = `participant-decks-${participant.id}`

              return (
              <article
                className={`participant-card panel ${decksExpanded ? 'is-expanded' : 'is-collapsed'}`}
                key={participant.id}
              >
                <header className="participant-header">
                  <div className="player-number">{String(participantIndex + 1).padStart(2, '0')}</div>
                  <div className="field participant-name-field">
                    <label htmlFor={`participant-${participant.id}`}>Nome do jogador</label>
                    <input
                      id={`participant-${participant.id}`}
                      value={participant.name}
                      placeholder="Ex: João"
                      onChange={(event) =>
                        updateParticipant(participant.id, (item) => ({
                          ...item,
                          name: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="participant-header__actions">
                    <button
                      className={`decks-toggle ${decksExpanded ? 'is-expanded' : ''}`}
                      type="button"
                      aria-expanded={decksExpanded}
                      aria-controls={decksSectionId}
                      onClick={() => toggleParticipantDecks(participant.id)}
                    >
                      <span>{decksExpanded ? 'Esconder decks' : 'Mostrar decks'}</span>
                      <small>{participant.commanders.length}</small>
                      <Icon name="chevron-right" />
                    </button>
                    <button
                      className="icon-button icon-button--danger"
                      type="button"
                      onClick={() => removeParticipant(participant.id)}
                      aria-label="Remover participante"
                      title="Remover participante"
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                </header>

                <div
                  className="participant-decks"
                  id={decksSectionId}
                  hidden={!decksExpanded}
                >
                  <div className="decks-list">
                    {participant.commanders.map((deck, deckIndex) => (
                      <DeckEditor
                        key={deck.id}
                        deck={deck}
                        index={deckIndex}
                        onChange={(update) => updateDeck(participant.id, deck.id, update)}
                        onRemove={() =>
                          updateParticipant(participant.id, (item) => ({
                            ...item,
                            commanders: item.commanders.filter((candidate) => candidate.id !== deck.id),
                          }))
                        }
                      />
                    ))}
                  </div>

                  <button
                    className="add-deck-button"
                    type="button"
                    onClick={() =>
                      updateParticipant(participant.id, (item) => ({
                        ...item,
                        commanders: [...item.commanders, createDeck()],
                      }))
                    }
                  >
                    <Icon name="plus" /> Adicionar deck
                  </button>
                </div>
              </article>
              )
            })}
          </div>
        )}
      </section>

      <footer className="editor-actions">
        {savedGroup && (
          <div className="editor-actions__secondary">
            <button
              className="button button--secondary"
              type="button"
              onClick={() =>
                downloadGroupExport(
                  group,
                  tierLists.filter((tierList) => tierList.groupId === group.id),
                )
              }
            >
              <Icon name="download" /> Exportar grupo
            </button>
            <button className="button button--danger-text" type="button" onClick={removeGroup}>
              <Icon name="trash" /> Excluir grupo
            </button>
          </div>
        )}
        <div className="editor-actions__main">
          <button className="button button--ghost" type="button" onClick={onCancel}>Cancelar</button>
          <button className="button button--primary" type="button" onClick={save}>
            Salvar grupo <Icon name="chevron-right" />
          </button>
        </div>
      </footer>
    </main>
  )
}

function DeckEditor({
  deck,
  index,
  onChange,
  onRemove,
}: {
  deck: CommanderDeck
  index: number
  onChange: (update: (deck: CommanderDeck) => CommanderDeck) => void
  onRemove: () => void
}) {
  const setCommander = (commander: CardData) => onChange((item) => ({ ...item, commander }))
  const setPartner = (partner: CardData) => onChange((item) => ({ ...item, partner }))

  return (
    <div className="deck-editor">
      <div className="deck-editor__topline">
        <span>Deck {String(index + 1).padStart(2, '0')}</span>
        <label className="partner-toggle">
          <input
            type="checkbox"
            checked={Boolean(deck.partner)}
            onChange={(event) =>
              onChange((item) =>
                event.target.checked
                  ? { ...item, partner: emptyCard() }
                  : { id: item.id, commander: item.commander },
              )
            }
          />
          <span className="toggle-track"><span /></span>
          Possui parceiro?
        </label>
        <button className="text-button text-button--danger" type="button" onClick={onRemove}>
          Remover deck
        </button>
      </div>

      <div className={`deck-editor__content ${deck.partner ? 'is-partnered' : ''}`}>
        <CommanderField
          card={deck.commander}
          label={deck.partner ? 'Comandante 1' : 'Comandante'}
          onChange={setCommander}
        />
        {deck.partner && (
          <>
            <div className="partner-plus">+</div>
            <CommanderField card={deck.partner} label="Comandante 2" onChange={setPartner} />
          </>
        )}
      </div>
    </div>
  )
}

function CommanderField({
  card,
  label,
  onChange,
}: {
  card: CardData
  label: string
  onChange: (card: CardData) => void
}) {
  return (
    <div className="commander-field">
      <div className={`card-preview ${card.imageUrl ? 'has-image' : ''}`}>
        {card.imageUrl ? (
          <img src={card.imageUrl} alt={card.name} />
        ) : (
          <div className="card-placeholder">
            <Icon name="cards" />
            <span>A arte da carta aparece aqui</span>
          </div>
        )}
      </div>
      <CardSearch value={card} onChange={onChange} label={label} />
    </div>
  )
}
