// Last War server time is Fernando de Noronha, UTC-2 all year.
export function serverClockState(now = Date.now()) {
  const date = new Date(Number(now) - 2 * 3600000);
  const h = date.getUTCHours(), m = date.getUTCMinutes(), s = date.getUTCSeconds();
  const hour = (h % 12) * 30 + m / 2 + s / 120;
  return { hour, minute: m * 6 + s / 10, second: s * 6,
    danger: Math.max(0, -Math.cos(hour * Math.PI / 180)),
    label: [h,m,s].map(n => String(n).padStart(2,'0')).join(':') + ' ST' };
}
