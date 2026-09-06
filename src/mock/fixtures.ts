/**
 * Deterministic fake dataset for local testing (`VITE_USE_MOCK=true`).
 *
 * Nothing here is real: every figure comes out of a fixed-seed PRNG, so each
 * dev run produces identical data and screenshots/diffs stay stable.
 * Table names and column shapes mirror the live Supabase schema.
 */

export type MockRow = Record<string, unknown>;
export type SeedData = Record<string, MockRow[]>;

export const MOCK_TABLES = [
  'pantagon_financial_accounts',
  'pantagon_financial_transactions',
  'pantagon_financial_fx',
  'pantagon_financial_fcd',
  'pantagon_financial_salary_logs',
  'dime_trades',
  'dime_gold',
] as const;

// ─── seeded RNG (mulberry32) ─────────────────────────────────────────────────

function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const rN = (n: number, d: number) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function num(rng: () => number, min: number, max: number, decimals = 2): number {
  return rN(min + rng() * (max - min), decimals);
}

function int(rng: () => number, min: number, max: number): number {
  return Math.floor(min + rng() * (max - min + 1));
}

const isoDate = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);

const isoStamp = (y: number, m: number, d: number, h = 9) =>
  new Date(Date.UTC(y, m - 1, d, h)).toISOString();

// ─── static reference data ───────────────────────────────────────────────────

/**
 * Built inside a function on purpose: a top-level `.map()` counts as a side
 * effect to the bundler, which would keep this array in the production build
 * instead of tree-shaking the whole mock module away.
 */
function accountCatalog(): MockRow[] {
  return [
    { id: 1, name: 'SCB', display_order: 1, icon_url: '/scb.jpg', is_active: true },
    { id: 2, name: 'KBank MAKE', display_order: 2, icon_url: '/kbank.png', is_active: true },
    { id: 3, name: 'TTB', display_order: 3, icon_url: '/ttb.png', is_active: true },
    { id: 4, name: 'Dime', display_order: 4, icon_url: '/Dime.png', is_active: true },
    { id: 5, name: 'SSO', display_order: 5, icon_url: '/SSO.jpg', is_active: true },
    { id: 6, name: 'Cash', display_order: 6, icon_url: null, is_active: true },
    // Inactive on purpose — exercises the `onlyActive` filter in fetchAccounts().
    { id: 7, name: 'Old Wallet', display_order: 99, icon_url: null, is_active: false },
  ].map(a => ({ ...a, created_at: '2025-01-01T00:00:00.000Z' }));
}

/**
 * Balance carried into 2025-01 for each account, booked as a single "Opening
 * balance" row. This is what puts the portfolio in the millions of THB before
 * any monthly cash flow is applied.
 */
const OPENING_BALANCE = [
  { account_name: 'SCB', amount: 880000 },
  { account_name: 'KBank MAKE', amount: 420000 },
  { account_name: 'TTB', amount: 310000 },
  { account_name: 'Dime', amount: 265000 },
  { account_name: 'Cash', amount: 45000 },
  { account_name: 'SSO', amount: 186000 },
];

const SALARY_SPLIT = [
  { account_name: 'SCB', amount: 45000 },
  { account_name: 'KBank MAKE', amount: 25000 },
  { account_name: 'TTB', amount: 18000 },
  { account_name: 'Dime', amount: 30000 },
  { account_name: 'Cash', amount: 8000 },
  { account_name: 'SSO', amount: 750 },
];

const EXPENSES = [
  { tag: 'Food', account: 'KBank MAKE', min: 350, max: 3200, notes: ['Lunch', 'Groceries', 'Coffee', 'Dinner with friends', 'Street food'] },
  { tag: 'Transport', account: 'KBank MAKE', min: 180, max: 1800, notes: ['BTS top-up', 'Grab', 'Fuel', 'Taxi'] },
  { tag: 'Utilities', account: 'SCB', min: 1200, max: 5400, notes: ['Electricity', 'Water', 'Internet', 'Mobile'] },
  { tag: 'Shopping', account: 'SCB', min: 900, max: 14000, notes: ['Shopee order', 'Lazada order', 'Clothes', 'Home stuff'] },
  { tag: 'Subscription', account: 'KBank MAKE', min: 299, max: 1900, notes: ['Netflix', 'Spotify', 'iCloud', 'AI subscription'] },
  { tag: 'Health', account: 'SCB', min: 800, max: 9500, notes: ['Pharmacy', 'Dentist', 'Clinic visit', 'Supplements'] },
  { tag: 'Travel', account: 'SCB', min: 6000, max: 38000, notes: ['Weekend trip', 'Hotel', 'Flight ticket'] },
] as const;

const SYMBOLS = [
  { symbol: 'NVDA', base: 108, drift: 0.055 },
  { symbol: 'AAPL', base: 212, drift: 0.018 },
  { symbol: 'MSFT', base: 398, drift: 0.022 },
  { symbol: 'VOO', base: 498, drift: 0.014 },
  { symbol: 'QQQ', base: 462, drift: 0.017 },
  { symbol: 'TSLA', base: 238, drift: 0.03 },
  { symbol: 'AMZN', base: 178, drift: 0.021 },
  { symbol: 'PLTR', base: 34, drift: 0.06 },
] as const;

const FUNDS = [
  { symbol: 'SCBRMGOLDH', base: 12.4, drift: 0.02 },
  { symbol: 'K-USA-A', base: 28.7, drift: 0.024 },
] as const;

/** 2025-01 … 2026-09 — the window the app's charts and year filters cover. */
function months(): Array<{ y: number; m: number }> {
  const out: Array<{ y: number; m: number }> = [];
  for (let y = 2025; y <= 2026; y++) {
    for (let m = 1; m <= 12; m++) {
      if (y === 2026 && m > 9) break;
      out.push({ y, m });
    }
  }
  return out;
}

// ─── generator ───────────────────────────────────────────────────────────────

export function createSeedData(seed = 20260906): SeedData {
  const rng = makeRng(seed);
  const MONTHS = months();

  // ── transactions + salary logs ────────────────────────────────────────────
  const transactions: MockRow[] = [];
  const salaryLogs: MockRow[] = [];
  let txId = 1;
  let logId = 1;

  const pushTx = (
    date: string,
    account_name: string,
    type: 'IN' | 'OUT',
    amount: number,
    tag: string | null,
    note: string | null,
  ) => {
    transactions.push({
      id: txId++,
      account_name,
      type,
      amount: r2(amount),
      date,
      note,
      tag,
      created_at: `${date}T03:00:00.000Z`,
    });
  };

  // Opening balances, booked the day before the first month starts.
  OPENING_BALANCE.forEach(o =>
    pushTx('2024-12-31', o.account_name, 'IN', o.amount, 'Opening', 'Opening balance'),
  );

  MONTHS.forEach(({ y, m }, i) => {
    // Rent, 1st of the month.
    pushTx(isoDate(y, m, 1), 'SCB', 'OUT', 25000, 'Rent', 'Monthly rent');

    // Salary allocation, 25th.
    const payDate = isoDate(y, m, 25);
    const raise = i >= 12 ? 1.08 : 1; // pay bump from 2026 onward
    const allocations = SALARY_SPLIT.map(s => ({
      account_name: s.account_name,
      amount: r2(s.account_name === 'SSO' ? s.amount : s.amount * raise),
    }));
    allocations.forEach(a =>
      pushTx(payDate, a.account_name, 'IN', a.amount, 'Salary', `Salary allocation - ${a.account_name}`),
    );
    salaryLogs.push({
      id: logId++,
      month: `${y}-${String(m).padStart(2, '0')}`,
      total_amount: r2(allocations.reduce((s, a) => s + a.amount, 0)),
      allocations,
      date: payDate,
      created_at: `${payDate}T04:00:00.000Z`,
    });

    // December bonus.
    if (m === 12) pushTx(isoDate(y, m, 28), 'SCB', 'IN', 150000 * raise, 'Bonus', 'Year-end bonus');

    // Day-to-day spending.
    const count = int(rng, 6, 11);
    for (let k = 0; k < count; k++) {
      const e = pick(rng, EXPENSES);
      if (e.tag === 'Travel' && rng() > 0.25) continue; // travel is occasional
      pushTx(isoDate(y, m, int(rng, 2, 27)), e.account, 'OUT', num(rng, e.min, e.max), e.tag, pick(rng, e.notes));
    }

    // Quarterly top-up into the brokerage account, as a transfer pair.
    if (i % 3 === 2) {
      const d = isoDate(y, m, 26);
      const amt = num(rng, 30000, 85000, 0);
      pushTx(d, 'SCB', 'OUT', amt, 'Transfer', 'Transfer to Dime');
      pushTx(d, 'Dime', 'IN', amt, 'Transfer', 'Transfer from SCB');
    }
  });

  // ── FX conversions (THB → USD, plus a couple of reversals) ────────────────
  const fx: MockRow[] = [];
  let fxId = 1;
  MONTHS.forEach(({ y, m }, i) => {
    const rounds = rng() > 0.65 ? 2 : 1;
    for (let k = 0; k < rounds; k++) {
      const day = int(rng, 3, 27);
      const back = i > 3 && rng() > 0.88; // occasional USD → THB
      const rate = num(rng, 32.9, 36.4, 4);
      const thb = num(rng, 60000, 380000, 2);
      fx.push({
        id: fxId++,
        foreign_amount: r2(thb / rate),
        thb_amount: thb,
        exchange_rate: rate,
        transaction_at: isoStamp(y, m, day, int(rng, 8, 20)),
        from_currency: back ? 'USD' : 'THB',
        to_currency: back ? 'THB' : 'USD',
        created_at: isoStamp(y, m, day, 21),
      });
    }
  });

  // ── Dime trades (stocks / funds / gold) ───────────────────────────────────
  const trades: MockRow[] = [];
  let tradeId = 1;
  const position: Record<string, number> = {};
  const orderNo = (prefix: string) => `${prefix}-${String(100000 + tradeId).slice(1)}`;

  const priceAt = (base: number, drift: number, i: number) =>
    r2(base * (1 + drift * i) * (0.93 + rng() * 0.14));

  const pushTrade = (row: MockRow) => trades.push({ id: tradeId++, ...row });

  MONTHS.forEach(({ y, m }, i) => {
    // 2–3 buys a month, DCA style.
    const buys = int(rng, 2, 3);
    for (let k = 0; k < buys; k++) {
      const s = pick(rng, SYMBOLS);
      const day = int(rng, 2, 27);
      const price = priceAt(s.base, s.drift, i);
      const input = num(rng, 900, 4200, 2);
      const fee = r2(input * 0.0018 + 0.1);
      const gross = r2(input - fee);
      const qty = rN(gross / price, 6);
      position[s.symbol] = rN((position[s.symbol] ?? 0) + qty, 6);
      pushTrade({
        order_no: orderNo('MOCK'),
        trade_date: isoDate(y, m, day),
        side: 'BUY',
        symbol: s.symbol,
        market: 'US',
        asset_class: 'STOCK',
        qty,
        qty_unit: 'SHARES',
        price,
        currency: 'USD',
        gross_usd: gross,
        fee_usd: fee,
        wht_usd: null,
        net_usd: input,
        gross_thb: null,
        fee_thb: null,
        wht_thb: null,
        net_thb: null,
        source: 'mock',
        created_at: isoStamp(y, m, day, 22),
      });
    }

    // Occasional partial take-profit, never more than the position held.
    const held = Object.keys(position).filter(sym => (position[sym] ?? 0) > 1.5);
    if (held.length && rng() > 0.62) {
      const sym = pick(rng, held);
      const s = SYMBOLS.find(x => x.symbol === sym)!;
      const day = int(rng, 2, 27);
      const price = priceAt(s.base, s.drift, i);
      const qty = rN(position[sym] * num(rng, 0.2, 0.6, 4), 6);
      const gross = r2(qty * price);
      const fee = r2(gross * 0.0018 + 0.1);
      position[sym] = rN(position[sym] - qty, 6);
      pushTrade({
        order_no: orderNo('MOCK'),
        trade_date: isoDate(y, m, day),
        side: 'SELL',
        symbol: sym,
        market: 'US',
        asset_class: 'STOCK',
        qty,
        qty_unit: 'SHARES',
        price,
        currency: 'USD',
        gross_usd: gross,
        fee_usd: fee,
        wht_usd: null,
        net_usd: r2(gross - fee),
        gross_thb: null,
        fee_thb: null,
        wht_thb: null,
        net_thb: null,
        source: 'mock',
        created_at: isoStamp(y, m, day, 22),
      });
    }

    // A dividend now and then.
    if (rng() > 0.8) {
      const s = pick(rng, SYMBOLS);
      const day = int(rng, 2, 27);
      const amt = num(rng, 8, 65, 2);
      pushTrade({
        order_no: orderNo('MOCK'),
        trade_date: isoDate(y, m, day),
        side: 'REWARD',
        symbol: s.symbol,
        market: 'US',
        asset_class: 'STOCK',
        qty: 0,
        qty_unit: 'SHARES',
        price: 0,
        currency: 'USD',
        gross_usd: amt,
        fee_usd: null,
        wht_usd: r2(amt * 0.15),
        net_usd: r2(amt * 0.85),
        gross_thb: null,
        fee_thb: null,
        wht_thb: null,
        net_thb: null,
        source: 'mock',
        created_at: isoStamp(y, m, day, 22),
      });
    }

    // Mutual fund, every other month — exercises the FUND asset_class filter.
    if (i % 2 === 0) {
      const f = pick(rng, FUNDS);
      const day = int(rng, 5, 25);
      const price = priceAt(f.base, f.drift, i);
      const thb = num(rng, 18000, 55000, 0);
      pushTrade({
        order_no: orderNo('FUND'),
        trade_date: isoDate(y, m, day),
        side: 'SUBSCRIB',
        symbol: f.symbol,
        market: 'TH',
        asset_class: 'FUND',
        qty: rN(thb / price, 4),
        qty_unit: 'UNITS',
        price,
        currency: 'THB',
        gross_usd: null,
        fee_usd: null,
        wht_usd: null,
        net_usd: null,
        gross_thb: thb,
        fee_thb: 0,
        wht_thb: null,
        net_thb: thb,
        source: 'mock',
        created_at: isoStamp(y, m, day, 22),
      });
    }
  });

  // ── gold (own table, mirrored into dime_trades as asset_class GOLD) ───────
  const gold: MockRow[] = [];
  let goldId = 1;
  let goldOz = 0;
  MONTHS.forEach(({ y, m }, i) => {
    if (rng() > 0.55) return;
    const day = int(rng, 3, 27);
    const price = r2(2380 * (1 + 0.021 * i) * (0.97 + rng() * 0.06));
    const sell = goldOz > 0.9 && rng() > 0.6;
    const qty = sell ? rN(goldOz * num(rng, 0.3, 0.8, 3), 4) : num(rng, 0.25, 1.4, 4);
    goldOz = rN(sell ? goldOz - qty : goldOz + qty, 4);
    const gross = r2(qty * price);
    const fee = r2(gross * 0.002);
    const row = {
      order_no: `GOLD-${String(1000 + goldId).slice(1)}`,
      trade_date: isoDate(y, m, day),
      side: sell ? 'SELL' : 'BUY',
      symbol: 'XAUUSD',
      market: 'OTC',
      asset_class: 'GOLD',
      qty,
      qty_unit: 'OZ',
      price,
      currency: 'USD',
      gross_usd: gross,
      fee_usd: fee,
      wht_usd: null,
      net_usd: sell ? r2(gross - fee) : r2(gross + fee),
      gross_thb: null,
      fee_thb: null,
      wht_thb: null,
      net_thb: null,
      source: 'mock',
      created_at: isoStamp(y, m, day, 22),
    };
    gold.push({ id: goldId++, ...row });
    pushTrade({ ...row });
  });

  // ── FCD ledger (USD account: FX in, gold, interest, transfers) ────────────
  const fcd: MockRow[] = [];
  let fcdId = 1;
  const pushFcd = (
    date: string,
    tx_type: string,
    status: string,
    usd: number,
    thb: number | null,
    rate: number | null,
    note: string | null,
  ) => {
    fcd.push({ id: fcdId++, tx_type, status, date, usd: r2(usd), thb, rate, note, created_at: `${date}T05:00:00.000Z` });
  };

  MONTHS.forEach(({ y, m }, i) => {
    // Monthly USD funding.
    const rate = num(rng, 33.1, 36.2, 4);
    const usd = num(rng, 1800, 9500, 2);
    pushFcd(isoDate(y, m, int(rng, 2, 10)), 'FX', 'IN', usd, r2(usd * rate), rate, 'THB to USD funding');

    // Quarterly interest credit.
    if (i % 3 === 0) {
      pushFcd(isoDate(y, m, 28), 'INTEREST', 'Interest', num(rng, 12, 140, 2), null, null, 'Quarterly interest');
    }

    // Gold flows, roughly mirroring the gold table.
    if (rng() > 0.62) {
      const buy = rng() > 0.4;
      pushFcd(
        isoDate(y, m, int(rng, 5, 26)),
        buy ? 'GOLD_BUY' : 'GOLD_SELL',
        buy ? 'OUT' : 'IN',
        num(rng, 900, 4800, 2),
        null,
        null,
        buy ? 'Gold buy (MTS)' : 'Gold sell (MTS)',
      );
    }

    // Occasional transfer out to the broker.
    if (rng() > 0.78) {
      pushFcd(isoDate(y, m, int(rng, 8, 27)), 'TRANSFER', 'OUT', num(rng, 700, 3200, 2), null, null, 'Transfer to Dime');
    }
  });

  return {
    pantagon_financial_accounts: accountCatalog(),
    pantagon_financial_transactions: transactions,
    pantagon_financial_fx: fx,
    pantagon_financial_fcd: fcd,
    pantagon_financial_salary_logs: salaryLogs,
    dime_trades: trades,
    dime_gold: gold,
  };
}
