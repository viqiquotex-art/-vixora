# Nexa Android V1

Nexa is the Android client for the existing Vixora Command Core.

## Architecture

- Vixora Web: existing React/Vite interface.
- Vixora Command Core: existing Worker/API.
- Nexa Android: Capacitor Android shell around the web client.
- App ID: `id.vixora.nexa`

## Local Android build

Prerequisites:
- Node.js 20+
- Android Studio / Android SDK
- Java 17

Commands:

```bash
npm install
npx cap add android
npm run build
npx cap sync android
npx cap open android
```

For a debug APK, build from Android Studio or run the Gradle assemble task after the `android/` directory has been generated.

> The native `android/` directory is intentionally generated locally because this repository change is currently source/config only.
