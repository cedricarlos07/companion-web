-- Companion — Phase production : registry explicite des tools Activepieces
-- + external IDs anti-réingestion + tracking des credentials

-- Registry explicite : chaque tool Activepieces doit être ENREGISTRÉ puis
-- ACTIVÉ manuellement avant d'être utilisable. Découverte ≠ autorisation.
CREATE TABLE IF NOT EXISTS ap_tool_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  ap_name text NOT NULL,
  namespaced_name text NOT NULL,
  app_name text NOT NULL,
  description text,
  risk_level text NOT NULL DEFAULT 'high',
  side_effect boolean NOT NULL DEFAULT true,
  requires_approval boolean NOT NULL DEFAULT true,
  allowed_autonomy jsonb NOT NULL DEFAULT '[]',
  enabled boolean NOT NULL DEFAULT false,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  enabled_at timestamptz,
  enabled_by text,
  UNIQUE (organization_id, ap_name)
);
CREATE INDEX IF NOT EXISTS ap_tool_registry_org_idx ON ap_tool_registry (organization_id, enabled);

-- External ID : évite de réingérer le même fichier/email/événement.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS external_provider text;
CREATE UNIQUE INDEX IF NOT EXISTS documents_ext_uq
  ON documents (organization_id, external_provider, external_id)
  WHERE external_id IS NOT NULL;

-- Chiffrement des credentials (clé dérivée de ENCRYPTION_KEY, jamais en clair).
CREATE TABLE IF NOT EXISTS credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  encrypted_value text NOT NULL,
  kind text NOT NULL DEFAULT 'api_key',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
