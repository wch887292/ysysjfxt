// 格式化工具函数

/** 格式化日期 YYYY-MM-DD HH:mm:ss */
export function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 格式化日期 YYYY-MM-DD */
export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 格式化积分（带正负号） */
export function formatPoints(points) {
  if (points === undefined || points === null) return '-';
  return points > 0 ? `+${points}` : String(points);
}

/** 脱敏手机号：138****1234 */
export function maskPhone(phone) {
  if (!phone) return '-';
  if (phone.length !== 11) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(7);
}