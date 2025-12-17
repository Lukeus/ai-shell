# Secrets & Connections
- Main-only SecretsService uses safeStorage for encrypt/decrypt.
- Store encrypted blobs + metadata in local store (SQLite later).
- Connections UI in Settings configures MCP/external APIs.
- Extensions contribute Connection Providers (schema-driven forms).
- First-use consent prompts; audit secret access.
No .env. No plaintext secrets.
