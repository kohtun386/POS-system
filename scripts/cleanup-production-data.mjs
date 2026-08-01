#!/usr/bin/env node
/**
 * scripts/cleanup-production-data.mjs
 *
 * Destructive cleanup of 6 test shops + 7 test users (approved by Ko Htun).
 * DRY-RUN by default — pass --exec to actually mutate.
 *
 * Reads VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env, then .env.local
 * (Node >=20.6 process.loadEnvFile — no tsx, no dotenv). Never prints secrets.
 *
 * Addresses the 3 pre-flight blockers:
 *   1. Repoint survivors off sekaLabs (users.shop_id is NOT NULL / NO ACTION).
 *   2. Clear NO ACTION cross-refs for doomed users (audit_logs.actor_id,
 *      sales.cashier_id, cash_shifts.cashier_id, shop_invitations.invited_by)
 *      BEFORE auth.admin.deleteUser() runs — otherwise the public.users
 *      DELETE is rejected by the NO ACTION FKs.
 *   3. Keep kohtunhtun386 as the surviving active platform_admin so the
 *      approve/update-subscription Edge Functions keep working.
 *
 * DEVIATION FROM PLAN (flagged for security review):
 *   audit_logs.actor_id is NOT NULL live. "SET actor_id = NULL" (approved plan)
 *   would error 23502. Rows are instead REASSIGNED to kohtunhtun386 (the
 *   surviving platform_admin) to preserve the audit trail. This covers BOTH the
 *   doomed-shop rows (deleted later in Step E) and the 20 global shop_id=NULL
 *   rows (kept) — and it is REQUIRED before Step D: 47 audit rows reference
 *   doomed users, and audit_logs.actor_id is NO ACTION, so deleteUser() would
 *   fail unless they are cleared first.
 *
 * Safe order (verified against live FKs 2026-08-01):
 *   internal children FKs are all SET NULL or CASCADE:
 *     sales.customer_id->customers SET NULL, sales_tabs.selected_customer_id->customers SET NULL,
 *     product_batches.product_id->products CASCADE, print_jobs.order_id->sales SET NULL,
 *     stock_adjustments.stock_item_id->stock_items CASCADE
 */

import { createClient } from '@supabase/supabase-js';

const EXEC = process.argv.includes('--exec');

// ---- Environment (no dotenv; Node >=20.6) ----
for (const f of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(f);
  } catch (e) {
    if (e && e.code !== 'ENOENT') throw e;
  }
}
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('FATAL: missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env/.env.local');
  process.exit(1);
}
if (!url.includes('ejvvwnupiqytximrbmfw')) {
  console.warn('WARNING: target URL does not reference project ejvvwnupiqytximrbmfw — refusing to continue.');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// ---- Hard-pinned IDs (verified live 2026-08-01) ----
const CELE_SHOP_ID = '99cf2f48-1f8e-4886-9f45-b8f411914c04'; // Cele's Coffee Shop
const CELE_USER_ID = '09a6fc18-8007-4eb5-9e20-5520e129cac2'; // cele@coffee.com
const KOHTUN_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; // kohtunhtun386@gmail.com

const DOOMED_USER_EMAILS = [
  'test-admin@coffeeshop.local',
  'test-admin-manager@coffeeshop.local',
  'demo-shop-2026@coffeeshop.local',
  'kokoe131986@gmail.com',
  'winttheingiaung@gmail.com',
  'htuntunsagaing@gmail.com',
  'uhtun.khtun@gmail.com',
];

const DOOMED_SHOP_IDS = [
  '4f3dab19-144e-4a29-95a5-2ee82f160ce5', // sekaLabs 2025 POS Store
  'bc84146a-311b-4353-8e9a-b40a09713c29', // Demo Coffee Bar
  'b66c6fbd-21e2-4004-b1af-cd51328c373b', // kokoe131986's Coffee Shop
  'e736e2ad-d9f7-48a1-a321-8bce226796a0', // testing
  'd539de4b-5379-402b-aedc-79aad1d1d781', // fufu-coffee
  '73c02c69-d82e-4e06-a36b-d24f6f6ea59b', // uhtun.khtun's Coffee Shop
];

// Step C config — column nullability verified live 2026-08-01 (PostgREST cannot
// read information_schema, so it is hardcoded + defensively handled in --exec).
// fallback: 'null' | 'reassign' | 'delete'
const STEP_C = [
  { table: 'audit_logs', column: 'actor_id', nullable: false, fallback: 'reassign' },
  { table: 'sales', column: 'cashier_id', nullable: true, fallback: 'null' },
  { table: 'cash_shifts', column: 'cashier_id', nullable: false, fallback: 'reassign' },
  { table: 'shop_invitations', column: 'invited_by', nullable: false, fallback: 'delete' },
];

// All 23 children of shops(id). NO ACTION group must be deleted explicitly
// before the shop; CASCADE group is deleted explicitly too (deterministic).
const NO_ACTION_CHILDREN = [
  'app_settings', 'audit_logs', 'categories', 'customers', 'discounts',
  'notification_service_config', 'product_batches', 'products', 'sales',
  'sales_tabs', 'suppliers', 'cash_shifts',
  'alert_configurations', 'alert_history', 'alert_recipients', 'alert_templates',
];
const CASCADE_CHILDREN = [
  'shop_memberships', 'print_jobs', 'purchase_logs',
  'shop_invitations', 'stock_items', 'stock_adjustments',
];
const ALL_CHILDREN = [...NO_ACTION_CHILDREN, ...CASCADE_CHILDREN];

const fetchJson = async (builder) => {
  const { data, error } = await builder;
  if (error) throw new Error(`${error.message} (hint: ${error.hint ?? ''})`);
  return data;
};

async function main() {
  // ---- Step A: resolve IDs live, verify hard-pinned constants ----
  const [shops, users] = await Promise.all([
    fetchJson(admin.from('shops').select('id, name')),
    fetchJson(admin.from('users').select('id, email, role, shop_id')),
  ]);
  const shopName = new Map(shops.map((s) => [s.id, s.name]));
  const userEmail = new Map(users.map((u) => [u.id, u.email]));

  for (const id of [CELE_SHOP_ID, ...DOOMED_SHOP_IDS]) {
    if (!shopName.has(id)) throw new Error(`FATAL: shop id ${id} not found live`);
  }
  for (const id of [CELE_USER_ID, KOHTUN_USER_ID]) {
    if (!userEmail.has(id)) throw new Error(`FATAL: user id ${id} not found live`);
  }

  const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
  const doomedUserIds = [];
  const missing = [];
  for (const email of DOOMED_USER_EMAILS) {
    const id = byEmail.get(email.toLowerCase());
    if (!id) missing.push(email);
    else doomedUserIds.push(id);
  }
  if (missing.length) throw new Error(`FATAL: doomed users not found live: ${missing.join(', ')}`);

  const doomedUserSet = new Set(doomedUserIds);
  if (doomedUserSet.has(CELE_USER_ID) || doomedUserSet.has(KOHTUN_USER_ID)) {
    throw new Error('FATAL: a doomed user equals a survivor');
  }
  if (doomedUserIds.length !== 7 || DOOMED_SHOP_IDS.length !== 6) {
    throw new Error(`FATAL: unexpected counts (users=${doomedUserIds.length}, shops=${DOOMED_SHOP_IDS.length})`);
  }

  // ---- Dry-run counts: child rows per doomed shop ----
  const childCounts = {};
  for (const shopId of DOOMED_SHOP_IDS) {
    const counts = {};
    await Promise.all(
      ALL_CHILDREN.map(async (t) => {
        const { count, error } = await admin
          .from(t).select('id', { count: 'exact', head: true }).eq('shop_id', shopId);
        counts[t] = error ? -1 : (count ?? 0);
      }),
    );
    childCounts[shopId] = counts;
  }

  // ---- Dry-run counts: Step C cross-refs per doomed user ----
  const stepC = [];
  for (const sc of STEP_C) {
    for (const uid of doomedUserIds) {
      const { count, error } = await admin
        .from(sc.table).select('id', { count: 'exact', head: true }).eq(sc.column, uid);
      stepC.push({
        table: sc.table,
        column: sc.column,
        user: userEmail.get(uid),
        count: error ? -1 : (count ?? 0),
        action: sc.nullable ? 'set null' : sc.fallback,
      });
    }
  }

  // ---- Step B dry-run: survivors currently on sekaLabs ----
  const repoint = users.filter(
    (u) => (u.id === CELE_USER_ID || u.id === KOHTUN_USER_ID) && u.shop_id === DOOMED_SHOP_IDS[0],
  );

  // ---- Print summary ----
  console.log(`\n=== cleanup-production-data: ${EXEC ? 'EXEC MODE' : 'DRY RUN (no mutations)'} ===\n`);
  console.log(`Doomed shops (${DOOMED_SHOP_IDS.length}):`);
  for (const sid of DOOMED_SHOP_IDS) {
    const rows = Object.entries(childCounts[sid]).filter(([, c]) => c > 0);
    const total = rows.reduce((a, [, c]) => a + c, 0);
    console.log(`  ${shopName.get(sid)} (${sid})`);
    if (rows.length) {
      for (const [t, c] of rows) console.log(`      ${t}: ${c}`);
      console.log(`      TOTAL child rows: ${total}`);
    } else {
      console.log('      (no child rows)');
    }
  }
  const shopTotals = Object.values(childCounts).flatMap((m) => Object.values(m));
  console.log(`\nTotal child rows to delete across all doomed shops: ${shopTotals.reduce((a, c) => a + c, 0)}`);

  console.log(`\nDoomed users (${doomedUserIds.length}):`);
  for (const uid of doomedUserIds) console.log(`  ${userEmail.get(uid)} (${uid})`);

  console.log(`\nStep B — repoint survivors to Cele's shop (${CELE_SHOP_ID}):`);
  console.log(`  users to repoint: ${repoint.length}`);
  for (const u of repoint) console.log(`    ${u.email} (currently shop ${u.shop_id})`);

  console.log('\nStep C — clear NO ACTION cross-refs (before user deletion):');
  for (const r of stepC) {
    if (r.count > 0) console.log(`  ${r.table}.${r.column} → ${r.action} for ${r.user}: ${r.count} row(s)`);
  }
  const stepCTotal = stepC.reduce((a, r) => a + r.count, 0);
  console.log(`  TOTAL cross-ref rows: ${stepCTotal}`);
  const auditNotNull = STEP_C.find((s) => s.table === 'audit_logs');
  console.log(
    `\nNOTE: audit_logs.actor_id is NOT NULL live — rows are REASSIGNED to ` +
      `kohtunhtun386 (${KOHTUN_USER_ID}) instead of SET NULL (deviation from plan text, approved flag).`,
  );

  console.log('\nStep D — delete doomed users via auth.admin.deleteUser (cascades public.users + memberships):');
  console.log(`  ${doomedUserIds.length} user(s)`);

  console.log('\nStep E — delete doomed shops, children first (23 child tables + shop row):');
  console.log('  children deleted explicitly (NO ACTION then CASCADE), then the shop row.');

  if (!EXEC) {
    console.log('\nDRY RUN complete — no data modified. Re-run with --exec to execute (post security review).');
    return;
  }

  // ================= EXEC MODE =================
  console.log('\n=== EXECUTING ===');
  const failures = [];

  // Step B — repoint survivors
  {
    const { error, count } = await admin
      .from('users').update({ shop_id: CELE_SHOP_ID }, { count: 'exact' })
      .in('id', [CELE_USER_ID, KOHTUN_USER_ID]);
    if (error) failures.push(`Step B repoint users: ${error.message}`);
    else console.log(`Step B: repointed ${count ?? 0} user(s) to Cele's shop`);
  }

  // Step C — clear NO ACTION cross-refs for doomed users
  for (const sc of STEP_C) {
    for (const uid of doomedUserIds) {
      const action = sc.nullable ? 'null' : sc.fallback;
      let builder;
      if (action === 'null') {
        builder = admin.from(sc.table).update({ [sc.column]: null }, { count: 'exact' }).eq(sc.column, uid);
      } else if (action === 'reassign') {
        builder = admin.from(sc.table).update({ [sc.column]: KOHTUN_USER_ID }, { count: 'exact' }).eq(sc.column, uid);
      } else {
        builder = admin.from(sc.table).delete({ count: 'exact' }).eq(sc.column, uid);
      }
      const { error, count } = await builder;
      if (error) failures.push(`Step C ${sc.table}.${sc.column} for ${userEmail.get(uid)}: ${error.message}`);
      else if (count > 0) console.log(`Step C: ${sc.table}.${sc.column} ${action} for ${userEmail.get(uid)} (${count})`);
    }
  }

  // Step D — delete doomed users (auth.admin.deleteUser → cascades public.users)
  for (const uid of doomedUserIds) {
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (error) failures.push(`Step D deleteUser ${userEmail.get(uid)}: ${error.message}`);
    else console.log(`Step D: deleted user ${userEmail.get(uid)}`);
  }

  // Step E — delete doomed shops, children first, then the shop
  for (const shopId of DOOMED_SHOP_IDS) {
    try {
      for (const t of ALL_CHILDREN) {
        const { error, count } = await admin.from(t).delete({ count: 'exact' }).eq('shop_id', shopId);
        if (error) failures.push(`[${shopName.get(shopId)}] delete ${t}: ${error.message}`);
        else if (count > 0) console.log(`[${shopName.get(shopId)}] deleted ${count} ${t}`);
      }
      const { error } = await admin.from('shops').delete().eq('id', shopId);
      if (error) failures.push(`[${shopName.get(shopId)}] delete shop: ${error.message}`);
      else console.log(`[${shopName.get(shopId)}] deleted shop row`);
    } catch (e) {
      failures.push(`[${shopName.get(shopId)}] ${e.message}`);
    }
  }

  if (failures.length) {
    console.error(`\n${failures.length} failure(s):`);
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }
  console.log('\nCleanup complete with no failures.');
}

main().catch((e) => {
  console.error(`\nFATAL: ${e.message}`);
  process.exit(1);
});
