'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FlaskConical,
  Activity,
  FileText,
  GitCommitHorizontal,
  Settings2,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  Search,
  Upload,
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
  Download,
  LockKeyhole,
  Check,
  Database,
  Layers,
  Info,
} from 'lucide-react';
import type { HealthRecord, Period, View } from '@/modules/health-records/model';
import { PERSON_ALPHA, PERSON_BETA } from '@/modules/health-records/model';
import { Overview, type PageProps } from './overview';
import { Biology } from './biology';
import { Sport } from './sport';
import { Documents } from './documents';
import { Timeline } from './timeline';
import { EvidenceModal } from './evidence-modal';
import { ActivityModal } from './activity-modal';
import { ImportModal } from './import-modal';
import { Panel, Pill, Modal, Skeleton, Notice } from './ui';
const navigation = [
  { id: 'overview' as const, name: 'Vue d’ensemble', icon: LayoutDashboard, path: '/' },
  { id: 'biology' as const, name: 'Biologie', icon: FlaskConical, path: '/biology' },
  { id: 'sport' as const, name: 'Sport & mouvement', icon: Activity, path: '/sport' },
  { id: 'documents' as const, name: 'Documents', icon: FileText, path: '/documents' },
  { id: 'timeline' as const, name: 'Timeline', icon: GitCommitHorizontal, path: '/timeline' },
];
const pageMeta: Record<View, { title: string; subtitle: string }> = {
  overview: {
    title: 'Votre santé, en perspective.',
    subtitle: 'Bonjour Alex. Prenez un peu de recul sur votre histoire.',
  },
  biology: {
    title: 'Vos bilans, au fil du temps.',
    subtitle: 'Des résultats lisibles. Une provenance toujours à portée de main.',
  },
  sport: {
    title: 'Le mouvement, dans la durée.',
    subtitle: 'Vos activités réunies, sans confondre performance et santé.',
  },
  documents: {
    title: 'Tout commence à la source.',
    subtitle: 'Votre bibliothèque personnelle, reliée au reste de votre histoire.',
  },
  timeline: {
    title: 'Le fil de votre histoire.',
    subtitle: 'Documents, mouvement et événements. Un même repère temporel.',
  },
  settings: {
    title: 'Votre espace vous appartient.',
    subtitle: 'Profil de démonstration, apparence et contrôle de vos données.',
  },
};
export function Workspace({ view }: { view: View }) {
  const router = useRouter();
  const [record, setRecord] = useState<HealthRecord | null>(null);
  const [error, setError] = useState('');
  const [personId, setPersonId] = useState(PERSON_ALPHA);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [collapsed, setCollapsed] = useState(false);
  const [period, setPeriod] = useState<Period>(365);
  const [importOpen, setImportOpen] = useState(false);
  const [source, setSource] = useState<{ documentId: string; observationId?: string } | null>(null);
  const [activityId, setActivityId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [summaryPeriod, setSummaryPeriod] = useState(365);
  const [search, setSearch] = useState('');
  const refresh = useCallback(
    async (id = personId) => {
      const res = await fetch(`/api/records/${id}`, { cache: 'no-store' });
      if (!res.ok)
        throw Error(
          res.status === 401
            ? 'Session expirée. Rechargez la page pour rouvrir la démo.'
            : 'Impossible de charger ce dossier.',
        );
      setRecord(await res.json());
    },
    [personId],
  );
  const chooseProfile = useCallback(
    async (id: string) => {
      setError('');
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ personId: id }),
      });
      if (!res.ok) throw Error('Impossible d’ouvrir la session de démonstration.');
      localStorage.setItem('convergence-demo-persona', id);
      setPersonId(id);
      await refresh(id);
    },
    [refresh],
  );
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const preference = localStorage.getItem('convergence-theme');
      if (preference === 'light') {
        document.documentElement.dataset.theme = 'light';
        setTheme('light');
      }
      const profile =
        localStorage.getItem('convergence-demo-persona') === PERSON_BETA
          ? PERSON_BETA
          : PERSON_ALPHA;
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ personId: profile }),
      });
      if (!response.ok) throw Error('Impossible de démarrer la démonstration.');
      const res = await fetch(`/api/records/${profile}`);
      if (!res.ok) throw Error('Le dossier synthétique ne peut pas être chargé.');
      const value = (await res.json()) as HealthRecord;
      if (!cancelled) {
        setPersonId(profile);
        setRecord(value);
      }
    }
    void boot().catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur de chargement.');
    });
    return () => {
      cancelled = true;
    };
  }, []);
  function changeTheme(value: 'dark' | 'light') {
    setTheme(value);
    document.documentElement.dataset.theme = value;
    localStorage.setItem('convergence-theme', value);
  }
  const navigate = (id: View) => router.push(id === 'overview' ? '/' : `/${id}`);
  const props: PageProps | null = record
    ? {
        record,
        period,
        navigate,
        openDocument: (documentId, observationId) => setSource({ documentId, observationId }),
        openActivity: setActivityId,
      }
    : null;
  const meta = pageMeta[view];
  const pageName = navigation.find((n) => n.id === view)?.name || 'Paramètres';
  const searchDocs =
    record?.documents
      .filter((d) => `${d.title} ${d.laboratory}`.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 5) || [];
  const searchBio =
    record?.biomarkers.filter((b) => b.label.toLowerCase().includes(search.toLowerCase())) || [];
  return (
    <div className={`app-shell ${collapsed ? 'collapsed' : ''}`}>
      <a className="skip-link" href="#main-content">
        Aller au contenu
      </a>
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="Convergence, accueil">
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          <span className="brand-name">
            convergence<span>PERSONAL HEALTH INTELLIGENCE</span>
          </span>
        </Link>
        <div className="workspace-label">
          <span>ESPACE PERSONNEL</span>
          <LockKeyhole size={12} />
        </div>
        <nav aria-label="Navigation principale">
          {navigation.map((n) => (
            <Link
              href={n.path}
              key={n.id}
              className={`nav-link ${view === n.id ? 'active' : ''}`}
              aria-current={view === n.id ? 'page' : undefined}
              title={collapsed ? n.name : undefined}
            >
              <n.icon size={19} />
              <span>{n.name}</span>
              {view === n.id && <i />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="small-sigil">
              <Layers size={22} />
            </span>
            <strong>
              Votre histoire.
              <br />
              Vos données. Votre regard.
            </strong>
            <p>Chaque donnée garde le lien avec sa source.</p>
            <button onClick={() => navigate('documents')}>
              Explorer mon dossier <ArrowUpRight size={13} />
            </button>
          </div>
          <Link href="/settings" className={`nav-link ${view === 'settings' ? 'active' : ''}`}>
            <Settings2 size={18} />
            <span>Paramètres</span>
          </Link>
          <button className="nav-link" onClick={() => setHelpOpen(true)}>
            <HelpCircle size={18} />
            <span>À propos de la démo</span>
          </button>
          <div className="sidebar-profile">
            <span className="avatar">{record?.profile.initials || 'AM'}</span>
            <div>
              <strong>{record?.profile.firstName || 'Alex'} · profil fictif</strong>
              <small>Prototype personnel</small>
            </div>
            <button
              className="icon-button"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? 'Déployer la navigation' : 'Rétracter la navigation'}
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Espace personnel</span>
            <span>/</span>
            <strong>{pageName}</strong>
          </div>
          <div className="topbar-actions">
            <button className="global-search" onClick={() => setSearchOpen(true)}>
              <Search size={15} />
              <span>Retrouver dans mon histoire</span>
              <kbd>⌕</kbd>
            </button>
            <button
              className="icon-button theme-button"
              onClick={() => changeTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Activer le mode clair' : 'Activer le mode sombre'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <span className="topbar-divider" />
            <button
              className="avatar-button"
              onClick={() => navigate('settings')}
              aria-label="Ouvrir le profil"
            >
              <span className="avatar small">{record?.profile.initials || 'AM'}</span>
            </button>
          </div>
        </header>
        <main id="main-content">
          <div className="demo-notice">
            <span>
              <span className="live-dot" /> ESPACE DE DÉMONSTRATION
            </span>
            <p>Données entièrement fictives. Aucun usage médical.</p>
            <button onClick={() => setHelpOpen(true)}>
              En savoir plus <ArrowUpRight size={12} />
            </button>
          </div>
          <div className="page-heading">
            <div>
              <div className="eyebrow heading-date">MERCREDI 18 NOVEMBRE 2026 · DÉMO</div>
              <h1>{meta.title}</h1>
              <p>
                {view === 'overview'
                  ? `Bonjour ${record?.profile.firstName || 'Alex'}. Prenez un peu de recul sur votre histoire.`
                  : meta.subtitle}
              </p>
            </div>
            <button
              className="button primary import-top"
              onClick={() => setImportOpen(true)}
              disabled={!record}
            >
              <Upload size={16} /> Importer <span>une démo</span>
            </button>
          </div>
          {view !== 'settings' && (
            <div className="period-bar">
              <div className="period-switch" aria-label="Période affichée">
                {(
                  [
                    [30, '30 jours'],
                    [90, '90 jours'],
                    [365, '1 an'],
                    [0, 'Tout'],
                  ] as [Period, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={period === value}
                    className={period === value ? 'active' : ''}
                    onClick={() => setPeriod(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="period-explanation">
                <ShieldCheck size={13} /> Sources traçables <i /> V1 descriptive
              </span>
            </div>
          )}
          {error ? (
            <Panel>
              <div className="empty-state" role="alert">
                <Info size={28} />
                <h2>Le dossier n’a pas pu être chargé.</h2>
                <p>{error}</p>
                <button className="button" onClick={() => location.reload()}>
                  Réessayer
                </button>
              </div>
            </Panel>
          ) : !record || !props ? (
            <Skeleton />
          ) : view === 'overview' ? (
            <Overview {...props} />
          ) : view === 'biology' ? (
            <Biology {...props} />
          ) : view === 'sport' ? (
            <Sport {...props} />
          ) : view === 'documents' ? (
            <Documents {...props} onImport={() => setImportOpen(true)} />
          ) : view === 'timeline' ? (
            <Timeline {...props} />
          ) : (
            <div className="settings-grid">
              <Panel>
                <h2>Un profil de démonstration</h2>
                <p>Deux dossiers fictifs pour explorer le produit et ses états vides.</p>
                {[
                  [PERSON_ALPHA, 'Alex Martin', 'Historique synthétique complet'],
                  [PERSON_BETA, 'Camille Durand', 'Dossier volontairement vide'],
                ].map(([id, name, description]) => (
                  <button
                    className={`profile-choice ${id === personId ? 'selected' : ''}`}
                    key={id}
                    onClick={() => void chooseProfile(id).catch((e) => setError(e.message))}
                  >
                    <span className="avatar">{id === PERSON_ALPHA ? 'AM' : 'CD'}</span>
                    <span>
                      <strong>{name}</strong>
                      <small>{description}</small>
                    </span>
                    {id === personId && <Check size={18} />}
                  </button>
                ))}
                <Notice>
                  La session est une identité de démonstration, pas une authentification destinée à
                  de vrais patients.
                </Notice>
              </Panel>
              <Panel>
                <h2>Une apparence à votre rythme</h2>
                <p>
                  Choisissez votre confort de lecture. Les préférences restent sur cet appareil.
                </p>
                <div className="theme-choices">
                  <button
                    className={theme === 'dark' ? 'selected' : ''}
                    onClick={() => changeTheme('dark')}
                  >
                    <Moon size={22} />
                    Sombre
                  </button>
                  <button
                    className={theme === 'light' ? 'selected' : ''}
                    onClick={() => changeTheme('light')}
                  >
                    <Sun size={22} />
                    Clair
                  </button>
                </div>
                <h3>Votre dossier, exportable</h3>
                <p>Export JSON des informations et de leur provenance.</p>
                <a className="button" href="/api/export" download>
                  <Download size={16} />
                  Exporter mon dossier synthétique
                </a>
                <h3>Préparer une consultation</h3>
                <p>
                  Résumé PDF factuel : chaque valeur avec sa date, son document et sa page, les
                  lacunes et les limites. Sans interprétation ni score.
                </p>
                <div className="summary-export">
                  <select
                    aria-label="Période du résumé"
                    value={summaryPeriod}
                    onChange={(e) => setSummaryPeriod(Number(e.target.value))}
                  >
                    <option value={90}>90 derniers jours</option>
                    <option value={365}>12 derniers mois</option>
                    <option value={730}>24 derniers mois</option>
                  </select>
                  <a className="button" href={`/api/summary?period=${summaryPeriod}`} download>
                    <FileText size={16} />
                    Télécharger le résumé
                  </a>
                </div>
              </Panel>
              <Panel className="settings-sources">
                <h2>Des sources indépendantes, des limites visibles.</h2>
                <div className="source-setting">
                  <Database size={20} />
                  <div>
                    <strong>Persistance du dossier</strong>
                    <small>
                      {record.storage === 'postgresql'
                        ? 'Documents, observations, activités, nuits et journal stockés en base.'
                        : 'Mode fixtures local, activé explicitement.'}
                    </small>
                  </div>
                  <Pill tone="teal">
                    {record.storage === 'postgresql' ? 'PostgreSQL connecté' : 'Fixtures locales'}
                  </Pill>
                </div>
                <div className="source-setting">
                  <FileText size={20} />
                  <div>
                    <strong>Bilans biologiques et comptes rendus</strong>
                    <small>PDF générés à partir des fixtures · aucun OCR ou LLM</small>
                  </div>
                  <Pill tone="teal">Démonstration locale</Pill>
                </div>
                <div className="source-setting">
                  <Activity size={20} />
                  <div>
                    <strong>Activités et sommeil</strong>
                    <small>Capteur fictif unique · aucune connexion à un fabricant</small>
                  </div>
                  <Pill tone="teal">Données synthétiques</Pill>
                </div>
                <div className="source-setting">
                  <Database size={20} />
                  <div>
                    <strong>HealthKit, Health Connect, Garmin, Strava</strong>
                    <small>Accès, contrats et applications natives à étudier séparément</small>
                  </div>
                  <Pill>Non configurés</Pill>
                </div>
                <Notice>
                  Aucune conformité HDS, RGPD ou MDR revendiquée. Le partage professionnel et les
                  organisations ne sont pas activés dans ce sprint.
                </Notice>
              </Panel>
            </div>
          )}
          <footer className="app-footer">
            <span className="brand-mark tiny">
              <i />
              <i />
              <i />
            </span>
            <span>Votre histoire mérite de la clarté.</span>
            <small>Prototype synthétique · ni diagnostic, ni score médical</small>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Navigation mobile">
        {navigation.map((n) => (
          <Link
            key={n.id}
            href={n.path}
            className={view === n.id ? 'active' : ''}
            aria-current={view === n.id ? 'page' : undefined}
          >
            <n.icon size={20} />
            <span>{n.id === 'overview' ? 'Accueil' : n.id === 'sport' ? 'Sport' : n.name}</span>
          </Link>
        ))}
      </nav>
      {record && (
        <>
          <EvidenceModal
            record={record}
            selection={source}
            onClose={() => setSource(null)}
            onCorrected={() => refresh()}
          />
          <ActivityModal
            activity={record.activities.find((a) => a.id === activityId)}
            onClose={() => setActivityId(null)}
          />
        </>
      )}
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => refresh()}
      />
      <Modal
        open={helpOpen}
        onOpenChange={setHelpOpen}
        title="Une vision ambitieuse. Un périmètre clair."
        description="Convergence · premier sprint B2C"
      >
        <div className="help-content">
          <Pill tone="teal">100 % synthétique · local</Pill>
          <p>
            Explorez un même dossier à travers la biologie, le mouvement, les documents et la
            timeline. Les filtres, les graphiques, les sources PDF et l’import structuré de
            démonstration fonctionnent.
          </p>
          <h3>Ce qui n’est pas implémenté</h3>
          <p>
            Authentification réelle, OCR, extraction par IA, synchronisation fabricant, avis
            médical, partage professionnel et paiement.
          </p>
          <Notice>
            Ces écrans sont un prototype descriptif. Aucune donnée de santé réelle ne doit y être
            introduite.{' '}
            {record?.storage === 'postgresql'
              ? 'Les données et les imports de cet espace sont persistés dans PostgreSQL, dans un schéma dédié.'
              : 'Le mode fixtures local est explicitement activé ; les reçus restent des fichiers locaux.'}
          </Notice>
        </div>
      </Modal>
      <Modal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title="Retrouver dans votre histoire"
        description="Rechercher dans les documents et les paramètres du dossier fictif."
      >
        <label className="search-input">
          <Search size={18} />
          <input
            placeholder="Un bilan, un laboratoire, un paramètre…"
            aria-label="Recherche globale"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="search-results">
          {searchDocs.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setSearchOpen(false);
                setSource({ documentId: d.id });
              }}
            >
              <FileText size={18} />
              <span>
                <strong>{d.title}</strong>
                <small>{d.laboratory}</small>
              </span>
              <ArrowUpRight size={15} />
            </button>
          ))}
          {searchBio.map((b) => (
            <button
              key={b.code}
              onClick={() => {
                setSearchOpen(false);
                navigate('biology');
              }}
            >
              <FlaskConical size={18} />
              <span>
                <strong>{b.shortLabel}</strong>
                <small>Explorer dans Biologie</small>
              </span>
              <ArrowRight size={15} />
            </button>
          ))}
          {!searchDocs.length && !searchBio.length && <p>Aucun résultat dans ce dossier.</p>}
        </div>
      </Modal>
    </div>
  );
}
