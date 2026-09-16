# Pogo Showdown — Android / Google Play build

The web game is wrapped with Capacitor. `android/` is a normal Gradle project that loads the Vite
build from `dist/` inside a WebView.

## One-time machine setup

- Android SDK at `~/Android/Sdk` (platforms 34/36, build-tools 35). Export `ANDROID_HOME=$HOME/Android/Sdk`.
- Capacitor 8 requires JDK 21. Gradle 8.14 does not run on JDK 26, so a Temurin 21 lives at
  `~/.jdks/jdk-21.0.12+8` and `~/.gradle/gradle.properties` sets `org.gradle.java.home` to it.
  (Machine-local; not in the repo.)

## Everyday commands

```bash
npm run android:apk       # build web, sync into android/, assemble debug APK
npm run android:install   # adb install the debug APK onto the attached phone
npm run android:release   # signed AAB + APK for Play (needs android/keystore.properties)
```

Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
Release bundle (what Play wants): `android/app/build/outputs/bundle/release/app-release.aab`

## Release signing

1. Generate an upload key once and keep it somewhere safe (Play ties the app to it forever):
   ```bash
   keytool -genkeypair -v -keystore ~/pogo-upload.jks -alias pogo -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Copy `android/keystore.properties.example` to `android/keystore.properties` and fill in the
   passwords. That file and `*.jks` are gitignored.
3. `npm run android:release`. Without `keystore.properties` the release build falls back to the
   debug key so it still compiles, but Play will reject it.

## Per-release bump

`android/app/build.gradle` → `versionCode` (must increase every upload) and `versionName`.

## What's already set for Play

- `applicationId` `com.pogoshowdown.app`, targetSdk 36 (meets the 2026 target-API floor), minSdk 24.
- Portrait-locked activity, dark splash matching the game background.
- Adaptive launcher icon (vector) in `res/drawable-v24/ic_launcher_foreground.xml`; background colour
  in `res/values/ic_launcher_background.xml`. Note: the Capacitor template put its robot icon in
  `drawable-v24`, which outranks `drawable/` — edit the v24 file.
- Only permission requested: INTERNET (Capacitor default; the game makes no network calls).
- All save data is on-device IndexedDB, no accounts, no ads, no analytics.

## Still needed on the Play Console side (not code)

- Developer account, app listing, 512px icon + feature graphic, at least 2 phone screenshots
  (the `adb exec-out screencap` shots work at 1080x2424).
- Privacy policy URL (can state "no data collected"). Data safety form: no data collected/shared.
- Content rating questionnaire. Target audience: not designed for children (avoids the Families policy).
- Upload the AAB to Internal testing first, then promote.

## Verified on device (2026-09-16)

Pixel over adb: install, launch, menu, character select, a full Pogo Dash run with swipe input,
tier-up to Amateur persisted across reinstall, launcher icon renders.
