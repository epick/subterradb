-- =============================================================================
-- 0001_initial_schema.sql — SubterraDB control-plane initial schema
-- =============================================================================
-- Applied automatically by the migration runner in src/server/migrations.ts
-- on first boot of the GUI container.
--
-- Idempotent: every CREATE uses IF NOT EXISTS where possible. Re-running on
-- an existing database is a no-op, which makes upgrades from pre-migration
-- installs safe (the schema may already be present from the legacy
-- /docker-entrypoint-initdb.d hook).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Platform users — independent from any per-project Supabase Auth.
CREATE TABLE IF NOT EXISTS platform_users (
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

CREATE INDEX IF NOT EXISTS idx_platform_users_email ON platform_users (lower(email));
CREATE INDEX IF NOT EXISTS idx_platform_users_role ON platform_users (role);

-- Projects registered with the control plane.
CREATE TABLE IF NOT EXISTS projects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  slug              TEXT UNIQUE NOT NULL,
  status            TEXT NOT NULL DEFAULT 'provisioning'
                      CHECK (status IN ('provisioning', 'running', 'stopped', 'error')),
  jwt_secret        TEXT NOT NULL,
  anon_key          TEXT NOT NULL,
  service_key       TEXT NOT NULL,
  db_password       TEXT NOT NULL,
  kong_consumer_id  TEXT,
  kong_service_ids  JSONB NOT NULL DEFAULT '{}'::jsonb,
  kong_route_ids    JSONB NOT NULL DEFAULT '{}'::jsonb,
  owner_id          UUID NOT NULL REFERENCES platform_users (id) ON DELETE RESTRICT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects (slug);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects (owner_id);

-- Project ↔ developer assignments. Admins access all projects implicitly.
CREATE TABLE IF NOT EXISTS project_members (
  project_id  UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES platform_users (id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members (user_id);

-- Active sessions for the GUI.
CREATE TABLE IF NOT EXISTS platform_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES platform_users (id) ON DELETE CASCADE,
  token_hash  TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  user_agent  TEXT,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON platform_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON platform_sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON platform_sessions (expires_at);

-- Audit log — write-only for now; queryable views are a future addition.
CREATE TABLE IF NOT EXISTS audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES platform_users (id) ON DELETE SET NULL,
  action       TEXT NOT NULL,
  target_type  TEXT,
  target_id    UUID,
  metadata     JSONB,
  ip_address   INET,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log (created_at DESC);

-- updated_at maintenance trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'platform_users_updated_at'
  ) THEN
    CREATE TRIGGER platform_users_updated_at
      BEFORE UPDATE ON platform_users
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'projects_updated_at'
  ) THEN
    CREATE TRIGGER projects_updated_at
      BEFORE UPDATE ON projects
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
