-- ================================================================
-- SQL: Tạo bảng track_records cho module Track Record ROV
-- Chạy trong Supabase SQL Editor
-- ================================================================

CREATE TABLE IF NOT EXISTS track_records (
  id                      BIGSERIAL PRIMARY KEY,
  no                      INTEGER,
  client                  TEXT,
  contract                TEXT,
  project_task            TEXT,
  start_date              DATE,
  end_date                DATE,
  duration_days           INTEGER GENERATED ALWAYS AS (
                            CASE
                              WHEN start_date IS NOT NULL AND end_date IS NOT NULL
                              THEN (end_date - start_date + 1)
                              ELSE NULL
                            END
                          ) STORED,
  client_contact_person   TEXT,
  client_contact_phone    TEXT,
  project_sow             TEXT,
  location                TEXT,
  total_project_cost_usd  NUMERIC(18,2),
  water_depth_min_msw     NUMERIC(10,2),
  water_depth_max_msw     NUMERIC(10,2),
  rov_system              TEXT,
  vessel_rig              TEXT,
  class                   TEXT,
  notes                   TEXT,
  created_by              TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Index thường dùng để filter/search nhanh
CREATE INDEX IF NOT EXISTS idx_track_records_client     ON track_records(client);
CREATE INDEX IF NOT EXISTS idx_track_records_start_date ON track_records(start_date);
CREATE INDEX IF NOT EXISTS idx_track_records_location   ON track_records(location);
CREATE INDEX IF NOT EXISTS idx_track_records_rov_system ON track_records(rov_system);

-- Trigger tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_track_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_track_records_updated_at
  BEFORE UPDATE ON track_records
  FOR EACH ROW EXECUTE FUNCTION update_track_records_updated_at();

-- Cấp quyền đọc/ghi cho anon (app dùng anon key)
ALTER TABLE track_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read track_records"
  ON track_records FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert track_records"
  ON track_records FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update track_records"
  ON track_records FOR UPDATE TO anon USING (true);

CREATE POLICY "Anon can delete track_records"
  ON track_records FOR DELETE TO anon USING (true);
