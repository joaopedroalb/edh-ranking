export type CardArtLookup = {
  key: string
  name: string
  scryfallId?: string
}

export type CardArtwork = {
  imageUrl: string
  artCropUrl: string
}

type ScryfallImageUris = {
  art_crop?: string
  normal?: string
  large?: string
}

type ScryfallCard = {
  id: string
  name: string
  image_uris?: ScryfallImageUris
  card_faces?: Array<{ image_uris?: ScryfallImageUris }>
}

type CollectionResponse = {
  data?: ScryfallCard[]
}

const normalizedName = (name: string) => name.trim().toLocaleLowerCase('en-US')
const identifierName = (name: string) => normalizedName(name.split(' // ')[0])

const cardImage = (card: ScryfallCard, field: keyof ScryfallImageUris) =>
  card.image_uris?.[field] ?? card.card_faces?.[0]?.image_uris?.[field] ?? ''

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))

export async function fetchCardArtwork(lookups: CardArtLookup[]) {
  const results = new Map<string, CardArtwork>()
  const uniqueLookups = [...new Map(
    lookups.map((lookup) => [lookup.scryfallId || identifierName(lookup.name), lookup]),
  ).values()]

  for (let index = 0; index < uniqueLookups.length; index += 75) {
    const batch = uniqueLookups.slice(index, index + 75)
    const response = await fetch('https://api.scryfall.com/cards/collection', {
      method: 'POST',
      headers: {
        Accept: 'application/json;q=0.9,*/*;q=0.8',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifiers: batch.map((lookup) =>
          lookup.scryfallId ? { id: lookup.scryfallId } : { name: lookup.name.split(' // ')[0] },
        ),
      }),
    })

    if (!response.ok) throw new Error(`Scryfall indisponível (${response.status})`)
    const payload = (await response.json()) as CollectionResponse
    const cards = payload.data ?? []
    const cardsById = new Map(cards.map((card) => [card.id, card]))
    const cardsByName = new Map(
      cards.flatMap((card) => [
        [normalizedName(card.name), card] as const,
        [identifierName(card.name), card] as const,
      ]),
    )

    batch.forEach((lookup) => {
      const card = lookup.scryfallId
        ? cardsById.get(lookup.scryfallId)
        : cardsByName.get(identifierName(lookup.name))
      if (!card) return
      const normal = cardImage(card, 'normal') || cardImage(card, 'large')
      const artCrop = cardImage(card, 'art_crop') || normal
      if (!artCrop) return

      lookups
        .filter((candidate) =>
          lookup.scryfallId
            ? candidate.scryfallId === lookup.scryfallId
            : !candidate.scryfallId && identifierName(candidate.name) === identifierName(lookup.name),
        )
        .forEach((candidate) => {
          results.set(candidate.key, { imageUrl: normal || artCrop, artCropUrl: artCrop })
        })
    })

    if (index + 75 < uniqueLookups.length) await pause(120)
  }

  return results
}
