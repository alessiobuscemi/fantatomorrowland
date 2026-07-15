// Headless smoke test: load the bundled app with a minimal DOM stub,
// seed a realistic game through the real UI functions, and render every
// screen. Catches runtime errors in the view code that unit tests miss.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function makeContext(opts = {}) {
  const store = {};
  const el = () => ({
    innerHTML: '',
    textContent: '',
    value: '',
    style: {},
    classList: { add() {}, remove() {} },
  });
  const elements = {};
  const ctx = {
    localStorage: opts.brokenStorage
      ? { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } }
      : {
          getItem: (k) => (k in store ? store[k] : null),
          setItem: (k, v) => { store[k] = v; },
          removeItem: (k) => { delete store[k]; },
        },
    document: {
      getElementById: (id) => (elements[id] ||= el()),
      createElement: el,
      addEventListener() {},
    },
    window: { scrollTo() {} },
    setTimeout: () => 0,
    clearTimeout: () => {},
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} },
    Blob: class {},
    console,
    Date,
    Math,
    JSON,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  return { ctx, elements };
}

function loadApp(ctx) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'fantatomorrowland.html'), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.equal(scripts.length, 2, 'bundle should contain exactly two inline scripts (logic + UI)');
  for (const s of scripts) vm.runInContext(s, ctx);
}

test('bundle contains no inline event handlers (artifact CSP blocks them)', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'fantatomorrowland.html'), 'utf8');
  const hits = html.match(/\son(click|change|input|load|submit)\s*=/gi);
  assert.equal(hits, null, `inline handlers found: ${hits}`);
});

test('app boots and works when localStorage is blocked (sandboxed iframes, content:// pages)', () => {
  const { ctx } = makeContext({ brokenStorage: true });
  loadApp(ctx);
  const run = (code) => vm.runInContext(code, ctx);
  assert.equal(run('store.persistent'), false);
  run(`document.getElementById('fname').value = 'Ale';
       document.getElementById('fcost').value = '30';
       addFriend();`);
  assert.equal(run('state.friends.length'), 1, 'in-memory fallback still plays');
});

test('bundled app boots and every screen renders through a full game', () => {
  const { ctx, elements } = makeContext();
  loadApp(ctx);

  const run = (code) => vm.runInContext(code, ctx);

  // friends
  for (const [name, cost] of [['Ale', 30], ['Marco', 40], ['Giulia', 25], ['Pippo', 35]]) {
    run(`document.getElementById('fname').value = ${JSON.stringify(name)};
         document.getElementById('fcost').value = '${cost}';
         addFriend();`);
  }
  assert.equal(run('state.friends.length'), 4);

  // team via the real builder functions (Ale owns; picks Marco+Giulia; captain Marco/drama)
  run(`go('teams'); openBuilder();
       bSet('owner', 'Ale'); bPick(1); bPick(2); bCap(0); bSet('captainCategory', 'drama');
       saveTeam();`);
  assert.equal(run('state.teams.length'), 1, 'team should be created');

  // self-pick must be refused by the builder validation
  run(`openBuilder(); bSet('owner', 'Marco'); bPick(0); bPick(1);`);
  assert.equal(run('ui.builder.roster.includes("Marco")'), false, 'owner selection strips self from roster');
  run(`bCap(0); bSet('captainCategory', 'pain'); saveTeam();`);
  assert.equal(run('state.teams.length'), 2);

  // event: Marco drama +5 → Ale's team +10 (captain double), Marco's team 0
  run(`go('events');
       ui.ev.friend = 'Marco'; ui.ev.category = 'drama'; ui.ev.points = 5; ui.ev.sign = 1;
       ui.ev.desc = 'cried during the Armin set';
       addEvent();`);
  assert.equal(run('state.events.length'), 1);
  assert.equal(
    run(`JSON.stringify(standings(state.teams, state.events).map(t => [t.owner, t.total]))`),
    JSON.stringify([['Ale', 10], ['Marco', 0]]),
  );

  // cost editing is inline (no prompt(), which artifact sandboxes block)
  run(`go('friends'); editCost(3);`);
  assert.equal(run('ui.costEditing'), 'Pippo');
  run(`document.getElementById('costinput').value = '55'; saveCost(3);`);
  assert.equal(run(`state.friends[3].cost`), 55);
  assert.equal(run('ui.costEditing'), null);

  // every screen renders without throwing, with data present
  for (const t of ['board', 'events', 'teams', 'friends']) {
    run(`go('${t}')`);
    assert.ok(elements.view.innerHTML.length > 100, `${t} screen renders content`);
  }

  // state survives a reload (fresh context, same storage)
  const raw = ctx.localStorage.getItem('fantatomorrowland');
  const second = makeContext();
  second.ctx.localStorage.setItem('fantatomorrowland', raw);
  loadApp(second.ctx);
  assert.equal(vm.runInContext('state.teams.length', second.ctx), 2);
  assert.equal(vm.runInContext('state.events.length', second.ctx), 1);
});
