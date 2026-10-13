# 🌍 Como publicar o ANDORA (celular + APK)

Este jogo já é um **PWA completo** (site instalável). É só hospedar a pasta `webapp/`
e abrir o endereço no celular.

## Opção 1 — GitHub Pages (grátis, 2 minutos)

1. Crie um repositório novo no GitHub (ex.: `andora3d`).
2. Envie **todo o conteúdo da pasta `webapp/`** para a raiz do repositório:
   - `index.html` (o jogo inteiro — um único arquivo)
   - `manifest.webmanifest`
   - `sw.js`
   - `icon-192.png` e `icon-512.png`
3. Em **Settings → Pages**, escolha a branch `main` / raiz `/` e salve.
4. O jogo fica em `https://SEU-USUARIO.github.io/andora3d/`.
5. No celular: abra o endereço no Chrome → menu ⋮ → **Adicionar à tela inicial**.
   Pronto: ícone no celular, abre em tela cheia e **funciona offline**.

## Opção 2 — Render (o que você mencionou)

1. Crie um **Static Site** no Render apontando para o repositório.
2. **Build command:** (vazio) · **Publish directory:** `webapp` (ou `/` se subir na raiz).
3. Deploy. O endereço `https://SEU-APP.onrender.com` já roda o jogo.
4. Mesma coisa no celular: Chrome → ⋮ → **Adicionar à tela inicial**.

## Opção 3 — APK de verdade (depois, com as APIs que você vai mandar)

Com o jogo hospedado (GitHub Pages ou Render), gere o APK com **PWABuilder**:

1. Acesse `https://www.pwabuilder.com/`.
2. Cole o endereço do jogo (ex.: `https://SEU-APP.onrender.com`).
3. **Android → Package** → baixa o `.aab`/`.apk` assinado para a Play Store
   (ou um APK para instalar direto no celular com "fontes desconhecidas").

Quando você me mandar as APIs do GitHub e do Render, eu faço todo esse processo
por você (push do código, deploy e configuração).

## 📱 Controles no celular

- **Joystick à esquerda** — andar
- **Arrastar na tela** — girar a câmera
- **🏃** correr · **⬆️** pular · **💬** usar/interagir (conversar, montar, pegar itens, acender lanternas)
- No PC: WASD, Shift correr, Espaço pular, E interagir, ESC menu.

## ⚙️ Rebuild (se mexer no código-fonte)

```bash
python3 demo3d/build.py
```

Isso recompila `demo3d/andora3d.html` e `webapp/index.html` a partir de
`demo3d/template.html` + `demo3d/game.js`.
