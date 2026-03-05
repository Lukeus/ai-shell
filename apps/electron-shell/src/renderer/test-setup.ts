import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * Test setup for electron-shell renderer tests.
 * Imports jest-dom matchers for Vitest.
 */

// JSDOM does not implement scrollIntoView — provide a no-op stub.
if (typeof globalThis.HTMLElement !== 'undefined' && typeof HTMLElement.prototype.scrollIntoView !== 'function') {
  HTMLElement.prototype.scrollIntoView = () => {};
}

// Automatically cleanup after each test
afterEach(() => {
  cleanup();
});
