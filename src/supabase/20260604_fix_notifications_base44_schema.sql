-- Fix Notifications schema to match Base44 requirements
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT,
  restaurant_id TEXT,
  branch TEXT,
  type TEXT DEFAULT 'info',
  title TEXT,
  message TEXT,
  amount NUMERIC,
  actor_email TEXT,
  actor_name TEXT,
  target_role TEXT DEFAULT 'all',
  is_read BOOLEAN DEFAULT FALSE,
  severity TEXT DEFAULT 'info',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Robust RLS Policies
DROP POLICY IF EXISTS "notifications: owner all" ON public.notifications;
CREATE POLICY "notifications: owner all" ON public.notifications
  FOR ALL
  USING (
    created_by = (auth.jwt() ->> 'email')
    OR restaurant_id IN (SELECT id::text FROM public.restaurants WHERE created_by = (auth.jwt() ->> 'email'))
  )
  WITH CHECK (
    created_by = (auth.jwt() ->> 'email')
    OR auth.uid() IS NOT NULL
  );

-- Updated Date Trigger
DROP TRIGGER IF EXISTS trg_notifications_updated_date ON public.notifications;
CREATE TRIGGER trg_notifications_updated_date
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_date();
