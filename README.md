# UAV Monitoring Dashboard

面向无人机与环境监测场景的 Vue 3 可视化前端。项目采用 Vite、Vue Router、Element Plus、ECharts 与 Leaflet，包含登录、综合看板、空气质量、设备运维、无人机轨迹和频谱瀑布图等页面。

## Development

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

## Architecture

- `src/api/`：后端请求与本地 mock 数据接口。
- `src/layouts/`：应用级页面框架。
- `src/router/`：路由与登录状态守卫。
- `src/views/`：业务页面。
- `src/mock/`：本地开发数据。

Repository-local IDE settings, generated logs, duplicate package manifests, and unused Vue starter components are intentionally excluded.
