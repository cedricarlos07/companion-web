-- Companion — MCP Server : clients authentifiés par token (hashé, jamais en clair)

CREATE TABLE IF NOT EXISTS mcp_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  allowed_scopes jsonb NOT NULL DEFAULT '[]',
  allowed_tools jsonb NOT NULL DEFAULT '[]',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  expires_at timestamptz
);
CREATE INDEX IF NOT EXISTS mcp_clients_org_idx ON mcp_clients (organization_id);
