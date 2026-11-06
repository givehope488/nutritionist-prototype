// session_id：匿名档案标识，首次生成 UUID 存 localStorage 并透传到所有需要身份的接口（API.md §0.6）
const STORAGE_KEY = 'cn.session_id';

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // 老 WebView 兜底：不追求密码学强度，只需唯一
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    return (char === 'x' ? rand : (rand & 0x3) | 0x8).toString(16);
  });
}

export function getSessionId(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = generateUuid();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export const sessionId = getSessionId();
