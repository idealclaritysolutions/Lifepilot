-- Migration: Fix constraints for Supabase Auth (user_id columns)
-- Run this in Supabase SQL Editor

-- 1. Make user_id the primary lookup for user_data
-- Drop old unique constraint on clerk_user_id, add one on user_id
ALTER TABLE user_data DROP CONSTRAINT IF EXISTS user_data_clerk_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS user_data_user_id_unique ON user_data(user_id);

-- 2. Fix household_members unique constraint
ALTER TABLE household_members DROP CONSTRAINT IF EXISTS household_members_household_id_clerk_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS household_members_hh_user_unique ON household_members(household_id, user_id);

-- 3. Ensure RLS policies still allow access
DROP POLICY IF EXISTS "Allow all user_data" ON user_data;
CREATE POLICY "Allow all user_data" ON user_data FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all households" ON households;
CREATE POLICY "Allow all households" ON households FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all household_members" ON household_members;
CREATE POLICY "Allow all household_members" ON household_members FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all shared_items" ON shared_items;
CREATE POLICY "Allow all shared_items" ON shared_items FOR ALL USING (true) WITH CHECK (true);
