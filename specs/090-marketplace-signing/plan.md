# 090 Marketplace + Signing — Technical Plan

## Architecture changes
- Add a main-process `MarketplaceService` that handles catalog discovery, package download, and installation orchestration.
- Add a main-process `ExtensionSignatureService` that verifies publisher signatures and certificate chains before install.
- Add a main-process `ExtensionScanService` that performs static package safety checks before activation.
- Add an install pipeline with staging directory, atomic move into extensions dir, and rollback on failure.
- Persist install receipts (package hash, publisher, signature fingerprint, install timestamp) for audit and rollback.

## Contracts (api-contracts)
- Add marketplace schemas for search/list/detail responses and install requests.
- Add signing schemas for signature envelope, publisher metadata, and verification result.
- Add scan-result schemas (severity, finding code, message, file path).
- Add IPC request/response schemas for:
  - marketplace list/search/details
  - install/uninstall/update
  - verify/signing status
  - scan results retrieval
- Export all schemas/types via `packages/api-contracts/src/index.ts`.

## IPC + process boundaries
- Renderer uses `window.api.extensions` marketplace methods only.
- Preload remains the sole bridge to IPC and exposes typed contracts-first methods.
- Main process performs network access, signature verification, scanning, filesystem writes, and policy gating.
- Extension host does not download, verify, or install packages.

## Testing strategy
- Unit tests:
  - signature verification edge cases (invalid signature, expired cert, unknown publisher).
  - scan pipeline behavior (block/high-risk findings, warn-only findings).
  - install transaction rollback behavior.
- Integration tests:
  - install from mock registry -> verify signature -> scan -> activate.
  - failed verification and failed scan paths.
  - update and uninstall lifecycle.
- E2E tests:
  - browse/search marketplace
  - install signed extension
  - block unsigned/invalid extension with clear user message

## Risks + mitigations
- Risk: false negatives in scanning. Mitigation: conservative defaults, deny high-severity findings by policy.
- Risk: registry tampering/man-in-the-middle. Mitigation: signed metadata and package signature verification in main.
- Risk: partial installs leaving broken state. Mitigation: staged install + atomic promote + rollback receipts.
- Risk: trust store drift between environments. Mitigation: explicit trust store versioning and diagnostics surface.
