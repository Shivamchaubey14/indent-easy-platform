# Mobile app: running it on a phone

The app (`apps/mobile`) is an Expo app. Until it needs a native module that Expo Go doesn't
include, it runs in **Expo Go**, so no Android SDK or APK build is needed.

## Run it

1. Start the local services and the API on the development computer:

   ```sh
   pnpm infra:up
   pnpm api:dev        # listens on all interfaces, port 4000
   ```

2. Start the bundler for the local network:

   ```sh
   pnpm mobile:dev     # Metro on port 8081, reachable from the LAN
   ```

3. On the phone, which must be on the same Wi-Fi, open **Expo Go**, scan the QR code the
   bundler prints, or choose "Enter URL manually" and type `exp://<computer's IP>:8081`.

The app finds the API on its own: in development it calls port 4000 on the computer that served
the bundle. To point it somewhere else (e.g. DEV at `http://192.168.50.11`), start the bundler
with `EXPO_PUBLIC_API_URL=<url>`. The Home screen shows which server it is using.

Expo Go only runs the newest Expo SDK. If it says the project is incompatible, update Expo Go
from the Play Store (the app uses SDK 57).

## When it doesn't connect

| Symptom                                               | Check                                                                                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Expo Go can't load the project (timeout)              | Phone and computer on the same network; Windows Firewall allows Node.js inbound; the network doesn't isolate Wi-Fi clients (guest and some office Wi-Fi do) |
| App opens but Home says "The server could not be reached" | `pnpm api:dev` is running; `http://<computer's IP>:4000/health/ready` opens in the phone's browser                                                     |
| Home shows "Not ready"                                | `pnpm infra:up`, then `pnpm db:migrate`                                                                                                                |

If the network isolates clients, `npx expo start --tunnel` routes the bundle through Expo's
servers instead. The API then needs a reachable address too, so prefer a network without client
isolation (or the phone's hotspot).

## Checks

```sh
pnpm --filter @ie/mobile typecheck
pnpm --filter @ie/mobile test              # Jest + React Native Testing Library
pnpm --filter @ie/mobile export:android    # the production JS bundle, as CI builds it
```

## Local database

The on-device SQLite schema lives in `apps/mobile/src/db/schema.ts`. After changing it, run
`pnpm --filter @ie/mobile db:generate` and commit the new migration; the app applies pending
migrations at start-up.

## Development builds (later)

The SRS plans development builds rather than Expo Go (SRS §18.1). They become necessary with the
first native module outside Expo Go: MMKV, a SQLCipher-enabled SQLite (OQ-014), or Sentry. The app
identifier `in.shwetdhara.indenteasy` is already set for that.
