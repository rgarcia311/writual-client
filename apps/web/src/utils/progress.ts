export type ProgressStatus = 'empty' | 'partial' | 'complete';

export interface ProgressItem {
  label: string;
  status: ProgressStatus;
}

interface ProjectForProgress {
  title?: string | null;
  logline?: string | null;
  activeVersion?: number | null;
  lockedVersion?: number | null;
  // Optional arrays for fallback when stats are missing or not backfilled
  characters?: Array<{ lockedVersion?: number | null }> | null;
  scenes?: Array<{ lockedVersion?: number | null }> | null;
  stats?: {
    totalScenes?: number;
    lockedScenes?: number;
    totalCharacters?: number;
    lockedCharacters?: number;
  } | null;
  treatment?: {
    lockedVersion?: number | null;
    versions?: Array<{ version?: number }> | null;
  } | null;
  screenplay?: {
    lockedVersion?: number | null;
    versions?: Array<{ version?: number }> | null;
  } | null;
}

/**
 * Computes the six progress items for the project card from dashboard project data.
 * Uses stats and version/lock flags only (no full scenes/characters).
 */
export function computeProjectProgress(project: ProjectForProgress | null | undefined): ProgressItem[] {
  if (!project) {
    return [
      { label: 'Title', status: 'empty' },
      { label: 'Logline', status: 'empty' },
      { label: 'Characters', status: 'empty' },
      { label: 'Outline', status: 'empty' },
      { label: 'Treatment', status: 'empty' },
      { label: 'Screenplay', status: 'empty' },
    ];
  }

  const stats = project.stats ?? {};
  const characters = Array.isArray(project.characters) ? project.characters : [];
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];

  const inferredTotalCharacters = characters.length;
  const inferredLockedCharacters = characters.filter((c: any) => c?.lockedVersion != null).length;
  const inferredTotalScenes = scenes.length;
  const inferredLockedScenes = scenes.filter((s: any) => s?.lockedVersion != null).length;

  const totalScenes = stats.totalScenes ?? inferredTotalScenes;
  const lockedScenes = stats.lockedScenes ?? inferredLockedScenes;
  const totalCharacters = stats.totalCharacters ?? inferredTotalCharacters;
  const lockedCharacters = stats.lockedCharacters ?? inferredLockedCharacters;
  const activeVersion = project.activeVersion ?? 1;
  const lockedVersion = project.lockedVersion ?? null;

  const hasTitle = Boolean((project.title ?? '').trim());
  const hasLogline = Boolean((project.logline ?? '').trim());
  const projectMetaLocked =
    lockedVersion != null && activeVersion != null && lockedVersion === activeVersion;

  const titleStatus: ProgressStatus = !hasTitle
    ? 'empty'
    : projectMetaLocked
      ? 'complete'
      : 'partial';
  const loglineStatus: ProgressStatus = !hasLogline
    ? 'empty'
    : projectMetaLocked
      ? 'complete'
      : 'partial';

  const charactersStatus: ProgressStatus =
    totalCharacters === 0
      ? 'empty'
      : lockedCharacters === totalCharacters
        ? 'complete'
        : 'partial';

  const outlineStatus: ProgressStatus =
    totalScenes === 0
      ? 'empty'
      : lockedScenes === totalScenes
        ? 'complete'
        : 'partial';

  const treatmentVersions = project.treatment?.versions ?? [];
  const treatmentHasContent = treatmentVersions.length > 0;
  const treatmentLocked = project.treatment?.lockedVersion != null;
  const treatmentStatus: ProgressStatus = !treatmentHasContent
    ? 'empty'
    : treatmentLocked
      ? 'complete'
      : 'partial';

  const screenplayVersions = project.screenplay?.versions ?? [];
  const screenplayHasContent = screenplayVersions.length > 0;
  const screenplayLocked = project.screenplay?.lockedVersion != null;
  const screenplayStatus: ProgressStatus = !screenplayHasContent
    ? 'empty'
    : screenplayLocked
      ? 'complete'
      : 'partial';

  return [
    { label: 'Title', status: titleStatus },
    { label: 'Logline', status: loglineStatus },
    { label: 'Characters', status: charactersStatus },
    { label: 'Outline', status: outlineStatus },
    { label: 'Treatment', status: treatmentStatus },
    { label: 'Screenplay', status: screenplayStatus },
  ];
}
