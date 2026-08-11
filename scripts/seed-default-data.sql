-- Insert default personnel data
INSERT INTO personnel (
  id, name, position, level, team, email, phone, work_address, address, 
  date_of_birth, hometown, current_address, responsibilities, experience, education, skills
) VALUES 
-- TRƯỞNG PHÒNG
(1, 'BÙI ĐÌNH VƯƠNG', 'Trưởng phòng', 'head', 'Phòng Quản lý Dự án', 
 'bui.dinh.vuong@company.com', '0123-456-789', 'Hà Nội, Việt Nam', 'Hà Nội, Việt Nam',
 '01/01/1980', 'Hà Nội', 'Hà Nội, Việt Nam',
 ARRAY['**Quản lý và điều hành** toàn bộ hoạt động của phòng', 'Phê duyệt các quyết định quan trọng', 'Báo cáo với ban lãnh đạo công ty', '• Phân công nhiệm vụ cho các phó phòng', '• Giám sát tiến độ các dự án'],
 '15 năm kinh nghiệm trong lĩnh vực quản lý dự án', 'Thạc sĩ Quản trị Kinh doanh',
 ARRAY['Quản lý dự án', 'Lãnh đạo', 'Chiến lược', 'Đàm phán']),

-- PHÓ PHÒNG
(2, 'TRIỆU QUY', 'Phó Phòng', 'deputy', 'Phòng Quản lý Dự án',
 'trieu.quy@company.com', '0123-456-790', 'Hà Nội, Việt Nam', 'Hà Nội, Việt Nam',
 '02/02/1982', 'Hải Phòng', 'Hà Nội, Việt Nam',
 ARRAY['Hỗ trợ trưởng phòng trong công tác quản lý', 'Giám sát các nhóm dự án', 'Đánh giá hiệu suất nhân viên', 'Tham gia họp ban lãnh đạo', 'Xử lý các vấn đề phát sinh'],
 '12 năm kinh nghiệm quản lý dự án', 'Cử nhân Kỹ thuật',
 ARRAY['Quản lý nhóm', 'Phân tích', 'Giải quyết vấn đề', 'Giao tiếp']),

(3, 'NGUYỄN VĂN CỬ', 'Phó Phòng', 'deputy', 'Phòng Quản lý Dự án',
 'nguyen.van.cu@company.com', '0123-456-791', 'Hà Nội, Việt Nam', 'Hà Nội, Việt Nam',
 '03/03/1985', 'Nam Định', 'Hà Nội, Việt Nam',
 ARRAY['Quản lý nhân sự', 'Lập kế hoạch dự án', 'Điều phối các bộ phận', 'Báo cáo tiến độ'],
 '11 năm kinh nghiệm', 'Cử nhân Quản trị',
 ARRAY['Quản lý nhân sự', 'Lập kế hoạch', 'Điều phối']),

(4, 'LÊ KIM LONG', 'Phó Phòng', 'deputy', 'Phòng Quản lý Dự án',
 'le.kim.long@company.com', '0123-456-792', 'Hà Nội, Việt Nam', 'Hà Nội, Việt Nam',
 '04/04/1988', 'Thái Bình', 'Hà Nội, Việt Nam',
 ARRAY['Hỗ trợ trưởng phòng trong công tác quản lý', 'Quản lý tài chính dự án', 'Kiểm soát chất lượng', 'Đào tạo nhân viên mới'],
 '10 năm kinh nghiệm', 'Cử nhân Kinh tế',
 ARRAY['Quản lý tài chính', 'Kiểm soát chất lượng', 'Đào tạo']),

-- TỬ VẤN
(5, 'S. SCHÖNKNECHT', 'Tư vấn', 'advisor', 'Phòng Quản lý Dự án',
 's.schonknecht@company.com', '0123-456-793', 'Hà Nội, Việt Nam', 'Hà Nội, Việt Nam',
 '05/05/1975', 'Berlin', 'Hà Nội, Việt Nam',
 ARRAY['Tư vấn kỹ thuật', 'Đánh giá dự án', 'Hỗ trợ giải pháp', 'Đào tạo chuyên môn'],
 '20 năm kinh nghiệm quốc tế', 'Tiến sĩ Kỹ thuật',
 ARRAY['Tư vấn kỹ thuật', 'Đánh giá dự án', 'Giải pháp công nghệ'])

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
