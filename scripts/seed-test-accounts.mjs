#!/usr/bin/env node
/**
 * scripts/seed-test-accounts.mjs
 *
 * Seeds 3 tier test accounts (free/growth/pro) via auth.admin.createUser, then
 * approves each shop and sets its subscription tier through the platform-admin
 * Edge Functions. DRY-RUN by default — pass --exec to mutate.
 *
 * Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
 * from .env then .env.local (Node >=20.6 process.loadEnvFile — no tsx, no dotenv).
 * Never prints secret values (except generated account passwords, which are
 * printed for Ko Htun's smoke-test logins and appended to a gitignored backups/ note).
 *
 * Password source: PLATFORM_ADMIN_PASSWORD -> TEST_PLATFORM_ADMIN_PASSWORD ->
 * generate a random strong password per account (printed + saved to backups/).
 *
 * Live-verified EF contracts (2026-08-01):
 *   platform-admin-approve-shop         body: { shop_id }
 *   platform-admin-update-subscription  body: { shop_id, tier, is_active? }
 *     NOTE: EF uses `tier` (NOT `subscription_tier`) and computes its own
 *     DAILY_ORDER_LIMITS { free: 50, growth: 0, pro: 0 }. `daily_order_limit`
 *     passed in the body is IGNORED by the EF.
 *   verifyPlatformAdmin accepts a service_role JWT in the Authorization header
 *   (service-role path: looks up an ACTIVE platform_admin — kohtunhtun386 is the
 *   sole one post-cleanup). The supabase-js FunctionsClient does NOT attach the
 *   JWT automatically, so invoke() must pass Authorization + apikey explicitly.
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import fs from 'node:fs';

const EXEC = process.argv.includes('--exec');

// ---- Environment (no dotenv; Node >=20.6) ----
function loadEnv(file) {
  try {
    process.loadEnvFile(file);
  } catch (e) {
    if (e && e.code !== 'ENOENT') throw e;
  }
}
loadEnv('.env');
loadEnv('.env.local');

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !serviceKey || !anonKey) {
  console.error('FATAL: missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY in .env/.env.local');
  process.exit(1);
}
if (!url.includes('ejvvwnupiqytximrbmfw')) {
  console.error('FATAL: target URL does not reference project ejvvwnupiqytximrbmfw — refusing to continue.');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// ---- Seed set ----
const ACCOUNTS = [
  { email: 'free.test@coffee.com', shop: 'Free Test Shop', tier: 'free' },
  { email: 'growth.test@coffee.com', shop: 'Growth Test Shop', tier: 'growth' },
  { email: 'pro.test@coffee.com', shop: 'Pro Test Shop', tier: 'pro' },
];
const KOHTUN_EMAIL = 'kohtunhtun386@gmail.com';

const makeUsername = (email) => email.split('@')[0].replace(/[^a-z0-9_]/gi, '_');
const makeName = (email) =>
  email.split('@')[0].split(/[._-]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

// ---- Password source ----
const envPassword =
  process.env.PLATFORM_ADMIN_PASSWORD ||
  process.env.TEST_PLATFORM_ADMIN_PASSWORD ||
  null;

async function invokeFn(name, body) {
  const { data, error } = await admin.functions.invoke(name, {
    body,
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: anonKey },
  });
  if (error) {
    const status = error?.context?.status;
    let detail = '';
    try {
      if (error?.context?.text) detail = await error.context.text();
    } catch {}
    const err = new Error(`${name} failed (status ${status}): ${detail || error.message}`);
    err.status = status;
    err.fn = name;
    err.detail = detail;
    throw err;
  }
  return data;
}

const fetchJson = async (builder) => {
  const { data, error } = await builder;
  if (error) throw new Error(`${error.message} (hint: ${error.hint ?? ''})`);
  return data;
};

async function resolvePassword() {
  if (envPassword) return { source: envPassword ? 'env' : 'generate', value: envPassword, perAccount: false };
  return {
    source: 'generate',
    value: crypto.randomBytes(24).toString('base64url'),
    perAccount: true,
  };
}

async function main() {
  // ---- Pre-flight checks (read-only) ----
  const [kohtun, existing] = await Promise.all([
    fetchJson(admin.from('users').select('id, email, role, active').eq('email', KOHTUN_EMAIL).maybeSingle()),
    fetchJson(admin.from('users').select('email').in('email', ACCOUNTS.map((a) => a.email))),
  ]);
  const existingEmails = existing.map((u) => u.email);
  const pw = await resolvePassword();

  console.log(`\n=== seed-test-accounts: ${EXEC ? 'EXEC MODE' : 'DRY RUN (no mutations)'} ===\n`);
  console.log(`Target: ${url}`);
  console.log(`Platform admin (for approve/update EF service-role path): ${kohtun ? `${kohtun.email} role=${kohtun.role} active=${kohtun.active}` : 'NOT FOUND — HARD STOP'}`);

  console.log('\nAccounts to seed:');
  for (const a of ACCOUNTS) {
    const dup = existingEmails.includes(a.email) ? '  [ALREADY EXISTS — skip/fail]' : '';
    console.log(`  ${a.email} -> shop "${a.shop}" (${a.tier})${dup}`);
  }
  if (existingEmails.length) console.log(`\nWARNING: ${existingEmails.length} target email(s) already exist in public.users.`);

  console.log('\nPassword source:');
  if (pw.source === 'env') console.log('  using password from env (shared across accounts) — value NOT printed');
  else console.log('  no env password key found — generating a random strong password PER ACCOUNT (printed + saved to backups/)');

  if (!kohtun || kohtun.role !== 'platform_admin' || !kohtun.active) {
    console.error('\nHARD STOP: no active platform_admin found — approve/update EFs would 403.');
    process.exit(1);
  }
  if (existingEmails.length) {
    console.error(`\nHARD STOP: target email(s) already exist: ${existingEmails.join(', ')}. Re-seeding would orphan data.`);
    process.exit(1);
  }
  if (!EXEC) {
    console.log('\nDRY RUN complete — no data modified. Re-run with --exec to seed.');
    return;
  }

  // ================= EXEC MODE =================
  console.log('\n=== EXECUTING ===');
  const generated = []; // { email, password } when per-account generated

  for (const acct of ACCOUNTS) {
    console.log(`\n--- ${acct.email} (${acct.tier}) ---`);
    let password = pw.value;
    if (pw.perAccount) {
      password = crypto.randomBytes(24).toString('base64url');
      generated.push({ email: acct.email, password, tier: acct.tier, shop: acct.shop });
    }

    // 1. Create auth user (onboarding trigger auto-creates shop+profile+membership+app_settings)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: acct.email,
      password,
      email_confirm: true,
      user_metadata: {
        name: makeName(acct.email),
        username: makeUsername(acct.email),
        shop_name: acct.shop,
      },
    });
    if (createErr) throw new Error(`createUser ${acct.email}: ${createErr.message}`);
    const authUserId = created.user.id;
    console.log(`  created auth user ${authUserId}`);

    // 2. Wait for the onboarding trigger, then fetch the shop by owner_id
    let shop = null;
    for (let i = 0; i < 10 && !shop; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 200));
      shop = await fetchJson(
        admin.from('shops').select('id, name, subscription_tier, is_active, daily_order_limit').eq('owner_id', authUserId).maybeSingle(),
      ).catch(() => null);
    }
    if (!shop) throw new Error(`shop not created for ${acct.email} after 10 attempts`);
    const shopId = shop.id;
    console.log(`  shop auto-created: ${shop.name} (${shopId}) tier=${shop.subscription_tier} active=${shop.is_active}`);

    // 3. Approve via Edge Function
    const approve = await invokeFn('platform-admin-approve-shop', { shop_id: shopId });
    console.log(`  approve-shop: ${JSON.stringify(approve)}`);

    // 4. Set tier if not free (free is set by approve-shop; daily_order_limit derived by EF/DB)
    if (acct.tier !== 'free') {
      const sub = await invokeFn('platform-admin-update-subscription', { shop_id: shopId, tier: acct.tier });
      console.log(`  update-subscription: ${JSON.stringify(sub)}`);
    }

    // 5. Verify
    const [verifyShop, verifyUser, verifyMembership] = await Promise.all([
      fetchJson(admin.from('shops').select('id, name, subscription_tier, is_active, daily_order_limit').eq('id', shopId).single()),
      fetchJson(admin.from('users').select('id, email, role, active, shop_id').eq('id', authUserId).single()),
      fetchJson(admin.from('shop_memberships').select('id, shop_id, user_id, role, is_active').eq('shop_id', shopId).eq('user_id', authUserId).maybeSingle()),
    ]);
    console.log(`  verify shop: tier=${verifyShop.subscription_tier} active=${verifyShop.is_active} daily_order_limit=${verifyShop.daily_order_limit}`);
    console.log(`  verify user: role=${verifyUser.role} active=${verifyUser.active} shop_id=${verifyUser.shop_id}`);
    console.log(`  verify membership: ${verifyMembership ? `role=${verifyMembership.role} is_active=${verifyMembership.is_active}` : 'MISSING'}`);

    if (verifyShop.subscription_tier !== acct.tier || !verifyShop.is_active || !verifyUser.active || !verifyMembership?.is_active) {
      throw new Error(`VERIFICATION FAILED for ${acct.email} — aborting (see above)`);
    }
    console.log(`  OK: ${acct.email} seeded, shop=${acct.shop} tier=${acct.tier}`);
  }

  // Save + print generated credentials
  if (generated.length) {
    const stamp = new Date().toISOString();
    const notePath = 'backups/test-account-credentials-2026-08-01.md';
    const lines = [
      `# Test Account Credentials (generated ${stamp})`,
      '',
      'DO NOT COMMIT — backups/ is gitignored.',
      '',
      ...generated.map((g) => `| ${g.email} | ${g.password} | ${g.tier} | ${g.shop} |`),
      '',
    ];
    fs.mkdirSync('backups', { recursive: true });
    fs.appendFileSync(notePath, lines.join('\n'));
    console.log(`\nGenerated passwords appended to ${notePath}`);
    console.log('GENERATED PASSWORDS (for smoke-test logins):');
    for (const g of generated) console.log(`  ${g.email}: ${g.password}  (tier=${g.tier}, shop="${g.shop}")`);
  } else {
    console.log('\nPassword came from env (shared) — not printed.');
  }

  console.log('\nSeeding complete.');
}

main().catch((e) => {
  console.error(`\nFAILED: ${e.message}`);
  if (e.status === 403) console.error('HARD STOP: Edge Function returned 403 (no active platform_admin or insufficient role).');
  process.exit(1);
});
