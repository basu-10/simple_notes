#!/bin/bash
set -e # Exit immediately if any command fails

echo "Syncing and building..."
npm run sync
cd android
./gradlew assembleRelease --no-daemon
cd ..

echo "making ready to download from website..."
npm run apk:stage release

echo "Deploying to device..."
# Optional: adb uninstall com.notezen.app
adb install -r android/app/build/outputs/apk/release/app-release.apk

echo "Done!"