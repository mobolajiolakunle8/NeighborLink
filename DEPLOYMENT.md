# NeighbourLink — Vercel + Firebase deployment

Next.js App Router app · Firebase Auth / Firestore / Storage / Analytics / optional FCM · Ibadan, Nigeria · +2349030192034.

## The deployment error in the log

```
[NEXT_OUTPUT_DIR_MISSING] The Next.js output directory ".next"
was not found at "/vercel/path0/src/.next".
```

The build itself succeeded. The failure happened **after** `next build`, when Vercel tried to collect its output. Vercel was looking in `src/.next`, but Next.js writes `.next` to the repository root (the folder containing `package.json`, `next.config.ts`, `src/app` and `vercel.json`). This happens when the Vercel project has **Root Directory = `src`**, or an **Output Directory override of `src/.next`**.

### Fixes already applied to this repository

- `vercel.json` (for Vercel Root Directory = repository root) and `src/vercel.json` (for Vercel Root Directory = `src`) both declare:
  - **Framework:** `nextjs`
  - **Output Directory:** `.next`, relative to that project root — this overrides a wrong dashboard value such as `src/.next` or `public`
  - **Build Command:** `node scripts/vercel-build.mjs`
  - **Install Command:** npm install with Vercel's deprecated `npm_config_cache_dir` unset
- `scripts/vercel-build.mjs` and the self-contained `src/scripts/vercel-build.mjs` find the real project root, run `npm run build` there, then **physically copy** the valid `.next` output to both `/…/.next` and `/…/src/.next`. Vercel does not reliably accept symlinks as output directories, so this is a real copy.
- Both possible output paths now exist after a Vercel build, so a leftover Root Directory / Output Directory override cannot produce `NEXT_OUTPUT_DIR_MISSING` again.
- `.env.production` exists at the root and in `src/`, and `src/config/firebase.web.json` provides a committed fallback for the same **public** Firebase web identifiers. The app, SEO metadata reader and messaging service worker use that fallback whenever build-time env vars are absent. These are not Admin SDK secrets. Vercel dashboard variables take precedence if set.
- `.gitignore` excludes `.next`, `src/.next` and `.vercel`.

### Still do this in Vercel (recommended clean setup)

1. **Project → Settings → Build and Deployment:**
   - **Root Directory:** leave blank / repository root. The app is NOT a standalone project inside `src`; `src/app` is just the Next.js source folder.
   - **Framework Preset:** Next.js.
   - **Build Command:** `node scripts/vercel-build.mjs`, or let `vercel.json` supply it.
   - **Output Directory:** turn the dashboard Override **off**; `vercel.json` sets `.next`. Do not set `public`, `out`, `src/.next`, or `.next/standalone`.
   - **Install Command:** default npm install, or the one from `vercel.json`.
2. Push these files and **redeploy**. A local build does not update an existing Vercel deployment.
3. Open the **Ready** deployment → **Visit**, and check `https://YOUR-DEPLOYMENT.vercel.app/api/health`. It should return:
   ```json
   {"status":"ok","service":"NeighbourLink","firebaseConfigured":true,"timestamp":"…"}
   ```
4. If the project was created with the wrong root, the safest long-term fix is still to correct Root Directory in the dashboard. The dual-output build is a compatibility safeguard, not a substitute for correct project settings.

## The yellow warnings

| Warning | Cause | What this repo does |
|---|---|---|
| `npm warn Unknown env config "cache-dir"` | Vercel build image sets a deprecated npm env variable. | `installCommand` unsets `npm_config_cache_dir` and `npm_config_cache-dir`; `.npmrc` also keeps npm logs at error level. Non-fatal. |
| `npm warn install-scripts 6 packages have install scripts not yet covered by allowScripts` | npm 11's advisory install-script policy. Scripts still ran; it was not the build failure. | `.npmrc` approves the reviewed packages by name: `esbuild`, `@firebase/util`, `protobufjs`, `sharp`. Tested against npm 11.16.0, 11.19.0 and 11.21.2. No blanket `--dangerously-allow-all-scripts`. |
| `npm warn deprecated @esbuild-kit/…`, `@opentelemetry/…`, `eslint@9.39.4` | Upstream package metadata; not an application error. | Kept at versions compatible with Next 16 and Node 22. `loglevel=error` keeps non-actionable registry notices out of deployment logs. |
| `(node:148) [DEP0205] 'module.register()' is deprecated` | Node/Next.js internal tooling notice on newer Node versions. | The Vercel build wrapper appends `--no-deprecation` to `NODE_OPTIONS` for the build process. |
| `npm warn EBADENGINE` for Firebase 13 | Firebase 13 requires Node 24.12+, while this sandbox builds on Node 22. | Pinned `firebase@12.19.0`, `@firebase/app@0.16.2` and `@firebase/app-compat@0.5.18`, whose engine ranges support Node 20+. |

None of these warnings caused `NEXT_OUTPUT_DIR_MISSING`. The path mismatch did.

## Vercel environment

- The public Firebase web config is in `.env.production` (root), `src/.env.production`, and — most importantly — committed at `src/config/firebase.web.json`. `src/lib/firebase.ts`, the SEO metadata reader and the messaging service worker all fall back to that JSON, so a host that ignores `.env.production` cannot produce a build with Firebase unconfigured. Vercel dashboard variables still override the fallback. If you set them, scope them to **Production and Preview**, keep them consistent with project `neighborlink-71fef`, and **redeploy**: Next.js inlines `NEXT_PUBLIC_*` values at build time.
- Do not put Admin SDK service-account JSON or private keys in `NEXT_PUBLIC_*`, `.env.production`, client code, or the repository. Firestore and Storage rules enforce access.
- Add `NEXT_PUBLIC_FIREBASE_VAPID_KEY` in the Vercel dashboard only after generating a Web Push certificate in Firebase Console. Push is optional.

## Firebase Console (separate from Vercel hosting)

1. **Authentication → Sign-in method:** enable Email/Password.
2. **Authentication → Settings → Authorized domains:** add the exact `*.vercel.app` domain from Vercel → Settings → Domains, plus any custom domain.
3. Create the **Cloud Firestore (default)** database and enable **Cloud Storage**. A direct API check currently reports Firestore as disabled / not yet created; the site can render before this, but listings, profiles and admin tools need it.
4. Deploy the included rules and indexes with your Firebase login:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use neighborlink-71fef
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```
5. Wait for composite indexes to finish building.
6. Register a normal account, then in Firestore → `users/{your UID}` change `role` from `resident` to `admin`. Public sign-up cannot grant admin access.
7. Visit `/dashboard → Overview` and choose **Initialise defaults** so categories, neighbourhoods and legal pages become editable Firestore documents.
8. Firebase App Hosting (`apphosting.yaml`) is an alternative host configuration. Vercel uses `vercel.json`, not `apphosting.yaml`.

## Deploy from CLI (alternative to Git)

```bash
npm install
npx next typegen
npm exec tsc -- --noEmit --pretty false
node scripts/vercel-build.mjs       # reproduces the Vercel build + output sync
npx vercel login
npx vercel link                     # link THIS repository root to the right project
npx vercel --prod
```

Open the exact URL printed by Vercel. A successful `npm run build` alone does not publish a deployment.

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

## Security

- Business owners cannot approve their own listings; edits return listings to pending review.
- Public registration cannot grant admin access. Only an existing admin can change roles.
- Images are validated by client code and Storage rules: JPEG/PNG/WEBP/GIF under 5 MB, in owner-specific folders.
- Account deletion requires recent password authentication and removes the user's content and photos.
- Official email and social handles are intentionally empty. Add them when they exist in Dashboard → Website settings.

**Emergency disclaimer:** NeighbourLink is not an emergency service. In an emergency call **112** (Police) or **122** (FRSC).
