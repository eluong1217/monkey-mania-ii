import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('server', () => {
  it('creates an app', () => {
    const server = createApp('/nonexistent');
    expect(server.listening).toBe(false);
  });
});
