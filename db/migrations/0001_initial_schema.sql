-- SubterraDB control plane — initial schema
-- Run inside the `subterradb_system` database.
--
-- Tables follow the PRD section 6.6 with a few practical additions:
--   - password_hash instead of password (clearer name for the bcrypt hash)
--   - status column on platform_users to model pending invites
--   - kong_*_ids columns on projects so we can clean up Kong entities on delete
--   - audit_log for future activity tracking (writes come in Phase 1)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Platform users — independent from any per-project Supabase Auth.
CREATE TABLE platform_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('admin', 'developer')),
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'pending', 'disabled')),
  last_active_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_platform_users_email ON platform_users (lower(email));
CREATE INDEX idx_platform_users_role ON platform_users (role);

-- Projects registered with the control plane.
-- Each row also tracks the Kong entity IDs so deletes can clean up cleanly.
CREATE TABLE projects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  slug              TEXT UNIQUE NOT NULL,
  status            TEXT NOT NULL DEFAULT 'provisioning'
                      CHECK (status IN ('provisioning', 'running', 'stopped', 'error')),
  jwt_secret        TEXT NOT NULL,
  anon_key          TEXT NOT NULL,
  service_key       TEXT NOT NULL,
  db_password       TEXT NOT NULL,
  -- Kong entity tracking
  kong_consumer_id  TEXT,
  kong_service_ids  JSONB NOT NULL DEFAULT '{}'::jsonb,
  kong_route_ids    JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Ownership + activity
  owner_id          UUID NOT NULL REFERENCES platform_users (id) ON DELETE RESTRICT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_slug ON projects (slug);
CREATE INDEX idx_projects_status ON projects (status);
CREATE INDEX idx_projects_owner ON projects (owner_id);

-- Project ↔ developer assignments. Admins access all projects implicitly.
CREATE TABLE project_members (
  project_id  UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES platform_users (id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX idx_project_members_user ON project_members (user_id);

-- Active sessions for the GUI. We store a sha256 of the JWT so revoking a
-- session is a single DB delete instead of inspecting the JWT contents.
CREATE TABLE platform_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES platform_users (id) ON DELETE CASCADE,
  token_hash  TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  user_agent  TEXT,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_user ON platform_sessions (user_id);
CREATE INDEX idx_sessions_token_hash ON platform_sessions (token_hash);
CREATE INDEX idx_sessions_expires ON platform_sessions (expires_at);

-- Audit log — write-only for now; queryable views land in Phase 1.
CREATE TABLE audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES platform_users (id) ON DELETE SET NULL,
  action       TEXT NOT NULL,
  target_type  TEXT,
  target_id    UUID,
  metadata     JSONB,
  ip_address   INET,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_user ON audit_log (user_id);
CREATE INDEX idx_audit_log_action ON audit_log (action);
CREATE INDEX idx_audit_log_created ON audit_log (created_at DESC);

-- updated_at maintenance trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER platform_users_updated_at
  BEFORE UPDATE ON platform_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
