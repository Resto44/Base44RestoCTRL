-- Enable realtime change events for the canonical branch records used by
-- selectors, dashboards, and secure staff invitations.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'branches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.branches;
  END IF;
END
$$;
