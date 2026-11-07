# NeighbourLink — Deployment guide (Vercel + Firebase)

**Tagline:** Your Community. Your Connections. · Ibadan, Nigeria
**Firebase project:** `neighborlink-71fef` · **Website hosting:** Vercel (Firebase App Hosting also supported)

## How it fits together

| Concern | Service | Code |
|---|---|---|
| Website (Next.js 16) | Vercel | `vercel.json` |
| Accounts & sessions | Firebase Authentication (Email/Password) | `src/context/AuthContext.tsx`, `src/lib/api.ts` |
| Data & real-time sync | Cloud Firestore (`onSnapshot`) | `src/lib/hooks.ts`, `src/context/SiteContext.tsx` |
| Images | Cloud Storage | `src/lib/uploads.ts`, `storage.rules` |
| Push notifications | Cloud Messaging (FCM) | `src/lib/messaging.ts`, `src/app/firebase-messaging-sw.js/route.ts` |
| Access control | Security rules | `firestore.rules`, `storage.rules` |

Browsers talk to Firebase directly, so Vercel only serves the Next.js app. All data and permissions live in Firebase.

---

## Troubleshooting: Vercel shows "404 NOT_FOUND" on every page

**Symptom:** you see Vercel's own grey page, "This page doesn't exist… 404 NOT_FOUND lhr1::…", even on the home page.

**What it means:** the request never reached Next.js. Vercel deployed the repository as plain static files, found no `index.html`, and answered with its edge 404. A problem inside the app would instead show NeighbourLink's branded "We couldn't find that page" screen.

**Usual causes:**
1. **Framework Preset set to "Other".** This happens when the Vercel project is created before the code is pushed, or when detection fails. The build looks green but no app is served.
2. **Output Directory overridden**, for example to `public`, `out` or `dist`.
3. **Root Directory wrong.** `package.json` sits in a sub-folder of the repository.

**Fix (already in this repo):** `vercel.json` pins `"framework": "nextjs"`, the install and build commands, and the `.next` output directory. Vercel applies it on every deployment and it overrides the dashboard for causes 1 and 2.

**Cause 3 needs one dashboard check.** In Vercel → Project → Settings → Build and Deployment, **Root Directory** must point to the folder that contains `package.json` and `vercel.json`. Leave it empty if those files are at the top level of the repository.

**Then redeploy:** push a commit, or open Deployments → ⋯ → **Redeploy**.

**How to confirm it worked:**
- The build log shows `Detected Next.js version: 16.x`, followed by a route list.
- `https://<your-project>.vercel.app/api/health` returns `{"status":"ok", …, "firebaseConfigured": true}`.
- A made-up URL such as `/xyz` shows NeighbourLink's branded 404 page, not Vercel's grey one.

---

## 1. Environment variables

- **`.env.local`** is for local development. It is git-ignored and never deployed. After cloning, create it with `cp .env.production .env.local`; `npm run dev` doesn't read `.env.production`.
- **`.env.production`** is **committed on purpose**. It holds the public Firebase web config used by production builds on Vercel. These `NEXT_PUBLIC_*` values are not secrets: Firebase designs them to be public, and they are shipped to every visitor's browser. Security comes from the rules.
- **Vercel environment variables override `.env.production`.** Set them in Vercel → Settings → Environment Variables. Use this for `NEXT_PUBLIC_FIREBASE_VAPID_KEY` once you generate it, then redeploy, because `NEXT_PUBLIC_*` values are fixed at build time.
- **Never** put Admin SDK or service-account keys in any `NEXT_PUBLIC_*` variable or committed file.

Optional hardening: in Google Cloud Console → APIs & Services → Credentials, open the browser API key and restrict HTTP referrers to `https://*.vercel.app/*`, your custom domain and `http://localhost:3000/*`.

## 2. Firebase Console: one-time steps (requires your account)

1. **Firestore Database → Create database** in production mode, in the nearest region (for example `europe-west1`).
   **This is still outstanding:** the Firestore API is currently disabled for `neighborlink-71fef`. Until the database exists, pages show "NeighbourLink's database isn't switched on yet".
2. **Storage → Get started.**
3. **Authentication → Sign-in method → Email/Password → Enable.**
4. **Authentication → Settings → Authorized domains → Add domain:** add your `<project>.vercel.app` domain and any custom domain.
5. Optional, for notifications: **Project settings → Cloud Messaging → Web Push certificates → Generate key pair.**

## 3. Deploy security rules and indexes (Firebase CLI)

```bash
npm install -g firebase-tools
firebase login
firebase use neighborlink-71fef
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Indexes take a few minutes to build; you can watch them under Firestore → Indexes. Until they finish, lists show "This list is still being prepared…".

## 4. Deploy the website on Vercel

1. Import the GitHub repository into Vercel, or run `npx vercel` from the project folder.
2. Build settings come from `vercel.json`, so no manual framework or build configuration is needed. Do confirm the **Root Directory** (see Troubleshooting above).
3. **Node.js version:** 22.x or 24.x, set in Settings → Build and Deployment. 24.x matches the Firebase SDK's declared engine.
4. Deploy. Every push to the production branch then redeploys automatically.

**Alternative: Firebase App Hosting.** `apphosting.yaml` is ready. Run `firebase init apphosting`, then `firebase deploy --only apphosting`.

## 5. Create the first administrator (one time)

Public sign-up can only create `resident` or `business` accounts. This is enforced by the rules, so nobody can grant themselves admin access.

1. Register your account on the live site.
2. In Firebase Console → Firestore → `users` → *your uid*, change `role` to `admin`.
3. Log in again. "Admin" now appears in the header and `/dashboard` unlocks.

## 6. First-time content

Open `/dashboard → Overview` and press **Initialise defaults**. This saves the built-in categories, neighbourhoods and legal pages to Firestore so you can edit them. Existing documents are never overwritten.

## 7. Local development and production checks

```bash
npm install
cp .env.production .env.local            # once, after cloning
npm run dev                              # http://localhost:3000
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
| `reports/{id}`, `contactMessages/{id}`, `activityLogs/{id}` | Moderation, inbox, audit trail | Admin only |

## Security summary

- **Roles:** roles live only in `users/{uid}.role`. Owners can switch between resident and business, but can never set `admin`, un-suspend themselves, or change their email.
- **Listings:** business owners can't approve or feature their own listing. Every edit sends it back to `pending`.
- **Suspensions:** suspended accounts are signed out automatically and all their writes are rejected.
- **Uploads:** checked in the browser and again by Storage rules — JPEG/PNG/WEBP/GIF only, 5 MB maximum, and each user can write only to their own folder.
- **Account deletion:** requires re-entering the password. It removes the user's listings, posts, reviews, photos and profile, then deletes the Auth account.

## Items requiring your credentials or approval

1. Creating Firestore and Storage, enabling Email/Password sign-in, and adding authorised domains in the Firebase Console.
2. `firebase login` and `firebase deploy` for the rules and indexes.
3. Vercel project settings (Root Directory, Node version) and redeploying.
4. The Web Push (VAPID) key for notifications.
5. Promoting the first administrator (step 5).
6. Official email address and social handles. None exist yet; add them later in Dashboard → Website settings.
7. Optional: sending push notifications from the server and deleting a user's Auth login from the admin dashboard. Both need Cloud Functions with the Admin SDK, and those credentials stay server-side.

**Contact:** +2349030192034 · Ibadan, Oyo State, Nigeria.
NeighbourLink is not an emergency service. In an emergency, call **112** (Police) or **122** (FRSC).
