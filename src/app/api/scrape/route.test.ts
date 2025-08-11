import { describe, it, expect } from '@jest/globals';

describe('placeholder', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
// E2E example (documentation only):
// curl -H "x-vercel-protection-bypass: SECRET" -H 'Content-Type: application/json' -X POST https://YOUR_APP/api/scrape --data '{"input":"jayhoovy","limit":1}'