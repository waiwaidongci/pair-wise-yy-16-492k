# SOTA 跑测执行轨迹 — 摄影师作品集 + 巡展纪念册打样批次

日期：2026-10-05　最终产出目录：`sota-submission/`（`starter/` 为指向它的软链）

## 1. 交付概览

| 部分 | 内容 |
|---|---|
| 公开站点 | React 18 + TypeScript + Vite，5 个路由 + 1 个全局共享 Lightbox |
| 纪念册打样 | `/proof` 校对台、`/prepress` 印前清单；纯领域层 + localStorage 持久化 |
| 数据 | `mock-data/photos.json` 原样拷贝至 `src/data/photos.json`，照片在 `public/photos/`，未改一字 |
| 字体 | 三份本地 woff2（Inter / Playfair Display 600 / Playfair Display Italic 400）+ 一份按本站用字子集化的文泉驿正黑（中文回退），全部本地 `@font-face`，零外部字体请求 |
| 测试 | Vitest 领域单测 13 个；任务包官方 Playwright 套件 12 个；新增纪念册工作流 e2e 5 个 |

## 2. 环境备忘（无 root 的 arm64 容器）

- 机器为 `aarch64` Debian 12，系统无中文字体、无 chromium 运行库，且无 sudo。
- chromium 运行库：从 `deb.debian.org/debian bookworm binary-arm64` 下载 66 个 deb 解压到家目录
  （/tmp/debs/extract），以 `LD_LIBRARY_PATH=…/usr/lib/aarch64-linux-gnu:…/lib/aarch64-linux-gnu`
  提供给 Playwright Chromium。
- 中文字体：`fonts-wqy-zenhei` 解出 `wqy-zenhei.ttc`，用 fontTools（pip zipapp 装到 /tmp/pylibs）
  按站点实际使用的 712 个中日韩字符子集化为 `wqy-zenhei-subset.woff2`（约 94 KB），放在
  `sota-submission/public/fonts/` 下本地托管。

## 3. 官方验收套件结果（tests/，未改动）

```
12 passed
```

覆盖：routes-render、lightbox-shared-component（含首页精选图入口，缺陷已避免）、
filter-ui-exists、photo-data-fidelity、no-cross-contamination、约束 1–7 全部。

## 4. 纪念册打样批次：业务规则与实现位置

- 领域模型（纯函数，可脱离 React 单测）：`src/proof/types.ts`
- 跨页/灯箱/页数派生与失效归档：`src/proof/derive.ts`
- 双机合并 / 冲突保留两份 / 冲突确认 / 批次确认锁定：`src/proof/merge.ts`
- 断网校对包校验：`src/proof/validate.ts`
- 建批（14 张在册初排）：`src/proof/factory.ts`
- 导入、恢复区、印前清单、持久化：`src/proof/store.ts`
- UI：`src/pages/proof/ProofStation.tsx`、`src/pages/proof/PrepressList.tsx`

规则落实：

1. **双机合并到同一批次**：校对包带 `batchId`，`mergeTwoPackages` 要求两包同批次、不同设备。
   没撞上（不同 photoId，或同照片不同字段）的改动直接并入；同一照片的去留/片序/说明两边都改
   （同 `photoId:field` 键）→ 生成冲突条目，双方原文各存一份，未确认前不改变当前排法。
2. **失效重算、旧记录只读**：只有实际并入的去留/片序改动触发 `recompute`——旧 current 快照标记
   `archived`（只追加、不再变更），新快照重算跨页、灯箱序列与页数（封面 1 页 + 跨页×2，奇数张
   单张跨页补偶数页）。纯文案改动不触发重算。
3. **导入失败可恢复，按原批次继续**：任何 JSON/结构/批次锁定错误都不动现场，包进"导入恢复区"
   （尽力保留解析出的 `batchId`），可直接重试或在文本框修复后重试，沿用原批次 id。
4. **确认后才进印前清单**：存在未决冲突时确认按钮禁用；`confirmBatch` 后批次只读锁定，
   不能再并入/改冲突，并出现在 `/prepress`，可导出付印快照。

## 5. 状态 C 点击序列（lightbox-scoped-navigation）

1. `/work` 点击「牧野」→ 网格只剩 pastoral-01..04；
2. 点击第 2 张 → 灯箱打开，`sota_state_c1.png`：**pastoral-02《坡地牛群》，2 / 4**；
3. 点一次「下一张」→ `sota_state_c2.png`：**pastoral-03《雪山下的歇息》，3 / 4**；
4. 继续连点「下一张」：pastoral-04（4/4）→ pastoral-01（1/4）→ pastoral-02（2/4），
   计数器始终为 x / 4，全程不出现肖像/风光照片。官方 Playwright 用例断言 4 次循环回到起点，通过。

## 6. 截图清单（screenshots/）

- `sota_state_a.png` 首页冷启动；`sota_state_b.png` 牧野筛选；
  `sota_state_c1/c2.png` 灯箱 2/4 → 3/4；`sota_state_d.png` 高原牧歌系列（全页）；
  `sota_state_e.png` 移动端 390×844 单列；`sota_state_e_lightbox.png` 移动端灯箱底部信息条；
  `sota_state_f1/f2.png` 表单校验态 / 成功态。

## 7. 复现方式

```bash
cd sota-submission && npm install && npm run dev      # http://127.0.0.1:5173
npm run build                                          # tsc + vite build 通过
npx vitest run                                         # 13 个领域单测
npx playwright test --config=e2e/playwright.config.ts  # 5 个工作流 e2e
cd ../tests && npm install && npx playwright test      # 官方 12 项（需 chromium 运行库）
```

公开站点之外，纪念册工作流在浏览器中的操作路径：导航「纪念册打样」→ 载入巡演示例批次 →
导出编辑机/印厂机两份校对包（按钮触发下载，内容也写在 `src/proof/samples.ts`）→
联网后在「双机成对合并」选择两个文件 → 确认两处冲突 → 确认批次 → `/prepress` 查看；
另有"导出损坏校对包"可演练恢复区流程。
