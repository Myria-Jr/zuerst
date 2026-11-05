CREATE TABLE public.kitchen_backups (
  user_id text PRIMARY KEY DEFAULT auth.user_id(),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND octet_length(payload::text) <= 1000000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.kitchen_backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_backup ON public.kitchen_backups TO authenticated
  USING (user_id = auth.user_id()) WITH CHECK (user_id = auth.user_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kitchen_backups TO authenticated;
