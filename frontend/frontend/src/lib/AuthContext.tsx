import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  authenticateAccount,
  registerPhoneAccount,
  type PhoneAccount,
} from '@/lib/accountStore';

/** 用户（本地会话，无真实后端） */
export interface DemoUser {
  id: string;
  /** 邮箱登录时有值；手机号账户为空字符串 */
  email: string;
  name: string;
  avatarUrl: string;
  loginAt: number;
  /** 登录方式（老数据缺省视为 email） */
  loginType?: 'email' | 'phone';
  /** 手机号账户字段 */
  phone?: string;
  username?: string;
}

interface AuthContextValue {
  user: DemoUser | null;
  loading: boolean;
  /** 邮箱 + 密码登录（演示：任意邮箱 + 6 位以上密码） */
  signIn: (email: string, password: string) => Promise<void>;
  /** 手机号注册：一个手机号一个账号，用户名全局唯一 */
  signUpWithPhone: (phone: string, username: string, password: string) => Promise<void>;
  /** 手机号（或用户名）+ 密码登录 */
  signInWithPhone: (identifier: string, password: string) => Promise<void>;
  /** 退出登录 */
  signOut: () => void;
}

const STORAGE_KEY = 'mathlens-demo-user';

const AuthContext = createContext<AuthContextValue | null>(null);

/** 从邮箱推导展示名：math.lens@example.com → Math Lens */
const nameFromEmail = (email: string): string => {
  const local = email.split('@')[0] ?? 'user';
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

/** 基于种子生成稳定的头像（DiceBear API，无需后端） */
const avatarFromSeed = (seed: string): string =>
  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=2563eb,475569&textColor=ffffff`;

const readStoredUser = (): DemoUser | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoUser;
    if (!parsed?.id) return null;
    return parsed;
  } catch {
    return null;
  }
};

/** 手机号账户 → 会话用户 */
const userFromAccount = (account: PhoneAccount): DemoUser => ({
  id: account.id,
  email: '',
  name: account.username,
  avatarUrl: avatarFromSeed(account.username),
  loginAt: Date.now(),
  loginType: 'phone',
  phone: account.phone,
  username: account.username,
});

/** 开发者专属账号（手机号）：开发者模式仅对该账号开放 */
export const DEV_PHONE = '17736095542';

/** 当前登录用户是否为开发者账号 */
export const isDevUser = (user: DemoUser | null): boolean =>
  Boolean(user && user.loginType === 'phone' && user.phone === DEV_PHONE);

/** 侧栏/个人页展示的联系方式：邮箱优先，否则脱敏手机号 */
export const userContact = (user: DemoUser): string => {
  if (user.email) return user.email;
  if (user.phone) return `${user.phone.slice(0, 3)}****${user.phone.slice(-4)}`;
  return '手机号账户';
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // 惰性初始化：渲染前同步恢复会话（刷新后保持登录）
  const [user, setUser] = useState<DemoUser | null>(readStoredUser);
  // 本地会话为同步读取，无异步加载态；保留字段以兼容守卫逻辑
  const loading = false;

  // 多标签页同步：一个标签登出，其他标签同步
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setUser(readStoredUser());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new Error('请输入有效的邮箱地址');
    }
    if (password.length < 6) {
      throw new Error('密码至少需要 6 位字符');
    }
    // 模拟网络请求延迟
    await new Promise((r) => setTimeout(r, 600));
    const demoUser: DemoUser = {
      id: `demo-${btoa(normalized).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`,
      email: normalized,
      name: nameFromEmail(normalized),
      avatarUrl: avatarFromSeed(normalized),
      loginAt: Date.now(),
      loginType: 'email',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demoUser));
    setUser(demoUser);
  }, []);

  const signUpWithPhone = useCallback(
    async (phone: string, username: string, password: string) => {
      const account = await registerPhoneAccount({ phone, username, password });
      const session = userFromAccount(account);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      setUser(session);
    },
    [],
  );

  const signInWithPhone = useCallback(async (identifier: string, password: string) => {
    const account = await authenticateAccount(identifier, password);
    const session = userFromAccount(account);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setUser(session);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signUpWithPhone, signInWithPhone, signOut }),
    [user, loading, signIn, signUpWithPhone, signInWithPhone, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内部使用');
  return ctx;
};
