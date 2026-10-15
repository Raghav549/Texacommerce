# Project audit and implementation report

## Starting state

Reviewed the repository structure, both manifests/lockfiles and build configuration, mobile route/component/auth utilities, web API route inventory and SQL/security/auth/upload utilities. The original web app was a placeholder despite a large imported API tree. The native source contained many screens, but package.json omitted dependencies such as React Query, Zustand, SVG, image picker, WebView, and animation packages. Expo packages mixed incompatible SDK generations. No reproducible production tests, migration, environment template, or deployment guide existed.

### Important findings

- `@auth/create` referenced a proprietary authentication runtime unavailable to an independent deployment.
- Legacy login returned profile JSON without establishing a usable session.
- Multiple cart/settings/message/store handlers accepted caller-controlled user IDs without ownership checks. Public seed/demo and state-changing routes were exposed.
- Checkout writes were not atomic; quantities, stock, mixed-store ordering, and payment finality were not safe.
- Encryption utilities derive keys on the server; this must not be marketed as end-to-end encrypted messaging.
- Upload utilities depended on a third-party Anything endpoint without independent configuration.
- Existing source had no compatible full database schema. Inventing tables alone would not make it safe.

## Changes made

- Rebuilt the active web interface: responsive navigation, feed, discovery, marketplace/product details, saved, cart, message preview, visual reel/story preview, profile, settings, account and publishing dialogs, errors/404.
- Custom local SVG logo/icons and editorial illustrations, pastel/purple/sage identity, transform/opacity splash, gentle card motion, reduced-motion preference, keyboard dialog close/focus containment, keyboard search shortcut.
- Explicit demo labels; local persistence for preview interactions; checkout cannot silently create fake orders.
- Replaced proprietary server auth with public Auth.js credentials and Argon2 password verification/hashing.
- Added namespaced schema and migration command, account registration, authenticated public text publishing, bounded feed reads, input validation, same-origin mutation checks, and atomic database throttling. New accounts are distinct from legacy users; no legacy-data migration is attempted.
- Added a fail-closed Next proxy around imported legacy APIs. Source is retained for future feature-by-feature migrations; the guard is a deliberate security restriction, not completion of those services.
- Upgraded web to Next.js 16 and matching React, and Android shell to Expo SDK 57 with compatible packages.
- Replaced mobile entry with a minimal Expo WebView shell. Existing source routes are not the active application and are intentionally retained, not claimed fixed.
- Added environment templates, deployment documentation, unit/browser checks, local original assets, and ignore rules for generated results.

## Verification

Executed during this session:

- `apps/web`: optimized production build passed.
- `apps/web`: 3 validation/origin unit tests passed.
- Browser automation against the running production server: desktop navigation, saving/bag persistence, local conversation persistence, 390px mobile layout/navigation/product dialog, all nine views, legacy API blocking, unauthenticated publishing denial, account unavailable-state handling, and desktop rendering. Five browser tests passed. A packaged Chromium binary was used because direct browser downloads are restricted in this sandbox.
- `apps/mobile`: offline Expo dependency compatibility check passed (offline validation caveat applies).
- `apps/mobile`: Android Hermes JavaScript export passed on SDK 57. This is not an APK or device execution.
- Web dependency audit: no known vulnerabilities at the time checked. Mobile dependency audit: **22 findings (7 moderate, 15 high)** after compatible fixes, primarily transitive Expo/Metro/build tooling chains (`braces`, `node-forge`, `uuid`). These require upstream review/updates before release; no incompatible audit-force downgrade was applied.

Not verified: a real Neon database connection, real signup/login/post round trip, transactional commerce, external communications, signed Android packaging, physical device performance, Play approval, or a public Vercel deployment. No production credentials were supplied, and this sandbox only permits a limited set of outbound hosts.

## Architecture / next priorities

The current active backend is deliberately small: `/api/auth/*` (approved Auth.js actions), `/api/community/register`, `/api/community/posts`, `/api/health`. Everything else under `/api` fails closed with `SERVICE_NOT_READY`. Build output still lists legacy routes because their files remain, but requests pass through the safety guard.

Before bringing any old endpoint online, require server-derived user identity, ownership/role checks, input validation and limits, matching migrations, and integration tests. Commerce additionally requires single-transaction stock/order writes, server-side pricing, idempotency and verified payment webhooks. Do not disable the guard globally to make old screens appear functional.


## Phase 2 — social and marketplace foundation (latest)

This section supersedes earlier descriptions that the active marketplace is entirely illustrative:

- Added `002_market_social.sql` for seller-owned listings, carts, idempotent checkout batches, seller-split orders/items, likes, follows and comments.
- Added live catalog, cart, seller studio and buyer/seller order UI. Home editorial products remain explicitly illustrative and now link to the separate marketplace rather than adding fake inventory to a local bag.
- Added server-derived identity/ownership checks, integer-paise money validation, quantity limits, version-checked seller edits, customer price consent, database transactional checkout, deterministic product lock ordering, idempotent request keys and exactly-once cancellation stock restoration.
- COD ordering is gated by `MARKETPLACE_COD_ENABLED=true`; online payment collection is not implemented. India address validation is implemented; shipping is seller-arranged, not a shipping-provider integration.
- Live posts now have durable likes/follows/comments, plus owner-only post/comment deletion and public bounded comment reads. Profile/creator editorial suggestions are still demo content.
- The migration runner now discovers ordered SQL files and preserves dollar-quoted PL/pgSQL bodies.
- Unit/database checks execute actual migrations and SQL functions inside PGlite (embedded PostgreSQL). These test rollback, multi-seller totals, stock checks, idempotency, ownership/state transitions, cancellation, stale inventory updates, customer price consent, social constraints, and input validation. They do not prove multi-connection concurrency on Neon.
- Browser marketplace/social fixture tests exercise authenticated UI interactions with intercepted API responses; they are **not represented as hosted-backend end-to-end tests**. Actual unconfigured-service and legacy safety-barrier tests also run against the production server.

Hosted Neon authentication/commerce tests, real concurrent buyer tests, operational seller verification/moderation, media uploads, tax/shipping/return policy, payment providers, signed Android/device testing and prior release gates remain open. This is a significantly more complete foundation, not an assertion that public production launch is safe yet.

Latest phase-2 verification: **16 unit/database tests passed**, **8 browser tests passed**, and the optimized web build passed. Added a GitHub Actions workflow for web tests/build/browser checks and Android compatibility/export checks. The workflow is added but has not been run on GitHub in this session.


## Phase 3 — account safety, recovery, moderation and text inbox (latest)

- Added migrations 003/004 for account status/roles/session versions, profile bio, bilateral blocks, moderation reports/audit, hashed single-use password tokens, private text messages, and in-app notifications.
- Added profile editing, password changes, session revocation, guarded account anonymization, optional Resend recovery delivery, and URL-fragment reset UI. Every authenticated JWT use checks current account state/session version against the database. Resend has not been configured or verified here.
- Added report controls on actual posts/comments/products/member profiles, blocked-person controls, and a database-admin-only Settings moderation console. Hiding/suspending/dismissing/restoring are audited; database functions recheck privilege. Admin promotion requires a trusted operator CLI, never public signup input.
- Block/status/hidden checks apply to public feed/catalog reads and social/message/commerce database writes. Existing order access is preserved. Public content is still visible while signed out, as disclosed.
- Replaced the local chat demo with a persisted, participant-scoped text inbox with send-key deduplication, read receipts, visible-tab polling and block/report controls. It is not E2EE and is not a scalable WebSocket/push implementation.
- Transactional notification triggers cover social events, messages and orders. API response caching is explicitly disabled for private data.
- Account deletion refuses open orders, protects administrators, anonymizes profile/listings, removes social/private content and scrubs buyer shipping details; financial snapshots and moderation records are retained. Legal policy and backup retention remain operator obligations.
- **23 unit/database tests passed** including all four migrations, moderation authorization/auditing/restoration, block enforcement, suspension/version changes, token expiry/reuse, message/notification deduplication, deletion safeguards and privacy cleanup.
- **12 browser tests passed** against the production build, including fixture-driven profile/block/moderation/inbox/notification workflows and real unconfigured-service handling. Hosted authentication/database integration and actual email delivery are still not verified.

Not completed by this phase: online payment collection/refunds, seller identity verification, real photo/video uploads/transcoding/storage, video reels/stories, voice/video calls, native push, tax/shipping/carrier integrations, load/concurrency tests on Neon, production legal/safety operations, public deployment, signed Android store build and physical-device approval. Existing mobile dependency advisories still require review. These are not implied complete by the passing code tests.

Final phase-3 hardening: password change/session invalidation/recovery-token removal now occur atomically in PostgreSQL; password reset uses consistent account-before-token locking. **24 unit/database tests pass** after the additional atomic-password-change test.
