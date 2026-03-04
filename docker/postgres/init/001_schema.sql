CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  gender VARCHAR(20),
  dob DATE,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_audit_logs (
  id SERIAL PRIMARY KEY,
  action VARCHAR(20) NOT NULL CHECK (action IN ('added', 'removed')),
  target_user_id INTEGER,
  target_username VARCHAR(50) NOT NULL,
  target_email VARCHAR(255),
  target_role VARCHAR(20),
  performed_by_user_id INTEGER,
  performed_by_username VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed a default admin account for first-time deployments.
-- Username: admin
-- Password: Admin@123
INSERT INTO users (
  first_name,
  last_name,
  email,
  username,
  password,
  role,
  gender
)
VALUES (
  'System',
  'Administrator',
  'admin@vitalwatch.local',
  'admin',
  '$2b$10$rH/69fXKbuqIlwgpG0XSYeyth87VKWK7uAq.VuWUUp3uMuqWRcwOK',
  'admin',
  'Other'
)
ON CONFLICT (username) DO NOTHING;

INSERT INTO user_audit_logs (
  action,
  target_user_id,
  target_username,
  target_email,
  target_role,
  performed_by_user_id,
  performed_by_username
)
SELECT
  'added',
  u.id,
  u.username,
  u.email,
  u.role,
  NULL,
  NULL
FROM users u
WHERE u.username = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM user_audit_logs l
    WHERE l.action = 'added'
      AND l.target_username = 'admin'
      AND l.performed_by_user_id IS NULL
  );
