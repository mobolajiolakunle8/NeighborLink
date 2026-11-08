# NeighbourLink deployment

## Local checks

```bash
npm install
npx next typegen
npm exec tsc -- --noEmit --pretty false
npm run build
```

## Vercel

- Root Directory: repository root.
- Framework Preset: Next.js.
- Build Command: `node scripts/vercel-build.mjs`.
- Output Directory: `.next` (declared in `vercel.json`).
- Keep the public Firebase web config in Vercel environment variables or `.env.production`. Never commit Admin SDK credentials.

## Firebase

Enable Email/Password, create Firestore and Storage, then publish the rules and indexes:

```bash
npm install -g firebase-tools
firebase login
firebase use neighborlink-71fef
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Add the production domain to Firebase Authentication authorized domains.

## Administrator setup (one time)

The first administrator is created with a **one-time Admin Setup Key**. The key is stored only in your git-ignored `.env.local` (`ADMIN_SETUP_KEY`). `firestore.rules` contains just its SHA-256 hash, and no key is shipped in the website code.

1. Publish the latest `firestore.rules` (Firebase Console → Firestore → Rules → Publish, or `firebase deploy --only firestore:rules`).
2. Sign in on the site, open `/dashboard`, enter the key and click **Activate Admin Privileges**. Or run `node scripts/setup-admin.mjs <email> <password>`, which reads the key from `.env.local`.
3. The key works **once**: a `config/bootstrap` record is created and further claims are blocked. Add more admins from **Dashboard → Users**.

To rotate the key before it is used, generate a new key, put its lowercase SHA-256 hex in `firestore.rules`, and republish. If the only admin account is lost, set `users/{uid}.role` to `admin` in the Firebase Console.

## Automatic rules deployment

Add `FIREBASE_TOKEN` (from `firebase login:ci`) or `FIREBASE_SERVICE_ACCOUNT_JSON` as a server-only Vercel environment variable. `scripts/vercel-build.mjs` then deploys Firestore rules, indexes and Storage rules on every build, and fails the build if that deployment fails. Never prefix these with `NEXT_PUBLIC_`.

## New Firestore data

`users/{uid}/saved`, `users/{uid}/notifications`, `conversations/{id}/messages`, `config/bootstrap`, plus business fields `whatsappEnabled`, `verificationStatus`, `cacNumber` and user field `suspendedReason`. Publish `firestore.indexes.json` for the inbox index.

## Maps and admin messaging

- Maps use Leaflet + OpenStreetMap tiles; no paid map API key is required. Business owners set latitude/longitude in the listing form (click the map, enter coordinates, or use current location with browser permission). Admins can correct pins from Dashboard → Businesses → Location. Only approved listings with valid saved coordinates appear on public maps. This is live Firestore synchronization of saved listing locations, not continuous GPS tracking.
- The homepage no longer renders the full category grid or neighbourhood chip list; it shows a business map with compact category/area selectors. The directory also has a map view.
- All new direct messages are admin support threads (`conversations` with `kind: "admin"`). Members see their own threads in `/profile#messages` and `/inbox`; active admins see all support threads in Dashboard → Member messages. Admin replies create an in-app notification for the member. Older peer-to-peer threads are read-only.
- Publish the updated `firestore.rules` and `firestore.indexes.json` before using these features. The new indexes cover admin support lists by kind/user/time and kind/time.
