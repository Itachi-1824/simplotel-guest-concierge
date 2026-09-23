import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestLimits } from '../src/lib/request-limits.mjs';

test('request allowance is isolated by client and renews each minute', () => {
  let clock = 0;
  const limits = createRequestLimits({now:()=>clock,perMinute:2});
  assert.equal(limits.accept('a'),true);
  assert.equal(limits.accept('a'),true);
  assert.equal(limits.accept('a'),false);
  assert.equal(limits.accept('b'),true);
  clock = 60_000;
  assert.equal(limits.accept('a'),true);
});

test('provider allowance stops paid calls until the next UTC day', () => {
  let clock = 0;
  const limits = createRequestLimits({now:()=>clock,dailyModelCalls:1});
  assert.equal(limits.reserveModelCall(),true);
  assert.equal(limits.reserveModelCall(),false);
  clock = 86_400_000;
  assert.equal(limits.reserveModelCall(),true);
});
