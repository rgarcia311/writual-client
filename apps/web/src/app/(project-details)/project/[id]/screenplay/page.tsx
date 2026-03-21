import { ProjectDetailsLayout } from '@/components/ProjectDetailsLayout'
import { WritualEditor } from '@/components/ScreenplayEditor'

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
      <WritualEditor projectId={id} />
    </ProjectDetailsLayout>
  )
}
