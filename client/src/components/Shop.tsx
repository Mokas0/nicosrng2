import { useState, useEffect } from 'react';
import { useAuth } from '../store/AuthContext';
import { shop as shopApi, type PotionCatalogItem } from '../api/client';

const AUTO_ROLL_PRICE = 5000;
const QUICK_ROLL_PRICE = 2500;

export default function Shop() {
  const { user, setGold, setHasAutoRoll, setHasQuickRoll, refreshUser } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [potions, setPotions] = useState<PotionCatalogItem[]>([]);

  useEffect(() => {
    shopApi.getPotions().then(setPotions).catch(() => setPotions([]));
  }, []);

  const getQuantity = (potionId: string) =>
    user?.potionInventory?.find((p) => p.potionId === potionId)?.quantity ?? 0;

  async function buyAutoRoll() {
    setError('');
    setLoading('auto');
    try {
      const res = await shopApi.buyAutoRoll();
      setGold(res.newBalance);
      setHasAutoRoll(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setLoading(null);
    }
  }

  async function buyQuickRoll() {
    setError('');
    setLoading('quick');
    try {
      const res = await shopApi.buyQuickRoll();
      setGold(res.newBalance);
      setHasQuickRoll(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setLoading(null);
    }
  }

  async function buyPotion(potionId: string) {
    setError('');
    setLoading(potionId);
    try {
      const res = await shopApi.buyPotion(potionId);
      setGold(res.newBalance);
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mt-8 w-full max-w-md rounded-xl bg-slate-800/60 border border-slate-600 p-6">
      <h2 className="font-display text-lg font-bold text-amber-400 mb-4">Shop</h2>
      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50">
          <div>
            <p className="font-semibold text-white">Auto Roll</p>
            <p className="text-slate-400 text-sm">Roll automatically every 3 seconds</p>
          </div>
          {user?.hasAutoRoll ? (
            <span className="text-green-400 text-sm">Owned</span>
          ) : (
            <button
              onClick={buyAutoRoll}
              disabled={loading !== null || (user?.gold ?? 0) < AUTO_ROLL_PRICE}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-900 font-semibold"
            >
              {loading === 'auto' ? '...' : `${AUTO_ROLL_PRICE} Gold`}
            </button>
          )}
        </div>
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50">
          <div>
            <p className="font-semibold text-white">Quick Roll</p>
            <p className="text-slate-400 text-sm">Roll 10x at once</p>
          </div>
          {user?.hasQuickRoll ? (
            <span className="text-green-400 text-sm">Owned</span>
          ) : (
            <button
              onClick={buyQuickRoll}
              disabled={loading !== null || (user?.gold ?? 0) < QUICK_ROLL_PRICE}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-900 font-semibold"
            >
              {loading === 'quick' ? '...' : `${QUICK_ROLL_PRICE} Gold`}
            </button>
          )}
        </div>

        <div className="pt-2 border-t border-slate-600">
          <h3 className="font-semibold text-slate-300 mb-3">Luck Potions</h3>
          <p className="text-slate-500 text-sm mb-3">Use before a roll for better odds. Rarer auras benefit more.</p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {potions.map((p) => {
              const qty = getQuantity(p.id);
              const cost = p.gold_cost ?? 0;
              const canBuy = (user?.gold ?? 0) >= cost && loading === null;
              return (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-700/50 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white truncate">{p.name}</p>
                    <p className="text-slate-400 text-xs">+{(p.luck_percent ?? 0).toLocaleString()}% luck · {cost.toLocaleString()}g</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {qty > 0 && <span className="text-amber-400 text-xs">×{qty}</span>}
                    <button
                      onClick={() => buyPotion(p.id)}
                      disabled={!canBuy || loading === p.id}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs"
                    >
                      {loading === p.id ? '...' : 'Buy'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
