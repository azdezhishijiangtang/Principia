/**
 * 手机号账户注册表（本地演示实现）：
 * - 一个手机号只能注册一个账号；用户名全局唯一（同浏览器内）
 * - 密码只存 SHA-256 哈希，不存明文
 * - 支持手机号或用户名 + 密码登录
 *
 * 说明：纯前端演示站，注册数据保存在当前浏览器的 localStorage；
 * 换浏览器/设备需重新注册。要真正跨设备唯一需后端支撑。
 */

export interface PhoneAccount {
  id: string;
  /** 11 位手机号 */
  phone: string;
  /** 全局唯一用户名 */
  username: string;
  /** SHA-256（hex） */
  passwordHash: string;
  createdAt: number;
  lastLoginAt?: number;
}

const STORAGE_KEY = 'mathlens-phone-accounts-v1';

const readAll = (): PhoneAccount[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PhoneAccount[]) : [];
  } catch {
    return [];
  }
};

const writeAll = (accounts: PhoneAccount[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    /* 存储失败时静默降级 */
  }
};

/* ───────── 校验规则 ───────── */

export const PHONE_RE = /^1[3-9]\d{9}$/;
export const USERNAME_RE = /^[\u4e00-\u9fa5A-Za-z0-9_]{2,16}$/;

/** SHA-256 hex；无 WebCrypto 环境时退化为非加密摘要（仅演示） */
export const hashPassword = async (text: string): Promise<string> => {
  try {
    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
      const buf = await globalThis.crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(text),
      );
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    /* 落入回退 */
  }
  let h1 = 0xdeadbeef ^ text.length;
  let h2 = 0x41c6ce57 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 注册手机号账户。
 * 校验：手机号格式、手机号唯一、用户名格式、用户名全局唯一、密码长度。
 * 抛出带友好提示的 Error。
 */
export const registerPhoneAccount = async (input: {
  phone: string;
  username: string;
  password: string;
}): Promise<PhoneAccount> => {
  const phone = input.phone.trim();
  const username = input.username.trim();
  const password = input.password;

  if (!PHONE_RE.test(phone)) {
    throw new Error('请输入 11 位有效手机号（1 开头的中国大陆号码）');
  }
  if (!USERNAME_RE.test(username)) {
    throw new Error('用户名需 2-16 位，仅支持中文、字母、数字和下划线');
  }
  if (password.length < 6 || password.length > 32) {
    throw new Error('密码长度需在 6-32 位之间');
  }

  const accounts = readAll();
  if (accounts.some((a) => a.phone === phone)) {
    throw new Error('该手机号已注册过账号，可直接登录');
  }
  if (accounts.some((a) => a.username.toLowerCase() === username.toLowerCase())) {
    throw new Error('该用户名已被占用，请换一个试试');
  }

  await delay(500); // 模拟请求
  const account: PhoneAccount = {
    id: `acc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    phone,
    username,
    passwordHash: await hashPassword(password),
    createdAt: Date.now(),
  };
  writeAll([...accounts, account]);
  return account;
};

/** 手机号或用户名 + 密码登录；成功返回账户并更新 lastLoginAt */
export const authenticateAccount = async (
  identifier: string,
  password: string,
): Promise<PhoneAccount> => {
  const id = identifier.trim();
  if (!id) throw new Error('请输入手机号或用户名');
  if (!password) throw new Error('请输入密码');

  const accounts = readAll();
  const account = accounts.find(
    (a) => a.phone === id || a.username.toLowerCase() === id.toLowerCase(),
  );
  if (!account) {
    throw new Error('账号不存在，请先用手机号注册');
  }

  await delay(500);
  const hash = await hashPassword(password);
  if (hash !== account.passwordHash) {
    throw new Error('密码不正确，请重试');
  }

  writeAll(
    accounts.map((a) => (a.id === account.id ? { ...a, lastLoginAt: Date.now() } : a)),
  );
  return account;
};

/** 全部注册账户（注册时间倒序） */
export const listAccounts = (): PhoneAccount[] =>
  [...readAll()].sort((a, b) => b.createdAt - a.createdAt);

/** 注册账户总数 */
export const countAccounts = (): number => readAll().length;
