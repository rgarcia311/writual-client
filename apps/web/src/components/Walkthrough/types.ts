import type { Placement } from '@floating-ui/dom';

/**
 * How a step hands control to the user instead of showing a Next button. Each variant describes
 * the observable result of the action the copy asks for, so the tour resumes on its own once the
 * user has actually done it.
 */
export type WalkthroughAction =
  /** The user clicks something that navigates; advance when the path matches. */
  | { type: 'navigate'; route: RegExp }
  /** The user opens a modal/panel; advance when that node enters the DOM. */
  | { type: 'appear'; selector: string }
  /** The user closes something the previous step opened; advance when it leaves the DOM. */
  | { type: 'disappear'; selector: string };

export interface WalkthroughStep {
  id: string;
  title: string;
  /** Paragraphs of explanation. Rendered in order, one <p> each. */
  body: string[];
  /**
   * CSS selector for the element to spotlight. Omit for a centred card (welcome/finish).
   * A step whose target never appears is skipped — that is how the tour degrades for users with
   * no projects yet, without needing a separate script.
   */
  target?: string;
  /** Preferred side of the target for the card; flips automatically when it doesn't fit. */
  placement?: Placement;
  /** Extra pixels of breathing room around the spotlight cutout. */
  spotlightPadding?: number;
  /**
   * Route the step belongs to. Checked before the target: a step for a page the user is not on is
   * skipped rather than left hanging on a selector that can never resolve.
   */
  route?: RegExp;
  /** Present on interaction-gated steps; absent steps advance with the Next button. */
  action?: WalkthroughAction;
  /** Prompt shown in place of Next while the tour waits for `action`. */
  actionHint?: string;
}

/** Milliseconds a step waits for its target before deciding the element isn't on this screen. */
export const TARGET_RESOLVE_TIMEOUT_MS = 1500;
