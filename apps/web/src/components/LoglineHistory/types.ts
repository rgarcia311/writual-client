import type { LoglineVersion } from '@/interfaces/logline';
import type { ProjectAccess } from '../../utils/projectPermissions';

/** Everything the panel needs to render and mutate a project's logline history. */
export interface LoglineHistoryHandlers {
  onAddVersion: (text: string) => void;
  onUpdateVersion: (versionId: string, text: string) => void;
  onDeleteVersion: (versionId: string) => void;
  onMakeCurrent: (versionId: string) => void;
  onAddFeedback: (versionId: string, text: string) => void;
  onDeleteFeedback: (versionId: string, feedbackId: string) => void;
}

export interface LoglineHistoryViewProps extends LoglineHistoryHandlers {
  versions: LoglineVersion[];
  /** `project.logline`, shown read-only when nothing has been written to the history yet. */
  currentLogline: string;
  access: ProjectAccess;
  /** Signed-in viewer, so they can delete their own feedback. */
  viewerUid: string | null;
  isPending?: boolean;
  errorMessage?: string | null;
  /** Tighter layout for the stat tile; the dialog uses the roomy version. */
  dense?: boolean;
}

/** Character limits, matching the API's validation in `LoglineService`. */
export const MAX_LOGLINE_LENGTH = 1000;
export const MAX_FEEDBACK_LENGTH = 2000;

/** Short, locale-aware date for an entry or a feedback note. */
export function formatEntryDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
