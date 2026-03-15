import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../store/AuthContext';
import { roll as rollApi, user as userApi, type RollAura } from '../api/client';
import RollReveal from '../scenes/RollReveal';
import IntroCutscene from '../scenes/IntroCutscene';
import ChatPanel from '../components/ChatPanel';
import Shop from '../components/Shop';
import Inventory from '../components/Inventory';
import { AUTO_ROLL_INTERVAL_MS } from '../game/constants';

const PASSIVE_GOLD_INTERVAL_MS = 30_000;
const USERNAME_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export default function Dashboard() {
  const { user, setGold, refreshUser } = useAuth();
  const [rolling, setRolling] = useState(false);
  const [lastAura, setLastAura] = useState<RollAura | null>(null);
  const [showReveal, setShowReveal] = useState(false);
  const [batchResults, setBatchResults] = useState<RollAura[] | null>(null);
  const [autoRollEnabled, setAutoRollEnabled] = useState(false);
  const [showIntro, setShowIntro] = useState(() => !sessionStorage.getItem('fame-intro-seen'));
  const [showInventory, setShowInventory] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usePotionId, setUsePotionId] = useState<string | ''>('');
  const autoRollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const passiveGoldTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (user?.hasAutoRoll) setAutoRollEnabled(true);
  }, [user?.hasAutoRoll]);

  useEffect(() => {
    const tick = async () => {
      try {
        const res = await userApi.passiveGold();
        if (res.granted > 0) setGold(res.gold);
      } catch {
        // ignore
      }
    };
    const id = setInterval(tick, PASSIVE_GOLD_INTERVAL_MS);
    passiveGoldTimerRef.current = id;
    return () => {
      if (passiveGoldTimerRef.current) clearInterval(passiveGoldTimerRef.current);
    };
  }, [setGold]);

  useEffect(() => {
    if (!autoRollEnabled || !user?.hasAutoRoll || rolling) return;
    const id = setInterval(async () => {
      setRolling(true);
      try {
        const res = await rollApi.single();
        setGold(res.newBalance);
        setLastAura(res.aura);
        setShowReveal(true);
      } catch {
        setRolling(false);
      }
    }, AUTO_ROLL_INTERVAL_MS);
    autoRollTimerRef.current = id;
    return () => {
      if (autoRollTimerRef.current) clearInterval(autoRollTimerRef.current);
    };
  }, [autoRollEnabled, user?.hasAutoRoll, rolling, setGold]);

  const availablePotions = (user?.potionInventory ?? []).filter((p) => p.quantity > 0);

  async function handleRoll(quick: boolean) {
    if (rolling || !user) return;
    const potionId = usePotionId || undefined;
    setRolling(true);
    setBatchResults(null);
    try {
      if (user.hasQuickRoll && quick) {
        const res = await rollApi.batch(10, potionId);
        setGold(res.newBalance);
        setBatchResults(res.results);
        setShowReveal(true);
        setLastAura(res.results[res.results.length - 1] ?? null);
      } else {
        const res = await rollApi.single(potionId);
        setGold(res.newBalance);
        setLastAura(res.aura);
        setShowReveal(true);
      }
      if (potionId) {
        setUsePotionId('');
        refreshUser();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRolling(false);
    }
  }

  function closeReveal() {
    setShowReveal(false);
    setLastAura(null);
    setBatchResults(null);
    setRolling(false);
  }

  const canRoll = user && !rolling;

  const usernameChangedAt = user?.usernameChangedAt ? new Date(user.usernameChangedAt).getTime() : 0;
  const canChangeUsername = Date.now() - usernameChangedAt >= USERNAME_CHANGE_COOLDOWN_MS;
  const daysUntilNextChange = canChangeUsername
    ? 0
    : Math.ceil((USERNAME_CHANGE_COOLDOWN_MS - (Date.now() - usernameChangedAt)) / (24 * 60 * 60 * 1000));

  async function handleChangeUsername(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newUsername.trim();
    if (!trimmed || !user) return;
    setUsernameError('');
    setUsernameLoading(true);
    try {
      await userApi.changeUsername(trimmed);
      await refreshUser();
      setShowUsernameModal(false);
      setNewUsername('');
    } catch (err) {
      setUsernameError(err instanceof Error ? err.message : 'Failed to change username');
    } finally {
      setUsernameLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      {showIntro && (
        <IntroCutscene
          onComplete={() => {
            sessionStorage.setItem('fame-intro-seen', '1');
            setShowIntro(false);
          }}
        />
      )}
      <header className="flex items-center justify-between px-4 py-3 bg-slate-800/80 border-b border-slate-700">
        <h1 className="font-display text-xl font-bold text-amber-400">Fame and Fortune</h1>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowInventory(true)}
            className="text-slate-300 hover:text-amber-400 text-sm font-medium flex items-center gap-1"
          >
            <span className="text-lg">📦</span> Inventory {user?.auras?.length ? `(${user.auras.length})` : ''}
          </button>
          <span className="text-amber-400 font-semibold flex items-center gap-1">
            <span className="text-lg">🪙</span> {user?.gold ?? 0} Gold
          </span>
          <button
            type="button"
            onClick={() => {
              setNewUsername(user?.username ?? '');
              setUsernameError('');
              setShowUsernameModal(true);
            }}
            className="text-slate-400 hover:text-amber-400 text-sm font-medium"
            title="Change username (once per week)"
          >
            {user?.username}
          </button>
          <button
            onClick={() => {
              localStorage.removeItem('token');
              window.location.href = '/login';
            }}
            className="text-slate-400 hover:text-white text-sm"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row p-4 gap-4">
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="bg-slate-800/60 rounded-2xl border border-slate-600 p-8 max-w-md w-full text-center">
            <p className="text-slate-400 mb-4">Rolls are free. You earn 5 Gold per roll.</p>
            {availablePotions.length > 0 && (
              <label className="block mb-3 text-left">
                <span className="text-slate-400 text-sm">Use potion (one roll):</span>
                <select
                  value={usePotionId}
                  onChange={(e) => setUsePotionId(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-slate-700 border border-slate-600 text-white px-3 py-2 text-sm"
                >
                  <option value="">None</option>
                  {availablePotions.map((p) => (
                    <option key={p.potionId} value={p.potionId}>
                      {p.name} (+{p.luckPercent.toLocaleString()}%) ×{p.quantity}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              onClick={() => handleRoll(false)}
              disabled={!canRoll}
              className="w-full py-4 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-slate-900 font-display font-bold text-lg transition"
            >
              {rolling ? 'Rolling...' : 'Roll'}
            </button>
            {user?.hasAutoRoll && (
              <label className="flex items-center gap-2 mt-3 text-slate-300 text-sm">
                <input
                  type="checkbox"
                  checked={autoRollEnabled}
                  onChange={(e) => setAutoRollEnabled(e.target.checked)}
                  className="rounded border-slate-500"
                />
                Auto Roll (every 6s)
              </label>
            )}
            {user?.hasQuickRoll && (
              <button
                onClick={() => handleRoll(true)}
                disabled={!canRoll}
                className="w-full mt-3 py-3 rounded-xl bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-white font-semibold transition"
              >
                Quick Roll (10x){usePotionId ? ' + potion' : ''}
              </button>
            )}
            {lastAura && !showReveal && (
              <p className="mt-4 text-slate-400 text-sm">
                Last: <span className="text-white">{lastAura.name}</span> (1/{lastAura.chance})
              </p>
            )}
          </div>
          <Shop />
        </div>
        <aside className="w-full md:w-80 flex-shrink-0">
          <ChatPanel />
        </aside>
      </main>

      {showReveal && (batchResults ? (
        <RollReveal auras={batchResults} onClose={closeReveal} />
      ) : lastAura ? (
        <RollReveal aura={lastAura} onClose={closeReveal} />
      ) : null)}
      {showInventory && user && (
        <Inventory auras={user.auras} onClose={() => setShowInventory(false)} />
      )}
      {showUsernameModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => !usernameLoading && setShowUsernameModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="username-modal-title"
        >
          <div
            className="bg-slate-800 rounded-xl border border-slate-600 p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="username-modal-title" className="font-display text-lg font-bold text-amber-400 mb-2">
              Change username
            </h2>
            <p className="text-slate-400 text-sm mb-3">Usernames are unique. You can change once per week.</p>
            {!canChangeUsername && (
              <p className="text-amber-400/90 text-sm mb-3">Next change available in {daysUntilNextChange} day(s).</p>
            )}
            <form onSubmit={handleChangeUsername} className="space-y-3">
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="New username"
                minLength={2}
                maxLength={24}
                disabled={!canChangeUsername || usernameLoading}
                className="w-full rounded-lg bg-slate-700 border border-slate-600 text-white px-3 py-2 text-sm placeholder-slate-500 disabled:opacity-50"
                autoFocus
              />
              {usernameError && <p className="text-red-400 text-sm">{usernameError}</p>}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowUsernameModal(false)}
                  disabled={usernameLoading}
                  className="px-3 py-2 rounded-lg text-slate-400 hover:text-white text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canChangeUsername || usernameLoading || newUsername.trim().length < 2}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-900 font-semibold text-sm"
                >
                  {usernameLoading ? 'Saving...' : 'Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
