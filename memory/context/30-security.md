# Security
- renderer is isolated (no Node APIs)
- minimal contextBridge surface
- extensions untrusted by default; explicit permissions + consent
- audit all sensitive actions (secrets access, network calls, installs)
- never log secrets; never store plaintext secrets
