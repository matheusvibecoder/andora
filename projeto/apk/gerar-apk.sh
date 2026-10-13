#!/bin/bash
# Gera o APK instalável do Andora (TWA) apontando para o site no Render.
set -x
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
BW=/home/user/apk/node_modules/.bin/bubblewrap
cd /home/user/apk
rm -rf andora-app
yes "y" | $BW init \
  --manifest https://andora-75sw.onrender.com/manifest.webmanifest \
  --directory ./andora-app \
  --packageId com.andora.jogo \
  --name "Andora" \
  --launcherName "Andora" \
  --display standalone \
  --orientation any \
  --themeColor "#1d4a7a" \
  --backgroundColor "#12233f" \
  --startUrl "https://andora-75sw.onrender.com/" \
  --skipPwaValidation
echo "=== INIT CONCLUIDO ==="
ls -la andora-app/
cd andora-app
yes "y" | $BW build
echo "=== BUILD CONCLUIDO ==="
ls -la *.apk
