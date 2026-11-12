import { describe, expect, it } from 'vitest';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './index';

describe('shared', () => {
  it('has a 640x360 logical size', () => {
    expect([LOGICAL_WIDTH, LOGICAL_HEIGHT]).toEqual([640, 360]);
  });
});
