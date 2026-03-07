-- Run this in Supabase SQL Editor
-- Adds notes and link columns to shared_items

ALTER TABLE shared_items ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE shared_items ADD COLUMN IF NOT EXISTS link TEXT DEFAULT '';
