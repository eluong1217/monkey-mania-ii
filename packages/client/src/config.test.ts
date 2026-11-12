import { describe, expect, it } from 'vitest';
import { LOGICAL_SIZE } from './config';

describe('client', () => {
  it('uses the shared logical size', () => {
    expect(LOGICAL_SIZE).toEqual({ width: 640, height: 360 });
  });
});
