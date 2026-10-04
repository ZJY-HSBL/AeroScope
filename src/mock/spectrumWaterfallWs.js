/**
 * 频谱瀑布流 WebSocket 帧的本地模拟（仅开发阶段后端未提供 /ws/spectrum 时使用）
 * 与页面约定的 payload：{ type, t, start_hz, end_hz, bins }
 */

const BIN_COUNT = 800

/** 生成一帧 spectrum_frame */
export function generateSpectrumFrame(timeMs = Date.now()) {
  const bins = []
  const t = timeMs / 1000
  const center = BIN_COUNT / 2 + Math.sin(t * 0.7) * 80
  for (let i = 0; i < BIN_COUNT; i++) {
    const dist = Math.abs(i - center) / (BIN_COUNT * 0.15)
    const base = Math.exp(-dist * dist) * 220
    const noise = Math.random() * 35
    bins.push(Math.round(Math.min(255, base + noise)))
  }
  return {
    type: 'spectrum_frame',
    t: timeMs,
    start_hz: 2.4e9,
    end_hz: 2.5e9,
    bins,
  }
}
