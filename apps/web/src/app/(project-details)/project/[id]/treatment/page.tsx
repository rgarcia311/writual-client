import { ProjectDetailsLayout } from '@/components/ProjectDetailsLayout';
import { Treatment } from '@/components/Treatment';

export default async function TreatmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;
  return (
    <ProjectDetailsLayout
      headerTitle="Treatment"
      contentSx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      <Treatment />
    </ProjectDetailsLayout>
  );
}
