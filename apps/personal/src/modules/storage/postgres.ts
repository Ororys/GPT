import 'server-only';
import pg from 'pg';
const state = globalThis as typeof globalThis & {
  personalPool?: pg.Pool;
  personalRoleChecked?: Promise<void>;
};
async function pool() {
  if (!process.env.HC_PERSONAL_DATABASE_URL) throw Error('DATABASE_UNAVAILABLE');
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
export async function databaseCall<T>(sql: string, parameters: unknown[]): Promise<T> {
  try {
    const p = await pool();
    const result = await p.query(sql, parameters);
    return result.rows[0].result as T;
  } catch (e) {
    if (e instanceof Error && e.message === 'UNSAFE_DATABASE_ROLE') throw e;
    // Business refusal raised by a SQL trigger (permission withdrawn): surfaced as such.
    if (e instanceof Error && e.message === 'CONSENT_REQUIRED') throw Error('CONSENT_REQUIRED');
    throw Error('DATABASE_UNAVAILABLE');
  }
}
