# Arena Verde

Tower defense militar em pixel art: posicione soldados numa arena de grama 5×9 e segure a base por **10 ondas** de zumbis. Na onda 10 chega o **Chefão Metralhadora**.

## Regra de ouro das artes
Cada personagem tem 2 artes, e uma nunca substitui a outra:

| Arte | Onde fica | Uso |
| --- | --- | --- |
| **Carta** (retrato grande) | `public/assets/cards/art-*.jpg` e `card-*.jpg` | Só nas cartas e na seleção de esquadrão |
| **Sprite de ação** (pequeno, de lado, fundo transparente) | `public/assets/sprites/*.png` | Só dentro do campo |

O campo é desenhado em alta resolução, então os sprites ficam nítidos e acompanham o tamanho da casa (cerca de 64 px no celular deitado e 80–110 px no PC). Cada sprite tem 2 frames: **parado** (respirando) e **atacando** (recuo). Os zumbis têm frames de andar e de morder.

## Modo Tanque (campanha)
O tanque é o **T-90 Bravo** (arte em `public/assets/tank/`), desenhado em camadas para girar 360°. No menu, **MODO TANQUE** abre a **Garagem**, onde você escolhe a camuflagem, o canhão e o chassi. A campanha tem **5 missões** em mapas compridos, com a câmera seguindo o tanque:

1. Saída da Base · 2. Floresta Densa · 3. Deserto Queimado · 4. Cidade em Ruínas · 5. Fortaleza Zumbi (com o Chefão)

Em cada missão, destrua os **ninhos de zumbi** e chegue à **extração** (bandeira no fim do mapa). Tudo pode ser destruído: árvores, cercas e caixas o tanque esmaga passando por cima; barris e carros explodem em cadeia; sacos de areia, pedras, cabanas, torres e prédios caem com o canhão. Caixas e construções podem deixar reparo ou moedas. Entre as missões, a **Oficina** vende melhorias. O progresso, as moedas e as melhorias ficam salvos no aparelho.

Os controles são iguais em todo lugar, no estilo tanque: **frente acelera, trás dá ré sem girar e os lados giram o casco**.

| Ação | PC | Controle PS4 | Celular (tela cheia) |
| --- | --- | --- | --- |
| Frente / ré | W / S | analógico esquerdo ↑ / ↓ | analógico esquerdo ↑ / ↓ |
| Girar o tanque | A / D | analógico esquerdo ← / → | analógico esquerdo ← / → |
| Torreta | setas ou mouse | analógico direito (empurrar mais = mira mais longe) | analógico direito |
| Canhão | Espaço ou clique esquerdo | R2 | CANHÃO |
| Metralhadora | Shift ou clique direito | R1 | METRALHADORA |
| Acessório (míssil / mina) | E | L1 | MÍSSIL / MINA |
| Fumaça | Q | L2 | FUMAÇA |
| Trocar acessório | Tab ou roda do mouse | direcional ← / → | ⇄ |
| Pausa | P ou Esc | OPTIONS | II |

**Acessórios:** o **lança-mísseis** fica no teto e o míssil cai onde está a mira (círculo vermelho no chão); as **minas** ficam atrás do tanque; a **fumaça** cria uma nuvem que deixa os zumbis perdidos, sem atacar. Compre na Oficina ou ache nas **caixas azuis** do mapa (a primeira missão tem uma logo no começo).

O código fica na seção `MODO TANQUE` do `game.js`: as missões estão em `MISSIONS`, os temas em `THEMES` e os objetos destrutíveis em `OBJ`.

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
