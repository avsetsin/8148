const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');

const script = readFileSync(join(__dirname, '../assets/eva-support.js'), 'utf8');
const html = readFileSync(join(__dirname, '../index.html'), 'utf8');
const valid = {
  id: 8148,
  approved: true,
  yesVotes: 9,
  yesVoteBalance: '49330000000000000000000',
  noVotes: 0,
  noVoteBalance: '0',
  abstainVotes: 0,
  abstainVoteBalance: '0'
};

async function render({ data = valid, failure, expire = false } = {}) {
  const fields = Object.fromEntries([...html.matchAll(/<(dd|span|time)\b([^>]*\bdata-eva-([a-z]+)[^>]*)>([^<]*)<\/\1>/g)].map((match) => [match[3], {
    textContent: match[4],
    dateTime: /datetime="([^"]+)"/.exec(match[2])?.[1]
  }]));
  assert.equal(Object.keys(fields).length, 6);
  const snapshot = structuredClone(fields);
  const panel = { hidden: false, querySelector: (selector) => fields[/data-eva-([a-z]+)/.exec(selector)?.[1]] };
  const requests = [];
  let onTimeout;
  let timerCleared = false;
  const complete = runInNewContext(script, {
    document: { querySelector: () => panel },
    AbortController,
    setTimeout(callback, delay) { assert.equal(delay, 6000); onTimeout = callback; return 1; },
    clearTimeout() { timerCleared = true; },
    async fetch(url, options) {
      requests.push({ url, options });
      if (failure === 'network') throw new Error('offline');
      if (expire) return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('timeout'))));
      return { ok: failure !== 'http', async json() { if (failure === 'json') throw new Error('invalid JSON'); return data; } };
    }
  });
  if (expire) onTimeout();
  await complete;
  assert.equal(timerCleared, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.ethva.net/eips/8148');
  assert.equal(requests[0].options.credentials, 'omit');
  assert.equal(requests[0].options.referrerPolicy, 'no-referrer');
  return { fields, snapshot, panel, request: requests[0] };
}

test('refreshes the verified EIP-8148 totals and check date', async () => {
  const { fields } = await render();
  assert.equal(fields.percent.textContent, '100%');
  assert.equal(fields.eth.textContent, '49,330');
  assert.equal(fields.total.textContent, '49,330');
  assert.equal(fields.signals.textContent, '9');
  assert.equal(fields.breakdown.textContent, '9 yes · 0 no · 0 abstain');
  assert.ok(Math.abs(Date.now() - Date.parse(fields.checked.dateTime)) < 5000);
});

test('weights support by stake and includes both opposition and abstentions', async () => {
  const { fields } = await render({ data: {
    ...valid,
    yesVotes: 1, yesVoteBalance: '250000000000000000000',
    noVotes: 3, noVoteBalance: '500000000000000000000',
    abstainVotes: 1, abstainVoteBalance: '250000000000000000000'
  } });
  assert.equal(fields.percent.textContent, '25%');
  assert.equal(fields.eth.textContent, '250');
  assert.equal(fields.total.textContent, '1,000');
  assert.equal(fields.signals.textContent, '5');
  assert.equal(fields.breakdown.textContent, '1 yes · 3 no · 1 abstain');
});

test('distinguishes zero participation from zero support', async () => {
  const empty = { ...valid, yesVotes: 0, yesVoteBalance: '0' };
  const { fields } = await render({ data: empty });
  assert.equal(fields.percent.textContent, '—');
  assert.equal(fields.signals.textContent, '0');
  const opposed = await render({ data: { ...empty, noVotes: 1, noVoteBalance: '32000000000000000000' } });
  assert.equal(opposed.fields.percent.textContent, '0%');
});

test('does not round tiny opposing or supporting stakes away', async () => {
  const mostlyYes = { ...valid, yesVoteBalance: '9999000000000000000000', noVotes: 1, noVoteBalance: '1000000000000000000' };
  const high = await render({ data: mostlyYes });
  assert.equal(high.fields.percent.textContent, '>99.9%');
  const low = await render({ data: { ...mostlyYes, yesVoteBalance: mostlyYes.noVoteBalance, noVoteBalance: mostlyYes.yesVoteBalance } });
  assert.equal(low.fields.percent.textContent, '<0.1%');
});

for (const failure of ['network', 'http', 'json']) {
  test(`${failure} failure preserves the complete snapshot and its date`, async () => {
    const { fields, snapshot } = await render({ failure });
    assert.deepEqual(fields, snapshot);
  });
}

test('aborts a stalled request and keeps the dated snapshot', async () => {
  const { fields, snapshot, request } = await render({ expire: true });
  assert.equal(request.options.signal.aborted, true);
  assert.deepEqual(fields, snapshot);
});

for (const [label, patch] of Object.entries({
  'wrong proposal': { id: 8205 },
  'missing approval': { approved: undefined },
  'missing balance': { abstainVoteBalance: undefined },
  'negative balance': { noVoteBalance: '-1' },
  'imprecise numeric balance': { yesVoteBalance: 49330e18 },
  'fractional signal count': { yesVotes: 7.5 },
  'overflowing signal count': { yesVotes: Number.MAX_SAFE_INTEGER, noVotes: 1 },
  'markup in a numeric field': { yesVoteBalance: '<img src=x onerror=alert(1)>' }
})) {
  test(`${label} leaves every existing value unchanged`, async () => {
    const { fields, snapshot } = await render({ data: { ...valid, ...patch } });
    assert.deepEqual(fields, snapshot);
  });
}

test('hides the results if EVA withdraws approval', async () => {
  const { panel } = await render({ data: { ...valid, approved: false } });
  assert.equal(panel.hidden, true);
});
