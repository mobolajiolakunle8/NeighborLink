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

## Administrator Setup

You can set up and activate administrator access directly in the application using the **Admin Setup Key**:
- Default Key: `NEIGHBOURLINK_ADMIN_2026` (configurable via `NEXT_PUBLIC_ADMIN_SETUP_KEY`)

Ways to activate Admin access:
1. **On `/dashboard`:** Sign in with any account, enter the Admin Setup Key in the activation card, and click **Activate Admin Privileges**. Your role updates immediately and the dashboard unlocks.
2. **On `/register`:** Click "Site owner? Register as Administrator", enter the Admin Setup Key, and register directly with admin privileges.
3. **On `/profile`:** Click "Activate Admin Access" under account details.
4. **Via CLI:** Run `node scripts/setup-admin.mjs <email> <password> [setupKey]` in the terminal.

Note: A successful Next.js deployment does not publish Firebase rules. If Firestore returns permission-denied during setup, deploy `firestore.rules` (which includes the authorized admin key check) via Firebase Console or CLI (`firebase deploy --only firestore:rules`).
