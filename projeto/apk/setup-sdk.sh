#!/bin/bash
# Prepara JDK 17 + Android SDK com licenças pré-aceitas (sem prompts do Bubblewrap).
set -x
BW=/home/user/.bubblewrap
mkdir -p $BW

# 1) JDK 17 (Temurin)
if [ ! -x $BW/jdk/bin/java ]; then
  mkdir -p $BW/jdk-dl && cd $BW/jdk-dl
  curl -fsSL -o jdk17.tar.gz "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse"
  tar xzf jdk17.tar.gz
  rm -rf $BW/jdk
  mv jdk-17* $BW/jdk
  cd $BW
fi
$BW/jdk/bin/java -version

# 2) Android cmdline-tools
if [ ! -x $BW/android_sdk/cmdline-tools/latest/bin/sdkmanager ]; then
  mkdir -p $BW/android_sdk && cd $BW/android_sdk
  curl -fsSL -o cmdtools.zip "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip" || \
  curl -fsSL -o cmdtools.zip "https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip"
  unzip -q cmdtools.zip
  mv cmdline-tools latest-tmp
  mkdir -p cmdline-tools
  mv latest-tmp cmdline-tools/latest
fi

# 3) Licenças pré-aceitas (mecanismo oficial de CI)
mkdir -p $BW/android_sdk/licenses
printf '\n24333f8a63b6825ea9c5514f83c2829b004d1fee' > $BW/android_sdk/licenses/android-sdk-license
printf '\n84831b9409646a918e30573bab4c9c91346d8abd' > $BW/android_sdk/licenses/android-sdk-preview-license
printf '\n504667f4c0de7af1a06de9f4b1727b84351f2910' > $BW/android_sdk/licenses/android-sdk-arm-dbt-license

# 4) Pacotes do SDK
export JAVA_HOME=$BW/jdk
yes | $BW/android_sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root=$BW/android_sdk \
  "platform-tools" "platforms;android-35" "platforms;android-34" \
  "build-tools;35.0.0" "build-tools;34.0.0"

# 5) Config do Bubblewrap (sem prompts)
echo '{"jdkPath":"/home/user/.bubblewrap/jdk","androidSdkPath":"/home/user/.bubblewrap/android_sdk"}' > $BW/config.json
echo "=== SETUP SDK CONCLUIDO ==="
ls $BW/android_sdk/
