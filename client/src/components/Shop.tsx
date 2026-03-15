import { useState, useEffect } from 'react';
import { useAuth } from '../store/AuthContext';
import { shop as shopApi, user as userApi, type PotionCatalogItem, type SpecialShopItem } from '../api/client';

const AUTO_ROLL_PRICE = 5000;
const QUICK_ROLL_PRICE = 2500;

export default function Shop() {
  const { user, setGold, setHasAutoRoll, setHasQuickRoll, refreshUser } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [potions, setPotions] = useState<PotionCatalogItem[]>([]);
  const [specialOpen, setSpecialOpen] = useState<boolean | null>(null);
  const [specialEndsAt, setSpecialEndsAt] = useState<string | null>(null);
  const [specialItems, setSpecialItems] = useState<SpecialShopItem[]>([]);

  useEffect(() => {
    shopApi.getPotions().then(setPotions).catch(() => setPotions([]));
  }, []);

  const getQuantity = (potionId: string) =>
    user?.potionInventory?.find((p) => p.potionId === potionId)?.quantity ?? 0;

  async function checkSpecialShop() {
    setError('');
    setLoading('special-check');
    try {
      const status = await shopApi.getSpecialStatus();
      setSpecialOpen(status.open);
      setSpecialEndsAt(status.endsAt ?? null);
      if (status.open) {
        const items = await shopApi.getSpecialItems();
        setSpecialItems(items);
      } else {
        setSpecialItems([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check');
      setSpecialOpen(false);
    } finally {
      setLoading(null);
    }
  }

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

  async function buySpecialPotion(potionId: string) {
    setError('');
    setLoading(`special-${potionId}`);
    try {
      const res = await shopApi.buySpecialPotion(potionId);
      setGold(res.newBalance);
      await refreshUser();
      const items = await shopApi.getSpecialItems();
      setSpecialItems(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setLoading(null);
    }
  }

  async function usePotion(potionId: string) {
    setError('');
    setLoading(`use-${potionId}`);
    try {
      await userApi.usePotion(potionId);
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to use');
    } finally {
      setLoading(null);
    }
  }

  const luckPotions = potions.filter((p) => (p.luck_percent ?? 0) > 0);
  const rollSpeedPotions = potions.filter((p) => (p.duration_minutes ?? 0) > 0 && (p.roll_speed_percent ?? 0) > 0);

  return (
    <div className="mt-8 w-full max-w-md rounded-xl bg-slate-800/60 border border-slate-600 p-6">
      <h2 className="font-display text-lg font-bold text-amber-400 mb-4">Shop</h2>
      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50">
          <div>
            <p className="font-semibold text-white">Auto Roll</p>
            <p className="text-slate-400 text-sm">Roll automatically (speed boosted by buff)</p>
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

        {rollSpeedPotions.length > 0 && (
          <div className="pt-2 border-t border-slate-600">
            <h3 className="font-semibold text-slate-300 mb-3">Roll speed buffs</h3>
            <p className="text-slate-500 text-sm mb-3">+X% roll speed for Y minutes. Use from inventory or here.</p>
            <div className="space-y-2">
              {rollSpeedPotions.map((p) => {
                const qty = getQuantity(p.id);
                const cost = p.gold_cost ?? 0;
                const canBuy = (user?.gold ?? 0) >= cost && loading === null;
                return (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-700/50 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white truncate">{p.name}</p>
                      <p className="text-slate-400 text-xs">
                        +{(p.roll_speed_percent ?? 0)}% speed for {p.duration_minutes} min · {cost.toLocaleString()}g
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {qty > 0 && (
                        <>
                          <span className="text-amber-400 text-xs">×{qty}</span>
                          <button
                            onClick={() => usePotion(p.id)}
                            disabled={loading !== null}
                            className="px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium"
                          >
                            {loading === `use-${p.id}` ? '...' : 'Use'}
                          </button>
                        </>
                      )}
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
        )}

        <div className="pt-2 border-t border-slate-600">
          <h3 className="font-semibold text-slate-300 mb-3">Luck Potions</h3>
          <p className="text-slate-500 text-sm mb-3">Use before a roll for better odds. Rarer auras benefit more.</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {luckPotions.map((p) => {
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

        <div className="pt-2 border-t border-slate-600">
          <h3 className="font-semibold text-purple-300 mb-2">Mystery Special Shop</h3>
          <p className="text-slate-500 text-sm mb-2">Rare shop with cheap high-luck and high roll-speed potions. 10% chance every 24h.</p>
          <button
            type="button"
            onClick={checkSpecialShop}
            disabled={loading !== null}
            className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium"
          >
            {loading === 'special-check' ? 'Checking...' : 'Check if open'}
          </button>
          {specialOpen === true && (
            <div className="mt-3 space-y-2">
              <p className="text-emerald-400 text-sm font-medium">Open! Ends in {specialEndsAt ? Math.ceil((new Date(specialEndsAt).getTime() - Date.now()) / 60000) : '?'} min</p>
              {specialItems.map((p) => {
                const price = p.special_shop_price ?? p.gold_cost ?? 0;
                const canBuy = (user?.gold ?? 0) >= price && !String(loading).startsWith('special-');
                const desc = p.roll_speed_percent ? `+${p.roll_speed_percent}% speed ${p.duration_minutes}min` : `+${(p.luck_percent ?? 0).toLocaleString()}% luck`;
                return (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-purple-900/30 border border-purple-500/50 text-sm">
                    <div>
                      <p className="font-medium text-white">{p.name}</p>
                      <p className="text-slate-400 text-xs">{desc} · {price.toLocaleString()}g</p>
                    </div>
                    <button
                      onClick={() => buySpecialPotion(p.id)}
                      disabled={!canBuy || loading === `special-${p.id}`}
                      className="px-3 py-1.5 rounded bg-purple-500 hover:bg-purple-400 disabled:opacity-50 text-white text-xs"
                    >
                      {loading === `special-${p.id}` ? '...' : 'Buy'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {specialOpen === false && specialItems.length === 0 && loading === null && (
            <p className="mt-2 text-slate-500 text-sm">Not open this time. Try again later (cooldown 24h).</p>
          )}
        </div>
      </div>
    </div>
  );
}
