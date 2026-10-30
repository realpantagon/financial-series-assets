interface Env { DB: D1Database; ASSETS: Fetcher; TYPHOON_API_KEY?: string }

const TABLES = new Set([
  'pantagon_financial_accounts', 'pantagon_financial_transactions', 'pantagon_financial_fx',
  'pantagon_financial_fcd', 'pantagon_financial_salary_logs', 'dime_trades', 'dime_gold',
]);
const JSON_COLS = new Set(['allocations']);
const BOOL_COLS = new Set(['is_active']);
const IDENT = /^[a-z_][a-z0-9_]*$/;

type Filter = { col: string; op: 'eq' | 'neq' | 'gte' | 'lte' | 'gt' | 'lt'; val: unknown };
interface Query {
  table: string;
  op: 'select' | 'insert' | 'update' | 'delete';
  filters?: Filter[];
  order?: { col: string; asc: boolean }[];
  limit?: number;
  rows?: Record<string, unknown>[];
  onConflict?: string;
  values?: Record<string, unknown>;
}

const OPS = { eq: '=', neq: '!=', gte: '>=', lte: '<=', gt: '>', lt: '<' } as const;

function ident(s: string) {
  if (!IDENT.test(s)) throw new Error(`bad identifier: ${s}`);
  return s;
}
function enc(col: string, v: unknown) {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (JSON_COLS.has(col) && v !== null && typeof v !== 'string') return JSON.stringify(v);
  return v;
}
function dec(row: Record<string, unknown>) {
  for (const k of Object.keys(row)) {
    if (BOOL_COLS.has(k) && row[k] !== null) row[k] = !!row[k];
    if (JSON_COLS.has(k) && typeof row[k] === 'string') {
      try { row[k] = JSON.parse(row[k] as string); } catch { /* leave as-is */ }
    }
  }
  return row;
}
function where(filters: Filter[] = [], args: unknown[]) {
  if (!filters.length) return '';
  return ' WHERE ' + filters.map(f => {
    args.push(enc(f.col, f.val));
    return `${ident(f.col)} ${OPS[f.op]} ?`;
  }).join(' AND ');
}

async function run(db: D1Database, q: Query) {
  if (!TABLES.has(q.table)) throw new Error('unknown table');
  const t = ident(q.table);
  const args: unknown[] = [];

  if (q.op === 'select') {
    let sql = `SELECT * FROM ${t}` + where(q.filters, args);
    if (q.order?.length) sql += ' ORDER BY ' + q.order.map(o => `${ident(o.col)} ${o.asc ? 'ASC' : 'DESC'}`).join(', ');
    if (q.limit) sql += ` LIMIT ${Math.min(Math.floor(q.limit), 10000)}`;
    const { results } = await db.prepare(sql).bind(...args).all<Record<string, unknown>>();
    return results.map(dec);
  }

  if (q.op === 'insert') {
    const out: Record<string, unknown>[] = [];
    const conflict = (cols: string[]) => q.onConflict
      ? ` ON CONFLICT(${ident(q.onConflict)}) DO UPDATE SET ${cols.filter(c => c !== q.onConflict).map(c => `${c}=excluded.${c}`).join(',')}`
      : '';
    const stmts = (q.rows ?? []).map(r => {
      const cols = Object.keys(r).filter(k => r[k] !== undefined).map(ident);
      const sql = `INSERT INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})${conflict(cols)} RETURNING *`;
      return db.prepare(sql).bind(...cols.map(c => enc(c, r[c])));
    });
    if (!stmts.length) return out;
    const res = await db.batch<Record<string, unknown>>(stmts);
    for (const r of res) out.push(...r.results.map(dec));
    return out;
  }

  if (q.op === 'update') {
    const vals = q.values ?? {};
    const cols = Object.keys(vals).map(ident);
    if (!cols.length) return [];
    const setArgs = cols.map(c => enc(c, vals[c]));
    const w = where(q.filters, args);
    const { results } = await db.prepare(`UPDATE ${t} SET ${cols.map(c => `${c}=?`).join(',')}${w} RETURNING *`)
      .bind(...setArgs, ...args).all<Record<string, unknown>>();
    return results.map(dec);
  }

  if (q.op === 'delete') {
    if (!q.filters?.length) throw new Error('delete requires a filter');
    const { results } = await db.prepare(`DELETE FROM ${t}${where(q.filters, args)} RETURNING *`)
      .bind(...args).all<Record<string, unknown>>();
    return results.map(dec);
  }
  throw new Error('bad op');
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/api/query' && req.method === 'POST') {
      try {
        const data = await run(env.DB, await req.json<Query>());
        return Response.json({ data });
      } catch (e) {
        return Response.json({ error: { message: (e as Error).message } }, { status: 400 });
      }
    }
    // Slip OCR: the Typhoon key stays on the server (wrangler secret), never in the app bundle.
    if (url.pathname === '/api/ocr' && req.method === 'POST') {
      if (!env.TYPHOON_API_KEY) {
        return Response.json({ error: { message: 'OCR is not configured: set the TYPHOON_API_KEY secret' } }, { status: 503 });
      }
      const upstream = await fetch('https://api.opentyphoon.ai/v1/ocr', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.TYPHOON_API_KEY}` },
        body: await req.formData(),
      });
      return new Response(upstream.body, { status: upstream.status, headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' } });
    }
    if (url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(req);
  },
};
