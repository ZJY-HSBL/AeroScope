/** 无人机轨迹 + 污染热力图 Mock 数据（供地图页使用） */

function buildTrackPoints() {
  // 无锡附近一段模拟航线（初始中心：118.883E, 31.654N）
  const baseLng = 118.883
  const baseLat = 31.654
  const points = []
  const start = new Date('2026-03-14T13:00:00')
  for (let i = 0; i < 60; i++) {
    const t = new Date(start.getTime() + i * 60 * 1000)
    const angle = i / 10
    // 缩小轨迹扰动范围，保证飞行航线更集中在中心点附近
    // 用 (cos(angle) - 1) 保证 i=0 时经度偏移为 0，起点精确等于 baseLng
    const lng = baseLng + (Math.cos(angle) - 1) * 0.004 + i * 0.00002
    const lat = baseLat + Math.sin(angle) * 0.003 + i * 0.000015
    const altitude = 110 + Math.sin(i / 6) * 18
    points.push({
      time: t.toISOString(),
      longitude: Number(lng.toFixed(6)),
      latitude: Number(lat.toFixed(6)),
      altitude: Number(altitude.toFixed(1)),
    })
  }
  return points
}

function buildHeatPoints() {
  // 以轨迹附近区域生成污染热力点：intensity 0~1
  const centerLng = 118.883
  const centerLat = 31.654
  const pts = []
  for (let i = 0; i < 140; i++) {
    const dx = (Math.random() - 0.5) * 0.12
    const dy = (Math.random() - 0.5) * 0.08
    const lng = centerLng + dx
    const lat = centerLat + dy
    const dist = Math.sqrt(dx * dx + dy * dy)
    const base = Math.max(0, 1 - dist * 10)
    const jitter = (Math.random() - 0.5) * 0.15
    const intensity = Math.max(0, Math.min(1, base + jitter))
    pts.push({ longitude: Number(lng.toFixed(6)), latitude: Number(lat.toFixed(6)), intensity: Number(intensity.toFixed(3)) })
  }
  return pts
}

export const mockUavTrackData = {
  taskId: 'TASK-001',
  flightPath: buildTrackPoints().map((p, i) => ({
    taskId: 'TASK-001',
    longitude: p.longitude,
    latitude: p.latitude,
    altitude: p.altitude,
    speed: Number((8 + Math.random() * 8).toFixed(3)),
    concentration: Number((35 + Math.random() * 90).toFixed(1)),
    pollutionLevel: 2,
    colorCode: '#ADFF2F',
    timestamp: p.time,
    stepNumber: i + 1,
  })),
}

export const mockPollutionHeatmap = {
  heatmap: {
    taskId: 'TASK-001',
    gridPoints: buildHeatPoints().map((p) => ({
      longitude: p.longitude,
      latitude: p.latitude,
      concentration: Number((20 + p.intensity * 150).toFixed(1)),
      pollutionLevel: 2,
      colorCode: '#ADFF2F',
      weight: p.intensity,
    })),
    minConcentration: 20,
    maxConcentration: 170,
    avgConcentration: 85,
    colorMapping: {
      excellentColor: '#00FF00',
      goodColor: '#ADFF2F',
      lightPollutionColor: '#FFFF00',
      moderatePollutionColor: '#FFA500',
      heavyPollutionColor: '#FF0000',
      severePollutionColor: '#8B0000',
    },
  },
}

