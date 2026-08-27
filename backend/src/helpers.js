export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const monthNameToNumber = (name) => {
  if (!name) return null;
  if (/^\d+$/.test(String(name).trim())) return Number(name);
  const idx = MONTH_NAMES.findIndex(
    (m) => m.toLowerCase() === String(name).trim().toLowerCase()
  );
  return idx >= 0 ? idx + 1 : null;
};

export const pad = (n) => String(n).padStart(2, '0');

// MySQL DATETIME -> ISO "YYYY-MM-DDTHH:mm:ss"
export const toIso = (dt) => {
  if (!dt) return null;
  if (dt instanceof Date) {
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
  }
  const s = String(dt);
  if (s.includes('T')) return s;
  return s.replace(' ', 'T');
};

// MySQL DATE -> "YYYY-MM-DD"
export const toDateStr = (d) => {
  if (!d) return null;
  if (d instanceof Date) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return String(d).slice(0, 10);
};

export const timeToHMS = (t) => {
  if (!t) return null;
  return String(t).slice(0, 8);
};

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Number of days between two dates inclusive
export const diffDays = (from, to) => {
  const f = new Date(from);
  const t = new Date(to);
  const ms = Math.abs(t.getTime() - f.getTime());
  return Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
};

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
