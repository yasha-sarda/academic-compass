ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS course text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS college text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Assignment lifecycle: ensure 'completed_at' timestamp for completed state
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS completed_at timestamptz;