# NeighbourLink — Firebase setup & deployment

**Tagline:** Your Community. Your Connections. · Ibadan, Nigeria
**Firebase project:** `neighborlink-71fef`

## Architecture

| Concern | Firebase service | Where it lives |
|---|---|---|
| Accounts & sessions | Authentication (Email/Password) | `src/context/AuthContext.tsx`, `src/lib/api.ts` |
| Data & live sync | Cloud Firestore + `onSnapshot` | `src/lib/hooks.ts`, `src/context/SiteContext.tsx` |
| Images | Cloud Storage | `src/lib/uploads.ts`, `storage.rules` |
| Push notifications | Cloud Messaging (FCM) | `src/lib/messaging.ts`, `src/app/firebase-messaging-sw.js/route.ts` |
| Analytics | Google Analytics for Firebase | `src/lib/firebase.ts` |
| Access control | Security rules | `firestore.rules`, `storage.rules` |
| Hosting (SSR) | Firebase App Hosting | `apphosting.yaml` |

Every admin edit is written to Firestore, and all connected browsers receive it through `onSnapshot` listeners.

## 1. Configuration (already done)

`.env.local` holds your web config. The same public values are in `apphosting.yaml` for deployment.
These values identify the project and are safe to ship to browsers. Security comes from the rules.

**Never** add Admin SDK service-account keys to `NEXT_PUBLIC_*` variables, to this repository, or to any client file.

## 2. Firebase Console — one-time manual steps (requires your account)

1. **Authentication → Sign-in method:** enable **Email/Password**.
2. **Authentication → Settings → Authorized domains:** `localhost` is included. Add your hosted domain (for example `neighborlink-71fef.web.app` and any custom domain).
3. **Firestore Database:** create the database (production mode, region closest to Nigeria, e.g. `europe-west1` or `africa-south1` if available).
4. **Storage:** get started (production mode).
5. **Project settings → Cloud Messaging → Web configuration:** generate a **Web Push certificate (VAPID key)** and paste it into `NEXT_PUBLIC_FIREBASE_VAPID_KEY` in `.env.local` and `apphosting.yaml`. Push stays disabled until this is set.
6. **Google Analytics:** already linked via `measurementId`.

## 3. Firebase CLI — deploy rules and indexes

```bash
npm install -g firebase-tools     # once
firebase login                     # opens your browser — needs your Google account
firebase use neighborlink-71fef    # uses .firebaserc
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Composite indexes take a few minutes to build. Check status under **Firestore → Indexes**. Lists remain empty until the indexes are ready.

## 4. Deploy the web app (Firebase App Hosting)

Next.js server rendering runs on **Firebase App Hosting**. Initialise it once:

```bash
firebase init apphosting
```

Choose project `neighborlink-71fef`, create a backend (for example `neighborlink`), region, and root directory `/`. Connect your GitHub repository, which the CLI or console will guide you through. Every push to the chosen branch then builds and deploys automatically.

Manual deploy from the CLI after the backend exists:

```bash
firebase deploy --only apphosting
```

The `apphosting.yaml` env block supplies the public Firebase config at build and run time. Add `NEXT_PUBLIC_FIREBASE_VAPID_KEY` there once you have it.

> Alternative: `npm run build` followed by any Node host with `npm run start` and the same `NEXT_PUBLIC_*` variables.

## 5. Create the first administrator (one time)

Public sign-up can only create `resident` or `business` accounts. This is enforced by the rules, so admin access can't be self-granted.

1. Register your admin account on the site (or add a user in **Authentication → Users**).
2. Open **Firestore → `users` → {your uid}**.
3. Change the `role` field from `resident` to `admin` and save.
4. Log in again. **Admin** appears in the header, and `/dashboard` is unlocked.

## 6. First-time content

Open `/dashboard → Overview` and press **Initialise defaults**. This saves the built-in categories, neighbourhoods and legal pages to Firestore so you can edit them. Existing documents are never overwritten.

## 7. Local development

```bash
npm install
npm run dev          # http://localhost:3000
```

## 8. Production checks

```bash
npx next typegen
npm exec tsc -- --noEmit --pretty false
npm run build
```

## Data model (Cloud Firestore)

| Collection / doc | Purpose | Public read? |
|---|---|---|
| `users/{uid}` | Private profile & role | Owner + admin |
| `siteSettings/main` | Name, logo, colours, hero, contact, SEO, nav, footer, social | Yes |
| `categories/{slug}`, `neighbourhoods/{slug}` | Directory taxonomy | Yes |
| `businesses/{id}` | Listings (pending → approved) | Approved only |
| `reviews/{id}` | Ratings & comments on approved listings | Yes |
| `helpPosts/{id}` | Community requests & offers | Yes |
| `announcements/{id}` | Published updates | Published only |
| `legalPages/{privacy\|terms}` | Legal text | Yes |
| `reports/{id}` | Moderation reports | Admin |
| `contactMessages/{id}` | Contact form submissions | Admin |
| `activityLogs/{id}` | Audit trail | Admin |

## Security summary

- Roles live only in `users/{uid}.role`. Owners can switch between resident and business, but can never write `admin`, unsuspend themselves, or change email or createdAt. The rules enforce this.
- Business owners can't approve or feature their own listing. Every edit returns it to `pending`.
- Suspended accounts are signed out automatically and their writes are rejected.
- Image uploads are validated in the browser and by Storage rules: JPEG, PNG, WEBP or GIF, maximum 5 MB, and each user can only write into their own folder.
- Account deletion requires password re-authentication, then removes the user's listings, posts, reviews, photos and profile before the Auth account.
- Firestore lists are limited to queries the rules can verify (for example `status == 'approved'`).

## Items requiring your credentials or approval

1. Firebase login and deployment (`firebase login`, `firebase deploy`, `firebase init apphosting`) — requires your Google account.
2. Enabling Email/Password sign-in and adding authorised domains.
3. Creating the Firestore and Storage databases in the console.
4. Generating the Web Push (VAPID) key for notifications.
5. Promoting the first administrator (step 5 above).
6. Official email address and social-media handles. None exist yet, so they are left blank and can be added in **Dashboard → Website settings**.
7. Optional: server-side push sending and auth-user deletion by administrators, which need Cloud Functions with the Admin SDK. Those credentials must stay on the server.

## Contact

Phone: +2349030192034 · Ibadan, Oyo State, Nigeria.
NeighbourLink is not an emergency service. In an emergency call **112** (Police) or **122** (FRSC).
