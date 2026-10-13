import { serverClockState } from './server-clock-core.js';
const clock = document.querySelector('[data-server-clock]');
if (clock) {
  const readout = clock.querySelector('time');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let offset = 0, timer;
  function render() {
    const state = serverClockState(Date.now() + offset);
    for (const name of ['hour','minute','second']) clock.style.setProperty(`--${name}`, `${state[name]}deg`);
    clock.style.setProperty('--slide', `${motion.matches ? 0 : state.danger * 13}px`);
    clock.style.setProperty('--wobble', `${motion.matches ? 0 : 2 + state.danger * 5}deg`);
    readout.textContent = state.label;
  }
  async function sync() {
    const before = Date.now();
    try {
      const response = await fetch('/api/server-clock', {cache:'no-store'});
      if (!response.ok) return;
      const data = await response.json();
      if (Number.isFinite(data.now)) offset = data.now - (before + Date.now()) / 2;
      render();
    } catch { /* The clock keeps working with the device time offline. */ }
  }
  function resume() {
    clearInterval(timer);
    if (document.hidden) return;
    render(); sync();
    timer = setInterval(render,1000);
  }
  document.addEventListener('visibilitychange',resume);
  motion.addEventListener('change',render);
  resume();
}
