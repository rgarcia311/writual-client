import { ChatContainer } from '@/components/Chat';
import { ProjectDetailsLayout } from '@/components/ProjectDetailsLayout';

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ProjectDetailsLayout
      floatContentFill
      contentSx={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        height: '100%',
        pl: 0,
        pt: 0,
        // Let the pane shadows render into the layout gutters rather than clipping them.
        overflow: 'visible',
      }}
    >
      <ChatContainer projectId={id} />
    </ProjectDetailsLayout>
  );
}
