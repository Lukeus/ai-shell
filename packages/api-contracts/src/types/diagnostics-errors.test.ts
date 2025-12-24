import { describe, it, expect } from 'vitest';
import {
  ErrorReportSchema,
  DiagFatalEventSchema,
  DiagSetSafeModeRequestSchema,
  DiagSetSafeModeResponseSchema,
} from './diagnostics';

describe('Diagnostics error reporting contracts', () => {
  it('accepts a minimal error report', () => {
    const report = {
      source: 'renderer',
      message: 'Boom',
      timestamp: new Date().toISOString(),
    };
    expect(ErrorReportSchema.parse(report)).toEqual(report);
  });

  it('accepts fatal event payloads', () => {
    const report = {
      source: 'main',
      message: 'Fatal error',
      timestamp: new Date().toISOString(),
    };
    const parsed = DiagFatalEventSchema.parse({ report });
    expect(parsed).toEqual({ report });
  });

  it('accepts safe mode toggle payloads', () => {
    const request = { enabled: true };
    const response = { enabled: true };
    expect(DiagSetSafeModeRequestSchema.parse(request)).toEqual(request);
    expect(DiagSetSafeModeResponseSchema.parse(response)).toEqual(response);
  });
});
