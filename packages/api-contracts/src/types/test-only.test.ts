import { describe, it, expect } from 'vitest';
import {
  TestForceCrashRendererRequestSchema,
  TestForceCrashRendererResponseSchema,
} from './test-only';

describe('Test-only contracts', () => {
  it('accepts renderer crash request', () => {
    const request = {};
    expect(TestForceCrashRendererRequestSchema.parse(request)).toEqual(request);
  });

  it('accepts renderer crash response', () => {
    const response = { triggered: true };
    expect(TestForceCrashRendererResponseSchema.parse(response)).toEqual(response);
  });
});
