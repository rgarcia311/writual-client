import { ChatContainer } from '@/components/Chat';
import { ProjectDetailsLayout } from '@/components/ProjectDetailsLayout';

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ProjectDetailsLayout contentSx={{ paddingTop: 2, display: 'flex', height: '100%' }}>
      <ChatContainer projectId={id} />
    </ProjectDetailsLayout>
  );
}
