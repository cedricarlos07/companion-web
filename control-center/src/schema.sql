-- Kamaloka Control Center — schéma éditeur (clients, licences, activations, factures).
-- Les données clients de COMPANION ne transitent JAMAIS ici : uniquement le commercial.

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_email text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES customers(id),
  plan text NOT NULL DEFAULT 'pilot',
  status text NOT NULL DEFAULT 'active',
  max_instances integer NOT NULL DEFAULT 1,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  entitlements jsonb NOT NULL DEFAULT '{}',
  signature text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS license_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id text NOT NULL REFERENCES licenses(license_id),
  instance_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  version text NOT NULL DEFAULT '',
  mode text NOT NULL DEFAULT 'active',
  counts jsonb NOT NULL DEFAULT '{}',
  first_activated_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz
);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES customers(id),
  label text NOT NULL DEFAULT '',
  amount_fcf bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'sent',
  issued_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  paid_at timestamptz
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id),
  amount_fcf bigint NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'virement',
  paid_at timestamptz NOT NULL DEFAULT now()
);
