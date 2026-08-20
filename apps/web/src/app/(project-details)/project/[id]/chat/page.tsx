import { ChatContainer } from '@/components/Chat';
import { ProjectDetailsLayout } from '@/components/ProjectDetailsLayout';

/** Tiles the chat hero shows until the user picks their own from the breadcrumb-bar menu. */
const CHAT_PAGE_STAT_KEYS = ['progress', 'deadlines'] as const;

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ProjectDetailsLayout
      shellClassName="project-details-float-root--chat"
      surfaceBleed
      showFloatStatsRail
      floatStatsRailKeys={[...CHAT_PAGE_STAT_KEYS]}
      // The chat panes scroll internally and end level with the side nav, so the hero stays in
      // flow rather than becoming a sticky band over a scrolling content host.
      floatStatsRailInFlow
      contentSx={{ display: 'flex', minHeight: 0, overflow: 'visible', pl: 0, pt: 0, pb: 0 }}
    >
      <ChatContainer projectId={id} />
    </ProjectDetailsLayout>
  );
}
