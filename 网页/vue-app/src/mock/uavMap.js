/** 频谱热力图 Mock 数据（时频图 / 瀑布图），与 API 出参一致 */

const FREQ_MIN = 88
const FREQ_MAX = 108
const FREQ_STEP = 2
const TIME_ROWS = 50

function buildMockMatrix() {
  const freqCount = (FREQ_MAX - FREQ_MIN) / FREQ_STEP + 1
  const matrix = []
  for (let t = 0; t < TIME_ROWS; t++) {
    const row = []
    for (let f = 0; f < freqCount; f++) {
      const freqM = FREQ_MIN + f * FREQ_STEP
      const dist = Math.abs(freqM - 100.5)
      const peak = Math.max(0, 80 - dist * 25 + (Math.random() - 0.5) * 20)
      const base = 20 + Math.random() * 25
      row.push(Math.min(100, Math.round(peak + base)))
    }
    matrix.push(row)
  }
  return matrix
}

export const mockUavMapData = {
  title: '频谱热力图',
  freqMin: FREQ_MIN,
  freqMax: FREQ_MAX,
  freqStep: FREQ_STEP,
  freqLabels: Array.from({ length: (FREQ_MAX - FREQ_MIN) / FREQ_STEP + 1 }, (_, i) => FREQ_MIN + i * FREQ_STEP),
  timeRowCount: TIME_ROWS,
  /** 热力矩阵 [timeIndex][freqIndex] = RSSI 0~100，红强蓝弱 */
  matrix: buildMockMatrix(),
  /** 红色 T 型游标所在频率 (MHz) */
  cursorFreq: 100.5,
  /** 白色虚线所在频率 (MHz) */
  markerFreq: 103.5,
  rssiRange: [0, 100],
  highlights: [
    '88–108MHz 频段内信号强度随时间与频率的分布。',
    '颜色表示 RSSI：红色为强信号，蓝色为弱信号。',
    '纵轴为时间，横轴为频率，竖条为沿时间的渐变。',
  ],
}
