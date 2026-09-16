/** Companion server configuration — env-overridable, sensible local defaults. */
export const config = {
  port: Number(process.env.PORT ?? 5299),
  /** Where the frontend dev server runs (CORS + auth cookie scope). */
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5199',
  jwtSecret: process.env.JWT_SECRET ?? 'companion-dev-secret-change-me',
  // 127.0.0.1 (pas « localhost ») : évite la course avec un relais Ollama WSL
  // qui peut occuper [::]:11434 avec un magasin de modèles différent.
  ollamaUrl: process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434',
  llmModel: process.env.LLM_MODEL ?? 'qwen2.5:7b',
  embedModel: process.env.EMBED_MODEL ?? 'nomic-embed-text',
  embedDim: Number(process.env.EMBED_DIM ?? 768),
  /** Below this hybrid score, Ask Companion abstains instead of answering. */
  askAbstainThreshold: Number(process.env.ASK_ABSTAIN_THRESHOLD ?? 0.28),
  uploadsDir: process.env.UPLOADS_DIR ?? './data/uploads',
} as const
