# SULVENT v3 — Supabase foundation
SULVENT live version
Update SULVENT

This version continues from the three latest uploaded files (`index.html`, `styles.css`, `app.js`) and keeps the current visual direction.

## Included in v3
- Supabase JS v2 browser client (loaded as an ES module).
- Email/password sign-in and sign-up.
- First-time organization/workspace creation through a secure Postgres RPC.
- Organization membership and role-aware Row Level Security (RLS).
- Persistent event listing and event creation in Supabase.
- Demo mode remains available when Supabase credentials are not configured.
- User-provided event text is HTML-escaped before being rendered.

## Setup
1. Create a Supabase project.
2. Open **SQL Editor** and run all of `supabase-schema.sql`.
3. Open `config.js` and replace:
   - `supabaseUrl` with your Project URL.
   - `supabaseAnonKey` with your anon/publishable key.
4. Do not put a `service_role` key in frontend files.
5. Serve this folder through a local web server (ES modules do not work reliably from `file://`):
   - `python3 -m http.server 8000`
   - Open `http://localhost:8000`
6. Register an account, verify email if Supabase requires it, sign in, and create your first workspace.

## Current functional scope
- Authentication: functional through Supabase Auth.
- Organization: first workspace creation and owner membership.
- Events: persistent list/create scoped to the active organization.
- Calendar display, attendees, and team remain UI/demo placeholders.
- Tenant/venue, sponsor, finance, donation, marketing, and logistics tables are now included in the SQL migration with organization-level RLS. Their dashboard screens still use demo data until their create/list workflows are connected in the next build step.
- Tasks, QR ticketing/check-in, payments, invitations, billing, Super Admin console, audit log, and production deployment are not implemented yet.

## Important security notes
- Browser config uses only the Supabase anon/publishable key. RLS is the actual data boundary.
- Do not disable RLS to make the app work.
- Review policies before production. The current onboarding RPC allows one organization per user account for this MVP; multi-workspace switching/invitations will be a later step.
- The SQL grants member-management table privileges but RLS limits management to owners/admins; test with separate accounts before production.
- Use HTTPS for deployment and configure Supabase Auth redirect URLs to match your domain.

## Next implementation steps
1. Organization switcher, invitations, and complete role/permission matrix.
2. Persist calendar/task data and team records.
3. Tenant/booth, sponsor CRM, finance, donations, marketing, logistics schemas and screens.
4. Ticketing, QR generation, scanner/check-in, email notifications.
5. Automated tests, security review, backups, and deployment.
