// Unique porte d'accès aux données : chaque méthode appelle UNE fonction hc.api_* (SECURITY DEFINER).
// Le rôle SQL de l'API n'a aucun droit sur les tables. Les décisions d'accès sont prises en base.
export class PgRepository{
 constructor(pool){this.pool=pool;}
 async #call(sql,params){const {rows}=await this.pool.query(`SELECT ${sql} AS r`,params);return rows[0].r;}
 ping(){return this.pool.query('SELECT 1');}
 whoami({subject}){return this.#call('hc.api_whoami($1::text)',[subject]);}
 registry(){return this.#call('hc.api_metric_registry()',[]);}
 listObservations({subject,personId,metric=null,namespace=null,from=null,to=null,limit=50,offset=0,action='read'}){
  return this.#call('hc.api_list_observations($1::text,$2::uuid,$3::text,$4::text,$5::timestamptz,$6::timestamptz,$7::int,$8::int,$9::text)',[subject,personId,metric,namespace,from,to,limit,offset,action]);}
 getObservation({subject,personId,id}){return this.#call('hc.api_get_observation($1::text,$2::uuid,$3::uuid)',[subject,personId,id]);}
 recordReport({subject,personId,algorithm,parameters,sha256,observationIds}){
  return this.#call('hc.api_record_report($1::text,$2::uuid,$3::text,$4::jsonb,$5::text,$6::uuid[])',[subject,personId,algorithm,JSON.stringify(parameters),sha256,observationIds]);}
 importBatch({subject,personId,namespace,version,records}){
  return this.#call('hc.api_import_batch($1::text,$2::uuid,$3::text,$4::text,$5::jsonb)',[subject,personId,namespace,version,JSON.stringify(records)]);}
 listConnections({subject,personId}){return this.#call('hc.api_list_connections($1::text,$2::uuid)',[subject,personId]);}
 setConnection({subject,personId,provider,status}){return this.#call('hc.api_set_connection($1::text,$2::uuid,$3::text,$4::text)',[subject,personId,provider,status]);}
 listAudit({subject,personId,limit=50}){return this.#call('hc.api_list_audit($1::text,$2::uuid,$3::int)',[subject,personId,limit]);}
}
