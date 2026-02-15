import { ProjectOverviewContent } from '@/components/ProjectOverviewContent/ProjectOverviewContent';

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectOverviewContent projectId={id} />;
}
