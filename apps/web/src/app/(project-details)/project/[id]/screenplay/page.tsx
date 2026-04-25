import { ScreenplayView } from './ScreenplayView'

export default async function ScreenplayPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <ScreenplayView projectId={id} />
}
