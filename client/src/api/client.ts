const API = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
  return data as T;
}

export interface UserMe {
  id: string;
  username: string;
  gold: number;
  hasAutoRoll: boolean;
  hasQuickRoll: boolean;
  auras: { auraId: string; obtainedAt: string }[];
}

export interface RollAura {
  id: string;
  name: string;
  rarity: string;
  chance: number;
  visualId: string;
  description: string;
}

export interface RollResponse {
  aura: RollAura;
  newBalance: number;
  goldEarned: number;
  firstTime: boolean;
}

export const auth = {
  register: (_username: string, _password: string) =>
    Promise.reject(new Error('Use Supabase auth – register via AuthContext')),
  login: (_username: string, _password: string) =>
    Promise.reject(new Error('Use Supabase auth – login via AuthContext')),
};

export const user = {
  me: () => api<UserMe>('/user/me'),
  passiveGold: () => api<{ gold: number; granted: number }>('/user/passive-gold', { method: 'POST' }),
};

export const roll = {
  single: () => api<RollResponse>('/roll', { method: 'POST' }),
  batch: (count: number) =>
    api<{ results: RollAura[]; newBalance: number; goldEarned: number }>('/roll/batch', {
      method: 'POST',
      body: JSON.stringify({ count }),
    }),
};

export const shop = {
  buyAutoRoll: () =>
    api<{ success: boolean; newBalance: number; hasAutoRoll: boolean }>('/shop/buy-auto-roll', { method: 'POST' }),
  buyQuickRoll: () =>
    api<{ success: boolean; newBalance: number; hasQuickRoll: boolean }>('/shop/buy-quick-roll', { method: 'POST' }),
};
