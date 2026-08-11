# Onboarding Edge Functions

| Function | Purpose |
|----------|---------|
| `staff-create` | Platform admin creates staff user (service_role + provision_user) |
| `staff-invite` | Admin sends staff invitation (token, role, expiry) |
| `staff-accept-invitation` | Invited user accepts token → provision_user reads role from invitation |
| `send-notification` | Email/SMS/WhatsApp/Discord delivery — approval/rejection/invite notifications + shop-configurable daily sales reports (channel selected in `app_settings`; WhatsApp via Twilio `whatsapp:` prefix, Discord via webhook URL) |
