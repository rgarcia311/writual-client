'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Box from '@mui/material/Box';
import { usePathname } from 'next/navigation';
import { useWalkthroughStore } from '@/state/walkthrough';
import { WALKTHROUGH_STEPS } from './walkthroughSteps';
import { WalkthroughCard } from './WalkthroughCard';
import { WalkthroughSpotlight } from './WalkthroughSpotlight';
import { useWalkthroughTarget } from './useWalkthroughTarget';
import { useWalkthroughAdvance } from './useWalkthroughAdvance';
import { useWalkthroughPosition } from './useWalkthroughPosition';

export interface WalkthroughOverlayProps {
  /** Called when the tour ends, with whether it ran to the end or was closed part-way. */
  onFinish: (outcome: 'completed' | 'closed') => void;
  /** Called when the user ticks or unticks "Don't show this again". */
  onDontShowAgainChange: (value: boolean) => void;
  dontShowAgain: boolean;
}

/** Above MUI's modal layer (1300), so a step can spotlight a dialog. */
const OVERLAY_Z_INDEX = 1600;

export function WalkthroughOverlay({
  onFinish,
  onDontShowAgainChange,
  dontShowAgain,
}: WalkthroughOverlayProps) {
  const pathname = usePathname();
  const stepIndex = useWalkthroughStore((s) => s.stepIndex);
  const next = useWalkthroughStore((s) => s.next);
  const back = useWalkthroughStore((s) => s.back);

  const step = WALKTHROUGH_STEPS[stepIndex];
  const [cardElement, setCardElement] = React.useState<HTMLElement | null>(null);

  // A step for a page the user is not on can never resolve, so it is passed over rather than
  // stranding the tour. Steps without a route run wherever the user happens to be.
  const routeMismatch = Boolean(step?.route && pathname && !step.route.test(pathname));

  const target = useWalkthroughTarget(routeMismatch ? undefined : step?.target);

  // Nothing here to point at — wrong page, or the element never showed up.
  const unavailable =
    Boolean(step) && (routeMismatch || (Boolean(step?.target) && target.status === 'missing'));
  // The tour has handed control to the user and is watching for what they do next.
  const waiting = Boolean(step?.action) && !unavailable;

  // A step can be left by several routes at once — the watched interaction completing at the same
  // moment its target leaves the DOM, say. This latch keeps the first of them the only one, so a
  // step is never advanced past twice. It resets whenever the step actually changes, including on
  // the way back, so a revisited step can be left again.
  const lastSeenStep = React.useRef(stepIndex);
  const settled = React.useRef(false);
  if (lastSeenStep.current !== stepIndex) {
    lastSeenStep.current = stepIndex;
    settled.current = false;
  }

  // Which way the tour is travelling, so a step that has to be skipped is skipped *past* rather
  // than bounced into again — walking back through an unavailable step must keep going back.
  const direction = React.useRef<1 | -1>(1);
  const leaveStep = React.useCallback(
    (towards: 1 | -1) => {
      if (settled.current) return;
      settled.current = true;
      direction.current = towards;
      if (towards === -1) back();
      else next();
    },
    [back, next],
  );

  const handleNext = React.useCallback(() => leaveStep(1), [leaveStep]);
  const handleBack = React.useCallback(() => leaveStep(-1), [leaveStep]);
  // The watched interaction completed: always forward, whichever way the user was travelling.
  const handleAdvance = React.useCallback(() => leaveStep(1), [leaveStep]);

  useWalkthroughAdvance(waiting ? step?.action : undefined, pathname, handleAdvance);

  const position = useWalkthroughPosition(target.rect, step?.placement, cardElement);

  // Ran off the end of the script.
  React.useEffect(() => {
    if (!step) onFinish('completed');
  }, [step, onFinish]);

  // Step over an unavailable step in whichever direction the tour was already heading.
  React.useEffect(() => {
    if (!unavailable) return;
    if (direction.current === -1 && stepIndex === 0) onFinish('closed');
    else leaveStep(direction.current);
  }, [unavailable, stepIndex, leaveStep, onFinish]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // While a step is waiting on an interaction, Escape belongs to whatever the user opened —
      // closing the create-project dialog with it should complete the step, not end the tour.
      if (event.key === 'Escape' && !waiting) onFinish('closed');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onFinish, waiting]);

  if (!step || unavailable) return null;
  // Hold the overlay back until the target is located, so the card never flashes centre-screen
  // before jumping to the element it describes.
  if (step.target && target.status === 'pending') return null;

  const close = () => onFinish('closed');

  return createPortal(
    <Box sx={{ position: 'fixed', inset: 0, zIndex: OVERLAY_Z_INDEX, pointerEvents: 'none' }}>
      <Box sx={{ pointerEvents: 'auto' }}>
        <WalkthroughSpotlight rect={target.rect} padding={step.spotlightPadding} />
      </Box>
      <Box
        ref={setCardElement}
        sx={{
          position: 'fixed',
          top: position?.top ?? 0,
          left: position?.left ?? 0,
          pointerEvents: 'auto',
          // Kept out of sight until placed, rather than unmounted — floating-ui needs to measure
          // the real card to work out where it goes.
          visibility: position ? 'visible' : 'hidden',
        }}
      >
        <WalkthroughCard
          step={step}
          stepNumber={stepIndex + 1}
          stepCount={WALKTHROUGH_STEPS.length}
          isFirst={stepIndex === 0}
          isLast={stepIndex === WALKTHROUGH_STEPS.length - 1}
          waiting={waiting}
          dontShowAgain={dontShowAgain}
          onDontShowAgainChange={onDontShowAgainChange}
          onBack={handleBack}
          onNext={stepIndex === WALKTHROUGH_STEPS.length - 1 ? () => onFinish('completed') : handleNext}
          onSkipStep={handleNext}
          onClose={close}
        />
      </Box>
    </Box>,
    document.body,
  );
}
