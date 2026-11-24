# Arena Verde

Tower defense militar em pixel art: posicione soldados numa arena de grama 5×9 e segure a base contra hordas de zumbis.

- **8 unidades, esquadrão de 6:** Fuzileiro, Granadeiro, Tanque Pesado, Lança-Mísseis, Mina Terrestre, Arame Farpado, Metralhadora e Morteiro, mais a pá para remover (devolve 50%)
- **Inimigos:** Zumbi comum, Corredor, Blindado, Cuspidor (ataque ácido à distância) e Chefe Gigante a cada 5 ondas
- **Economia:** dinheiro por abate, bônus ao limpar a onda e caixas de suprimento que caem de paraquedas (+$25)
- **Responsivo:** no celular (retrato) as cartas ficam grandes em 2 fileiras; no PC as 7 ficam numa fileira só, com atalhos de teclado (1–6, Q, P, F)
- Toda a arte é desenhada em código: o jogo inteiro é um único `public/index.html`, sem imagens externas

## App (PWA)

O jogo é instalável: `public/manifest.webmanifest`, `public/sw.js` (funciona offline e pega versões novas sozinho) e ícones em `public/icons/`. No Android/PC aparece o botão **INSTALAR APP** no menu; no iPhone, use Compartilhar → Adicionar à Tela de Início. Ao publicar uma mudança grande, troque a versão `V` no topo do `sw.js`.

## Ranking global (Cloudflare D1)

O Worker em `src/worker.js` serve o jogo e a API `GET/POST /api/scores`, gravando no banco D1 `arenaverde` (a tabela `scores` já foi criada). Quando o jogo roda fora do Worker, o ranking global some e só o recorde local fica salvo.

```bash
npm install
npm run deploy        # publica em https://arenaverde.<sua-conta>.workers.dev
# npm run db:init     # só se precisar recriar a tabela
```
