-- Conversations table
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null default 'New Conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table conversations enable row level security;

create policy "Users can read own conversations"
  on conversations for select
  using (auth.uid()::text = user_id);

create policy "Users can insert own conversations"
  on conversations for insert
  with check (auth.uid()::text = user_id);

create policy "Users can update own conversations"
  on conversations for update
  using (auth.uid()::text = user_id);

create index if not exists conversations_user_id_idx on conversations(user_id);

-- Add conversation_id column to commands table
alter table commands add column if not exists conversation_id uuid references conversations(id);

-- User subscriptions table
create table if not exists user_subscriptions (
  user_id text primary key,
  trial_started_at timestamptz not null default now(),
  is_premium boolean not null default false,
  stripe_customer_id text,
  stripe_subscription_id text,
  post_trial_prompt_count integer not null default 0
);

alter table user_subscriptions enable row level security;

create policy "Users can read own subscription status"
  on user_subscriptions for select
  using (auth.uid()::text = user_id);

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
