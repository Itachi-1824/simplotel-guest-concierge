import test from 'node:test';
import assert from 'node:assert/strict';
import { answerQuestion, checkAvailability, isAvailabilityIntent, retrieve, validateStay } from '../src/lib/assistant.mjs';

const now = new Date('2026-10-01T12:00:00Z');
const config = { now, logger:{warn(){}} };

test('check-in question returns the sourced time', async () => {
  const result = await answerQuestion({question:'What time is check-in?'}, config);
  assert.equal(result.type,'answer'); assert.match(result.answer,/3:00 PM/); assert.ok(result.sources.some((source) => source.id === 'arrival'));
});

test('pool question retrieves the pool fact', async () => {
  const result = await answerQuestion({question:'Does the hotel have a swimming pool?'}, config);
  assert.equal(result.type,'answer'); assert.match(result.answer,/outdoor sea-view pool/);
});

test('room for three guests is grounded in capacity', async () => {
  const result = await answerQuestion({question:'Which room is suitable for three guests?'}, config);
  assert.equal(result.type,'answer'); assert.match(result.answer,/Terrace Suite/);
});

test('unknown amenity does not invent an answer', async () => {
  const result = await answerQuestion({question:'Do you have a helipad?'}, config);
  assert.equal(result.type,'fallback'); assert.equal(result.sources.length,0);
});

test('availability intent asks for missing details', async () => {
  const result = await answerQuestion({question:'Do you have rooms available?'}, config);
  assert.equal(result.type,'availability-needed'); assert.deepEqual(result.missing,['checkIn','checkOut','adults']);
});

test('availability rejects impossible date range', () => {
  const result = validateStay({checkIn:'2026-10-05',checkOut:'2026-10-04',adults:2},now);
  assert.equal(result.ok,false); assert.match(result.error,/1 and 30 nights/);
});

test('availability rejects past check-in and invalid guest count', () => {
  assert.match(validateStay({checkIn:'2026-09-20',checkOut:'2026-09-21',adults:2},now).error,/past/);
  assert.match(validateStay({checkIn:'2026-10-04',checkOut:'2026-10-05',adults:7},now).error,/1 and 4/);
});

test('availability tool returns capacity-safe prices and inventory', async () => {
  const result = await answerQuestion({question:'Check availability',stay:{checkIn:'2026-10-05',checkOut:'2026-10-07',adults:3}}, config);
  assert.equal(result.type,'availability');
  assert.equal(result.availability.nights,2);
  assert.ok(result.availability.rooms.every((room) => room.capacity >= 3 && room.total === room.basePrice * 2 && room.available > 0));
});

test('availability is deterministic for same inputs', () => {
  const stay = validateStay({checkIn:'2026-10-05',checkOut:'2026-10-07',adults:2},now);
  assert.deepEqual(checkAvailability(stay),checkAvailability(stay));
});

test('follow-up maintains conversation context', async () => {
  const result = await answerQuestion({question:'And breakfast?',history:[{role:'user',content:'Tell me about the Terrace Suite'},{role:'assistant',content:'The Terrace Suite sleeps up to 3 guests.'}]}, config);
  assert.equal(result.type,'answer'); assert.match(result.answer,/breakfast/i);
});

test('graph adds connected policy as a candidate when appropriate', async () => {
  const results = await retrieve('Terrace Suite breakfast',config);
  assert.ok(results.some((result) => result.id === 'terrace'));
  assert.ok(results.some((result) => result.id === 'breakfast'));
});

test('follow-up availability can keep prior intent', () => {
  assert.equal(isAvailabilityIntent('And for three guests?', [{role:'user',content:'Check availability for next week'}]),true);
});

test('model endpoint failure falls back to grounded answer', async () => {
  const original = global.fetch;
  global.fetch = async () => { throw new Error('offline'); };
  try {
    const result = await answerQuestion({question:'What is the cancellation policy?'},{...config,apiKey:'test',localAiUrl:'http://127.0.0.1:1'});
    assert.equal(result.type,'answer'); assert.match(result.answer,/48 hours/);
  } finally { global.fetch = original; }
});
