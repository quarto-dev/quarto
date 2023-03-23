/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://jestjs.io/"}
 */

import { describe, it, expect } from '@jest/globals';

describe('myextension', () => {
  it('should be tested', () => {
    expect(1 + 1).toEqual(2);
  });
});
