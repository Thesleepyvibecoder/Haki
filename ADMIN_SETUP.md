# Haki Admin Setup

1. In Supabase, create an admin user under Authentication > Users.
2. Run `supabase/admin_policies.sql` once in SQL Editor.
3. Run `START HAKI LOCAL.bat`.
4. Open `http://localhost:5173/admin`.
5. Sign in with the Supabase admin email/password.
6. Use **Add Business** to create customer profiles. The system generates the slug and analytics token automatically.

For now, Logo URL accepts a hosted image URL. We can add direct logo upload through Supabase Storage after the core admin workflow is confirmed.
