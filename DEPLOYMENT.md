# NeighbourLink — Vercel + Firebase deployment

NeighbourLink is a **Next.js App Router** application hosted on Vercel, using Firebase for Authentication, Cloud Firestore, Cloud Storage, Analytics and optional Cloud Messaging. Ibadan, Nigeria · +2349030192034.

## First: the Vercel `404 NOT_FOUND` in your screenshot

**"This page doesn't exist · 404 NOT_FOUND · region:trace-id" is Vercel's own deployment/edge error, not a NeighbourLink/Firebase page.** [Vercel's NOT_FOUND documentation](https://vercel.com/docs/errors/not_found) lists an incorrect URL, a deployment that doesn't exist or is unavailable, and permissions as things to check. A missing Firebase collection would show inside NeighbourLink, not as Vercel's branded 404.

### Fix it in this order

1. **Vercel → Project → Deployments:** Find the latest **Ready** production deployment, and click **Visit**. Use the exact URL Vercel gives you. If there is no Ready deployment, inspect the deployment's **Build Logs**, fix the error and redeploy.
2. **Vercel → Project → Settings → Build and Deployment:**
   - **Root Directory:** repository root (the folder containing `package.json`, `next.config.ts`, `src/app` and `vercel.json`), not `src`, `public`, `.next` or a subfolder. Leave the Root Directory field blank if this app is at the repository root.
   - **Framework Preset:** **Next.js**. `vercel.json` also sets `"framework": "nextjs"` for new deployments.
   - **Build Command:** `npm run build` (`vercel.json` sets this).
   - **Output Directory:** **disable Override**. Let Vercel's Next.js builder handle build output. Do NOT set `public`, `out`, `.next/standalone`, or a manual rewrite to `index.html`.
   - **Install Command:** use the detected default (`npm install` for this project).
3. **Redeploy after any setting changes** (Deployments → newest deployment → `…` → Redeploy) or push the updated code to the connected Git branch. Check the build log for `Route (app)` with a `/` route. A successful local build does not automatically redeploy your Vercel project.
4. **If Visit works but your `*.vercel.app` URL still says NOT_FOUND:** the URL may belong to another project, refer to a removed deployment, or lack a production domain assignment. In Vercel → Project → Settings → **Domains**, check which domain is assigned to THIS project. Copy the exact production URL from the successful deployment, or assign the correct domain there. For custom domains, also check DNS.
5. **Test `https://YOUR-READY-DEPLOYMENT.vercel.app/api/health`.** A successful app response is JSON with `"status":"ok"` and `"firebaseConfigured":true`. Vercel's own HTML 404 on `/api/health` means routing/deployment/domain is still incorrect; the request did not reach this app.

> No code change can restore a deleted deployment, correct a typo in the URL, attach your domain to the right Vercel project, or change a project's Root Directory in your Vercel account. Those are dashboard/CLI actions. The repository now declares the correct framework and build command, but you must redeploy it to the correct project.

## Vercel project settings and environment

- **Framework:** Next.js · **Root Directory:** repo root · **Build:** `npm run build` · **Output Directory override:** OFF · **Node version:** Node 22 or 24 LTS (the Firebase SDK and its transitive packages are pinned to versions supporting Node 22).
- The public Firebase web config is included in `.env.production`, so a Git-based Vercel production build gets the correct project ID even though `.env.local` is (correctly) git-ignored. These are *public web identifiers*, not Admin SDK secrets. `apphosting.yaml` is for Firebase App Hosting only; Vercel does not use it.
- If you set `NEXT_PUBLIC_FIREBASE_*` variables in **Vercel → Settings → Environment Variables**, set them for **Production and Preview**, make sure they match project `neighborlink-71fef`, and redeploy: Next.js inlines public variables at build time. Values configured in Vercel take precedence over `.env.production`.
- **Never** put Admin SDK service-account JSON or private keys in `NEXT_PUBLIC_*`, `.env.production`, client code, or the repo. Firebase web API keys do not grant Firestore access; `firestore.rules` and `storage.rules` enforce permissions.

### Deploy from CLI (alternative to Git)

```bash
npm install
npx next typegen
npm exec tsc -- --noEmit --pretty false
npm run build
npx vercel login
npx vercel link                # link THIS repository root to the right Vercel project
npx vercel --prod              # create/assign the production deployment
```

`vercel link` and `vercel --prod` require your Vercel login and account access. When linking, verify the project name and team, then open the URL printed by Vercel. A successful `npm run build` alone does not publish anything to your `.vercel.app` URL.

## Set up Firebase (separate from Vercel hosting)

1. In **Firebase Console → Authentication → Sign-in method**, enable **Email/Password**.
2. In **Authentication → Settings → Authorized domains**, add the actual `*.vercel.app` production domain from Vercel **Settings → Domains** and any custom domain. Firebase Auth will reject sign-in on an unapproved domain even if the page loads.
3. Create the **Cloud Firestore (default) database**, using production mode, and enable **Cloud Storage**. The site can render before this, but live listings, signup profiles and admin tools need them.
4. Apply the project rules and indexes (after authenticating with your Firebase account):

```bash
npm install -g firebase-tools
firebase login
firebase use neighborlink-71fef
firebase deploy --only firestore:rules,firestore:indexes,storage
```

5. Wait for composite indexes to finish building in **Firestore → Indexes**.
6. Register a normal account, then promote the **first** admin via Firebase Console → Firestore → `users/{your UID}` → change `role` from `resident` to `admin`. Only an existing admin may grant further admin rights from the dashboard. Public sign-up cannot create an admin.
7. In `/dashboard → Overview`, choose **Initialise defaults** to make the built-in categories, neighbourhoods, and legal pages editable in Firestore. Existing documents are never overwritten.
8. Optional web push: generate a Web Push (VAPID) key in Firebase Console → Project Settings → Cloud Messaging. Add `NEXT_PUBLIC_FIREBASE_VAPID_KEY` in Vercel → Settings → Environment Variables and redeploy. Sending notifications requires a trusted Cloud Function; the browser only subscribes.

## Local development

```bash
npm install
cp .env.example .env.local   # supply your public Firebase web config for local dev
npm run dev
```

`.env.production` is loaded for production builds, not local `next dev`. `.env.local` is intentionally untracked.

## Data model

| Firestore collection / doc | Purpose | Public read? |
|---|---|---|
| `users/{uid}` | Private profile and role | Owner + admin |
| `siteSettings/main` | Name, logo, colours, hero, contact, SEO, nav, footer | Yes |
| `categories/{slug}`, `neighbourhoods/{slug}` | Directory taxonomy | Yes |
| `businesses/{id}` | Listings pending approval / approved | Approved only |
| `reviews/{id}` | Reviews of approved businesses | Yes |
| `helpPosts/{id}` | Community requests / offers | Yes |
| `announcements/{id}` | Published neighbourhood updates | Published only |
| `legalPages/{privacy\|terms}` | Legal content | Yes |
| `reports/{id}` | Moderation reports | Admin |
| `contactMessages/{id}` | Contact form submissions | Admin |
| `activityLogs/{id}` | Audit trail | Admin |

## Security and operations

- Firestore/Storage rules are provided in the repo and must be deployed to Firebase separately from Vercel.
- Business owners cannot approve their own listings; edits return listings to pending review. Public registration cannot grant admin access.
- Images are validated by client code **and** Storage rules: JPEG/PNG/WEBP/GIF under 5 MB, in owner-specific folders.
- Account deletion requires recent password authentication and removes the user's content and photos.
- Vercel only hosts the Next.js app. Firebase owns the data. Failures to load Firestore after the site is visible are a separate issue from Vercel's deployment 404.
- Official email and social handles are intentionally empty. Add them when they exist in Dashboard → Website settings.

**Emergency disclaimer:** NeighbourLink is not an emergency service. In an emergency call **112** (Police) or **122** (FRSC).
