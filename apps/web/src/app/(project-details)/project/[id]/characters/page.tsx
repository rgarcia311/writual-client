import { CharactersContent } from '@/components/CharactersContent/CharactersContent';

export default async function CharactersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CharactersContent projectId={id} />;
}
