import { deckLabel } from '../lib'
import type { Group, TierList } from '../types'
import { Icon } from './Icon'

type DetailsProps = {
  group: Group
  tierLists: TierList[]
  onBack: () => void
  onEdit: () => void
  onStats: () => void
  onCreateTierList: () => void
  onOpenTierList: (tierListId: string) => void
}

export function GroupDetails({
  group,
  tierLists,
  onBack,
  onEdit,
  onStats,
  onCreateTierList,
  onOpenTierList,
}: DetailsProps) {
  const deckCount = group.participants.reduce(
    (total, participant) => total + participant.commanders.length,
    0,
  )

  return (
    <main className="page group-details-page">
      <button className="back-link" type="button" onClick={onBack}>
        <Icon name="arrow-left" /> Voltar para grupos
      </button>

      <header className="details-hero panel">
        <div className="details-hero__avatar">{group.name.slice(0, 1).toUpperCase()}</div>
        <div className="details-hero__copy">
          <p className="eyebrow">Detalhes da mesa</p>
          <h1>{group.name}</h1>
          <div className="details-hero__meta">
            <span><Icon name="users" /> {group.participants.length} participantes</span>
            <span><Icon name="cards" /> {deckCount} decks</span>
            <span><Icon name="layers" /> {tierLists.length} tier lists</span>
          </div>
        </div>
        <div className="details-hero__actions">
          <button className="button button--ghost" type="button" onClick={onStats}>
            <Icon name="chart" /> Estatísticas
          </button>
          <button className="button button--secondary" type="button" onClick={onEdit}>
            <Icon name="edit" /> Editar grupo
          </button>
          <button className="button button--primary" type="button" onClick={onCreateTierList}>
            <Icon name="plus" /> Nova tier list
          </button>
        </div>
      </header>

      <section className="details-section">
        <div className="section-title-row section-title-row--home">
          <div><p className="eyebrow">Classificações</p><h2>Tier lists do grupo</h2></div>
          <button className="button button--secondary" type="button" onClick={onCreateTierList}>
            <Icon name="plus" /> Criar tier list
          </button>
        </div>

        {tierLists.length === 0 ? (
          <div className="details-empty panel">
            <Icon name="layers" />
            <div><h3>Nenhuma tier list criada</h3><p>Crie a primeira classificação desta mesa.</p></div>
            <button className="button button--primary" type="button" onClick={onCreateTierList}>
              Criar tier list <Icon name="chevron-right" />
            </button>
          </div>
        ) : (
          <div className="details-tier-grid">
            {tierLists.map((tierList) => {
              const classified = new Set(tierList.assignments.map((item) => item.commanderId)).size
              const completion = deckCount ? Math.round((classified / deckCount) * 100) : 0
              return (
                <button
                  className="details-tier-card panel"
                  type="button"
                  key={tierList.id}
                  onClick={() => onOpenTierList(tierList.id)}
                >
                  <span className="details-tier-card__icon"><Icon name="layers" /></span>
                  <span className="details-tier-card__copy">
                    <strong>{tierList.name}</strong>
                    <small>{tierList.tiers.length} tiers · {classified}/{deckCount} decks</small>
                  </span>
                  <span className="details-tier-card__progress">
                    <i><b style={{ width: `${completion}%` }} /></i><small>{completion}%</small>
                  </span>
                  <Icon name="chevron-right" />
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="details-section">
        <div className="section-title-row section-title-row--home">
          <div><p className="eyebrow">A mesa</p><h2>Participantes e decks</h2></div>
        </div>
        <div className="details-player-grid">
          {group.participants.map((participant) => (
            <article className="details-player-card panel" key={participant.id}>
              <header><span>{participant.name.slice(0, 1).toUpperCase()}</span><div><h3>{participant.name}</h3><small>{participant.commanders.length} decks</small></div></header>
              <div className="details-deck-list">
                {participant.commanders.map((deck) => (
                  <div key={deck.id}>
                    {deck.commander.artCropUrl || deck.commander.imageUrl ? (
                      <img src={deck.commander.artCropUrl || deck.commander.imageUrl} alt="" />
                    ) : <span><Icon name="cards" /></span>}
                    <strong title={deckLabel(deck)}>{deckLabel(deck)}</strong>
                  </div>
                ))}
                {participant.commanders.length === 0 && <p>Nenhum deck cadastrado.</p>}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

type StatsProps = {
  group: Group
  tierLists: TierList[]
  onBack: () => void
  onOpenTierList: (tierListId: string) => void
}

export function GroupStats({ group, tierLists, onBack, onOpenTierList }: StatsProps) {
  const deckCount = group.participants.reduce(
    (total, participant) => total + participant.commanders.length,
    0,
  )
  const totalPossibleAssignments = deckCount * tierLists.length
  const totalAssignments = tierLists.reduce((total, list) => total + list.assignments.length, 0)
  const completion = totalPossibleAssignments
    ? Math.round((totalAssignments / totalPossibleAssignments) * 100)
    : 0

  const ranking = group.participants
    .map((participant) => {
      const scores = tierLists.flatMap((list) =>
        participant.commanders.flatMap((deck) => {
          const assignment = list.assignments.find((item) => item.commanderId === deck.id)
          if (!assignment) return []
          const tierIndex = list.tiers.findIndex((tier) => tier.id === assignment.tierId)
          return tierIndex < 0 ? [] : [(list.tiers.length - tierIndex) / Math.max(list.tiers.length, 1) * 100]
        }),
      )
      return {
        participant,
        evaluations: scores.length,
        average: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0,
      }
    })
    .sort((a, b) => b.average - a.average || b.evaluations - a.evaluations)

  return (
    <main className="page group-stats-page">
      <button className="back-link" type="button" onClick={onBack}>
        <Icon name="arrow-left" /> Voltar para {group.name}
      </button>
      <div className="page-heading stats-heading">
        <div><p className="eyebrow">Visão geral</p><h1>Estatísticas da mesa</h1><p>{group.name}</p></div>
      </div>

      <div className="overview-stat-grid">
        <div className="overview-stat panel"><Icon name="users" /><span><strong>{group.participants.length}</strong><small>jogadores</small></span></div>
        <div className="overview-stat panel"><Icon name="cards" /><span><strong>{deckCount}</strong><small>decks</small></span></div>
        <div className="overview-stat panel"><Icon name="layers" /><span><strong>{tierLists.length}</strong><small>tier lists</small></span></div>
        <div className="overview-stat panel"><Icon name="chart" /><span><strong>{completion}%</strong><small>classificado</small></span></div>
      </div>

      <div className="stats-overview-grid">
        <section className="panel stats-overview-card">
          <div className="ranking-card__title"><Icon name="chart" /><div><span>Ranking combinado</span><small>Nota normalizada entre todas as listas</small></div></div>
          <div className="ranking-list">
            {ranking.map((item, index) => (
              <div className="ranking-row" key={item.participant.id}>
                <span className={`rank-position rank-${index + 1}`}>{index + 1}</span>
                <span className="player-avatar">{item.participant.name.slice(0, 1).toUpperCase()}</span>
                <span className="ranking-name"><strong>{item.participant.name}</strong><small>{item.evaluations} avaliações</small></span>
                <span className="ranking-score">{item.evaluations ? item.average.toFixed(1) : '—'}<small>de 100</small></span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel stats-overview-card">
          <div className="ranking-card__title"><Icon name="layers" /><div><span>Progresso das listas</span><small>Decks classificados em cada critério</small></div></div>
          <div className="list-progress-list">
            {tierLists.map((list) => {
              const value = deckCount ? Math.round((list.assignments.length / deckCount) * 100) : 0
              return (
                <button type="button" key={list.id} onClick={() => onOpenTierList(list.id)}>
                  <span><strong>{list.name}</strong><small>{list.assignments.length}/{deckCount} decks</small></span>
                  <i><b style={{ width: `${value}%` }} /></i>
                  <em>{value}%</em>
                </button>
              )
            })}
            {tierLists.length === 0 && <p className="stats-list-empty">Crie uma tier list para começar a gerar estatísticas.</p>}
          </div>
        </section>
      </div>
    </main>
  )
}
