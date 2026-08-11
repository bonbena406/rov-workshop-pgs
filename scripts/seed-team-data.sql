-- Insert team members data
INSERT INTO personnel (
  id, name, position, level, team, email, phone, work_address, address,
  date_of_birth, hometown, current_address, responsibilities, experience, education, skills
) VALUES 
-- TỔ ĐIỀU PHỐI DỰ ÁN
(6, 'NGUYỄN XUÂN HOÀNG', 'Tổ trưởng', 'team_leader', 'Tổ Điều phối dự án',
 'nguyen.xuan.hoang@company.com', '0123-456-800', 'Hà Nội, Việt Nam', 'Hà Nội, Việt Nam',
 '06/06/1986', 'Hà Nam', 'Hà Nội, Việt Nam',
 ARRAY['Quản lý và điều phối các dự án', 'Phân công nhiệm vụ cho thành viên tổ', 'Báo cáo tiến độ dự án', 'Phối hợp với các tổ khác'],
 '8 năm kinh nghiệm', 'Cử nhân Kỹ thuật',
 ARRAY['Quản lý dự án', 'Điều phối', 'Lập kế hoạch', 'Giao tiếp']),

(7, 'CAO TRẦN NAM', 'Tổ phó', 'deputy_leader', 'Tổ Điều phối dự án',
 'cao.tran.nam@company.com', '0123-456-801', 'Hà Nội, Việt Nam', 'Hà Nội, Việt Nam',
 '07/07/1989', 'Nghệ An', 'Hà Nội, Việt Nam',
 ARRAY['Hỗ trợ tổ trưởng trong công tác quản lý', 'Theo dõi tiến độ dự án', 'Phối hợp với các bộ phận', 'Báo cáo công việc'],
 '5 năm kinh nghiệm', 'Cử nhân',
 ARRAY['Hỗ trợ quản lý', 'Theo dõi tiến độ', 'Phối hợp']),

(8, 'TRỊNH THỊ NHẬT', 'Phụ trách công tác...', 'staff', 'Tổ Điều phối dự án',
 'trinh.thi.nhat@company.com', '0123-456-802', 'Hà Nội, Việt Nam', 'Hà Nội, Việt Nam',
 '08/08/1984', 'Hải Dương', 'Hà Nội, Việt Nam',
 ARRAY['Thực hiện các nhiệm vụ được giao', 'Hỗ trợ điều phối dự án', 'Lập báo cáo định kỳ', 'Phối hợp với các bộ phận'],
 '12 năm kinh nghiệm', 'Cử nhân',
 ARRAY['Điều phối', 'Báo cáo', 'Phối hợp'])

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  position = EXCLUDED.position,
  level = EXCLUDED.level,
  team = EXCLUDED.team,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  work_address = EXCLUDED.work_address,
  address = EXCLUDED.address,
  date_of_birth = EXCLUDED.date_of_birth,
  hometown = EXCLUDED.hometown,
  current_address = EXCLUDED.current_address,
  responsibilities = EXCLUDED.responsibilities,
  experience = EXCLUDED.experience,
  education = EXCLUDED.education,
  skills = EXCLUDED.skills,
  updated_at = NOW();
