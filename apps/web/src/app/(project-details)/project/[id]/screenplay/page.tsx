import { ProjectDetailsLayout } from '@/components/ProjectDetailsLayout'
import { WritualEditor } from '@/components/ScreenplayEditor'
import { FeatureGate } from '@/components/Auth/FeatureGate'

export default async function ScreenplayPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <ProjectDetailsLayout
      contentSx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        p: 0,
        pt: 0,
        paddingTop: '0 !important',
        overflow: 'hidden',
      }}
    >
      <FeatureGate minTier="spec" variant="page">
        <WritualEditor projectId={id} />
      </FeatureGate>
    </ProjectDetailsLayout>
  )
}
