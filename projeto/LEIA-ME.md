# 📁 Backup completo do projeto ANDORA

Esta pasta contém **todo o projeto do jogo Andora** (fonte, arte, ferramentas e roteiro),
guardado aqui para liberar espaço no workspace de desenvolvimento.

## O que tem aqui

| Pasta/Arquivo | O que é |
|---|---|
| `arte/` | Toda a arte pintada: cenas do jogo, cutscene a1–a4, sprites, ícone, painel de conceito |
| `demo3d/` | **Fonte do jogo 3D** (atual): `template.html`, `game.js`, `build.py`, `three.min.js`, `validar.js` + `andora3d.html` compilado |
| `demo/` | Versão 2.5D antiga (pintada, vista de cima) — referência histórica |
| `roteiro/` | `dialogos-completos.md` — cutscene, NPCs, amizade, missões |
| `ferramentas/` | Scripts: `montar_painel.py`, `preparar_andora.py`, `preparar_sprites.py`, `teste-web/` (testes com navegador de verdade) |
| `apk/` | Scripts que geram o APK Android (Bubblewrap/TWA): `build-apk.sh`, `setup-sdk.sh`, `gerar-manifesto.js` |
| `README-DO-PROJETO.md` | Documentação principal do projeto |

## ⚠️ Chave de assinatura do APK (NÃO está aqui de propósito)

O keystore que assina o APK (`com.andora.jogo`) **ficou fora do repositório por segurança**
(senha: `andora123`, alias `android`). Sem ele não é possível publicar ATUALIZAÇÕES do APK
instalado. Guarde uma cópia em lugar seguro.

## ▶️ Como voltar a desenvolver

```bash
# o site/app instalável continua no webapp/ (raiz deste repositório)
python3 demo3d/build.py        # recompila o jogo → webapp/index.html
```

## 🌐 Onde o jogo está publicado

- **Site (Render):** https://andora-75sw.onrender.com
- **Site (GitHub Pages):** https://matheusvibecoder.github.io/andora/
- **APK:** https://github.com/matheusvibecoder/andora/releases/download/v1.0/andora.apk
