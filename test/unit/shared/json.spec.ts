/// <reference types="jest" />
import { isJsonObject } from '@shared/domain/json';

describe('JSON at provider boundaries', () => {
  it('accepts nested JSON and optional object properties', () => {
    expect(
      isJsonObject({
        id: 'payment',
        values: [null, 1, true, { state: 'paid' }],
        absent: undefined,
      }),
    ).toBe(true);
  });

  it.each([
    null,
    [],
    'payment',
    { at: new Date() },
    { value: Infinity },
    { value: 1n },
    { value: () => 1 },
    { values: [undefined] },
  ])('rejects values that cannot be persisted as a JSON object: %p', (value) =>
    expect(isJsonObject(value)).toBe(false),
  );
});
