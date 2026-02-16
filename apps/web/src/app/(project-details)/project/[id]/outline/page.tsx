import { OutlineContent } from '@/components/OutlineContent/OutlineContent';

export default async function OutlinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OutlineContent projectId={id} />;
}
