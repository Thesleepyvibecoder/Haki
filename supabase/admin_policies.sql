-- Run this once in Supabase SQL Editor.
-- It lets authenticated Haki admin users read/create/update business rows.
-- Public visitors still only see active profiles through the existing policy.

create policy "Authenticated admins can view businesses"
on public.businesses
for select
to authenticated
using (true);

create policy "Authenticated admins can create businesses"
on public.businesses
for insert
to authenticated
with check (true);

create policy "Authenticated admins can update businesses"
on public.businesses
for update
to authenticated
using (true)
with check (true);
