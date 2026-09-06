/**
 * In-memory stand-in for `supabase-js`, used when `VITE_USE_MOCK=true`.
 *
 * It implements the slice of PostgrestQueryBuilder this app actually calls —
 * select / insert / update / upsert / delete, plus eq-style filters, order,
 * limit, single and maybeSingle — over the fixtures in `./fixtures`. Data lives
 * in memory only: writes are visible for the rest of the session and disappear
 * on reload.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createSeedData, type MockRow, type SeedData } from './fixtures';

const LATENCY_MS = Number(import.meta.env.VITE_MOCK_LATENCY ?? 150);

interface MockError {
  message: string;
  details: string;
  hint: string;
  code: string;
}

interface MockResult<T> {
  data: T;
  error: MockError | null;
  count: number | null;
  status: number;
  statusText: string;
}

type FilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is' | 'like' | 'ilike';
type Op = 'select' | 'insert' | 'update' | 'upsert' | 'delete';

const err = (code: string, message: string): MockError => ({ message, details: '', hint: '', code });

const ok = <T>(data: T, count: number | null = null): MockResult<T> => ({
  data,
  error: null,
  count,
  status: 200,
  statusText: 'OK',
});

const fail = (e: MockError): MockResult<null> => ({
  data: null,
  error: e,
  count: null,
  status: 400,
  statusText: 'Bad Request',
});

const delay = () => new Promise<void>(r => setTimeout(r, LATENCY_MS));

// ─── store ───────────────────────────────────────────────────────────────────

class MockDb {
  tables: SeedData;

  constructor(seed: SeedData) {
    this.tables = seed;
  }

  rows(table: string): MockRow[] | null {
    return this.tables[table] ?? null;
  }

  nextId(table: string): number {
    const rows = this.tables[table] ?? [];
    return rows.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1;
  }

  /** Throw away every mutation and rebuild the fixtures. */
  reset(seed?: number) {
    this.tables = createSeedData(seed);
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1; // nulls last, like Postgres default
  if (b === null || b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

function matches(row: MockRow, col: string, op: FilterOp, value: unknown): boolean {
  const v = row[col];
  switch (op) {
    case 'eq': return String(v) === String(value);
    case 'neq': return String(v) !== String(value);
    case 'gt': return compare(v, value) > 0;
    case 'gte': return compare(v, value) >= 0;
    case 'lt': return compare(v, value) < 0;
    case 'lte': return compare(v, value) <= 0;
    case 'in': return Array.isArray(value) && value.some(x => String(x) === String(v));
    case 'is': return v === value || (value === null && (v === null || v === undefined));
    case 'like':
    case 'ilike': {
      const pattern = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
      return new RegExp(`^${pattern}$`, op === 'ilike' ? 'i' : '').test(String(v));
    }
  }
}

function project(row: MockRow, columns: string): MockRow {
  if (!columns || columns.trim() === '*') return { ...row };
  const cols = columns.split(',').map(c => c.trim()).filter(Boolean);
  const out: MockRow = {};
  for (const c of cols) out[c] = row[c];
  return out;
}

const toArray = (v: MockRow | MockRow[]): MockRow[] => (Array.isArray(v) ? v : [v]);

// ─── query builder ───────────────────────────────────────────────────────────

class MockQuery implements PromiseLike<MockResult<unknown>> {
  private filters: Array<{ col: string; op: FilterOp; value: unknown }> = [];
  private orders: Array<{ col: string; ascending: boolean }> = [];
  private limitN: number | null = null;
  private columns = '*';
  private mode: 'many' | 'single' | 'maybeSingle' = 'many';
  private returning: boolean;

  private db: MockDb;
  private table: string;
  private op: Op;
  private payload: MockRow[];
  private onConflict?: string;

  constructor(db: MockDb, table: string, op: Op, payload: MockRow[] = [], onConflict?: string) {
    this.db = db;
    this.table = table;
    this.op = op;
    this.payload = payload;
    this.onConflict = onConflict;
    this.returning = op === 'select';
  }

  select(columns = '*') {
    this.columns = columns;
    this.returning = true;
    return this;
  }

  private filter(col: string, op: FilterOp, value: unknown) {
    this.filters.push({ col, op, value });
    return this;
  }

  eq(col: string, value: unknown) { return this.filter(col, 'eq', value); }
  neq(col: string, value: unknown) { return this.filter(col, 'neq', value); }
  gt(col: string, value: unknown) { return this.filter(col, 'gt', value); }
  gte(col: string, value: unknown) { return this.filter(col, 'gte', value); }
  lt(col: string, value: unknown) { return this.filter(col, 'lt', value); }
  lte(col: string, value: unknown) { return this.filter(col, 'lte', value); }
  in(col: string, value: unknown[]) { return this.filter(col, 'in', value); }
  is(col: string, value: unknown) { return this.filter(col, 'is', value); }
  like(col: string, value: string) { return this.filter(col, 'like', value); }
  ilike(col: string, value: string) { return this.filter(col, 'ilike', value); }

  order(col: string, opts: { ascending?: boolean } = {}) {
    this.orders.push({ col, ascending: opts.ascending !== false });
    return this;
  }

  limit(n: number) {
    this.limitN = n;
    return this;
  }

  range(from: number, to: number) {
    this.rangeFrom = from;
    this.limitN = to - from + 1;
    return this;
  }
  private rangeFrom = 0;

  single() {
    this.mode = 'single';
    return this;
  }

  maybeSingle() {
    this.mode = 'maybeSingle';
    return this;
  }

  then<R1 = MockResult<unknown>, R2 = never>(
    onfulfilled?: ((value: MockResult<unknown>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }

  private applyFilters(rows: MockRow[]): MockRow[] {
    return rows.filter(row => this.filters.every(f => matches(row, f.col, f.op, f.value)));
  }

  private applyOrder(rows: MockRow[]): MockRow[] {
    if (!this.orders.length) return rows;
    return [...rows].sort((a, b) => {
      for (const o of this.orders) {
        const r = compare(a[o.col], b[o.col]);
        if (r !== 0) return o.ascending ? r : -r;
      }
      return 0;
    });
  }

  private async run(): Promise<MockResult<unknown>> {
    await delay();

    const rows = this.db.rows(this.table);
    if (!rows) {
      return fail(err('42P01', `relation "public.${this.table}" does not exist (mock mode)`));
    }

    let result: MockRow[];

    switch (this.op) {
      case 'select': {
        result = this.applyOrder(this.applyFilters(rows)).slice(this.rangeFrom);
        if (this.limitN !== null) result = result.slice(0, this.limitN);
        result = result.map(r => project(r, this.columns));
        break;
      }

      case 'insert': {
        const inserted = this.payload.map(p => ({
          id: p.id ?? this.db.nextId(this.table),
          created_at: p.created_at ?? new Date().toISOString(),
          ...p,
        }));
        rows.push(...inserted);
        result = inserted.map(r => project(r, this.columns));
        break;
      }

      case 'update': {
        const patch = this.payload[0] ?? {};
        const hit = this.applyFilters(rows);
        hit.forEach(row => Object.assign(row, patch));
        result = hit.map(r => project(r, this.columns));
        break;
      }

      case 'upsert': {
        const key = this.onConflict ?? 'id';
        result = this.payload.map(p => {
          const existing = rows.find(r => String(r[key]) === String(p[key]));
          if (existing) {
            Object.assign(existing, p);
            return project(existing, this.columns);
          }
          const created = {
            id: p.id ?? this.db.nextId(this.table),
            created_at: p.created_at ?? new Date().toISOString(),
            ...p,
          };
          rows.push(created);
          return project(created, this.columns);
        });
        break;
      }

      case 'delete': {
        const hit = this.applyFilters(rows);
        for (const row of hit) {
          const idx = rows.indexOf(row);
          if (idx >= 0) rows.splice(idx, 1);
        }
        result = hit.map(r => project(r, this.columns));
        break;
      }
    }

    if (this.mode === 'single') {
      if (result.length !== 1) {
        return fail(
          err('PGRST116', `JSON object requested, multiple (or no) rows returned — got ${result.length}`),
        );
      }
      return ok(result[0]);
    }

    if (this.mode === 'maybeSingle') {
      if (result.length > 1) {
        return fail(err('PGRST116', `JSON object requested, multiple rows returned — got ${result.length}`));
      }
      return ok(result[0] ?? null);
    }

    // supabase-js returns `data: null` for writes that don't chain .select()
    return ok(this.returning ? result : null, result.length);
  }
}

// ─── client facade ───────────────────────────────────────────────────────────

export interface MockSupabaseClient extends SupabaseClient {
  /** Escape hatch for the browser console: `supabase.__mock.db.tables`. */
  __mock: { db: MockDb; reset: (seed?: number) => void };
}

export function createMockSupabaseClient(seed?: number): MockSupabaseClient {
  const db = new MockDb(createSeedData(seed));

  const client = {
    from(table: string) {
      return {
        select: (columns = '*') => new MockQuery(db, table, 'select').select(columns),
        insert: (rows: MockRow | MockRow[]) => new MockQuery(db, table, 'insert', toArray(rows)),
        update: (row: MockRow) => new MockQuery(db, table, 'update', [row]),
        upsert: (rows: MockRow | MockRow[], opts?: { onConflict?: string }) =>
          new MockQuery(db, table, 'upsert', toArray(rows), opts?.onConflict),
        delete: () => new MockQuery(db, table, 'delete'),
      };
    },
    rpc: async () => fail(err('MOCK', 'rpc() is not implemented in mock mode')),
    __mock: { db, reset: (s?: number) => db.reset(s) },
  };

  if (typeof window !== 'undefined') {
    // Poke at the fake store from the devtools console:
    //   __mock.db.tables.pantagon_financial_transactions
    //   __mock.reset()   // back to pristine fixtures
    (window as unknown as Record<string, unknown>).__mock = client.__mock;
    console.info(
      `%c MOCK DATA %c Supabase is mocked in memory — ${Object.entries(db.tables)
        .map(([t, r]) => `${t}: ${r.length}`)
        .join(', ')}`,
      'background:#0891b2;color:#fff;font-weight:bold;border-radius:3px',
      'color:#0891b2',
    );
  }

  return client as unknown as MockSupabaseClient;
}
