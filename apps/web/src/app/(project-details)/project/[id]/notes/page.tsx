import { NotesContent } from '@/components/NotesContent/NotesContent';

export default async function NotesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <NotesContent projectId={id} />;
}
