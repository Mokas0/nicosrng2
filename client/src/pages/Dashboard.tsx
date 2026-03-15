import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../store/AuthContext';
import { roll as rollApi, user as userApi, type RollAura } from '../api/client';
import RollReveal from '../scenes/RollReveal';
import IntroCutscene from '../scenes/IntroCutscene';
import ChatPanel from '../components/ChatPanel';
import Shop from '../components/Shop';

const ROLL_COST = 10;
const PASSIVE_GOLD_INTERVAL_MS = 30_000;

export default function Dashboard() {
  const { user, setGold } = useAuth();
  const [rolling, setRolling] = useState(false);
  const [lastAura, setLastAura] = useState<RollAura | null>(null);
  const [showReveal, setShowReveal] = useState(false);
  const [batchResults, setBatchResults] = useState<RollAura[] | null>(null);
  const [autoRollEnabled, setAutoRollEnabled] = useState(false);
  const [showIntro, setShowIntro] = useState(() => !sessionStorage.getItem('fame-intro-seen'));
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
    if (!autoRollEnabled || !user?.hasAutoRoll || user.gold < ROLL_COST || rolling) return;
    const id = setInterval(async () => {
      if (user.gold < ROLL_COST) return;
      setRolling(true);
      try {
        const res = await rollApi.single();
        setGold(res.newBalance);
        setLastAura(res.aura);
        setShowReveal(true);
      } catch {
        setRolling(false);
      }
    }, 6000);
    autoRollTimerRef.current = id;
    return () => {
      if (autoRollTimerRef.current) clearInterval(autoRollTimerRef.current);
    };
  }, [autoRollEnabled, user?.hasAutoRoll, user?.gold, rolling, setGold]);

  async function handleRoll(quick: boolean) {
    if (rolling || !user || user.gold < ROLL_COST) return;
    setRolling(true);
    setBatchResults(null);
    try {
      if (user.hasQuickRoll && quick) {
        const res = await rollApi.batch(10);
        setGold(res.newBalance);
        setBatchResults(res.results);
        setShowReveal(true);
        setLastAura(res.results[res.results.length - 1] ?? null);
      } else {
        const res = await rollApi.single();
        setGold(res.newBalance);
        setLastAura(res.aura);
        setShowReveal(true);
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

  const canRoll = user && user.gold >= ROLL_COST && !rolling;

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
          <span className="text-amber-400 font-semibold flex items-center gap-1">
            <span className="text-lg">🪙</span> {user?.gold ?? 0} Gold
          </span>
          <span className="text-slate-400 text-sm">{user?.username}</span>
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
            <p className="text-slate-400 mb-4">Each roll costs {ROLL_COST} Gold. You earn 3 Gold per roll.</p>
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
                disabled={!canRoll || user.gold < ROLL_COST * 10}
                className="w-full mt-3 py-3 rounded-xl bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-white font-semibold transition"
              >
                Quick Roll (10x) — {ROLL_COST * 10} Gold
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
    </div>
  );
}
