-- v39 Migration: Activity log for shared lists + editable household names

CREATE TABLE IF NOT EXISTS shared_list_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  item_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_household ON shared_list_activity(household_id);

ALTER TABLE shared_list_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all shared_list_activity" ON shared_list_activity FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE shared_list_activity;
