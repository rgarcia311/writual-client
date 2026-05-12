export function stripMarkdownJsonWrapper(raw: string): string {
  const match = raw.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  return match ? match[1]! : raw;
}
