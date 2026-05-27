import { describe, it, expect } from 'vitest';
import { type IngestError, isRetriable } from './types/errors.js';

describe('IngestError retriable flags', () => {
  it('auth_failure is not retriable', () => {
    const err: IngestError = { kind: 'auth_failure', retriable: false, message: 'Unauthorized' };
    expect(isRetriable(err)).toBe(false);
  });

  it('rate_limited is retriable', () => {
    const err: IngestError = { kind: 'rate_limited', retriable: true, retryAfter: 30 };
    expect(isRetriable(err)).toBe(true);
  });

  it('provider_error is retriable', () => {
    const err: IngestError = { kind: 'provider_error', retriable: true, message: 'Service unavailable' };
    expect(isRetriable(err)).toBe(true);
  });

  it('schema_violation is not retriable', () => {
    const err: IngestError = { kind: 'schema_violation', retriable: false, field: 'id', message: 'Missing required field' };
    expect(isRetriable(err)).toBe(false);
  });

  it('partial_result is retriable', () => {
    const err: IngestError = { kind: 'partial_result', retriable: true, message: 'Incomplete page' };
    expect(isRetriable(err)).toBe(true);
  });

  it('timeout is retriable', () => {
    const err: IngestError = { kind: 'timeout', retriable: true };
    expect(isRetriable(err)).toBe(true);
  });
});
