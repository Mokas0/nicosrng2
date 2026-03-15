/**
 * Cutscene layout config – edit this file to change intro (and other) cutscene
 * content, order, and timing without touching the cutscene components.
 */

export type CutsceneStepType = 'title' | 'subtitle' | 'text' | 'spacer';

export interface CutsceneStep {
  type: CutsceneStepType;
  /** Main text content (e.g. title or subtitle) */
  text: string;
  /** Optional CSS class for the element */
  className?: string;
  /** Delay in seconds before this step starts (from timeline start) */
  delay?: number;
  /** Duration of the in-animation in seconds */
  duration?: number;
  /** Ease for the animation */
  ease?: string;
  /** Offset from previous step: negative = overlap with previous (e.g. "-=0.4") */
  positionOffset?: string;
  /** Starting Y offset for animation (px). Animates from (y, opacity 0) to (0, opacity 1) */
  fromY?: number;
  /** If true, skip button is shown when this step's animation completes */
  showSkipAfter?: boolean;
}

export interface CutsceneConfig {
  /** Unique id for this cutscene (e.g. "intro") */
  id: string;
  /** Steps in order; timing is applied in sequence */
  steps: CutsceneStep[];
  /** Total time before fade-out starts (seconds) */
  holdBeforeFade?: number;
  /** Fade-out duration (seconds) */
  fadeOutDuration?: number;
  /** Show skip button after this many seconds (from start) */
  skipButtonAfter?: number;
  /** Optional background color / class for the overlay */
  overlayClassName?: string;
}

/** Intro cutscene – edit steps and timing here */
export const introCutscene: CutsceneConfig = {
  id: 'intro',
  overlayClassName: 'bg-slate-950',
  holdBeforeFade: 1.5,
  fadeOutDuration: 0.8,
  skipButtonAfter: 2.2,
  steps: [
    {
      type: 'title',
      text: 'Fame and Fortune',
      className: 'font-display text-5xl md:text-6xl font-bold text-amber-400 mb-4',
      duration: 1,
      ease: 'power2.out',
      positionOffset: '-=0.4',
      fromY: 40,
    },
    {
      type: 'subtitle',
      text: 'Roll the dice. Claim your aura.',
      className: 'text-slate-400 text-lg',
      duration: 0.8,
      ease: 'power2.out',
      positionOffset: '-=0.5',
      fromY: 20,
      showSkipAfter: true,
    },
  ],
};
