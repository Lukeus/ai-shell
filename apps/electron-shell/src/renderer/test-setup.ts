import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * Test setup for electron-shell renderer tests.
 * Imports jest-dom matchers for Vitest.
 */

// Automatically cleanup after each test
afterEach(() => {
  cleanup();
});
