-- Create personnel table
CREATE TABLE IF NOT EXISTS personnel (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  position VARCHAR(255) NOT NULL,
  level VARCHAR(50) NOT NULL DEFAULT 'staff',
  team VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50) NOT NULL,
  work_address TEXT DEFAULT 'Hà Nội, Việt Nam',
  address TEXT DEFAULT 'Hà Nội, Việt Nam',
  date_of_birth VARCHAR(50),
  hometown VARCHAR(255),
  current_address TEXT,
  responsibilities TEXT[] DEFAULT '{}',
  experience TEXT DEFAULT '',
  education TEXT DEFAULT '',
  skills TEXT[] DEFAULT '{}',
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_personnel_updated_at 
    BEFORE UPDATE ON personnel 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for avatars (run this in Supabase dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('personnel-avatars', 'personnel-avatars', true);

-- Enable RLS (Row Level Security)
ALTER TABLE personnel ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust as needed)
CREATE POLICY "Enable read access for all users" ON personnel FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON personnel FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON personnel FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON personnel FOR DELETE USING (true);
