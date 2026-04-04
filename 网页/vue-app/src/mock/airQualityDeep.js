/** 独立空气质量深度展示 Mock 数据，与 API 出参一致 */

const TIME_POINTS = ['09:00', '12:00', '15:00', '18:00', '21:00']

export const mockAirQualityDeepData = {
  title: '空气检测',
  video: {
    /** 实际对接时替换为真实流媒体地址 */
    url: 'https://player.example.com/stream/demo',
    description: 'Drone Air Quality Video Feed - Real-time',
  },
  wind: {
    speed: 15,
    directionLabel: '西南风',
    /** 风向雷达图：8 个方位的相对风力 */
    directions: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
    values: [4, 6, 8, 10, 7, 5, 3, 2],
  },
  trend: {
    timeAxis: TIME_POINTS,
    /** 折线：PM2.5 / CO / NOx / Temp */
    lineSeries: {
      pm25: [120, 160, 260, 220, 190],
      co: [30, 42, 55, 48, 44],
      nox: [18, 25, 31, 28, 23],
      temp: [22, 24, 23, 21, 20],
    },
    /** 柱状：与截图类似的多彩柱图，单位可视为 AQI 或浓度（与 Temp 折线保持同名） */
    barSeries: [
      { name: 'PM2.5', data: [80, 110, 150, 130, 120] },
      { name: 'CO', data: [20, 25, 28, 26, 24] },
      { name: 'NOx', data: [15, 18, 22, 20, 19] },
      { name: 'Temp', data: [30, 36, 40, 38, 35] },
    ],
  },
}

