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

## Google Maps and business cover images

The map uses the Google Maps JavaScript API. Before interactive Google maps are available in production:

1. In Google Cloud Console, select the billing-enabled project and enable **Maps JavaScript API**.
2. Create a browser API key. Restrict **Application restrictions → Websites** to `https://neighborlinkweb.vercel.app/*`, your final production domain, and `http://localhost:3000/*` for local development. Restrict **API restrictions** to Maps JavaScript API. Never use a server service-account credential as the browser API key.
3. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in Vercel → Project → Settings → Environment Variables for **Production and Preview** and redeploy. In Google Cloud, restrict the browser key by HTTP referrer to your exact production domain and `localhost:3000`, and restrict its API access to Maps JavaScript API. Never use an Admin/service-account key in the browser.
4. The project currently uses `DEMO_MAP_ID` so Advanced Markers work during evaluation. For production styling, create a real Google Map ID and set `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` in Vercel too.
5. Enable billing and set Google Maps quotas/budget alerts. Device location is used only when a business owner explicitly presses **Use my location** in the listing form; the browser prompts for permission. Owners may instead click/drag a pin or type coordinates. The pin is published only after the business listing is approved.
6. Without a Maps API key, maps show a graceful Google Maps link and manual coordinate entry. Click-to-directions links work independently of the Maps JavaScript API.

**Business cover photo:** recommended source **1600 × 900 px (16:9)**. The business-cover uploader centre-crops to 16:9 and resizes to at most 1600 × 900. All locally uploaded images are auto-oriented, EXIF-stripped and converted to WebP (or JPEG where WebP encoding is unavailable) at ≤ 1.5 MB before Firebase Storage. Original source files up to 25 MB are accepted. Profile photos and logos use a centred square crop at up to 1024 × 1024; other images preserve aspect ratio with a 1600 px longest edge. Animated GIFs become still images. Pasted third-party URLs are used as provided and cannot be re-compressed by this app.

## Firebase

Enable Email/Password, create Firestore and Storage, then publish the rules and indexes:

```bash
npm install -g firebase-tools
firebase login
firebase use neighborlink-71fef
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Add the production domain to Firebase Authentication authorized domains.

## Administrator setup and MFA (one time)

Next.js and eslint-config-next are pinned to the patched 16.4.5 release, which clears the critical Next.js advisory. The current production audit still reports high-severity advisories inherited through the pinned Firebase 12 client and its gRPC dependency; npm's suggested "fix" is a breaking Firebase 9 downgrade and must not be applied automatically. Reassess with a tested Firebase upgrade during dependency maintenance.

**The public one-time setup key has been retired.** No client page, registration form or setup script can grant administrator access. Existing setup keys should be treated as exposed and ignored.

1. Create the **first** administrator directly in the Firebase Console: create the Authentication user, then set `users/{uid}.role = "admin"` in Firestore.
2. Verify that administrator's email. Admin writes require `email_verified = true`.
3. Sign in. Open **Profile -> Administrator security** and enrol an authenticator app (TOTP MFA).
4. Sign out and sign back in. The login page will ask for a 6-digit authenticator code, proving the second factor in the ID token.
5. From **Profile -> Administrator security**, choose **Require MFA for all admins**. Firestore then rejects privileged admin writes from sessions without a second factor.
6. Grant further admins from **Dashboard -> Users**. Requiring MFA cannot be disabled from the client.

Firebase Console setup required once: enable **TOTP MFA** under Authentication -> Sign-in method / Identity Platform. TOTP MFA requires Identity Platform; check its pricing and availability before enabling. Until it is enabled, `config/security.requireAdminMfa` should stay unset, and admins still need verified email plus password.

Administrators must be restored from the Firebase Console if the only admin loses MFA access; no public recovery key exists.

## Additional Firestore protections

- **No fabricated alerts:** every in-app notification must carry `sourceType` and `sourceId`. Rules verify the source document exists and that the actor is allowed to trigger that notice (review author, MFA-verified admin, or conversation participant).
- **Suspensions are durable:** suspending or removing an account writes a private `accountBans/{sha256(email)}` document. A new profile with that email is refused, so deleting and recreating a profile cannot bypass a suspension.
- **Admin writes require MFA** once `config/security.requireAdminMfa` is enabled. The flag can only be switched on by an MFA-verified admin and cannot be switched off from the client.
- **No public bootstrap:** `config/bootstrap` is denied for all client reads and writes; admin roles are granted only by an existing verified admin or directly in the Firebase Console.

Publish `firestore.rules` and `storage.rules` after every deployment. A successful website build does not publish rules.

## Automatic rules deployment

Add `FIREBASE_TOKEN` (from `firebase login:ci`) or `FIREBASE_SERVICE_ACCOUNT_JSON` as a server-only Vercel environment variable. `scripts/vercel-build.mjs` then deploys Firestore rules, indexes and Storage rules on every build, and fails the build if that deployment fails. Never prefix these with `NEXT_PUBLIC_`.

## New Firestore data

`users/{uid}/saved`, `users/{uid}/notifications`, `conversations/{id}/messages`, `config/security`, `accountBans/{sha256(email)}`, plus business fields `whatsappEnabled`, `verificationStatus`, `cacNumber`, and user fields `emailHash` and `suspendedReason`. Publish `firestore.indexes.json` for the inbox index.

## Maps and admin messaging

- Interactive maps use Google Maps JavaScript API with accessible draggable pins. A Google Maps API key is required for interactive tiles. In Google Cloud enable **Maps JavaScript API** and billing, restrict the key to website HTTP referrers and that API, then set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in Vercel Production and Preview and redeploy. No Google Maps key is present in this repo/sandbox. Until set, the site automatically uses an interactive OpenStreetMap fallback with the same exact pins, while Google Maps links and manual coordinates/geolocation still work. `DEMO_MAP_ID` is used for evaluation markers; create a production Map ID and set `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` when styling the production map.
- Business owners must set an exact latitude/longitude in the listing form (click or drag the map when enabled, enter coordinates, or explicitly use current location while at the business). Owners can update only the pin without sending an approved listing back to review. Admins can correct pins and filter “Missing pin” from Dashboard → Businesses → Location. Only approved listings with valid saved coordinates appear publicly. Coordinates sync live; this is the saved business location, not continuous GPS tracking.
- Business cover photo recommendation: **1600 × 900 px (16:9)**. Uploaded images are auto-oriented, centre-cropped when needed, EXIF-stripped, resized and compressed to WebP (JPEG fallback) ≤1.5 MB before Storage. Source files up to 25 MB are accepted. Logos/profile images use a square crop up to 1024×1024; other images preserve aspect ratio with a 1600 px longest edge. GIFs become still images. External image URLs are used as-is and are not compressed.
- The homepage no longer renders the full category grid or neighbourhood chip list; it shows a business map with compact category/area selectors. The directory also has a map view.
- All new direct messages are admin support threads (`conversations` with `kind: "admin"`). Members see their own threads in `/profile#messages` and `/inbox`; active admins see all support threads in Dashboard → Member messages. Admin replies create an in-app notification for the member. Older peer-to-peer threads are read-only.
- Publish the updated `firestore.rules` and `firestore.indexes.json` before using these features. The new indexes cover admin support lists by kind/user/time and kind/time.
