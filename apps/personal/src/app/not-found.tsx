import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="empty-state">
      <h1>Ce chapitre n’existe pas.</h1>
      <p>Revenez à votre vue d’ensemble pour retrouver votre histoire.</p>
      <Link className="button primary" href="/">
        Retour à mon espace
      </Link>
    </main>
  );
}
