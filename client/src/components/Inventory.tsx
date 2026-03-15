import { useState, useMemo } from 'react';
import type { InventoryAura, DuplicateAuraBehavior } from '../api/client';

const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f97316',
  mythic: '#eab308',
};

const RARITY_ORDER: Record<string, number> = {
  mythic: 0,
  legendary: 1,
  epic: 2,
  rare: 3,
  uncommon: 4,
  common: 5,
};

interface InventoryProps {
  auras: InventoryAura[];
  duplicateAuraBehavior: DuplicateAuraBehavior;
  onUpdateDuplicateAuraBehavior: (behavior: DuplicateAuraBehavior) => Promise<void>;
  onClose: () => void;
}

type SortBy = 'obtained' | 'rarity' | 'name';
type FilterRarity = 'all' | string;

export default function Inventory({ auras, duplicateAuraBehavior, onUpdateDuplicateAuraBehavior, onClose }: InventoryProps) {
  const [sortBy, setSortBy] = useState<SortBy>('rarity');
  const [filterRarity, setFilterRarity] = useState<FilterRarity>('all');

  const rarities = useMemo(() => {
    const set = new Set(auras.map((a) => a.rarity));
    return Array.from(set).sort((a, b) => (RARITY_ORDER[a] ?? 6) - (RARITY_ORDER[b] ?? 6));
  }, [auras]);

  const sorted = useMemo(() => {
    let list = filterRarity === 'all' ? [...auras] : auras.filter((a) => a.rarity === filterRarity);
    if (sortBy === 'rarity') {
      list.sort((a, b) => (RARITY_ORDER[a.rarity] ?? 6) - (RARITY_ORDER[b.rarity] ?? 6));
    } else if (sortBy === 'obtained') {
      list.sort((a, b) => new Date(b.obtainedAt).getTime() - new Date(a.obtainedAt).getTime());
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [auras, filterRarity, sortBy]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="inventory-title"
    >
      <div
        className="bg-slate-800 rounded-2xl border border-slate-600 shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-600 bg-slate-800/90">
          <h2 id="inventory-title" className="font-display text-xl font-bold text-amber-400">
            Aura Inventory ({auras.length})
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm font-medium"
          >
            Close
          </button>
        </div>

        <div className="flex flex-wrap gap-3 px-4 py-2 border-b border-slate-600/80 bg-slate-800/50">
          <label className="flex items-center gap-2 text-sm text-slate-400">
            When you roll a duplicate:
            <select
              value={duplicateAuraBehavior}
              onChange={(e) => onUpdateDuplicateAuraBehavior(e.target.value as DuplicateAuraBehavior)}
              className="rounded bg-slate-700 border border-slate-600 text-white px-2 py-1 text-sm"
            >
              <option value="keep">Keep in inventory</option>
              <option value="sacrifice">Sacrifice (more gold)</option>
              <option value="auto">Let game decide</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-400">
            Sort:
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="rounded bg-slate-700 border border-slate-600 text-white px-2 py-1 text-sm"
            >
              <option value="rarity">Rarity</option>
              <option value="obtained">Newest</option>
              <option value="name">Name</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-400">
            Rarity:
            <select
              value={filterRarity}
              onChange={(e) => setFilterRarity(e.target.value as FilterRarity)}
              className="rounded bg-slate-700 border border-slate-600 text-white px-2 py-1 text-sm"
            >
              <option value="all">All</option>
              {rarities.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {sorted.length === 0 ? (
            <p className="text-slate-500 text-center py-12">
              {auras.length === 0 ? 'No auras yet. Roll to collect!' : 'No auras match the filter.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sorted.map((item) => {
                const color = RARITY_COLORS[item.rarity] ?? RARITY_COLORS.common;
                return (
                  <div
                    key={`${item.auraId}-${item.obtainedAt}`}
                    className="rounded-xl border-2 p-3 bg-slate-700/50 hover:bg-slate-700/80 transition"
                    style={{ borderColor: color }}
                  >
                    <p
                      className="text-xs uppercase tracking-wider font-medium mb-1"
                      style={{ color }}
                    >
                      {item.rarity}
                    </p>
                    <h3 className="font-display font-semibold text-white text-lg leading-tight mb-1">
                      {item.name}
                    </h3>
                    <p className="text-slate-400 text-xs mb-2">1 in {item.chance.toLocaleString()}</p>
                    {item.description && (
                      <p className="text-slate-500 text-sm line-clamp-2 mb-2">{item.description}</p>
                    )}
                    <p className="text-slate-500 text-xs">Obtained {formatDate(item.obtainedAt)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
