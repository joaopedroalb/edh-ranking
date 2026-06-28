import { useRef, useState, type ChangeEvent } from 'react'
import { deckLabel } from '../lib'
import { useStore } from '../store'
import { cloneGroupBundle, parseGroupExport } from '../transfer'
import type { Group } from '../types'
import { Icon } from './Icon'

type Props = {
  onCreate: () => void
  onEdit: (group: Group) => void
  onTierList: (group: Group) => void
  onNotify: (message: string, type?: 'success' | 'error') => void
}

export function Home({ onCreate, onEdit, onTierList, onNotify }: Props) {
  const { groups, tierLists, addGroupBundle } = useStore()
  const importInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const totalDecks = groups.reduce(
    (total, group) =>
      total + group.participants.reduce((sum, participant) => sum + participant.commanders.length, 0),
    0,
  )

  const importGroup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      onNotify('O arquivo é muito grande. O limite para importação é 5 MB.', 'error')
      return
    }

    setImporting(true)
    try {
      const bundle = parseGroupExport(await file.text(), groups.map((group) => group.name))
      addGroupBundle(bundle.group, bundle.tierLists)
      onNotify(`Grupo “${bundle.group.name}” importado com sucesso.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'O arquivo não pôde ser processado.'
      onNotify(`Não foi possível importar o grupo: ${message}`, 'error')
    } finally {
      setImporting(false)
    }
  }

  const cloneGroup = (group: Group) => {
    const bundle = cloneGroupBundle(group, tierLists, groups.map((item) => item.name))
    addGroupBundle(bundle.group, bundle.tierLists)
    onNotify(`Grupo clonado como “${bundle.group.name}”.`)
  }

  const openImporter = () => importInputRef.current?.click()

  return (
    <main className="page home-page">
      <input
        ref={importInputRef}
        className="visually-hidden"
        type="file"
        accept="application/json,.json"
        onChange={importGroup}
        aria-label="Selecionar arquivo JSON de grupo"
      />
      <div className="home-hero">
        <div className="home-hero__copy">
          <p className="eyebrow"><span /> Seu laboratório de Commander</p>
          <h1>Menos planilhas.<br /><em>Mais política de mesa.</em></h1>
          <p className="hero-description">
            Organize seus grupos, classifique cada deck e descubra quem realmente está jogando sujo.
          </p>
          <div className="hero-actions">
            <button className="button button--primary button--large" type="button" onClick={onCreate}>
              <Icon name="plus" /> Criar novo grupo
            </button>
            <button
              className="button button--secondary button--large"
              type="button"
              onClick={openImporter}
              disabled={importing}
            >
              <Icon name="upload" /> {importing ? 'Importando…' : 'Importar grupo'}
            </button>
          </div>
        </div>
        <div className="hero-stat-card">
          <div className="orbit orbit--one" />
          <div className="orbit orbit--two" />
          <div className="hero-stat-card__mark"><Icon name="spark" /></div>
          <div className="hero-stat-card__numbers">
            <div><strong>{groups.length}</strong><span>grupos</span></div>
            <div><strong>{totalDecks}</strong><span>decks</span></div>
            <div><strong>{tierLists.length}</strong><span>listas</span></div>
          </div>
        </div>
      </div>

      <section className="groups-section">
        <div className="section-title-row section-title-row--home">
          <div>
            <p className="eyebrow">Seus grupos</p>
            <h2>Mesas cadastradas</h2>
          </div>
          {groups.length > 0 && (
            <div className="section-actions">
              <button className="button button--ghost" type="button" onClick={openImporter} disabled={importing}>
                <Icon name="upload" /> Importar grupo
              </button>
              <button className="button button--secondary" type="button" onClick={onCreate}>
                <Icon name="plus" /> Novo grupo
              </button>
            </div>
          )}
        </div>

        {groups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__art" aria-hidden="true">
              <div className="empty-card empty-card--back" />
              <div className="empty-card empty-card--middle" />
              <div className="empty-card empty-card--front"><Icon name="cards" /></div>
            </div>
            <p className="eyebrow">Comece por aqui</p>
            <h2>Nenhum grupo criado.<br />Crie seu primeiro grupo!</h2>
            <p>Cadastre sua mesa e os comandantes de cada jogador. Leva menos de um turno.</p>
            <div className="empty-state__actions">
              <button className="button button--primary" type="button" onClick={onCreate}>
                <Icon name="plus" /> Criar primeiro grupo
              </button>
              <button className="button button--ghost" type="button" onClick={openImporter} disabled={importing}>
                <Icon name="upload" /> Importar grupo
              </button>
            </div>
          </div>
        ) : (
          <div className="group-grid">
            {groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                listCount={tierLists.filter((list) => list.groupId === group.id).length}
                onEdit={() => onEdit(group)}
                onTierList={() => onTierList(group)}
                onClone={() => cloneGroup(group)}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function GroupCard({
  group,
  listCount,
  onEdit,
  onTierList,
  onClone,
}: {
  group: Group
  listCount: number
  onEdit: () => void
  onTierList: () => void
  onClone: () => void
}) {
  const decks = group.participants.flatMap((participant) =>
    participant.commanders.map((deck) => ({ deck, participant })),
  )
  const images = decks.filter(({ deck }) => deck.commander.imageUrl).slice(0, 3)

  return (
    <article className="group-card">
      <div className="group-card__visual">
        {images.length ? (
          <div className={`group-card__images images-${images.length}`}>
            {images.map(({ deck }) => (
              <img key={deck.id} src={deck.commander.imageUrl} alt={deckLabel(deck)} />
            ))}
          </div>
        ) : (
          <div className="group-card__fallback"><Icon name="cards" /></div>
        )}
        <span className="list-count">{listCount} {listCount === 1 ? 'tier list' : 'tier lists'}</span>
      </div>
      <div className="group-card__body">
        <h3>{group.name}</h3>
        <div className="group-card__meta">
          <span><Icon name="users" /> {group.participants.length} participantes</span>
          <span><Icon name="layers" /> {decks.length} decks</span>
        </div>
        <div className="group-card__players">
          {group.participants.slice(0, 4).map((participant) => (
            <span key={participant.id} title={participant.name}>
              {participant.name.slice(0, 1).toUpperCase() || '?'}
            </span>
          ))}
          {group.participants.length > 4 && <small>+{group.participants.length - 4}</small>}
        </div>
        <div className="group-card__actions">
          <button className="button button--ghost" type="button" onClick={onEdit}>
            <Icon name="edit" /> Editar grupo
          </button>
          <button className="button button--ghost" type="button" onClick={onClone}>
            <Icon name="copy" /> Clonar
          </button>
          <button className="button button--dark" type="button" onClick={onTierList}>
            Tier list <Icon name="chevron-right" />
          </button>
        </div>
      </div>
    </article>
  )
}
