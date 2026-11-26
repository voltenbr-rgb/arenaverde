# Arena Verde

Tower defense militar em pixel art: posicione soldados numa arena de grama 5×9 e segure a base por **10 ondas** de zumbis. Na onda 10 chega o **Chefão Metralhadora**.

## Regra de ouro das artes
Cada personagem tem 2 artes, e uma nunca substitui a outra:

| Arte | Onde fica | Uso |
| --- | --- | --- |
| **Carta** (retrato grande) | `public/assets/cards/art-*.jpg` e `card-*.jpg` | Só nas cartas e na seleção de esquadrão |
| **Sprite de ação** (pequeno, de lado, fundo transparente) | `public/assets/sprites/*.png` | Só dentro do campo |

O campo é desenhado em alta resolução, então os sprites ficam nítidos e acompanham o tamanho da casa (cerca de 64 px no celular deitado e 80–110 px no PC). Cada sprite tem 2 frames: **parado** (respirando) e **atacando** (recuo). Os zumbis têm frames de andar e de morder.

## Modo Tanque
No menu, **MODO TANQUE** abre a **Garagem**, onde você escolhe a camuflagem (verde, deserto, neve ou urbano), o canhão (leve, padrão ou pesado) e o chassi (leve, médio ou pesado). Depois você pilota o tanque pelo mapa contra as 10 ondas. Entre as ondas, a **Oficina** vende melhorias com as moedas ganhas: blindagem, munição, recarga, metralhadora, motor e reparo.

| Ação | PC | Celular |
| --- | --- | --- |
| Andar / ré | ↑ / ↓ | joystick |
| Girar o tanque | ← / → | joystick |
| Girar a torreta | A / D (ou mouse) | mira automática |
| Canhão | Espaço ou B (ou clique) | botão CANHÃO |
| Metralhadora | Enter (segure) | botão METRALHADORA |

A metralhadora esquenta e para por um tempo se você atirar sem parar. Passar por cima dos zumbis com o tanque também causa dano. Caixas de paraquedas dão reparo ou moedas. O código fica na seção `MODO TANQUE` do `game.js`.

## Vista isométrica
O campo é desenhado em ângulo isométrico, sobre o cenário `public/assets/maps/arena.jpg` (muralhas, torre, bunker, barracas). A lógica do jogo continua numa grade simples 5×9; só o desenho e o toque são projetados no tabuleiro inclinado (veja `ISO`, `iso()` e `unproject()` no `game.js`). Para trocar o mapa, substitua a imagem e ajuste `ISO` (canto do tabuleiro e tamanho de uma casa).

O modo principal é o **celular deitado**. Com o celular em pé, aparece uma dica para girar.

## Estrutura
```
public/
  index.html      tela e HUD
  style.css       visual (celular em pé, deitado e PC)
  game.js         lógica do jogo, comentada por seções
  sw.js           app offline (PWA)
  assets/cards/   artes das cartas
  assets/sprites/ sprites de ação do campo
  assets/maps/    cenário isométrico
src/worker.js     Worker: serve o jogo + API do D1
schema.sql        tabelas do D1
```

**Nova carta:** adicione em `U` no `game.js`, coloque o sprite em `assets/sprites/<chave>.png`, a altura em `SPRITE_H` e a lógica de tiro em `update()`.

**Novo zumbi:** adicione em `ZD`, o sprite em `assets/sprites/z_<chave>.png` e a chance de aparecer em `buildWave()`.

## Cartas
Fuzileiro, Granadeiro, Tanque Pesado, Lança-Mísseis, Mina Terrestre e Arame Farpado. Dá para levar até 6 cartas na missão. A **Metralhadora** é liberada na onda 4 e o **Morteiro** na onda 7.

## Banco D1 (`arenaverde`)
Tabelas: `players`, `progresso`, `cartas_desbloqueadas`, `ranking` (ver `schema.sql`).
- O progresso é salvo no fim de cada onda (no aparelho e no D1), e o botão **CONTINUAR** retoma de onde parou.
- O ranking top 10 aparece na tela inicial.
- Cada jogador recebe um token secreto guardado só no aparelho dele.

API: `POST /api/players`, `GET/PUT /api/progress`, `POST /api/unlock`, `GET/POST /api/ranking`.

## Publicar
O deploy é automático pelo Workers Builds a cada push na `main`. Manualmente:
```bash
npm install
npm run deploy
```

## App (PWA)
Instalável e funciona offline (`manifest.webmanifest`, `sw.js`, `icons/`). Ao publicar mudanças grandes, troque a versão `V` no `sw.js`.
