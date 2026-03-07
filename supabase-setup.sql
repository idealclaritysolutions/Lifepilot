-- LifePilot Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- 1. User data storage (cross-device sync)
CREATE TABLE IF NOT EXISTS user_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id TEXT UNIQUE NOT NULL,
  app_state JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Households (family sharing)
CREATE TABLE IF NOT EXISTS households (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  share_code TEXT UNIQUE NOT NULL,
  owner_clerk_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Household members
CREATE TABLE IF NOT EXISTS household_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, clerk_user_id)
);

-- 4. Shared items (family grocery list, shared tasks)
CREATE TABLE IF NOT EXISTS shared_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  category TEXT DEFAULT 'grocery',
  checked BOOLEAN DEFAULT FALSE,
  added_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_data_clerk ON user_data(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_household_share ON households(share_code);
CREATE INDEX IF NOT EXISTS idx_members_clerk ON household_members(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_members_household ON household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_shared_items_household ON shared_items(household_id);

-- Enable Row Level Security
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow all operations for anon key (auth handled by Clerk at app level)
-- In production, you'd validate Clerk JWTs server-side. For now, the anon key works.
CREATE POLICY "Allow all user_data" ON user_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all households" ON households FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all household_members" ON household_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all shared_items" ON shared_items FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for shared_items (family sharing live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE shared_items;
