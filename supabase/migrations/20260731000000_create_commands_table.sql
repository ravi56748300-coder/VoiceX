-- Migration to create commands table for VoiceX intent logging
CREATE TABLE IF NOT EXISTS public.commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    transcript TEXT NOT NULL,
    intent_tool TEXT,
    intent_params JSONB,
    status TEXT NOT NULL DEFAULT 'pending'
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.commands ENABLE ROW LEVEL SECURITY;

-- Create policy allowing service_role full access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'commands' AND policyname = 'Service role full access'
    ) THEN
        CREATE POLICY "Service role full access" ON public.commands
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;
