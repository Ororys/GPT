import 'server-only';
import pg from 'pg';
import { COOKIE } from '../identity/token';
const state = globalThis as typeof globalThis & {
  personalPool?: pg.Pool;
  personalRoleChecked?: Promise<void>;
};
async function pool() {
  if (!process.env.HC_PERSONAL_DATABASE_URL) throw Error('DATABASE_UNAVAILABLE');
  // The database checks session signatures with this key (S-02): a random per-process key
  // would make every call fail as "forbidden". Refuse clearly instead.
  if (!process.env.HC_PERSONAL_SESSION_SECRET) {
    console.error(
      'HC_PERSONAL_SESSION_SECRET is required in PostgreSQL mode (see npm run env:init).',
    );
    throw Error('SESSION_SECRET_REQUIRED');
  }
  const p = (state.personalPool ??= new pg.Pool({
    connectionString: process.env.HC_PERSONAL_DATABASE_URL,
    max: 8,
    connectionTimeoutMillis: 3000,
    statement_timeout: 8000,
    query_timeout: 10000,
    application_name: 'hc-personal',
  }));
  if (!state.personalRoleChecked) {
    state.personalRoleChecked = (async () => {
      const r = (
        await p.query(
          "SELECT rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR pg_has_role(current_user,'hc_personal_owner','MEMBER') OR EXISTS(SELECT 1 FROM pg_class c WHERE c.relnamespace='personal'::regnamespace AND c.relkind='r' AND has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')) AS unsafe FROM pg_roles WHERE rolname=current_user",
        )
      ).rows[0];
      if (!r || r.unsafe) throw Error('UNSAFE_DATABASE_ROLE');
    })().catch((e) => {
      state.personalRoleChecked = undefined;
      throw e;
    });
  }
  await state.personalRoleChecked;
  return p;
}
/** The signed session cookie of the current request, if any (null outside a request). */
async function sessionProof() {
  try {
    const { cookies } = await import('next/headers');
    return (await cookies()).get(COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}
/**
 * One transaction per call: the session token is set as hc.session_proof so that, when the
 * database requires it (migration 012), it verifies the signature itself instead of trusting
 * the subject passed by this role.
 */
export async function databaseCall<T>(sql: string, parameters: unknown[]): Promise<T> {
  try {
    const p = await pool();
    const proof = await sessionProof();
    const client = await p.connect();
    try {
      await client.query('BEGIN');
      if (proof) await client.query("SELECT set_config('hc.session_proof', $1, true)", [proof]);
      const result = await client.query(sql, parameters);
      await client.query('COMMIT');
      return result.rows[0].result as T;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    if (
      e instanceof Error &&
      ['UNSAFE_DATABASE_ROLE', 'SESSION_SECRET_REQUIRED'].includes(e.message)
    )
      throw e;
    // Business refusal raised by a SQL trigger (permission withdrawn): surfaced as such.
    if (e instanceof Error && e.message === 'CONSENT_REQUIRED') throw Error('CONSENT_REQUIRED');
    throw Error('DATABASE_UNAVAILABLE');
  }
}
