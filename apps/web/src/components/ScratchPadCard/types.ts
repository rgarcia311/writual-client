export type ScratchPadCardType = 'note' | 'link' | 'image' | 'video';

export type MoveToDestination = 'characters' | 'outline' | 'chat';

export interface ScratchPadCardData {
  id: string;
  type: ScratchPadCardType;
  /** Note: plain text content */
  text?: string;
  /** Link: URL */
  url?: string;
  /** Link: optional display label */
  label?: string;
  /** Image/Video: source URL */
  src?: string;
  /** Image/Video: optional caption */
  caption?: string;
}

export interface ScratchPadCardProps {
  data: ScratchPadCardData;
  onMoveTo?: (destination: MoveToDestination) => void;
  onDelete?: () => void;
}
