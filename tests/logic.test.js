const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CATEGORIES,
  BUDGET,
  rosterCost,
  validateTeam,
  teamScore,
  standings,
} = require('../fanta.js');

const friends = [
  { name: 'Ale', cost: 30 },
  { name: 'Marco', cost: 40 },
  { name: 'Giulia', cost: 25 },
  { name: 'Pippo', cost: 35 },
];

function team(overrides) {
  return {
    owner: 'Ale',
    roster: ['Marco', 'Giulia'],
    captain: 'Marco',
    captainCategory: 'drama',
    ...overrides,
  };
}

function event(overrides) {
  return {
    description: 'lost shoe in mosh pit',
    friend: 'Marco',
    category: 'idiocy',
    points: 3,
    ...overrides,
  };
}

test('CATEGORIES are the five agreed categories', () => {
  assert.deepEqual(CATEGORIES, ['sex', 'disgust', 'idiocy', 'drama', 'pain']);
});

test('BUDGET is 100 credits', () => {
  assert.equal(BUDGET, 100);
});

test('rosterCost sums the cost of every rostered friend', () => {
  assert.equal(rosterCost(['Marco', 'Giulia'], friends), 65);
  assert.equal(rosterCost([], friends), 0);
});

test('validateTeam accepts a valid team, even at exactly 100 credits', () => {
  const t = team({ roster: ['Marco', 'Giulia', 'Pippo'], captain: 'Pippo' }); // 40+25+35 = 100
  assert.deepEqual(validateTeam(t, friends), { ok: true, errors: [] });
});

test('validateTeam rejects a roster over 100 credits', () => {
  const over = [...friends, { name: 'Lucia', cost: 50 }];
  const t = team({ roster: ['Marco', 'Giulia', 'Pippo', 'Lucia'], captain: 'Marco' });
  const res = validateTeam(t, over);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes('budget')));
});

test('validateTeam rejects the owner picking themselves', () => {
  const t = team({ roster: ['Ale', 'Giulia'], captain: 'Giulia' });
  const res = validateTeam(t, friends);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes('own team')));
});

test('validateTeam rejects a captain who is not in the roster', () => {
  const t = team({ captain: 'Pippo' });
  const res = validateTeam(t, friends);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes('captain')));
});

test('validateTeam rejects duplicate friends in one roster', () => {
  const t = team({ roster: ['Marco', 'Marco'] });
  const res = validateTeam(t, friends);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes('duplicate')));
});

test('validateTeam rejects an invalid captain category and empty roster', () => {
  const t = team({ roster: [], captain: null, captainCategory: 'sonno' });
  const res = validateTeam(t, friends);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes('category')));
  assert.ok(res.errors.some((e) => e.includes('empty')));
});

test('teamScore adds event points to teams holding that friend', () => {
  assert.equal(teamScore(team(), [event()]), 3);
});

test('teamScore ignores events for friends not on the roster', () => {
  assert.equal(teamScore(team(), [event({ friend: 'Pippo' })]), 0);
});

test('teamScore doubles points when the captain scores in the captain category', () => {
  const e = event({ category: 'drama', points: 5 }); // Marco is captain, category matches
  assert.equal(teamScore(team(), [e]), 10);
});

test('teamScore does NOT double for the captain outside their category', () => {
  assert.equal(teamScore(team(), [event({ points: 5 })]), 5); // idiocy ≠ drama
});

test('teamScore does NOT double for non-captains in the captain category', () => {
  const e = event({ friend: 'Giulia', category: 'drama', points: 5 });
  assert.equal(teamScore(team(), [e]), 5);
});

test('teamScore handles negative points (doubled for captain too)', () => {
  const e = event({ category: 'drama', points: -2 });
  assert.equal(teamScore(team(), [e]), -4);
});

test('teamScore sums a whole event log', () => {
  const events = [
    event({ points: 3 }),                                  // Marco idiocy +3
    event({ category: 'drama', points: 5 }),               // Marco drama +5 → doubled to 10
    event({ friend: 'Giulia', category: 'pain', points: 2 }), // +2
    event({ friend: 'Pippo', category: 'sex', points: 9 }),   // not rostered → 0
  ];
  assert.equal(teamScore(team(), events), 15);
});

test('standings recompute per team and sort descending; same event can be doubled for one team only', () => {
  const t1 = team(); // captain Marco, drama
  const t2 = team({ owner: 'Marco', roster: ['Giulia', 'Ale'], captain: 'Giulia', captainCategory: 'pain' });
  const events = [
    event({ category: 'drama', points: 4 }),                  // t1: 8 (captain match), t2: 0
    event({ friend: 'Giulia', category: 'pain', points: 6 }),  // t1: 6, t2: 12 (captain match)
  ];
  const table = standings([t1, t2], events);
  assert.deepEqual(
    table.map((r) => ({ owner: r.owner, total: r.total })),
    [{ owner: 'Ale', total: 14 }, { owner: 'Marco', total: 12 }],
  );
});
