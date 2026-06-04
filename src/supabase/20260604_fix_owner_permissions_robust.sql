-- 1. Ensure helper functions exist
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.jwt() ->> 'email', auth.email(), '')
$$;

CREATE OR REPLACE FUNCTION public.current_restaurant_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id
  FROM public.restaurants r
  WHERE r.org_id = public.current_user_email() OR r.created_by = public.current_user_email()
  UNION
  SELECT p.restaurant_id
  FROM public.profiles p
  WHERE p.id = auth.uid() AND p.restaurant_id IS NOT NULL
$$;

-- 2. Ensure profile exists for the owner
INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'admin'
FROM auth.users
WHERE email = 'timrichards337@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- 3. Update Products RLS
DROP POLICY IF EXISTS "Products: owner manage all" ON public.products;
CREATE POLICY "Products: owner manage all" ON public.products
FOR ALL
TO authenticated
USING (restaurant_id IN (SELECT public.current_restaurant_ids()))
WITH CHECK (restaurant_id IN (SELECT public.current_restaurant_ids()));

-- 4. Update Daily Sales RLS
DROP POLICY IF EXISTS "Daily Sales: owner manage all" ON public.daily_sales;
CREATE POLICY "Daily Sales: owner manage all" ON public.daily_sales
FOR ALL
TO authenticated
USING (created_by = public.current_user_email() OR branch IN (SELECT name FROM public.branches WHERE restaurant_id IN (SELECT public.current_restaurant_ids())))
WITH CHECK (created_by = public.current_user_email() OR branch IN (SELECT name FROM public.branches WHERE restaurant_id IN (SELECT public.current_restaurant_ids())));

-- 5. Ensure created_by column exists and set default
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'created_by') THEN
    ALTER TABLE public.products ADD COLUMN created_by TEXT;
  END IF;
END $$;

ALTER TABLE public.daily_sales ALTER COLUMN created_by SET DEFAULT public.current_user_email();
ALTER TABLE public.products ALTER COLUMN created_by SET DEFAULT public.current_user_email();
