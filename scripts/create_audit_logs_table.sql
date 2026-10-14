-- Tạo bảng lưu lịch sử sửa đổi (Audit Logs) cho web app
CREATE TABLE IF NOT EXISTS app_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  action_type VARCHAR(100) NOT NULL,
  actor_name VARCHAR(255) DEFAULT 'Quản trị viên',
  ip_address VARCHAR(100) DEFAULT '127.0.0.1',
  device_info VARCHAR(255),
  target_name VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index giúp truy vấn danh sách mới nhất cực nhanh
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON app_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON app_audit_logs(action_type);

-- Kích hoạt Row Level Security (RLS)
ALTER TABLE app_audit_logs ENABLE ROW LEVEL SECURITY;

-- Cấp quyền đọc/ghi công khai (hoặc qua anon key của web app)
CREATE POLICY "Public read app_audit_logs" ON app_audit_logs FOR SELECT USING (true);
CREATE POLICY "Public insert app_audit_logs" ON app_audit_logs FOR INSERT WITH CHECK (true);
