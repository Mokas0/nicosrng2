import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { introCutscene, type CutsceneConfig } from '../config/cutscenes';

interface IntroCutsceneProps {
  onComplete: () => void;
  /** Override config (default: introCutscene). Use for different cutscenes with same component. */
  config?: CutsceneConfig;
}

export default function IntroCutscene({ onComplete, config: configOverride }: IntroCutsceneProps) {
  const config = configOverride ?? introCutscene;
  const containerRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [showSkip, setShowSkip] = useState(false);

  useEffect(() => {
    const tl = gsap.timeline({ onComplete });
    tl.fromTo(containerRef.current, { opacity: 0 }, { opacity: 1, duration: 0.8 });

    config.steps.forEach((step, i) => {
      const el = stepRefs.current[i];
      if (!el) return;
      const duration = step.duration ?? 0.8;
      const ease = (step.ease as gsap.EaseString) ?? 'power2.out';
      const fromY = step.fromY ?? 0;
      const position = step.positionOffset ?? '-=0.2';

      tl.fromTo(
        el,
        { y: fromY, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration,
          ease,
          onComplete: step.showSkipAfter ? () => setShowSkip(true) : undefined,
        },
        position
      );
    });

    const hold = config.holdBeforeFade ?? 1.5;
    const fadeOut = config.fadeOutDuration ?? 0.8;
    tl.to(containerRef.current, { opacity: 0, duration: fadeOut, delay: hold }, `+=1`);

    return () => { tl.kill(); };
  }, [onComplete, config]);

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center pointer-events-auto ${config.overlayClassName ?? 'bg-slate-950'}`}
    >
      {config.steps.map((step, i) => (
        <div
          key={`${config.id}-${i}`}
          ref={(el) => { stepRefs.current[i] = el; }}
          className={step.className}
          style={{ opacity: 0 }}
        >
          {step.type === 'spacer' ? null : step.text}
        </div>
      ))}
      {showSkip && (
        <button
          onClick={onComplete}
          className="mt-8 text-slate-500 hover:text-slate-300 text-sm underline"
        >
          Skip
        </button>
      )}
    </div>
  );
}
