'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authRequest } from '@/lib/authRequest';
import { STAT_TILE_PREFERENCES_QUERY } from '@/queries/UserQueries';
import { CLEAR_STAT_TILE_PREFERENCE, SET_STAT_TILE_PREFERENCE } from '@/mutations/UserMutations';
import { useUserProfileStore } from '@/state/user';
import {
  ALL_PROJECT_STAT_TILE_KEYS,
  type ProjectStatPageKey,
  type ProjectStatTileKey,
} from '@/components/ProjectFloat/buildProjectStatTiles';

export type StatTilePreferences = Record<string, ProjectStatTileKey[]>;

export const STAT_TILE_PREFERENCES_QUERY_KEY = 'stat-tile-preferences';

/** Drops anything the client no longer renders, so a stale saved key can't blank out a rail. */
function sanitizeKeys(keys: unknown): ProjectStatTileKey[] | null {
  if (!Array.isArray(keys)) return null;
  return ALL_PROJECT_STAT_TILE_KEYS.filter((key) => keys.includes(key));
}

export interface UseStatTilePreferencesOptions {
  /** Page whose choice is being read/written (the key inside `settings.statTilePreferences`). */
  pageKey: ProjectStatPageKey;
  /** Tiles the page shows until the user picks their own. */
  defaultKeys: ProjectStatTileKey[];
  /** Skip the fetch on routes without a stat rail. */
  enabled?: boolean;
}

export interface UseStatTilePreferencesResult {
  /** Tiles to render, in canonical order. */
  selectedKeys: ProjectStatTileKey[];
  setSelectedKeys: (keys: ProjectStatTileKey[]) => void;
  toggleKey: (key: ProjectStatTileKey) => void;
  /** Forgets the saved choice so the page follows `defaultKeys` again. */
  resetToDefault: () => void;
  /** False once the user has saved a choice for this page. */
  isDefault: boolean;
  /** No signed-in user yet — the picker stays hidden rather than saving into nowhere. */
  canPersist: boolean;
}

/**
 * Per-page stat-tile visibility, stored on the user document so a choice follows the account
 * across browsers and sign-outs. The persisted user profile seeds the first paint; the query is
 * the live copy and the mutation returns the full map the server actually stored.
 */
export function useStatTilePreferences({
  pageKey,
  defaultKeys,
  enabled = true,
}: UseStatTilePreferencesOptions): UseStatTilePreferencesResult {
  const queryClient = useQueryClient();
  const userId = useUserProfileStore((s) => s.userProfile?.user ?? null);
  const setUserProfile = useUserProfileStore((s) => s.setUserProfile);
  const storedPreferences = useUserProfileStore(
    (s) => s.userProfile?.settings?.statTilePreferences ?? null,
  );

  const queryKey = React.useMemo(() => [STAT_TILE_PREFERENCES_QUERY_KEY, userId], [userId]);

  const { data } = useQuery({
    queryKey,
    queryFn: async (): Promise<StatTilePreferences> => {
      const result = await authRequest<{
        me: { settings?: { statTilePreferences?: StatTilePreferences | null } | null } | null;
      }>(STAT_TILE_PREFERENCES_QUERY);
      return result.me?.settings?.statTilePreferences ?? {};
    },
    enabled: enabled && Boolean(userId),
    // The last profile sync already carries the saved map, so the rail paints the user's choice
    // immediately instead of flashing page defaults while this request is in flight.
    placeholderData: (storedPreferences as StatTilePreferences | null) ?? undefined,
    staleTime: 5 * 60 * 1000,
  });

  const preferences = data ?? (storedPreferences as StatTilePreferences | null) ?? {};
  const savedKeys = sanitizeKeys(preferences[pageKey]);

  // No saved choice yet: fall back to the page's own tiles, in canonical order.
  const selectedKeys =
    savedKeys ?? ALL_PROJECT_STAT_TILE_KEYS.filter((key) => defaultKeys.includes(key));

  const writePreferences = React.useCallback(
    (next: StatTilePreferences) => {
      queryClient.setQueryData(queryKey, next);
      const { userProfile } = useUserProfileStore.getState();
      if (userProfile) {
        setUserProfile({
          ...userProfile,
          settings: { ...userProfile.settings, statTilePreferences: next },
        });
      }
    },
    [queryClient, queryKey, setUserProfile],
  );

  const { mutate } = useMutation({
    mutationFn: async (keys: ProjectStatTileKey[]) => {
      const result = await authRequest<{ setStatTilePreference: StatTilePreferences | null }>(
        SET_STAT_TILE_PREFERENCE,
        { page: pageKey, statKeys: keys },
      );
      return result.setStatTilePreference ?? {};
    },
    // The server returns the whole map it stored, so the cache converges on it rather than on the
    // optimistic guess written below.
    onSuccess: (serverPreferences) => writePreferences(serverPreferences),
  });

  const { mutate: clearPreference } = useMutation({
    mutationFn: async () => {
      const result = await authRequest<{ clearStatTilePreference: StatTilePreferences | null }>(
        CLEAR_STAT_TILE_PREFERENCE,
        { page: pageKey },
      );
      return result.clearStatTilePreference ?? {};
    },
    onSuccess: (serverPreferences) => writePreferences(serverPreferences),
  });

  const setSelectedKeys = React.useCallback(
    (keys: ProjectStatTileKey[]) => {
      if (!userId) return;
      const cleaned = ALL_PROJECT_STAT_TILE_KEYS.filter((key) => keys.includes(key));
      const previous =
        (queryClient.getQueryData<StatTilePreferences>(queryKey) ?? preferences) || {};
      writePreferences({ ...previous, [pageKey]: cleaned });
      mutate(cleaned, {
        // Put the rail back the way it was if the save never lands.
        onError: (error) => {
          console.error('[useStatTilePreferences] failed to save stat tile choice', error);
          writePreferences(previous);
        },
      });
    },
    [userId, queryClient, queryKey, preferences, writePreferences, pageKey, mutate],
  );

  const toggleKey = React.useCallback(
    (key: ProjectStatTileKey) =>
      setSelectedKeys(
        selectedKeys.includes(key)
          ? selectedKeys.filter((k) => k !== key)
          : [...selectedKeys, key],
      ),
    [selectedKeys, setSelectedKeys],
  );

  const resetToDefault = React.useCallback(() => {
    if (!userId) return;
    const previous = (queryClient.getQueryData<StatTilePreferences>(queryKey) ?? preferences) || {};
    const { [pageKey]: _removed, ...rest } = previous;
    writePreferences(rest);
    clearPreference(undefined, {
      onError: (error) => {
        console.error('[useStatTilePreferences] failed to clear stat tile choice', error);
        writePreferences(previous);
      },
    });
  }, [userId, queryClient, queryKey, preferences, writePreferences, pageKey, clearPreference]);

  return {
    selectedKeys,
    setSelectedKeys,
    toggleKey,
    resetToDefault,
    isDefault: savedKeys === null,
    canPersist: Boolean(userId),
  };
}
