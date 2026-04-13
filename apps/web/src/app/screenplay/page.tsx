import { redirect } from 'next/navigation'

/**
 * Screenplay editing lives under /project/[id]/screenplay.
 * This entry avoids a bare 404 for /screenplay (bookmarks, typos, old links).
 */
export default async function ScreenplayEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; id?: string }>
}) {
  const { project, id } = await searchParams
  const projectId = project ?? id
  if (projectId) {
    redirect(`/project/${projectId}/screenplay`)
  }
  redirect('/projects')
}
