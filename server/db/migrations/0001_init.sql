-- Companion — initial schema (PostgreSQL + pgvector)
-- Applied idempotently at server boot by server/db/migrate.ts

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  sector text,
  country text,
  instance_url text,
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS departments_org_name_uq ON departments (organization_id, name);

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  department_id uuid REFERENCES departments(id),
  title text NOT NULL,
  description text,
  coverage_target integer NOT NULL DEFAULT 90,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS roles_org_idx ON roles (organization_id);

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  role_id uuid REFERENCES roles(id),
  department_id uuid REFERENCES departments(id),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  start_date text,
  seniority_months integer NOT NULL DEFAULT 0,
  companion_access text NOT NULL DEFAULT 'full',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employees_org_idx ON employees (organization_id);
CREATE INDEX IF NOT EXISTS employees_status_idx ON employees (status);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name text NOT NULL,
  app_role text NOT NULL DEFAULT 'employee',
  employee_id uuid,
  active boolean NOT NULL DEFAULT true,
  last_active_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  kind text NOT NULL DEFAULT 'local',
  name text NOT NULL,
  status text NOT NULL DEFAULT 'connected',
  config jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  source_id uuid REFERENCES sources(id),
  uploaded_by_id uuid REFERENCES users(id),
  title text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL DEFAULT 0,
  raw_text text,
  storage_path text,
  status text NOT NULL DEFAULT 'queued',
  status_detail text,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documents_org_idx ON documents (organization_id);
CREATE INDEX IF NOT EXISTS documents_status_idx ON documents (status);

CREATE TABLE IF NOT EXISTS chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding vector(768),
  embedding_provider text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chunks_doc_idx ON chunks (document_id);

CREATE TABLE IF NOT EXISTS memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  type text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  scope text NOT NULL DEFAULT 'company',
  employee_id uuid REFERENCES employees(id),
  role_id uuid REFERENCES roles(id),
  department_id uuid REFERENCES departments(id),
  status text NOT NULL DEFAULT 'candidate',
  confidence integer NOT NULL DEFAULT 50,
  importance integer NOT NULL DEFAULT 50,
  valid_from text,
  valid_until text,
  contributor text,
  origin text NOT NULL DEFAULT 'human',
  human_validated boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  embedding vector(768),
  embedding_provider text,
  supersedes_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memories_org_idx ON memories (organization_id);
CREATE INDEX IF NOT EXISTS memories_type_idx ON memories (type);
CREATE INDEX IF NOT EXISTS memories_status_idx ON memories (status);
CREATE INDEX IF NOT EXISTS memories_employee_idx ON memories (employee_id);
CREATE INDEX IF NOT EXISTS memories_role_idx ON memories (role_id);

CREATE TABLE IF NOT EXISTS memory_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  document_id uuid REFERENCES documents(id),
  chunk_id uuid REFERENCES chunks(id) ON DELETE CASCADE,
  excerpt text,
  location text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memory_sources_memory_idx ON memory_sources (memory_id);

CREATE TABLE IF NOT EXISTS memory_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_memory_id uuid NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  to_memory_id uuid NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'related',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memory_links_from_idx ON memory_links (from_memory_id);

CREATE TABLE IF NOT EXISTS memory_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  version integer NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  status text NOT NULL,
  confidence integer NOT NULL,
  importance integer NOT NULL,
  changed_by text,
  change_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memory_versions_memory_idx ON memory_versions (memory_id);

CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid REFERENCES users(id),
  target_type text NOT NULL,
  target_id uuid,
  verdict text NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  employee_id uuid NOT NULL REFERENCES employees(id),
  role_id uuid REFERENCES roles(id),
  successor_employee_id uuid REFERENCES employees(id),
  status text NOT NULL DEFAULT 'analyzing',
  readiness integer NOT NULL DEFAULT 0,
  analysis jsonb NOT NULL DEFAULT '{}',
  human_pack jsonb,
  machine_pack text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS handovers_employee_idx ON handovers (employee_id);

CREATE TABLE IF NOT EXISTS handover_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id uuid NOT NULL REFERENCES handovers(id) ON DELETE CASCADE,
  kind text NOT NULL,
  question text NOT NULL,
  detail text,
  status text NOT NULL DEFAULT 'open',
  related_memory_id uuid REFERENCES memories(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS handover_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gap_id uuid NOT NULL REFERENCES handover_gaps(id) ON DELETE CASCADE,
  handover_id uuid NOT NULL REFERENCES handovers(id) ON DELETE CASCADE,
  answer_text text NOT NULL,
  answered_by text,
  produced_memory_id uuid REFERENCES memories(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS onboardings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  employee_id uuid NOT NULL REFERENCES employees(id),
  role_id uuid REFERENCES roles(id),
  handover_id uuid REFERENCES handovers(id),
  plan jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  actor_id uuid REFERENCES users(id),
  actor_name text,
  actor_kind text NOT NULL DEFAULT 'human',
  action text NOT NULL,
  target_type text,
  target_id text,
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_org_time_idx ON audit_events (organization_id, created_at);

CREATE TABLE IF NOT EXISTS interview_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id uuid NOT NULL REFERENCES handovers(id) ON DELETE CASCADE,
  gap_id uuid REFERENCES handover_gaps(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  answered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Recency score used by the hybrid retrieval ranking.
CREATE OR REPLACE FUNCTION freshness(updated_at timestamptz) RETURNS float AS $$
  DECLARE days float;
  BEGIN
    days := EXTRACT(EPOCH FROM (now() - updated_at)) / 86400.0;
    IF days <= 7 THEN RETURN 1.0;
    ELSIF days <= 90 THEN RETURN 0.8;
    ELSIF days <= 365 THEN RETURN 0.5;
    ELSE RETURN 0.2;
    END IF;
  END;
$$ LANGUAGE plpgsql IMMUTABLE;
