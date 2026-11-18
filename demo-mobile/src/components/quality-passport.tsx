'use client';
import type { HealthRecord } from '@/modules/health-records/model';
import { qualityPassport, type ComparabilityNote } from '@/modules/quality/passport';
import { dateLabel } from '@/modules/observations/selectors';
import { Modal, Notice, Pill } from './ui';
const noteLabel: Record<ComparabilityNote, string> = {
  MIXED_UNITS: 'Plusieurs unités : valeurs non converties, non comparées.',
  SEVERAL_LABORATORIES:
    'Plusieurs laboratoires : références propres à chacun, non interchangeables.',
  SEVERAL_DEVICES: 'Plusieurs appareils : séries non directement comparables.',
  MANUFACTURER_ESTIMATE: 'Estimation du fabricant, pas une mesure de référence.',
  HRV_METHOD_SPECIFIC: 'VFC propre à sa méthode de calcul : non comparable à une autre méthode.',
  ANALYTICAL_METHOD_NOT_REPORTED: 'Méthode analytique non indiquée par le document.',
  SEVERAL_PROTOCOLS: 'Plusieurs méthodes ou protocoles : valeurs non directement comparables.',
};
const day = (iso: string) => dateLabel(iso, { day: 'numeric', month: 'short', year: 'numeric' });
export function QualityPassportModal({
  record,
  open,
  onClose,
}: {
  record: HealthRecord;
  open: boolean;
  onClose: () => void;
}) {
  const passport = qualityPassport(record);
  const measured = passport.biology.filter((b) => b.count);
  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Passeport de qualité"
      description="D’où vient chaque série, comment elle a été obtenue, ce qui manque. Faits techniques, sans lecture médicale."
      wide
    >
      <section className="passport-section" aria-labelledby="passport-daily">
        <h3 id="passport-daily">Quotidien · {passport.daily[0].windowDays} derniers jours</h3>
        <div className="passport-table">
          <table>
            <thead>
              <tr>
                <th>Série</th>
                <th>Couverture</th>
                <th>Plus longue période sans donnée</th>
                <th>Appareil</th>
              </tr>
            </thead>
            <tbody>
              {passport.daily.map((d) => (
                <tr key={d.id}>
                  <td>
                    <strong>{d.label}</strong>
                    {d.notes.map((n) => (
                      <small key={n}>{noteLabel[n]}</small>
                    ))}
                  </td>
                  <td>
                    {d.id === 'activities'
                      ? `${d.daysWithData} jour(s) avec activité enregistrée`
                      : `${d.daysWithData} / ${d.windowDays} jours`}
                  </td>
                  <td>
                    {d.id === 'activities'
                      ? 'Non applicable'
                      : d.longestGap
                        ? `${d.longestGap.days} jour(s) · ${day(d.longestGap.from)} → ${day(d.longestGap.to)}`
                        : 'Aucune'}
                  </td>
                  <td>{d.devices.join(', ') || 'Aucun'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="passport-section" aria-labelledby="passport-biology">
        <h3 id="passport-biology">Biologie et mesures du centre · tout l’historique</h3>
        {measured.length === 0 && <p>Aucun résultat biologique dans ce dossier.</p>}
        <div className="passport-cards">
          {measured.map((b) => (
            <article className="passport-card" key={b.code}>
              <header>
                <strong>{b.label}</strong>
                <Pill>{b.count} résultat(s)</Pill>
              </header>
              <dl>
                <div>
                  <dt>Période</dt>
                  <dd>
                    {day(b.first!)} → {day(b.last!)}
                  </dd>
                </div>
                <div>
                  <dt>Unité(s)</dt>
                  <dd>{b.units.join(', ')}</dd>
                </div>
                {b.category === 'Mesures du centre' && (
                  <div>
                    <dt>Protocole</dt>
                    <dd>{b.protocols.join(' / ')}</dd>
                  </div>
                )}
                <div>
                  <dt>Laboratoire(s)</dt>
                  <dd>{b.laboratories.join(', ')}</dd>
                </div>
                <div>
                  <dt>Obtention</dt>
                  <dd>{b.acquisition.map((a) => `${a.method} (${a.count})`).join(', ')}</dd>
                </div>
                <div>
                  <dt>Revue</dt>
                  <dd>
                    {b.needsReview} à vérifier · {b.corrected} corrigé(s) · {b.documents}{' '}
                    document(s)
                  </dd>
                </div>
              </dl>
              {b.notes.map((n) => (
                <small key={n}>{noteLabel[n]}</small>
              ))}
            </article>
          ))}
        </div>
        {passport.biology.some((b) => !b.count) && (
          <p className="passport-missing">
            Sans résultat :{' '}
            {passport.biology
              .filter((b) => !b.count)
              .map((b) => b.label)
              .join(', ')}
            .
          </p>
        )}
      </section>
      <Notice>
        Les jours sans donnée restent vides : rien n’est extrapolé. Ces indications décrivent la
        provenance et la comparabilité des mesures, jamais leur signification médicale.
      </Notice>
    </Modal>
  );
}
