// Minimal Supabase-style query builder backed by the Worker's D1 endpoint (/api/query).
type Op = 'eq' | 'neq' | 'gte' | 'lte' | 'gt' | 'lt';
type Result<T = any> = { data: T; error: { message: string } | null };

class Query implements PromiseLike<Result> {
  private q: any;
  private selecting = false;
  private mode: 'many' | 'single' = 'many';

  constructor(table: string) { this.q = { table, op: 'select', filters: [], order: [] }; }

  select(_cols?: string) { this.selecting = true; return this; }
  insert(rows: object | object[]) { this.q.op = 'insert'; this.q.rows = Array.isArray(rows) ? rows : [rows]; return this; }
  upsert(rows: object | object[], opts: { onConflict?: string } = {}) { this.q.op = 'insert'; this.q.rows = Array.isArray(rows) ? rows : [rows]; this.q.onConflict = opts.onConflict; return this; }
  update(values: object) { this.q.op = 'update'; this.q.values = values; return this; }
  delete() { this.q.op = 'delete'; return this; }
  order(col: string, opts: { ascending?: boolean } = {}) { this.q.order.push({ col, asc: opts.ascending !== false }); return this; }
  limit(n: number) { this.q.limit = n; return this; }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'single'; return this; }
  private f(op: Op, col: string, val: unknown) { this.q.filters.push({ col, op, val }); return this; }
  eq(c: string, v: unknown) { return this.f('eq', c, v); }
  neq(c: string, v: unknown) { return this.f('neq', c, v); }
  gte(c: string, v: unknown) { return this.f('gte', c, v); }
  lte(c: string, v: unknown) { return this.f('lte', c, v); }
  gt(c: string, v: unknown) { return this.f('gt', c, v); }
  lt(c: string, v: unknown) { return this.f('lt', c, v); }

  private async exec(): Promise<Result> {
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.q),
      });
      const json = await res.json();
      if (!res.ok || json.error) return { data: null, error: json.error ?? { message: `HTTP ${res.status}` } };
      let data = json.data as any[];
      // Writes only return rows when .select() is chained (Supabase semantics).
      if (this.q.op !== 'select' && !this.selecting) data = null as any;
      else if (this.mode === 'single') data = data[0] ?? null;
      return { data, error: null };
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } };
    }
  }

  then<R1 = Result, R2 = never>(
    ok?: ((v: Result) => R1 | PromiseLike<R1>) | null,
    err?: ((r: unknown) => R2 | PromiseLike<R2>) | null,
  ) { return this.exec().then(ok, err); }
}

export const db = { from: (table: string) => new Query(table) };
