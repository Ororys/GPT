import { notFound } from 'next/navigation';
import { Workspace } from '@/components/workspace';
import type { View } from '@/modules/health-records/model';
export default async function Page({ params }: { params: Promise<{ section?: string[] }> }) {
  const section = (await params).section || [];
  const view = section[0] || 'overview';
  if (
    section.length > 1 ||
    !['overview', 'biology', 'sport', 'documents', 'timeline', 'settings'].includes(view)
  )
    notFound();
  return <Workspace view={view as View} />;
}
