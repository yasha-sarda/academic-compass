
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS reasoning text,
  ADD COLUMN IF NOT EXISTS confidence numeric,
  ADD COLUMN IF NOT EXISTS deliverables text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS skills_required text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS source_text text,
  ADD COLUMN IF NOT EXISTS progress numeric NOT NULL DEFAULT 0;

ALTER TABLE public.roadmaps
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS estimated_time text,
  ADD COLUMN IF NOT EXISTS order_index int NOT NULL DEFAULT 0;

CREATE POLICY "Users read own assignment files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'assignments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own assignment files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'assignments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own assignment files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'assignments' AND auth.uid()::text = (storage.foldername(name))[1]);
