/** Erreurs MCP normalisées — mapping vers les codes JSON-RPC du protocole. */

export class McpToolError extends Error {
  constructor(
    message: string,
    public readonly code: 'DENIED' | 'RATE_LIMITED' | 'NOT_FOUND' | 'INVALID' | 'EXPIRED',
  ) {
    super(message)
  }
}
