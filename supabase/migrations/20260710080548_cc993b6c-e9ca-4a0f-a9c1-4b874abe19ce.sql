
-- Extend assignments
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Chats (Compass conversations)
CREATE TABLE IF NOT EXISTS public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New chat',
  assignment_id uuid REFERENCES public.assignments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chats TO authenticated;
GRANT ALL ON public.chats TO service_role;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own chats" ON public.chats
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Chat messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own chat messages" ON public.chat_messages
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chats c WHERE c.id = chat_messages.chat_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.chats c WHERE c.id = chat_messages.chat_id AND c.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS chat_messages_chat_id_created_idx ON public.chat_messages (chat_id, created_at);
CREATE INDEX IF NOT EXISTS chats_user_updated_idx ON public.chats (user_id, updated_at DESC);
