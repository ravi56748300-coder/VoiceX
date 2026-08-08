CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  name text NOT NULL,
  phone_number text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Note: Since edge functions will use the service_role key to bypass RLS, 
-- or enforce logic within the function, we don't strictly need RLS policies 
-- unless the client accesses the DB directly. But for completeness:
CREATE POLICY "Users can manage their own contacts" ON contacts
  FOR ALL
  USING (auth.uid()::text = user_id);
