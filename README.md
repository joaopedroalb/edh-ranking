# Commander Lab

Aplicativo frontend para criar grupos de Commander, cadastrar decks pela Scryfall e montar tier lists com ranking automático por jogador.

## Como executar

```bash
npm install
npm run dev
```

Para gerar a versão de produção:

```bash
npm run build
```

## Recursos

- Grupos com participantes e múltiplos decks por jogador
- Importação, exportação e clonagem completa de grupos
- Rotas compartilháveis com histórico do navegador e página 404
- Tema claro/escuro persistido com detecção da preferência do sistema
- Ordenação persistente dentro dos tiers e exportação da classificação em PNG
- Links externos de decklist por deck, com validação HTTP/HTTPS
- Randomização do pool “Sem tier”, alternando jogadores sempre que possível
- Uso de `art_crop` da Scryfall com fallback para a imagem normal
- Comandantes únicos ou em dupla
- Busca com autocomplete e imagens pela API da Scryfall
- Tier lists com nomes, cores e quantidade de tiers personalizáveis
- Atribuição por arrastar e soltar ou por seletor
- Média, ranking e distribuição de tiers por jogador
- Persistência completa no `localStorage`
- Recuperação segura de dados locais inválidos e fallback quando a API estiver offline
- Layout responsivo para desktop e celular

## Pontuação

O tier mais alto vale uma quantidade de pontos igual ao total de tiers; cada nível abaixo vale um ponto a menos. A média considera apenas os decks já classificados.
