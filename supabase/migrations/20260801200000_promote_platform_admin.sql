-- Promote kohtunhtun386@gmail.com to platform_admin
UPDATE public.users
SET role = 'platform_admin'
WHERE email = 'kohtunhtun386@gmail.com';

-- Fix VISION §4.3 violation: platform admins must have zero shop memberships
DELETE FROM public.shop_memberships
WHERE user_id IN (SELECT id FROM public.users WHERE role = 'platform_admin');
