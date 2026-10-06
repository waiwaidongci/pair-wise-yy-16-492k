# 林晚 · 摄影师作品集 + 巡展纪念册打样

React 18 + TypeScript + Vite。两部分：

1. **公开站点**：暗色编辑感摄影作品集（首页 / 作品集 / 系列详情 / 关于 / 联系），全局灯箱。
2. **纪念册打样校对台**（`/proof`、`/prepress`）：断网会场双机校对包在网络恢复后合并成可交接批次。

## 启动

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # tsc --noEmit + vite build
npx vitest run     # 纪念册批次领域规则单测
```

## 目录

```
src/
├── data/photos.ts        # 唯一内容数据源（来自 mock-data/photos.json）
├── state/stores.ts       # 全局灯箱 store（显式传入当前照片范围）+ /work 筛选状态保持
├── components/           # Header/Footer/Lightbox/PhotoCard/PhotoImage
├── pages/                # 5 个公开页 + proof/（校对台、印前清单）
├── proof/                # 纪念册批次：纯领域层（types/derive/merge/validate/factory/store）
└── styles/global.css     # 本地 @font-face，无任何外部字体请求
public/
├── photos/               # mock-data 的 14 张真实照片
└── fonts/                # Inter / Playfair Display / 子集化中文回退字体，全部本地 woff2
```

## 已实现的关键约束

- 筛选状态在 `/work → 系列页 → 返回` 间保持（模块级 store，不随页面卸载丢失）。
- 灯箱上一张/下一张严格限定在打开时传入的照片列表内（筛选后即只在子集循环，计数器 x / N 同步）。
- 图片容器用 `aspect-ratio: width/height` 在加载前撑开真实比例，零 CLS。
- 系列页与网格共用 `photosBySeries/photosByCategory` 派生数据，无重复硬编码。
- 移动端（≤720px）：网格多列瀑布流切单列、汉堡菜单、灯箱说明落到底部条。
- 本地字体，构建后无 `fonts.googleapis.com` / `fonts.gstatic.com` 请求。
- 联系表单：行内校验错误、未通过禁用提交、成功后展示独立成功态。

## 纪念册批次规则

- 两台设备各导出一份校对包（示例见 `src/proof/samples.ts`，校对台可一键导出）；
  网络恢复后成对合并到同一批次：不撞车的直接并入，同一照片的去留/片序/说明两边都改时
  保留两份等待人工确认。
- 照片去留或片序变化 → 跨页、灯箱结果、页数整体失效重算；旧快照归档只读（只追加）。
- 导入失败（坏 JSON / 结构错误 / 批次锁定）不触碰现场，包进恢复区，可修复后按原批次重试。
- 全部冲突确认后批次才能确认，进入印前清单并只读锁定。
