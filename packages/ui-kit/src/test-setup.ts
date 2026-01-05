/**
 * Vitest setup file for ui-kit package.
 * Configures testing environment with @testing-library/jest-dom matchers.
 */

import '@testing-library/jest-dom';

if (!globalThis.ResizeObserver) {
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  globalThis.ResizeObserver = ResizeObserver;
}
