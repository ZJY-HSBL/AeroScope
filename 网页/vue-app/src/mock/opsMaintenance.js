/** 运维界面 Mock 数据：传感器列表、校准信息等，与 API 出参一致 */

export const mockSensorList = [
  { id: '1', sensorModel: 'BME680', status: 'Online' },
  { id: '2', sensorModel: 'PMS7003', status: 'Online' },
  { id: '3', sensorModel: 'HackRF One', status: 'Online' },
  { id: '4', sensorModel: 'GPS', status: 'Online' },
  { id: '5', sensorModel: 'BME680', status: 'Online' },
  { id: '6', sensorModel: 'PMS7003', status: 'Online' },
]

/** 部分传感器校准浮窗内容（如 HackRF One 行显示） */
export const mockCalibrationTooltips = {
  '3': [
    'Log Code: 08590008885',
    'Log Code: 0000000000',
    'Hex Code: 00 00 00 00 00 07',
    'Hex Code: 00 00 00 00 07 03 00',
    'Log Code: 00 00 00 00',
  ],
}
