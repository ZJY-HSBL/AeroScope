<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { getDeviceStatusList, remoteRestartAllSensors } from '@/api/opsMaintenance.js'

// 运维列表：来自 GET /device/status/list
const sensorList = ref([])
// 行内校准浮窗内容（按设备 id 存储）
const calibrationTooltips = ref({})
const loading = ref(true)
const restartingAll = ref(false)

/** 将接口返回的设备项映射为表格行 { id, sensorModel, status, temperature, lastHeartbeat } */
function mapDeviceStatusToRow(device) {
  return {
    id: device.deviceId ?? '',
    sensorModel: device.model || device.deviceName || device.deviceId || '—',
    status: device.online === true ? 'Online' : 'Offline',
    temperature: device.temperature != null ? device.temperature : '—',
    lastHeartbeat: device.lastHeartbeat || '—',
    _raw: device,
  }
}

// 表格数据
const tableData = computed(() => sensorList.value)

// 获取指定传感器的日志/Hex 说明行
function getCalibrationLines(id) {
  const lines = calibrationTooltips.value[id]
  return Array.isArray(lines) ? lines : []
}

// 点击校准按钮，后续可接入真实校准接口
function onCalibration(row) {
  ElMessage.success(`校准：${row.sensorModel}`)
}

// 查看日志按钮，后续可跳转到日志详情
function onLog(row) {
  ElMessage.success(`查看日志：${row.sensorModel}`)
}

// 远程重启所有传感器
async function onRemoteRestart() {
  try {
    await remoteRestartAllSensors()
    ElMessage.success('已下发远程重启指令')
  } catch (e) {
    ElMessage.error(e?.message || '操作失败')
  }
}

// 页面挂载后：通过 GET /device/status/list 获取列表数据
onMounted(() => {
  getDeviceStatusList()
    .then((list) => {
      sensorList.value = (list || []).map(mapDeviceStatusToRow)
      calibrationTooltips.value = {}
    })
    .catch(() => {
      sensorList.value = []
    })
    .finally(() => {
      loading.value = false
    })
})
</script>

<template>
  <div class="ops-maintenance">
    <h2 class="page-title">设备列表</h2>

    <!-- 主表格：设备列表 - 传感器列表 -->
    <div class="table-wrap">
      <el-table
        :data="tableData"
        :loading="loading"
        class="ops-table"
        stripe
      >
        <el-table-column prop="sensorModel" label="传感器模型" min-width="140" />
        <el-table-column label="状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag
              :type="row.status === 'Online' ? 'success' : 'danger'"
              effect="dark"
              round
            >
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="temperature" label="温度 (°C)" width="120" align="center" />
        <el-table-column prop="lastHeartbeat" label="最后心跳" width="180" align="center" />
        <el-table-column label="校准" width="140" align="center">
          <template #default="{ row }">
            <el-tooltip
              v-if="getCalibrationLines(row.id).length"
              placement="top"
              effect="dark"
              popper-class="ops-calibration-tooltip"
            >
              <template #content>
                <div class="calibration-tooltip-content">
                  <div
                    v-for="(line, i) in getCalibrationLines(row.id)"
                    :key="i"
                    class="calibration-line"
                  >
                    {{ line }}
                  </div>
                </div>
              </template>
              <el-button type="primary" plain size="small" @click="onCalibration(row)">
                校准
              </el-button>
            </el-tooltip>
            <el-button
              v-else
              type="primary"
              plain
              size="small"
              @click="onCalibration(row)"
            >
            校准
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="日志" width="100" align="center">
          <template #default="{ row }">
            <el-button type="primary" plain size="small" @click="onLog(row)">
              日志
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="ops-actions">
      <el-button type="primary" plain class="restart-btn" @click="onRemoteRestart">
        远程重启所有传感器
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.ops-maintenance {
  padding: 1.5rem;
  min-height: 100%;
  background: #0a0e1a;
  color: #e0e8f0;
}

.page-title {
  margin: 0 0 1.5rem;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: #fff;
  text-align: center;
}

.table-wrap {
  background: rgba(8, 12, 24, 0.6);
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 12px;
  overflow: hidden;
  backdrop-filter: blur(8px);
}

.ops-table {
  --el-table-bg-color: transparent !important;
  --el-table-tr-bg-color: transparent !important;
  --el-table-header-bg-color: rgba(0, 212, 255, 0.08) !important;
  --el-table-row-hover-bg-color: rgba(0, 212, 255, 0.06) !important;
  --el-table-border-color: rgba(0, 212, 255, 0.15) !important;
  --el-table-text-color: #e0e8f0 !important;
}

.ops-table :deep(.el-table__header th) {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
}

.ops-table :deep(.el-table__body td) {
  color: #e0e8f0;
}

/* 列表内 Calibration / Log 按钮：深色底 + 青蓝边框 + 浅色字，与主题一致 */
.ops-table :deep(.el-button--primary.is-plain) {
  background: rgba(8, 12, 24, 0.8) !important;
  border-color: rgba(0, 212, 255, 0.6) !important;
  color: #e0e8f0 !important;
}

.ops-table :deep(.el-button--primary.is-plain:hover) {
  background: rgba(0, 212, 255, 0.18) !important;
  border-color: rgba(0, 212, 255, 0.9) !important;
  color: #fff !important;
}

.ops-table :deep(.el-tag--success) {
  background: rgba(34, 197, 94, 0.25);
  border-color: rgba(34, 197, 94, 0.5);
  color: #fff;
}

.ops-actions {
  margin-top: 1.5rem;
  display: flex;
  justify-content: flex-end;
}

/* 底部 Remote Restart 按钮：与列表按钮同风格 */
.restart-btn {
  background: rgba(8, 12, 24, 0.8) !important;
  border-color: rgba(0, 212, 255, 0.6) !important;
  color: #e0e8f0 !important;
}

.restart-btn:hover {
  background: rgba(0, 212, 255, 0.18) !important;
  border-color: rgba(0, 212, 255, 0.9) !important;
  color: #fff !important;
}
</style>

<style>
/* 校准浮窗全局样式（非 scoped，用于 el-tooltip 的 popper） */
.ops-calibration-tooltip {
  background: rgba(12, 20, 40, 0.98) !important;
  border: 1px solid rgba(0, 212, 255, 0.3) !important;
  padding: 0.75rem 1rem !important;
}

.calibration-tooltip-content {
  font-family: ui-monospace, monospace;
  font-size: 0.8rem;
  color: #e0e8f0;
  line-height: 1.6;
}

.calibration-line {
  white-space: nowrap;
}
</style>
