-- Enterprise Restaurant Ecosystem Schema Update

-- 1. Product Modifiers (Advanced Customization)
CREATE TABLE IF NOT EXISTS public.product_modifiers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id UUID REFERENCES public.restaurants(id),
    product_id UUID REFERENCES public.products(id),
    name_en TEXT NOT NULL,
    name_ar TEXT,
    name_fa TEXT,
    type TEXT DEFAULT 'single', -- 'single', 'multiple'
    min_selections INTEGER DEFAULT 0,
    max_selections INTEGER DEFAULT 1,
    is_required BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_modifier_options (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    modifier_id UUID REFERENCES public.product_modifiers(id) ON DELETE CASCADE,
    name_en TEXT NOT NULL,
    name_ar TEXT,
    name_fa TEXT,
    price_adjustment NUMERIC DEFAULT 0,
    is_default BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Update products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS calories INTEGER;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS preparation_time INTEGER;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ingredients_en TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ingredients_ar TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ingredients_fa TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS allergens_en TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS allergens_ar TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS allergens_fa TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_recommended BOOLEAN DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_best_seller BOOLEAN DEFAULT false;

-- 2. Customer Account System
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS loyalty_points INTEGER DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS loyalty_tier TEXT DEFAULT 'Bronze';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE TABLE IF NOT EXISTS public.customer_addresses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    label TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(customer_id, product_id)
);

-- 3. Orders & Checkout
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS service_fee NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS promo_discount NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS promo_code TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS loyalty_points_earned INTEGER DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS loyalty_points_used INTEGER DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estimated_delivery_time TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS actual_delivery_time TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address_id UUID REFERENCES public.customer_addresses(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.drivers(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS kitchen_status TEXT DEFAULT 'pending';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'unassigned';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Normal';

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS modifiers_json JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS special_notes TEXT;

-- 4. Promotion Engine
CREATE TABLE IF NOT EXISTS public.promotions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id UUID REFERENCES public.restaurants(id),
    code TEXT NOT NULL,
    type TEXT DEFAULT 'percentage',
    value NUMERIC DEFAULT 0,
    min_order_amount NUMERIC DEFAULT 0,
    max_discount NUMERIC,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    usage_limit INTEGER,
    times_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Driver & Kitchen Communication
CREATE TABLE IF NOT EXISTS public.driver_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE,
    request_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Recipe & Food Cost
CREATE TABLE IF NOT EXISTS public.recipes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id UUID REFERENCES public.restaurants(id),
    name TEXT NOT NULL,
    category TEXT,
    yield NUMERIC,
    portions NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE,
    inventory_id UUID REFERENCES public.inventory(id),
    quantity NUMERIC DEFAULT 0,
    unit TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.product_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_modifier_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
