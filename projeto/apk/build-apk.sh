#!/bin/bash
# Gera o APK final do Andora (sem prompts: config + licenças + senhas no ambiente).
set -x
export JAVA_HOME=/home/user/.bubblewrap/jdk
cd /home/user/apk
rm -rf andora-app
mkdir -p andora-app
node gerar-manifesto.js || exit 1
/home/user/.bubblewrap/jdk/bin/keytool -genkeypair -v \
  -keystore /home/user/apk/andora-app/android-keystore \
  -alias android -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass andora123 -keypass andora123 \
  -dname "CN=Andora, OU=Jogos, O=Andora, L=Sao Paulo, C=BR" || exit 1
cd andora-app
export BUBBLEWRAP_KEYSTORE_PASSWORD=andora123
export BUBBLEWRAP_KEY_PASSWORD=andora123
export GRADLE_OPTS="-Xmx768m"
pkill -f GradleDaemon 2>/dev/null || true
yes "" | /home/user/apk/node_modules/.bin/bubblewrap build
echo "=== BUILD CONCLUIDO ==="
ls -la *.apk
