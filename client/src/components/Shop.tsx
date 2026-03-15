import { useState } from 'react';
import { useAuth } from '../store/AuthContext';
import { shop as shopApi } from '../api/client';

const AUTO_ROLL_PRICE = 5000;
const QUICK_ROLL_PRICE = 2500;

export default function Shop() {
  const { user, setGold, setHasAutoRoll, setHasQuickRoll } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

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

  return (
    <div className="mt-8 w-full max-w-md rounded-xl bg-slate-800/60 border border-slate-600 p-6">
      <h2 className="font-display text-lg font-bold text-amber-400 mb-4">Shop</h2>
      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50">
          <div>
            <p className="font-semibold text-white">Auto Roll</p>
            <p className="text-slate-400 text-sm">Roll automatically every 6 seconds</p>
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
            <p className="text-slate-400 text-sm">Roll 10x at once (10x cost)</p>
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
      </div>
    </div>
  );
}
