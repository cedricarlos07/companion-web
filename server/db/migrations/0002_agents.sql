-- Companion — Phase 2 : Agent Orchestrator
-- agents, runs, steps, tool calls, approvals, triggers, settings

CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  key text NOT NULL,
  name text NOT NULL,
  description text,
  goal text NOT NULL,
  status text NOT NULL DEFAULT 'idle',
  autonomy text NOT NULL DEFAULT 'copilot',
  memory_scopes jsonb NOT NULL DEFAULT '[]',
  allowed_skills jsonb NOT NULL DEFAULT '[]',
  allowed_tools jsonb NOT NULL DEFAULT '[]',
  model_provider text NOT NULL DEFAULT 'ollama',
  model text,
  max_run_tokens integer NOT NULL DEFAULT 20000,
  max_daily_tokens integer NOT NULL DEFAULT 200000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS agents_org_key_uq ON agents (organization_id, key);

CREATE TABLE IF NOT EXISTS agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  agent_id uuid NOT NULL REFERENCES agents(id),
  initiator_user_id uuid REFERENCES users(id),
  initiator_name text,
  trigger_id uuid,
  goal text NOT NULL,
  skill text,
  plan jsonb,
  status text NOT NULL DEFAULT 'queued',
  memories_used jsonb NOT NULL DEFAULT '[]',
  sources_used jsonb NOT NULL DEFAULT '[]',
  result jsonb,
  verifier jsonb,
  model text,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  estimated_cost real NOT NULL DEFAULT 0,
  latency_ms integer,
  errors jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_runs_agent_idx ON agent_runs (agent_id, created_at);
CREATE INDEX IF NOT EXISTS agent_runs_org_idx ON agent_runs (organization_id);

CREATE TABLE IF NOT EXISTS agent_run_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  step_index integer NOT NULL,
  description text NOT NULL,
  skill text,
  tools jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'pending',
  output jsonb,
  started_at timestamptz,
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS agent_run_steps_run_idx ON agent_run_steps (run_id, step_index);

CREATE TABLE IF NOT EXISTS tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES agent_runs(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES agents(id),
  tool text NOT NULL,
  input jsonb NOT NULL DEFAULT '{}',
  output_summary jsonb,
  status text NOT NULL DEFAULT 'ok',
  policy_decision text NOT NULL DEFAULT 'allowed',
  policy_reason text,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tool_calls_run_idx ON tool_calls (run_id);

CREATE TABLE IF NOT EXISTS approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  run_id uuid REFERENCES agent_runs(id),
  agent_id uuid REFERENCES agents(id),
  agent_name text,
  action text NOT NULL,
  tool text NOT NULL,
  risk_level text NOT NULL DEFAULT 'medium',
  preview jsonb NOT NULL DEFAULT '{}',
  reason text,
  sources jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by text
);
CREATE INDEX IF NOT EXISTS approvals_org_status_idx ON approvals (organization_id, status);

CREATE TABLE IF NOT EXISTS triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  event_type text NOT NULL,
  conditions jsonb NOT NULL DEFAULT '{}',
  agent_key text NOT NULL,
  skill text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  rate_limit_per_hour integer NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS triggers_org_event_idx ON triggers (organization_id, event_type);

CREATE TABLE IF NOT EXISTS agent_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  run_id uuid REFERENCES agent_runs(id),
  user_id uuid REFERENCES users(id),
  user_name text,
  verdict text NOT NULL,
  comment text,
  correction_memory_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  organization_id uuid NOT NULL REFERENCES organizations(id),
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, key)
);
