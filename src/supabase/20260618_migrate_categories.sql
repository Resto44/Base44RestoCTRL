-- ============================================================
-- Enterprise Category System: Data Migration
-- 2026-06-18
-- ============================================================
-- 1. Migrate old product_categories rows (if any have name_en but no name)
-- 2. Migrate old menu_categories rows to online_order_categories
-- 3. Migrate old categories table rows to product_categories (product-type)
-- 4. Ensure expense_categories has name column (already migrated in schema)
-- 5. Ensure purchase_categories has name column (already migrated in schema)
-- ============================================================

-- Step 1: Fix product_categories rows that use name_en instead of name
UPDATE product_categories
SET name = COALESCE(name_en, name_ar, name_fa, 'Unnamed')
WHERE (name IS NULL OR name = '') AND (name_en IS NOT NULL OR name_ar IS NOT NULL);

-- Step 2: Migrate menu_categories to online_order_categories
-- (only if online_order_categories is empty to avoid duplicates)
INSERT INTO online_order_categories (
  id, restaurant_id, name, name_ar, name_fa, color, icon, image_url,
  sort_order, is_active, created_at
)
SELECT
  id,
  restaurant_id,
  COALESCE(name_en, name_ar, name_fa, name, 'Unnamed') AS name,
  name_ar,
  name_fa,
  color,
  icon,
  image_url,
  COALESCE(sort_order, 0),
  COALESCE(is_active, true),
  COALESCE(created_at, NOW())
FROM menu_categories
WHERE NOT EXISTS (
  SELECT 1 FROM online_order_categories WHERE online_order_categories.id = menu_categories.id
)
ON CONFLICT (id) DO NOTHING;

-- Step 3: Migrate old mixed categories table to product_categories
-- (only migrate rows that look like product categories)
INSERT INTO product_categories (
  restaurant_id, name, name_ar, name_fa, color, icon, image_url,
  sort_order, is_active, created_at
)
SELECT
  restaurant_id,
  COALESCE(name_en, name_ar, name_fa, name, 'Unnamed') AS name,
  name_ar,
  name_fa,
  color,
  icon,
  NULL AS image_url,
  COALESCE(sort_order, 0),
  COALESCE(is_active, true),
  COALESCE(created_at, NOW())
FROM categories
WHERE type IN ('product', 'inventory', 'menu', NULL)
  OR type IS NULL
ON CONFLICT DO NOTHING;

-- Step 4: Ensure expense_categories has name column populated
UPDATE expense_categories
SET name = COALESCE(name_en, name_ar, name_fa, 'Unnamed')
WHERE (name IS NULL OR name = '') AND (name_en IS NOT NULL OR name_ar IS NOT NULL);

-- Step 5: Ensure purchase_categories has name column populated
UPDATE purchase_categories
SET name = COALESCE(name_en, name_ar, name_fa, 'Unnamed')
WHERE (name IS NULL OR name = '') AND (name_en IS NOT NULL OR name_ar IS NOT NULL);

-- Step 6: Add sort_order defaults where missing
UPDATE product_categories SET sort_order = 0 WHERE sort_order IS NULL;
UPDATE expense_categories SET sort_order = 0 WHERE sort_order IS NULL;
UPDATE purchase_categories SET sort_order = 0 WHERE sort_order IS NULL;
UPDATE sales_categories SET sort_order = 0 WHERE sort_order IS NULL;
UPDATE online_order_categories SET sort_order = 0 WHERE sort_order IS NULL;

-- Step 7: Verify counts
SELECT 'product_categories' AS table_name, COUNT(*) AS row_count FROM product_categories
UNION ALL
SELECT 'expense_categories', COUNT(*) FROM expense_categories
UNION ALL
SELECT 'purchase_categories', COUNT(*) FROM purchase_categories
UNION ALL
SELECT 'sales_categories', COUNT(*) FROM sales_categories
UNION ALL
SELECT 'online_order_categories', COUNT(*) FROM online_order_categories
UNION ALL
SELECT 'categories (old)', COUNT(*) FROM categories
UNION ALL
SELECT 'menu_categories (old)', COUNT(*) FROM menu_categories;
