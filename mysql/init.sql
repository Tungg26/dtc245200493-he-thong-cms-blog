SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

CREATE DATABASE IF NOT EXISTS blog_cms_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE blog_cms_db;

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    role ENUM('admin', 'editor', 'author') DEFAULT 'author',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Categories
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Posts
CREATE TABLE IF NOT EXISTS posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    status ENUM('published', 'draft') DEFAULT 'published',
    category_id INT,
    author_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Du lieu mau
INSERT INTO users (username, email, full_name, role) VALUES
 ('tungtv', 'dtc245200493@ictu.edu.vn', 'Trương Văn Tùng', 'admin'),
 ('editor01', 'editor01@ictu.edu.vn', 'Nguyễn Văn Biên', 'editor'),
 ('author01', 'author01@ictu.edu.vn', 'Lê Thị Tác', 'author');

INSERT INTO categories (name, slug, description) VALUES
 ('Công nghệ', 'cong-nghe', 'Tin tức công nghệ mới nhất'),
 ('DevOps', 'devops', 'Docker, CI/CD, giám sát hệ thống'),
 ('Học tập', 'hoc-tap', 'Chia sẻ tài liệu và kinh nghiệm học tập'),
 ('Đời sống', 'doi-song', 'Đời sống sinh viên'),
 ('Lập trình Web', 'lap-trinh-web', 'Node.js, Express, frontend');

INSERT INTO posts (title, slug, content, status, category_id, author_id) VALUES
 ('Docker Compose cho người mới bắt đầu', 'docker-compose-cho-nguoi-moi-bat-dau',
  'Docker Compose cho phép định nghĩa và chạy nhiều container chỉ với một tệp YAML và một câu lệnh duy nhất.', 'published', 2, 1),
 ('Giám sát hệ thống với Prometheus và Grafana', 'giam-sat-he-thong-voi-prometheus-va-grafana',
  'Prometheus thu thập số liệu theo mô hình pull, Grafana trực quan hóa chúng thành các dashboard.', 'published', 2, 1),
 ('Xây dựng REST API với Express', 'xay-dung-rest-api-voi-express',
  'Express là framework tối giản cho Node.js, phù hợp xây dựng web và API nhanh chóng.', 'published', 5, 2),
 ('Kinh nghiệm học môn Triển khai và Quản trị', 'kinh-nghiem-hoc-mon-trien-khai-va-quan-tri',
  'Thực hành nhiều, đọc log kỹ và hiểu rõ luồng mạng giữa các container là chìa khóa.', 'draft', 3, 3);

-- Phan quyen toi thieu cho ung dung
CREATE USER IF NOT EXISTS 'blog_user'@'%' IDENTIFIED BY 'BlogUser@2026';
GRANT SELECT, INSERT, UPDATE, DELETE ON blog_cms_db.* TO 'blog_user'@'%';

-- Tai khoan chi doc cho mysqld-exporter
CREATE USER IF NOT EXISTS 'exporter'@'%' IDENTIFIED BY 'Exporter@2026' WITH MAX_USER_CONNECTIONS 3;
GRANT PROCESS, REPLICATION CLIENT, SELECT ON *.* TO 'exporter'@'%';
FLUSH PRIVILEGES;
