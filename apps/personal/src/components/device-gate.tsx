'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { LockKeyhole, ShieldCheck, TriangleAlert, Smartphone } from 'lucide-react';
import {
  create,
  eraseEverything,
  isUnlocked,
  lock,
  onLock,
  unlock,
  vaultExists,
} from '@/modules/local/session';
import { MIN_CODE_LENGTH, validCode } from '@/modules/local/vault';
import { NOTICE_VERSION } from '@/modules/local/store';
import { Panel, Notice } from './ui';
/** Locks again after this long in the background (Santé / Health Connect dialogs included). */
export const AUTO_LOCK_MS = 2 * 60_000;
/**
 * Information shown before anything is stored (RGPD art. 13). Keep NOTICE_VERSION in step
 * with any change of this text: the accepted version is recorded.
 */
export function NoticeText() {
  return (
    <div className="device-notice">
      <p>
        <strong>
          Convergence range vos données de santé sur ce téléphone, et nulle part ailleurs.
        </strong>{' '}
        Aucun serveur ne les reçoit, aucun compte n’est créé, aucune mesure d’audience n’est faite.
      </p>
      <ul>
        <li>
          Vous ajoutez vos documents PDF et, si vous l’autorisez, Convergence lit dans Santé
          (iPhone) ou Health Connect (Android) : sommeil, fréquence cardiaque au repos, variabilité
          cardiaque, pas et distance. Rien n’est écrit sur le téléphone.
        </li>
        <li>
          Les données sont chiffrées avec votre code.{' '}
          <strong>
            Sans ce code, personne ne peut les lire, pas même nous : un code oublié ne peut pas être
            récupéré.
          </strong>
        </li>
        <li>
          Si vous perdez ou réinitialisez le téléphone, les données sont perdues. Pour les garder,
          exportez-les régulièrement depuis Paramètres.
        </li>
        <li>
          Convergence affiche vos données avec leur source. Il ne donne aucun diagnostic, aucune
          interprétation ni recommandation, et ne remplace pas un avis médical.{' '}
          <strong>Ne l’utilisez pas en cas d’urgence.</strong>
        </li>
        <li>
          Vous pouvez à tout moment retirer une autorisation, supprimer un document, exporter ou
          supprimer toutes vos données (Paramètres). Vous pouvez aussi saisir la CNIL.
        </li>
      </ul>
      <small>Version du texte : {NOTICE_VERSION}</small>
    </div>
  );
}
function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="device-gate" id="main-content">
      <div className="device-gate-brand">
        <span className="brand-mark">
          <i />
          <i />
          <i />
        </span>
        <span>convergence</span>
      </div>
      <Panel>{children}</Panel>
    </main>
  );
}
function CodeInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="code-field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={12}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
      />
    </label>
  );
}
type Stage = 'loading' | 'welcome' | 'code' | 'locked' | 'open';
export function DeviceGate({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<Stage>('loading');
  const [adult, setAdult] = useState(false);
  const [read, setRead] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [code, setCode] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [failures, setFailures] = useState(0);
  useEffect(() => {
    // Moving between pages remounts the gate: an open vault stays open (key in memory).
    void vaultExists().then((exists) =>
      setStage(isUnlocked() ? 'open' : exists ? 'locked' : 'welcome'),
    );
    const stop = onLock(() => {
      setCode('');
      void vaultExists().then((exists) => setStage(exists ? 'locked' : 'welcome'));
    });
    let hiddenAt = 0;
    const visibility = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > AUTO_LOCK_MS) lock();
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  async function createCode() {
    setError('');
    if (!validCode(code))
      return setError(`Le code doit compter de ${MIN_CODE_LENGTH} à 12 chiffres.`);
    if (code !== again) return setError('Les deux codes ne sont pas identiques.');
    setBusy(true);
    try {
      // Information accepted (version recorded) and majority declared, inside the vault.
      await (await create(code)).completeOnboarding(firstName);
      setCode('');
      setAgain('');
      setStage('open');
    } catch {
      setError('Le coffre chiffré n’a pas pu être créé sur ce téléphone.');
    } finally {
      setBusy(false);
    }
  }
  async function open() {
    setError('');
    setBusy(true);
    try {
      await unlock(code);
      setFailures(0);
      setCode('');
      setStage('open');
    } catch (e) {
      const n = failures + 1;
      setFailures(n);
      setCode('');
      setError(
        e instanceof Error && e.message === 'WRONG_CODE'
          ? `Code incorrect (${n} essai${n > 1 ? 's' : ''}).`
          : 'Le coffre n’a pas pu être ouvert.',
      );
      // Slows down guessing on an unlocked phone; PBKDF2 already costs time per attempt.
      if (n >= 5) await new Promise((r) => setTimeout(r, 30_000));
    } finally {
      setBusy(false);
    }
  }
  if (stage === 'open') return <>{children}</>;
  if (stage === 'loading')
    return (
      <Shell>
        <p>Ouverture…</p>
      </Shell>
    );
  if (stage === 'welcome')
    return (
      <Shell>
        <h1>Bienvenue</h1>
        <NoticeText />
        <label className="field">
          <span>Votre prénom (facultatif, reste sur ce téléphone)</span>
          <input
            value={firstName}
            maxLength={40}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="check">
          <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
          J’ai 18 ans ou plus.
        </label>
        <label className="check">
          <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} />
          J’ai lu ces informations.
        </label>
        <button
          className="button primary"
          disabled={!adult || !read}
          onClick={() => setStage('code')}
        >
          Continuer
        </button>
        {!adult && <p className="consent-note">Convergence est réservé aux personnes majeures.</p>}
      </Shell>
    );
  if (stage === 'code')
    return (
      <Shell>
        <h1>
          <LockKeyhole size={22} /> Choisissez votre code
        </h1>
        <p>
          De {MIN_CODE_LENGTH} à 12 chiffres. Il chiffre vos données : notez-le en lieu sûr, il ne
          peut pas être récupéré.
        </p>
        <CodeInput id="code-new" label="Code" value={code} onChange={setCode} />
        <CodeInput id="code-again" label="Confirmer le code" value={again} onChange={setAgain} />
        {error && (
          <p className="feedback error" role="alert">
            <TriangleAlert size={16} /> {error}
          </p>
        )}
        <button className="button primary" disabled={busy} onClick={() => void createCode()}>
          {busy ? 'Chiffrement…' : 'Créer mon espace'}
        </button>
        <button className="button" disabled={busy} onClick={() => setStage('welcome')}>
          Retour
        </button>
      </Shell>
    );
  return (
    <Shell>
      <h1>
        <ShieldCheck size={22} /> Espace verrouillé
      </h1>
      <p>Saisissez votre code pour ouvrir vos données sur ce téléphone.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void open();
        }}
      >
        <CodeInput id="code-unlock" label="Code" value={code} onChange={setCode} />
        {error && (
          <p className="feedback error" role="alert">
            <TriangleAlert size={16} /> {error}
          </p>
        )}
        <button className="button primary" disabled={busy || code.length < MIN_CODE_LENGTH}>
          {busy ? 'Ouverture…' : 'Déverrouiller'}
        </button>
      </form>
      <Notice>
        <Smartphone size={16} /> Code oublié : les données ne peuvent pas être récupérées. Vous
        pouvez seulement tout effacer et repartir de zéro.
      </Notice>
      <button
        className="button danger"
        onClick={() => {
          if (confirm('Effacer définitivement toutes les données de ce téléphone ?'))
            void eraseEverything();
        }}
      >
        Code oublié : tout effacer
      </button>
    </Shell>
  );
}
