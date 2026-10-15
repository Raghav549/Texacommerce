# Deployment: web and Android

## 1. Vercel web project

- Framework: **Next.js**.
- Root directory: **`apps/web`** (not repository root).
- Node.js: **22.x**, at least 22.13.
- Install command: `npm ci`.
- Build command: `npm run build`.
- Output directory: Next.js default; do not enter `dist`.
- No static export: authentication and APIs require a server runtime.

### Environment variables

| Variable | Required for | Value |
| --- | --- | --- |
| `DATABASE_URL` | Accounts, live feed, throttling | Neon PostgreSQL connection string with SSL. Keep server-only. |
| `AUTH_SECRET` | Auth.js sessions | Cryptographically random secret (`openssl rand -base64 32`). Keep server-only. |
| `AUTH_URL` | Auth callback/cookie origin | Your exact HTTPS Vercel/custom-domain origin. Use the appropriate origin in each environment. |
| `RESEND_API_KEY` | Optional password recovery | Server-side Resend API key, never public. |
| `EMAIL_FROM` | Optional password recovery | A sender on your verified Resend domain, e.g. `Texa <accounts@example.com>`. |
| `MARKETPLACE_COD_ENABLED` | Optional COD ordering | Defaults off. Set `true` only after live marketplace validation and operations readiness. |
| `AUTH_TRUST_HOST` | Auth behind Vercel's proxy | `true`, only on your trusted deployment. |

No `NEXT_PUBLIC_` secret, OpenAI key, Uploadcare key, or proprietary Anything project ID is needed by the active application. Old source files mention provider variables, but their endpoints are intentionally disabled. Never put `DATABASE_URL` or `AUTH_SECRET` in mobile public variables.

### Prepare the database

1. Create a Neon PostgreSQL database and obtain its connection string.
2. Add it securely to Vercel's environment settings.
3. Run the idempotent migration against that database, from a trusted local shell:

   ```sh
   cd apps/web
   # Export DATABASE_URL through your shell or secret manager.
   npm run migrate
   ```

   Alternatively, run all numbered migrations, in order, from `apps/web/migrations/` in the database's SQL editor. The migration adds **new** `tx_` tables for accounts, social interactions, listings, cart, checkout, and orders plus atomic database functions and does not migrate imported legacy data.
4. Deploy/redeploy after setting variables.
5. Visit `/api/health`; confirm configuration booleans. This endpoint confirms presence of configuration, **not database connectivity**.
6. Create two real test accounts, publish text, refresh, check the public feed, log out, log in, and verify separate identities. No production database was provided in this coding session; these live tests remain necessary.

Use an isolated preview database and a different secret for preview deployments. Do not expose production user data to arbitrary preview branches.

## 2. Android shell

The active Android application is an Expo **WebView shell**, not a rewritten native social platform. It loads the deployed responsive site and requires internet access. HTTPS same-origin pages stay inside the app; approved external links open in the system browser. It requests no camera or microphone permissions.

1. Deploy web first.
2. Set **`EXPO_PUBLIC_BASE_URL=https://your-domain.example`** in `apps/mobile/.env` for local builds, and in the matching EAS environment for cloud builds. This URL is public and embedded at build time. Changing it requires rebuilding the shell.
3. In `apps/mobile`, run:

   ```sh
   npm ci
   npm run check
   npm run export:android
   npx eas-cli login
   npx eas-cli init
   npx eas-cli build --platform android --profile preview
   # Install resulting APK on actual devices and test.
   npx eas-cli build --platform android --profile production
   # Production output: signed Android App Bundle (AAB).
   ```

   EAS will associate your project and configure signing. Keep account/signing credentials out of Git. The production profile auto-increments its remote version.
4. Before first publication, choose a unique owned Android package ID in `app.json` (currently `com.texacommerce.app`), configure production launcher/adaptive icons and native launch artwork, and verify current target API requirements using EAS/Play Console. The web logo is in `apps/web/public/logo.svg`; it is not automatically a native launcher icon.
5. Test startup, connection loss/retry, cookies/login persistence, keyboard, Android back handling, external navigation, safe areas, text scaling, and screen readers on real devices.
6. Complete Play privacy/data-safety declarations, content ratings, account deletion, moderation/reporting, privacy/contact information, screenshots, and release review. A thin WebView shell may not satisfy store minimum-functionality policies; add useful native features before public store submission. Store approval is not guaranteed.

## Release gates still open

- End-to-end Neon/auth test with real credentials and migrations.
- Email verification, real recovery-email delivery testing, deletion/retention legal review, and user-facing support. Password recovery/change, session revocation, and guarded account anonymization now exist.
- Staff and exercise the moderation/reporting program, privacy/legal review, backups/restore, and observability. Report/block/admin review tools now exist; code does not substitute for a staffed safety program.
- Seller verification, listing photographs/media, shipping operations and policy, online payment webhooks/refunds, and tax/invoice review. Listings, atomic COD checkout and order state transitions now exist; they still need live hosted-database/concurrency QA.
- WebSocket/push delivery at scale, voice/video infrastructure, and durable saved collections. Authorized persisted text messaging with polling now exists, without end-to-end encryption. Live post likes/follows/comments now have database-backed APIs; editorial preview interactions remain local.
- Media storage, validation, malware/content checks, transcoding/CDN.
- Accessibility/contrast audit and device performance measurements; reduced-motion is implemented but no “zero lag” guarantee is made.
- Review outstanding Expo/Metro dependency advisories. Do **not** run `npm audit fix --force` blindly; it suggests incompatible framework downgrades.

The current version can be deployed as an honest demo/community preview. It must not be advertised as a complete, transaction-ready social marketplace.

## Phase 2: live social and COD marketplace

The new `/api/market/*` routes are independent of the quarantined legacy store/checkout handlers. Apply **all numbered** migrations using `npm run migrate`. The runner supports PL/pgSQL function bodies and runs each migration transactionally. Migrations are repeatable for the current definitions; do not edit previously deployed migrations for future schema changes—add a new migration.

### Required real-environment acceptance test

1. Create buyer, seller A, seller B, and unrelated test accounts in an isolated Neon database.
2. Publish two listings from separate sellers. Verify another account cannot edit them. Open a stale seller form, buy an item, and confirm the stale update is rejected.
3. From the buyer account add both listings, change quantities, sign out/in, and confirm the bag persists on the server.
4. Before enabling COD, confirm checkout returns unavailable. For controlled testing only, set `MARKETPLACE_COD_ENABLED=true` and redeploy.
5. Place a COD order; verify two seller orders, server-calculated totals, empty bag, decremented stock, and no online charge. Retry the same request key; ensure no duplicate orders/stock deductions.
6. Change a product price after the buyer loads the bag. Checkout must reject it until the updated bag/prices have been reviewed.
7. Try concurrent purchases of the last item from separate browser sessions against hosted PostgreSQL. Verify only available stock is sold. Embedded tests do not replace this multi-connection test.
8. Accept as the seller, cancel as buyer before shipping, and verify a single stock restoration. After shipping, buyer cancellation must fail; the buyer may confirm receipt.
9. Publish text, like/follow/comment from another account, refresh to confirm persistence, and test owner-only post/comment deletion.

Order statuses: `placed → accepted → shipped → delivered`. Buyer or seller may cancel a placed/accepted order. Only the seller can accept/ship; only the buyer can confirm receipt. Seller visibility is limited to their own listings and orders. Shipping details are shown only to the relevant buyer/seller APIs; operators still need a lawful retention and support policy.

All current account holders can list products; **there is no completed seller verification or moderation program**. Do not publicly enable orders merely because the code builds. Seller logistics, marketplace policies, returns/disputes, abuse review, account deletion, and real identity checks remain release gates.


## Phase 3: account safety, recovery and messaging

### Upgrade and administrator setup

Apply `003_safety_accounts.sql` and `004_inbox.sql` (the migration command discovers all four files). Existing sessions created before the session-version migration are intentionally invalidated. Sign in again after upgrading.

Create an ordinary account you control, verify its ownership yourself, and promote it from a **trusted operator shell**:

```sh
cd apps/web
# Securely export DATABASE_URL and ADMIN_EMAIL; do not paste credentials into chat.
export CONFIRM_ADMIN_PROMOTION=yes
npm run admin:promote
```

This changes only the matching active account and revokes its old sessions. The administrator console appears in Settings after signing in again. Ordinary registration always uses the database default `member` role. There is no browser API for assigning administrator privileges.

Moderators can hide reported posts/comments/products, suspend the reported author, dismiss reports, and restore mistaken decisions from the audit list. Actions are checked again inside PostgreSQL and recorded in an audit table. Staff need policies, response times, escalation/appeal procedures, and support for order disputes; these are operational obligations, not automatically completed by the console.

### Email recovery

Add `RESEND_API_KEY` and `EMAIL_FROM` in Vercel. Verify the sending domain in your email provider. `AUTH_URL` must be your actual **HTTPS** application origin. Resend is an external, separately configured service; no email was sent or verified in the sandbox.

Reset requests return the same acknowledgment for known and unknown addresses, with deferred delivery work. Tokens are cryptographically random, stored only as hashes, expire after 30 minutes, are single-use, and revoke all sessions when consumed. Links put the token in the URL fragment, which is removed from the browser address bar on load. Do not install analytics that capture fragments/form input. Monitor sanitized delivery failures in server logs and configure provider-level delivery alerts. The API is bounded/rate-limited but is not a substitute for distributed abuse monitoring.

### Account lifecycle

- Password change and sign-out-all-devices require the current password. Deletion also requires typing `DELETE`.
- Account deletion is blocked by unfinished buyer or seller orders; finish/cancel them first.
- Deletion anonymizes the account, removes posts/comments/connections/cart/messages and related notifications, hides/anonymizes listings, and scrubs delivery details from completed buyer orders.
- Financial order snapshots, pseudonymous account references, reports, and moderation audit history are retained. Backups may contain historical personal data until their retention window expires. Establish your actual legal basis, retention windows, backup deletion policy, support contact, and privacy notice before launch. This implementation is not a guarantee of legal compliance.
- Administrators cannot delete their account through the member flow; a trusted operator must transfer/demote administrative access first.

Session cookies are version-checked against PostgreSQL on authenticated requests. Password changes, resets, suspension, deletion and explicit revocation invalidate existing sessions; a suspended/deleted account cannot sign in. Database outages fail closed rather than authorizing cached privileges.

### Text inbox and notifications

Messages use `/api/inbox/messages`, with authenticated sender identity, participant-scoped reads, bounded text, send-key deduplication, and blocking checks. The inbox polls every 5–10 seconds only while visible. It is **not end-to-end encrypted**, has no voice/video/file support, and currently loads at most the latest 100 thread messages / 50 conversations. Pagination, retention management, scalable real-time delivery and abuse operations remain future work.

In-app notifications are generated in the same database transaction as likes, comments, follows, messages and order changes. Notification reads/mark-read are scoped to the current account. There is no mobile push or transactional order-email delivery yet.

Blocking is account-level: it hides each other's content from authenticated views and prevents new social/message/commerce interactions. Public posts remain public to signed-out visitors, so blocking must not be marketed as private-post access control. Historical orders stay accessible to the participants for fulfillment.

### Additional acceptance tests

Use multiple real browser sessions against an isolated hosted database to verify session revocation, block behavior in both directions, report access and moderation, mistaken-decision restoration, deletion with open and completed orders, private inbox isolation, retry deduplication, read receipts, and notification ownership. Test actual email inbox delivery, expired/reused reset links, and password recovery after signing out. Embedded database tests and mocked browser fixtures do not replace these hosted tests.
