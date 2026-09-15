(async function () {
  'use strict';

  const panel = document.querySelector('[data-eva-support]');
  if (!panel || typeof fetch !== 'function' || typeof AbortController !== 'function' || typeof BigInt !== 'function') return;
  const names = ['percent', 'eth', 'signals', 'breakdown', 'total', 'checked'];
  const fields = Object.fromEntries(names.map((name) => [name, panel.querySelector('[data-eva-' + name + ']')]));
  if (names.some((name) => !fields[name])) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch('https://api.ethva.net/eips/8148', {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      signal: controller.signal
    });
    if (!response.ok) throw new Error('EVA response unavailable');
    const data = await response.json();
    if (data.id !== 8148 || typeof data.approved !== 'boolean') throw new Error('Unexpected EIP');
    if (!data.approved) { panel.hidden = true; return; }

    const choices = ['yes', 'no', 'abstain'];
    const counts = choices.map((choice) => {
      const count = data[choice + 'Votes'];
      if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid signal count');
      return count;
    });
    const balances = choices.map((choice) => {
      const balance = data[choice + 'VoteBalance'];
      if (typeof balance !== 'string' || !/^(0|[1-9][0-9]{0,77})$/.test(balance)) throw new Error('Invalid stake balance');
      return BigInt(balance);
    });
    const signals = counts.reduce((sum, count) => sum + count, 0);
    if (!Number.isSafeInteger(signals)) throw new Error('Invalid total signal count');
    const total = balances.reduce((sum, balance) => sum + balance, BigInt(0));
    const tenths = total > 0 ? Number((balances[0] * BigInt(1000) + total / BigInt(2)) / total) : 0;
    let percent = total === BigInt(0) ? '—' : tenths / 10 + '%';
    if (balances[0] > 0 && tenths === 0) percent = '<0.1%';
    if (balances[0] < total && tenths === 1000) percent = '>99.9%';

    const eth = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
    const integers = new Intl.NumberFormat('en-US');
    const checked = new Date();
    const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][checked.getUTCMonth()];
    const checkedLabel = checked.getUTCDate() + ' ' + month + ' ' + checked.getUTCFullYear() + ', ' + checked.toISOString().slice(11, 16) + ' UTC';

    // Commit all fields together so a partial or malformed response cannot mix dates and totals.
    fields.percent.textContent = percent;
    fields.eth.textContent = eth.format(Number(balances[0]) / 1e18);
    fields.signals.textContent = integers.format(signals);
    fields.breakdown.textContent = integers.format(counts[0]) + ' yes · ' + integers.format(counts[1]) + ' no · ' + integers.format(counts[2]) + ' abstain';
    fields.total.textContent = eth.format(Number(total) / 1e18);
    fields.checked.dateTime = checked.toISOString();
    fields.checked.textContent = checkedLabel;
  } catch (_) {
    // Keep the dated HTML snapshot when offline, timed out, or the API changes.
  } finally {
    clearTimeout(timeout);
  }
})();
