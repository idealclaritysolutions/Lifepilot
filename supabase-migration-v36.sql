-- v36 Migration: Ensure both clerk_user_id and user_id columns work
-- Run this in Supabase SQL Editor

-- Make clerk_user_id nullable (it was NOT NULL before)
ALTER TABLE households ALTER COLUMN owner_clerk_id DROP NOT NULL;
ALTER TABLE household_members ALTER COLUMN clerk_user_id DROP NOT NULL;

-- Ensure user_id unique index exists
CREATE UNIQUE INDEX IF NOT EXISTS user_data_user_id_unique ON user_data(user_id);

-- Ensure household_members has proper unique constraint
DROP INDEX IF EXISTS household_members_hh_user_unique;
CREATE UNIQUE INDEX IF NOT EXISTS household_members_hh_user_unique ON household_members(household_id, user_id);

-- Verify RLS policies
DROP POLICY IF EXISTS "Allow all user_data" ON user_data;
CREATE POLICY "Allow all user_data" ON user_data FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all households" ON households;
CREATE POLICY "Allow all households" ON households FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all household_members" ON household_members;
CREATE POLICY "Allow all household_members" ON household_members FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all shared_items" ON shared_items;
CREATE POLICY "Allow all shared_items" ON shared_items FOR ALL USING (true) WITH CHECK (true);
