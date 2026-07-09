-- Run this in the Supabase SQL editor.
--
-- Admin verification console: supplier accounts get a tri-state approval
-- (approved / suspended / rejected, plus the initial pending) instead of the
-- boolean-only is_approved. is_approved stays in sync so is_active_supplier()
-- and every existing RLS policy keep working: only 'approved' suppliers can
-- create catalog entities.

alter table profiles add column if not exists approval_status text not null default 'pending';

update profiles
   set approval_status = case when is_approved then 'approved' else 'pending' end
 where role = 'supplier'
   and approval_status = 'pending';

create or replace function public.admin_set_supplier_status(p_user uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'admin only';
  end if;
  if p_status not in ('approved', 'suspended', 'rejected', 'pending') then
    raise exception 'invalid status %', p_status;
  end if;
  update profiles
     set approval_status = p_status,
         is_approved = (p_status = 'approved')
   where id = p_user;
end;
$$;
grant execute on function public.admin_set_supplier_status(uuid, text) to authenticated;
