# Onboarding Change Workflow

Tightening the onboarding pipeline: self-registration, staff invitation, platform admin approval.

## Which Pipeline?

| Pipeline | Description | Status |
|----------|-------------|--------|
| Pipeline C | Platform Admin Approval | ✅ Implemented |
| Pipeline A | Self-Registration (Shop Owner) | 📝 Proposed — migrations not yet applied |
| Pipeline B | Staff Invitation (Admin → staff) | 📝 Proposed — migrations not yet applied |

**UNDER of this workflow:** Only Pipeline C can be implemented. Pipeline A & B need migration conversations first.

## Gate

IMPLEMENTABLE → `architecture-architect` confirms scope + requires no new VISION conflicts  
PROPOSED → returns design only, returns no code

### Pipeline C: Platform Admin Approval

1. Install `src/components/platform/` content
2. Fl `PlatformLayout` > `PendingShopsList` pattern
3. Use `supabase.functions.invoke('platform-admin-approve-shop')`
4. Role checks: `shop_memberships.role`, never `users.role`

### Pipeline A & B: guidelines

- `architecture-architect` first — approve schema design, **including any proposed RLS policy changes**
- `db-guardian` next — review and sign off on the **RLS policy text** (service-role bypass rule, shop_id scoping, `current_shop_ids()` recursion guard)
- `onboarding-pipeline` then — **write the migration file** containing the pre-approved schema + policy
- Only then: implement (else: design-only report)

## Implementation Playbook

```
1. READ existing flows
   ├─ supabase/functions/platform-admin-approve-shop/
   ├─ supabase/functions/staff-create/
   └─ src/context/AuthContext.tsx

2. PIN migration needed?
   ├─ YES → db-guardian → show migration to user first
   └─ NO  → design + implementation

3. EDIT affected components
   ├─ src/components/platform/ (Manager + Modal)
   ├─ src/components/auth/

4. CHECK
   ├─ All `shop_memberships.role` checks (never `users.role`)
   └─ All Edge Function calls use `supabase.functions.invoke()`

5. VERIFY
   └─ pr-reviewer for review → git-pilot for PR
```

## Guardrails

- Never doorway checkout, discount, or reporting
- Never remove existing auth flow guards
- Never bypass platform admin auth
- Never touch DB (`shop_invitations` table, `users.onboarding_state` etc.) until migration is pushed and db-guardian has signed off