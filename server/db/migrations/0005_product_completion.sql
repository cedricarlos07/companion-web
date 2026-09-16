-- Companion — Phase Product Completion
-- Licenses, entitlements, invitations, password resets, sessions, invoices, plan limits

-- Licenses self-hosted signées Ed25519
CREATE TABLE IF NOT EXISTS licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  license_key_hash text UNIQUE,
  plan text NOT NULL DEFAULT 'pilot',
  status text NOT NULL DEFAULT 'trial',
  entitlements jsonb NOT NULL DEFAULT '{}',
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  grace_until timestamptz,
  signature text,
  last_validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Invitations
CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  email text NOT NULL,
  role text NOT NULL DEFAULT 'employee',
  department_id uuid REFERENCES departments(id),
  token_hash text NOT NULL UNIQUE,
  invited_by uuid REFERENCES users(id),
  invited_by_name text,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Password resets
CREATE TABLE IF NOT EXISTS password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Email verification
CREATE TABLE IF NOT EXISTS email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  token_hash text NOT NULL UNIQUE,
  verified_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Sessions actives (pour gestion des sessions par l'utilisateur)
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  session_token_hash text NOT NULL UNIQUE,
  device text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON user_sessions (user_id);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  number text NOT NULL UNIQUE,
  amount real NOT NULL,
  currency text NOT NULL DEFAULT 'XOF',
  status text NOT NULL DEFAULT 'draft',
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Plan limits (entitlements configurables par organisation)
CREATE TABLE IF NOT EXISTS org_entitlements (
  organization_id uuid NOT NULL REFERENCES organizations(id),
  plan text NOT NULL DEFAULT 'pilot',
  limits jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id)
);

-- Account lockout
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash_updated_at timestamptz;

-- Departure tracking
ALTER TABLE employees ADD COLUMN IF NOT EXISTS archived_at timestamptz;
