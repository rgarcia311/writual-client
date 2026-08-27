import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { NotificationSupport } from '@/lib/desktopNotifications';
import type { PushSupport } from '@/lib/pushNotifications';

interface ChatNotificationsState {
  /**
   * The user's own preference, independent of the browser permission. Both have to be on for a
   * notification to fire: the permission is per-device and survives a sign-out, this is the
   * in-app switch that turns them off without touching browser settings.
   *
   * Off until asked for. Defaulting it on made turning notifications on a no-op write, since the
   * value was already true before the user ever touched the switch.
   */
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  /**
   * The conversation currently open on screen. A message arriving there is already visible, so it
   * gets neither a notification nor a badge increment — the feed marks it read on arrival.
   */
  activeConversationId: string | null;
  setActiveConversationId: (conversationId: string | null) => void;
  /**
   * Whether this device holds a Web Push subscription. When it does, the banner comes from the
   * service worker and the in-page path must stay quiet or the same message rings twice.
   */
  pushSubscribed: boolean;
  setPushSubscribed: (pushSubscribed: boolean) => void;
  /**
   * What this browser can do and what the user has already answered. Both are read from the
   * browser after mount and kept here rather than in component state, so the settings row and the
   * background runtime read one shared answer instead of each probing separately.
   */
  support: PushSupport;
  permission: NotificationSupport;
  setCapabilities: (capabilities: { support: PushSupport; permission: NotificationSupport }) => void;
  /** A permission prompt or subscription round-trip is in flight; the settings row waits it out. */
  busy: boolean;
  setBusy: (busy: boolean) => void;
  /**
   * The user has waved off the in-chat offer to turn notifications on. Persisted, because a prompt
   * that returns on every visit is the reason people block a site outright.
   */
  promptDismissed: boolean;
  setPromptDismissed: (promptDismissed: boolean) => void;
  /**
   * A permission request came back still 'default' — the browser swallowed the prompt rather than
   * showing it. Not persisted: it describes one attempt, and the next page load starts clean.
   */
  promptSuppressed: boolean;
  setPromptSuppressed: (promptSuppressed: boolean) => void;
}

const STORAGE_KEY = 'writual-chat-notifications';

export const useChatNotificationsStore = create<ChatNotificationsState>()(
  persist(
    (set) => ({
      enabled: false,
      setEnabled: (enabled) => set({ enabled }),
      activeConversationId: null,
      setActiveConversationId: (activeConversationId) => set({ activeConversationId }),
      pushSubscribed: false,
      setPushSubscribed: (pushSubscribed) => set({ pushSubscribed }),
      support: 'unsupported',
      permission: 'default',
      setCapabilities: ({ support, permission }) => set({ support, permission }),
      busy: false,
      setBusy: (busy) => set({ busy }),
      promptDismissed: false,
      setPromptDismissed: (promptDismissed) => set({ promptDismissed }),
      promptSuppressed: false,
      setPromptSuppressed: (promptSuppressed) => set({ promptSuppressed }),
    }),
    {
      name: STORAGE_KEY,
      // Only the two user decisions survive a reload. The open conversation belongs to this tab and
      // this moment, and permission, support and the subscription are all re-read from the browser
      // on every start — restoring any of those would act on something that may no longer be true.
      partialize: (state) => ({ enabled: state.enabled, promptDismissed: state.promptDismissed }),
    },
  ),
);
