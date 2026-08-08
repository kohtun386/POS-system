# Onboarding Edge Functions

| Function | Purpose |
|----------|---------|
| `staff-create` | Platform admin creates staff user (service_role + provision_user) |
| `staff-invite` | Admin sends staff invitation (token, role, expiry) |
| `staff-accept-invitation` | Invited user accepts token → provision_user reads role from invitation |
| `send-notification` | Email/SMS delivery for approval/rejection/invite notifications |
