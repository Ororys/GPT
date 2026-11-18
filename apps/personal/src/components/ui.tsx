'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { X, ArrowUpRight, FileText, Database, Info } from 'lucide-react';
import type { ReactNode } from 'react';
export function Panel({
  children,
  className = '',
  ...props
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={`panel ${className}`} {...props}>
      {children}
    </section>
  );
}
export function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'teal' | 'purple' | 'amber';
}) {
  return <span className={`pill ${tone}`}>{children}</span>;
}
export function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className={`modal ${wide ? 'wide' : ''}`}>
          <div className="modal-head">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="icon-button" aria-label="Fermer">
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Empty({
  title = 'Une histoire à construire',
  text = 'Aucune donnée disponible sur cette période.',
  action,
}: {
  title?: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-icon">
        <Database size={25} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function SourceButton({
  onClick,
  label = 'Voir la source',
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button className="source-button" onClick={onClick}>
      <FileText size={13} />
      {label}
      <ArrowUpRight size={12} />
    </button>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="notice">
      <Info size={14} />
      <span>{children}</span>
    </p>
  );
}
export function Skeleton() {
  return (
    <main className="loading-page" aria-busy="true" aria-label="Chargement du dossier synthétique">
      <div className="skeleton title" />
      <div className="skeleton hero" />
      <div className="skeleton-grid">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="skeleton card" />
        ))}
      </div>
      <div className="skeleton hero" />
    </main>
  );
}
