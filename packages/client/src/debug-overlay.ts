import type { NetGame } from './net/net-game';
import type { SimNetworkOptions } from './net/sim-network';

/** Toggle with the backquote key (`). Shows ping, snapshot rate and correction distance. */
export function mountDebugOverlay(net: NetGame, sim: SimNetworkOptions | null): void {
  const box = document.createElement('pre');
  box.id = 'debug';
  box.hidden = true;
  document.body.append(box);
  addEventListener('keydown', (e) => {
    if (e.code === 'Backquote') box.hidden = !box.hidden;
  });
  setInterval(() => {
    if (box.hidden) return;
    const s = net.stats();
    box.textContent = [
      `ping      ~${Math.round(s.pingMs)} ms`,
      `snapshots ${s.snapshotsPerSecond}/s`,
      `correct   ${s.correctionPx.toFixed(1)} px${s.predicting ? '' : ' (not predicting)'}`,
      ...(sim ? [`sim       +${sim.lagMs} ms, ${Math.round(sim.drop * 100)}% drop`] : []),
    ].join('\n');
  }, 250);
}
