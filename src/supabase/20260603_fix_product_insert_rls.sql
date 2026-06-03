-- Fix Product INSERT failure caused by legacy RLS policy querying auth.users.
-- Root error observed from live Supabase REST insert:
--   code: 42501
--   message: permission denied for table users
--   hint: Grant the required privileges to the current role with: GRANT SELECT ON auth.users TO anon;
--
-- Do not grant anon access to auth.users. Replace the policy so it reads the
-- authenticated user's email from the JWT claims available to RLS.

BEGIN;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Products: owner manage all" ON public.products;
DROP POLICY IF EXISTS "Products: staff view" ON public.products;

CREATE POLICY "Products: owner manage all" ON public.products
FOR ALL
USING (
  restaurant_id IN (
    SELECT r.id
    FROM public.restaurants AS r
    WHERE r.org_id = (auth.jwt() ->> 'email')
  )
)
WITH CHECK (
  restaurant_id IN (
    SELECT r.id
    FROM public.restaurants AS r
    WHERE r.org_id = (auth.jwt() ->> 'email')
  )
);

CREATE POLICY "Products: staff view" ON public.products
FOR SELECT
USING (
  restaurant_id IN (
    SELECT p.restaurant_id
    FROM public.profiles AS p
    WHERE p.id = auth.uid()
  )
);

COMMIT;
