# Texa / Texacommerce

A redesigned social-commerce **social/marketplace foundation**, with a Next.js web application and an Expo Android WebView shell. This is **not yet a complete production marketplace**. Read [DEPLOYMENT.md](DEPLOYMENT.md) and [PROJECT_AUDIT.md](PROJECT_AUDIT.md) before enabling accounts or publishing to a store.

## Run the web app

Node 22.13+ recommended.

```sh
cd apps/web
npm ci
cp .env.example .env.local
# Set real environment values, or omit DATABASE_URL to browse the demo.
npm run dev -- --hostname 0.0.0.0
```

App views: `/?view=feed`, `explore`, `reels`, `shop`, `messages`, `saved`, `cart`, `profile`, and `settings`.

```sh
npm test
npm run build
npm run start -- --hostname 0.0.0.0
npm run test:browser # run with the production server available at port 3000
```

The UI uses original local SVG artwork, a custom SVG logo/icon set, transform/opacity motion, and reduced-motion support. No external images/fonts are required.

## Live vs. illustrative

- **Database-backed when configured:** account registration, credential sign-in/sign-out, public text posts, likes, follows, comments, owner deletion, editable profiles, blocking, reports/admin moderation, account/session security, persisted text inbox, notifications, listings, seller studio, cart, orders, and database-backed throttling. Password reset delivery optionally uses Resend. COD checkout is separately gated.
- **Local device demo:** likes/follows on illustrative creator content, saved editorial items, only. The Messages view now uses the real server inbox rather than a local demo conversation. No messages are sent.
- **Illustrative:** editorial maker profiles and product artwork, stories, reels, visual media previews. The live marketplace is separate from illustrative home-feed products.
- **Disabled:** online payments, calls, media upload, voice/video communications, AI, and imported unsafe legacy endpoints. Cash-on-delivery ordering is available only after explicit operator enablement. They respond with 503, not fabricated success.

## Android

```sh
cd apps/mobile
npm ci
cp .env.example .env
# Set EXPO_PUBLIC_BASE_URL to your deployed HTTPS web origin.
npm run check
npm run export:android
npx eas-cli build --platform android --profile preview
```

Android export checks JavaScript bundling; it does not produce a signed APK. EAS preview builds produce APKs; production builds produce AABs. Expo authentication, signing, physical device QA, and store submission are still required. Existing `apps/mobile/src` screens are retained as legacy reference; `App.jsx` is the active entry point and does not bundle them.

## Marketplace setup (phase 2)

`npm run migrate` now applies both ordered migrations. Once configured, Marketplace has **Discover**, **Your bag**, **Your orders**, and **Seller studio** tabs. Account holders can publish/edit their own listings. Artwork is clearly marked as placeholder; do not misrepresent it as a product photo.

Ordering defaults to disabled. Set `MARKETPLACE_COD_ENABLED=true` only after real buyer/seller testing and operational/legal readiness. Checkout is **cash on delivery only**, supports India addresses, uses customer-accepted prices, and splits multi-seller carts into individual orders. It does not process online payments or arrange shipping. See deployment release gates.

## Account safety and messaging (phase 3)

Run `npm run migrate` to apply **all four** current migrations. Settings now includes profile editing, blocked-member management, password change, sign-out-all-devices, account deletion, and an administrator-only moderation console. Password recovery is enabled only with `RESEND_API_KEY`, `EMAIL_FROM`, and a correct HTTPS `AUTH_URL`.

A trusted operator can promote an existing owned account with `npm run admin:promote`, using `DATABASE_URL`, `ADMIN_EMAIL`, and `CONFIRM_ADMIN_PROMOTION=yes` securely supplied through the shell. There is deliberately no public role-assignment endpoint.

Messages are persisted, account-authorized text conversations with polling while open. They are **not end-to-end encrypted** and are not a WebSocket/push/call implementation. In-app notifications are created transactionally for social events, messages and orders. Reporting and blocking are available on real posts/comments, listings and member profiles.
