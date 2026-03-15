import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

interface IntroCutsceneProps {
  onComplete: () => void;
}

export default function IntroCutscene({ onComplete }: IntroCutsceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const [showSkip, setShowSkip] = useState(false);

  useEffect(() => {
    const tl = gsap.timeline({ onComplete });
    tl.fromTo(containerRef.current, { opacity: 0 }, { opacity: 1, duration: 0.8 })
      .fromTo(titleRef.current, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'power2.out' }, '-=0.4')
      .fromTo(subRef.current, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power2.out', onComplete: () => setShowSkip(true) }, '-=0.5')
      .to(containerRef.current, { opacity: 0, duration: 0.8, delay: 1.5 }, '+=1');
    return () => { tl.kill(); };
  }, [onComplete]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950 pointer-events-auto"
    >
      <h1 ref={titleRef} className="font-display text-5xl md:text-6xl font-bold text-amber-400 mb-4">
        Fame and Fortune
      </h1>
      <p ref={subRef} className="text-slate-400 text-lg">
        Roll the dice. Claim your aura.
      </p>
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
