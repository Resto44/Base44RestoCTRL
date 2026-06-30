-- 20260630_unify_categories.sql
-- Unify Purchase Categories into Product Categories

-- 1. Add new product_category_id column to purchases table
ALTER TABLE public.purchases
ADD COLUMN IF NOT EXISTS product_category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL;

-- 2. Migrate existing purchase_category_id data to product_category_id in purchases table
--    This assumes a mapping can be made based on category names. If a direct mapping isn't possible,
--    a new product category will be created for the purchase category.
DO $$
DECLARE
    purchase_cat_record RECORD;
    product_cat_id UUID;
BEGIN
    FOR purchase_cat_record IN SELECT id, name, restaurant_id FROM public.purchase_categories LOOP
        -- Try to find an existing product category with the same name and restaurant_id
        SELECT id INTO product_cat_id
        FROM public.product_categories
        WHERE name = purchase_cat_record.name AND restaurant_id = purchase_cat_record.restaurant_id
        LIMIT 1;

        IF product_cat_id IS NULL THEN
            -- If no matching product category, create a new one
            INSERT INTO public.product_categories (restaurant_id, name, created_at, updated_date)
            VALUES (purchase_cat_record.restaurant_id, purchase_cat_record.name, NOW(), NOW())
            RETURNING id INTO product_cat_id;
        END IF;

        -- Update purchases to link to the new/existing product_category_id
        UPDATE public.purchases
        SET product_category_id = product_cat_id
        WHERE purchase_category_id = purchase_cat_record.id;
    END LOOP;
END
$$;

-- 3. Remove the old purchase_category_id column from purchases table
ALTER TABLE public.purchases
DROP COLUMN IF EXISTS purchase_category_id;

-- 4. Drop the purchase_categories table
DROP TABLE IF EXISTS public.purchase_categories CASCADE;

-- 5. Remove any references to purchase_categories in other schema files if necessary
--    (This will be handled by modifying existing migration files or application code)
