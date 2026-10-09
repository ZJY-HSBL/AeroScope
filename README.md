# AeroScope

**UAV atmospheric and spectrum monitoring dashboard · 无人机大气环境与电磁频谱监测平台**

AeroScope is a Vue 3 monitoring frontend for UAV operations, atmospheric sensing, electromagnetic-spectrum visualization, and device maintenance. It combines operational dashboards, map-based trajectory views, air-quality analysis, spectrum waterfall charts, and local development APIs in one interface.

AeroScope 是一套面向无人机巡检场景的可视化监测前端，聚合无人机运行态势、大气环境监测、电磁频谱分析、轨迹地图与设备运维等功能。

## Features

- Unified operational dashboard / 综合运行看板
- Air-quality monitoring and analysis / 空气质量监测与分析
- UAV map and trajectory visualization / 无人机地图与轨迹可视化
- Spectrum waterfall visualization / 电磁频谱瀑布图
- Device operations and maintenance / 设备运维
- Login and route protection / 登录与路由守卫
- Local mock data and API abstraction / 本地 Mock 与 API 抽象
- WebSocket proxy support for spectrum streaming / 频谱 WebSocket 开发代理

## Tech Stack

- Vue 3
- Vite
- Vue Router
- Element Plus
- ECharts
- Leaflet

## Quick Start

Requirements: Node.js 20.19+ or 22.12+.

```bash
npm ci
npm run dev
```

Production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Architecture

```text
src/
├── api/          # API clients and request helpers
├── assets/       # Shared assets and styles
├── components/   # Reusable UI components
├── layouts/      # Application shell
├── mock/         # Local development data
├── router/       # Routes and authentication guards
└── views/        # Dashboard, air quality, UAV, spectrum and O&M pages
```

Development-only backend and WebSocket traffic is proxied by Vite. The current local proxy target is `http://localhost:8081`; environment-specific endpoints should remain outside application source code.

## Verification

Every push and pull request runs a clean dependency install and production build through GitHub Actions.

## Scope

This repository contains the frontend monitoring application. Backend services, device-side telemetry, authentication infrastructure, and production deployment configuration are separate concerns.
