import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import type { RollAura } from '../api/client';

const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f97316',
  mythic: '#eab308',
};

interface RollRevealProps {
  aura?: RollAura;
  auras?: RollAura[];
  onClose: () => void;
}

export default function RollReveal({ aura, auras, onClose }: RollRevealProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const displayAura = aura ?? (auras && auras.length > 0 ? auras[auras.length - 1]! : null);
  const isBatch = auras && auras.length > 1;

  useEffect(() => {
    if (!displayAura || !cardRef.current) return;
    const overlay = overlayRef.current;
    const card = cardRef.current;
    const glow = glowRef.current;
    const color = RARITY_COLORS[displayAura.rarity] ?? '#9ca3af';
    const isRareOrAbove = ['rare', 'epic', 'legendary', 'mythic'].includes(displayAura.rarity);
    const isLegendaryOrMythic = ['legendary', 'mythic'].includes(displayAura.rarity);

    const tl = gsap.timeline({ onComplete: () => setVisible(true) });

    if (isLegendaryOrMythic && overlay && glow) {
      tl.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.3 })
        .to(overlay, { backgroundColor: color, duration: 0.5, ease: 'power2.inOut' })
        .fromTo(card, { scale: 0, rotationY: -90, opacity: 0 }, { scale: 1, rotationY: 0, opacity: 1, duration: 0.8, ease: 'back.out(1.2)' }, '-=0.3')
        .fromTo(glow, { scale: 0.5, opacity: 0 }, { scale: 2, opacity: 0.6, duration: 0.6 }, '-=0.6');
    } else if (isRareOrAbove && overlay && glow) {
      tl.fromTo(overlay, { opacity: 0 }, { opacity: 0.85, duration: 0.2 })
        .fromTo(card, { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'power2.out' }, '-=0.1')
        .fromTo(glow, { scale: 0.8, opacity: 0 }, { scale: 1.5, opacity: 0.4, duration: 0.4 }, '-=0.4');
    } else {
      tl.fromTo(
        card,
        { scale: 0.9, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.4, ease: 'power2.out' }
      );
    }

    return () => { tl.kill(); };
  }, [displayAura]);

  if (!displayAura) return null;

  const color = RARITY_COLORS[displayAura.rarity] ?? '#9ca3af';

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={() => visible && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={cardRef}
        className="relative rounded-2xl bg-slate-800 border-2 p-8 max-w-md w-full shadow-2xl"
        style={{ borderColor: color }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div
          ref={glowRef}
          className="absolute inset-0 rounded-2xl opacity-30 pointer-events-none"
          style={{ background: `radial-gradient(circle at center, ${color}40, transparent 70%)` }}
        />
        <p className="text-slate-400 text-sm uppercase tracking-wider mb-1" style={{ color }}>
          {displayAura.rarity}
        </p>
        <h2 className="font-display text-3xl font-bold text-white mb-2">{displayAura.name}</h2>
        <p className="text-slate-400 text-sm mb-4">1 in {displayAura.chance.toLocaleString()}</p>
        {isBatch && auras && (
          <div className="mb-4 p-3 rounded-lg bg-slate-700/50 max-h-32 overflow-y-auto">
            <p className="text-slate-400 text-xs mb-2">This batch:</p>
            <ul className="text-sm text-white space-y-1">
              {auras.map((a, i) => (
                <li key={i}>{a.name} ({`1/${a.chance}`})</li>
              ))}
            </ul>
          </div>
        )}
        <button
          onClick={onClose}
          disabled={!visible}
          className="w-full py-3 rounded-xl font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ backgroundColor: color, color: displayAura.rarity === 'common' || displayAura.rarity === 'uncommon' ? '#1e293b' : '#fff' }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
