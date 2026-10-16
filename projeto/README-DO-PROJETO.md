# ✨ ANDORA — Organização do Projeto

**O que é:** um **mundo aberto 3D** fantástico e relaxante (estilo Zelda/Ghibli, sem pixel art), com liberdade total para ir a qualquer lugar: vila, floresta, lago, montanha, ruínas e campos — de dia ou de noite.

**Nome:** *Andora — O Vale das Lanternas* (alternativas: *Andora e o Espírito do Vale*, *Crônicas de Andora*, *Auren*).

**★ O jogo atual:** `demo3d/andora3d.html` (3D de verdade, com câmera livre) · **para celular:** pasta `webapp/` (PWA instalável, pronto para GitHub/Render/APK).

---

## 📁 Pastas

| Pasta | Para que serve | O que tem |
|-------|----------------|-----------|
| **`demo3d/`** | 🎮 **O jogo 3D (atual)** | `andora3d.html` (★ jogar), `template.html` + `game.js` (código-fonte), `build.py` (compila), `three.min.js` (motor 3D embutido), `validar.js` (teste automático) |
| **`webapp/`** | 📱 **Versão instalável (celular/APK)** | `index.html` (jogo), `manifest.webmanifest`, `sw.js` (offline), ícones, `README-DEPLOY.md` (como publicar no GitHub/Render e gerar APK) |
| **`demo/`** | 🕹️ Versão 2.5D antiga | `demo-jogavel.html` (pintado, visto de cima) — mantida como referência |
| **`roteiro/`** | 📜 **Textos do jogo** | `dialogos-completos.md` (cutscene, NPCs, amizade, missões) |
| **`arte/`** | 🎨 **Toda a arte** pintada | cenas, cutscene a1–a4, sprites, ícone do app, painel de conceito |
| **`ferramentas/`** | 🔧 Scripts de apoio | `montar_painel.py`, `preparar_andora.py`, `preparar_sprites.py` |

---

## 🎮 Controles

| Celular | PC |
|---------|-----|
| Joystick à esquerda (andar) | **WASD / setas** |
| Arrastar na tela (câmera 3D) | **Mouse** (girar câmera / roda: zoom) |
| 🏃 correr · ⬆️ pular · 💬 usar | **Shift** correr · **Espaço** pular · **E** interagir |
| ☰ menu · 💾 salvar · 🗺️ mapa | **Esc** menu · **M** mapa |

### Sistemas do jogo 3D
- 🌍 **Mundo aberto gigante** (900×900): Vila de Andora · Floresta Sussurrante · Lago das Lanternas · Montanha Nevada · Ruínas Antigas · Moinho do Vento — **vá a qualquer lugar** (caminhe, corra, **nade**, escale a montanha)
- ☀️🌙 **Ciclo dia/noite** em tempo real (sol, lua, estrelas, nuvens, lanternas que acendem à noite)
- 🧍 **Câmera 3D livre** estilo GTA (gira à volta do herói, zoom)
- 💬 **14 NPCs** com conversas por **escolhas** + **amizade** (níveis até "Amigo do vale" 🌟) + presentes
- 👥 Moradores ambientes cuidando de cada região · cervos, coelhos, patos, cisnes, cachorro, cabra, galinhas, pássaros, borboletas
- 🐴 **Cavalos montáveis** com fome e sede — ao desmontar, o cavalo **vai comer grama e beber água sozinho** para recuperar
- ⭐ **Missões opcionais** (Maçãs para a torta · Pedras do riacho · O som do lago · Acenda as lanternas)
- 🎣 Coletáveis com inventário (🍎🌸🪨🍄🐚) · 🏮 lanternas que você acende à noite
- 🪨 **Física**: gravidade, pulo, natação, terreno com montanhas e vales
- 💾 **Criar mundo / Carregar mundo / Salvar** (6 slots + autosave a cada 45 s)
- 🎨 **Personalização** do herói (nome, cor da capa, tom de pele)
- 🎬 **Cutscene de introdução** com 4 cenas pintadas e **3 finais diferentes** (aparece 1 vez; repete pelo menu)
- 🗺️ **Minimapa** com regiões, NPCs e estradas

---

## 🔧 Regenerar / publicar

```bash
python3 demo3d/build.py                  # gera demo3d/andora3d.html + webapp/
node demo3d/validar.js                   # testa o jogo sem navegador (boot, cutscene, diálogo, física)
python3 ferramentas/montar_painel.py     # gera arte/painel-conceito.png
```

**Celular/APK:** veja `webapp/README-DEPLOY.md` (GitHub Pages ou Render → "Adicionar à tela inicial"; depois PWABuilder para APK).


## Assets 3D externos (CC0)
- **KayKit - Character Pack: Adventurers** (Kay Lousberg) — personagens riggeados e animados (Mage/Rogue/Barbarian). Licença CC0. https://kaylousberg.itch.io/kaykit-adventurers
- **Quaternius - Animated Animals** — animais riggeados e animados (deer/stag/fox/wolf/husky/shiba/alpaca/horse). Licença CC0. https://quaternius.itch.io/lowpoly-animated-animals
- Ambos otimizados: animações podadas (17 clips/personagem) + malha quantizada (KHR_mesh_quantization).
