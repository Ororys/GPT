/**
 * Controlled enrolment: links a verified provider identity (issuer + sub) to an existing
 * dossier. Run by an operator with the bootstrap (admin) connection, never by the app.
 *   node --env-file=.env.database --import tsx scripts/link-identity.ts <issuer> <sub> <personId>
 */
import pg from 'pg';
import { subjectFor } from '../src/modules/identity/oidc-core';
export async function linkIdentity(
  adminUrl: string,
  issuer: string,
  sub: string,
  personId: string,
) {
  if (!issuer || !sub || !/^[a-z0-9-]{1,64}$/.test(personId)) throw Error('USAGE');
  const subject = subjectFor(issuer.replace(/\/$/, ''), sub);
  const c = new pg.Client({ connectionString: adminUrl });
  await c.connect();
  try {
    const exists = await c.query('SELECT 1 FROM personal.record WHERE person_id=$1', [personId]);
    if (!exists.rowCount) throw Error('UNKNOWN_DOSSIER');
    await c.query(
      'INSERT INTO personal.actor(subject,person_id) VALUES($1,$2) ON CONFLICT (subject) DO NOTHING',
      [subject, personId],
    );
    const row = await c.query('SELECT person_id FROM personal.actor WHERE subject=$1', [subject]);
    if (row.rows[0].person_id !== personId) throw Error('IDENTITY_ALREADY_LINKED');
    return subject;
  } finally {
    await c.end();
  }
}
if (process.argv[1]?.endsWith('link-identity.ts')) {
  const [issuer, sub, personId] = process.argv.slice(2);
  const url = process.env.HC_PERSONAL_ADMIN_DATABASE_URL;
  if (!url) throw Error('HC_PERSONAL_ADMIN_DATABASE_URL required');
  console.log('Linked', await linkIdentity(url, issuer, sub, personId));
}
