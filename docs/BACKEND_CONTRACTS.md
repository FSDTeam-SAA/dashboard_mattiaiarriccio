# Admin Dashboard — Backend Contracts for New Sections

All requests go through the existing `apiRequest<T>(path, { token, method, body, isFormData })` helper
(now in `lib/api-client.ts`). `path` is relative to `NEXT_PUBLIC_API_BASE_URL` (default `/api/v1`, e.g.
`/admin/users`). `apiRequest` returns `payload.data` (already unwrapped) and throws `Error & {status}` on
non-2xx; the thrown `error.message` is the backend message. List endpoints return `{ data, meta }` — note
`apiRequest` returns only `data`; if you need `meta` (pagination), call `fetch` directly OR (preferred) the
sections below that need pagination should read total/pages from a second call or accept that `apiRequest`
drops meta — for paginated admin lists, use a small local `fetchWithMeta` that returns the whole payload
(see note at bottom). All admin endpoints require an admin Bearer token (the dashboard already stores it).

## Auth
- Admin login: `POST /auth/admin/login` `{ email, password }` → `data.accessToken` (already implemented in shell).

## Users / Premium  (UsersSection)
- `GET /admin/users?search=&tier=free|premium&page=&limit=` →
  `data: [{ id, fullName, email, role, tier, premiumSource, premiumExpiresAt, createdAt }]`, `meta:{page,limit,total,totalPages}`
- `GET /admin/users/:userId` →
  `data: { user: { id, fullName, email, phoneNumber, avatarUrl, role, tier, premiumSource, premiumExpiresAt, premiumGrantedBy, manualPremiumActive, manualPremiumExpiresAt, manualPremiumSource, preferredLanguage, createdAt, updatedAt },
           subscriptions: [{ id, store, productId, status, expiresAt, createdAt }],
           couponRedemptions: [{ id, couponId, redeemedAt }],
           auditLog: [{ id, adminId, action, meta, createdAt }] }`
- `POST /admin/users/:userId/grant-premium` `{ durationDays: number|null }` (null = lifetime) → updated user detail
- `POST /admin/users/:userId/revoke-premium` → updated user detail

## Coupons  (CouponsSection)
- `POST /admin/coupons` `{ code?, type:'premium_grant'|'trial', durationDays?:number|null, maxRedemptions?:number, expiresAt?:ISO|null, active?:bool }`
  → 201 `data: { id, code, type, durationDays, maxRedemptions, redemptionsCount, remainingRedemptions, expiresAt, active, createdAt }` (omit `code` to auto-generate)
- `GET /admin/coupons?page=&limit=&active=&type=&search=` → `data:[coupon]`, `meta`
- `PATCH /admin/coupons/:couponId` `{ active?, maxRedemptions?, expiresAt?, durationDays?, type? }` → updated coupon
- `DELETE /admin/coupons/:couponId` → `{ }` (cascades redemptions)
- premium_grant `durationDays:null` = lifetime. trial is always time-boxed (null defaults to 7 at redeem).

## System Settings (limits / tier prompts / access rules)
- `GET /admin/app-settings` → `data` = full config object:
  `{ freeDailyMessageLimit:int, freeDailyChatLimit:int, freePrompt:string, premiumPrompt:string,
     accessRules:{ premiumChecklistsLocked:bool, premiumGuidesLocked:bool, maxFreeMaterials:int },
     adsEnabled, adConfig, admUnitIds, emergencyOverrideEnabled:bool, reminderDefaults:{offsetDays:int[],channel}, notificationsEnabled:bool }`
- `PATCH /admin/app-settings` `{ <any subset of the keys above> }` → returns the full updated config.
  Validation is server-side (e.g. limits must be int>=0; freePrompt/premiumPrompt non-empty).
- The "Chat bot prompts" section edits `freePrompt` and `premiumPrompt` so tier-specific response controls
  are visible next to the per-language AI welcome/system/fallback prompts.
- The "Premium permissions" section edits only `freeDailyMessageLimit`, `freeDailyChatLimit`, `accessRules`,
  `emergencyOverrideEnabled`, and `notificationsEnabled`. Ad config is a SEPARATE section, see below.

## Ads  (AdsSection)
- `GET /admin/settings/ad-config` → `data: { adsEnabled:bool, adConfig:{ format:'banner'|'native'|'banner+native', placements:string[], nativeFrequency:int>=1 }, admUnitIds:{ android:{banner,native}, ios:{banner,native} } }`
- `PATCH /admin/settings/ad-config` `{ adsEnabled?, adConfig?, admUnitIds? }` → returns updated `{ adsEnabled, adConfig, admUnitIds }`.
  Helper text: premium users never see ads. `placements` is a multi-select of known screen keys
  (suggest: `home`, `checklists`, `guides`, `chat`, `materials`).

## Emergency Responses  (EmergencyResponsesSection)
- `GET /admin/emergency-responses?category=&language=&active=` → `data:[{ id, title, category, triggerKeywords:string[], responseTemplate, language:'en'|'it', order:int, active:bool, createdAt }]`
- `POST /admin/emergency-responses` `{ title*, responseTemplate*, category?, triggerKeywords?:string[], language?:'en'|'it', order?:int, active?:bool }` → 201 created doc
- `PATCH /admin/emergency-responses/:id` `{ title?, responseTemplate?, category?, triggerKeywords?, language?, order?, active? }` → updated doc (reorder via `order`, toggle via `active`)
- `DELETE /admin/emergency-responses/:id`
- triggerKeywords is a tag input; responseTemplate is a textarea. language is en/it.

## Materials oversight (read-only)  (MaterialsSection)
- `GET /admin/materials?expiringSoon=true|false&userId=&page=&limit=` →
  `data:[{ id, userId, name, category, imageUrl, expirationDate, inspection:{intervalDays,lastInspectedAt,nextInspectionAt}, reminderRules:[{offsetDays,channel}], active, createdAt }]`, `meta`
- Read-only. `expiringSoon=true` filters to expiration within 30 days. Show an "expiring soon" badge.

## Notifications monitoring (read-only)  (NotificationsSection)
- `GET /admin/notifications?status=pending|sent|canceled|failed&type=&channel=&userId=&page=&limit=` →
  `data:[{ id, userId, type:'material_expiry'|'inspection'|'custom', refId, title, body, scheduledAt, channel:'push'|'local', status, sentAt, error, createdAt }]`, `meta`
- Read-only. Status filter dropdown for monitoring.

## Pagination note
`apiRequest<T>` returns only `payload.data`, dropping `meta`. For paginated admin lists, add a tiny helper in
`lib/api-client.ts` like `apiRequestRaw<T>(path, opts): Promise<{ data: T; meta?: PageMeta }>` that returns the
whole payload, and use it where you need page/total. (Or just request a large `limit` and page client-side for v1.)
