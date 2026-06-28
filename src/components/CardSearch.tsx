import { useEffect, useRef, useState } from 'react'
import type { CardData } from '../types'
import { Icon } from './Icon'

type ScryfallCard = {
  id: string
  name: string
  image_uris?: { normal?: string; small?: string }
  card_faces?: Array<{ image_uris?: { normal?: string; small?: string } }>
}

type Props = {
  value: CardData
  onChange: (card: CardData) => void
  label: string
  placeholder?: string
}

const imageFromCard = (card: ScryfallCard, size: 'normal' | 'small') =>
  card.image_uris?.[size] ?? card.card_faces?.[0]?.image_uris?.[size] ?? ''

export function CardSearch({ value, onChange, label, placeholder }: Props) {
  const [results, setResults] = useState<ScryfallCard[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'empty'>('idle')
  const [open, setOpen] = useState(false)
  const selectedName = useRef(value.imageUrl ? value.name : '')

  useEffect(() => {
    const term = value.name.trim()
    if (term.length < 2 || term === selectedName.current) {
      setResults([])
      setStatus('idle')
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setStatus('loading')
      setOpen(true)
      try {
        const query = encodeURIComponent(`${term} is:commander`)
        const response = await fetch(
          `https://api.scryfall.com/cards/search?q=${query}&order=name&unique=cards`,
          {
            signal: controller.signal,
            headers: { Accept: 'application/json;q=0.9,*/*;q=0.8' },
          },
        )

        if (response.status === 404) {
          setResults([])
          setStatus('empty')
          return
        }
        if (!response.ok) throw new Error('Scryfall indisponível')

        const payload = (await response.json()) as { data?: ScryfallCard[] }
        const cards = (payload.data ?? []).slice(0, 8)
        setResults(cards)
        setStatus(cards.length ? 'idle' : 'empty')
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setResults([])
          setStatus('error')
        }
      }
    }, 420)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [value.name])

  const selectCard = (card: ScryfallCard) => {
    selectedName.current = card.name
    onChange({
      name: card.name,
      imageUrl: imageFromCard(card, 'normal'),
      scryfallId: card.id,
    })
    setOpen(false)
    setResults([])
    setStatus('idle')
  }

  return (
    <div className="card-search">
      <label className="field-label">{label}</label>
      <div className="input-with-icon">
        <Icon name="search" />
        <input
          value={value.name}
          placeholder={placeholder ?? 'Digite o nome da carta'}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            selectedName.current = ''
            onChange({ name: event.target.value, imageUrl: '' })
          }}
        />
        {status === 'loading' && <span className="input-loader" aria-label="Buscando" />}
      </div>

      {open && (results.length > 0 || status !== 'idle') && (
        <div className="search-popover">
          {results.map((card) => (
            <button
              type="button"
              className="search-result"
              key={card.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectCard(card)}
            >
              {imageFromCard(card, 'small') ? (
                <img src={imageFromCard(card, 'small')} alt="" />
              ) : (
                <span className="result-placeholder"><Icon name="cards" /></span>
              )}
              <span>{card.name}</span>
            </button>
          ))}
          {status === 'loading' && <p className="search-message">Buscando na Scryfall…</p>}
          {status === 'empty' && (
            <p className="search-message">Nenhum comandante encontrado. Você ainda pode salvar o nome digitado.</p>
          )}
          {status === 'error' && (
            <p className="search-message search-message--error">
              Scryfall está indisponível. O nome pode ser salvo sem imagem.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
