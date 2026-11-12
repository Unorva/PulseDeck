# PulseDeck visual and interaction QA

Date: 2026-11-12. Scope: a working, independently implemented recreation of the NEXUS video's visual character and five-mode hardware observatory. This is a visual-effect recreation, not a pixel-identity claim or a reproduction of the author's unavailable source code.

## Evidence and normalization

- Visual target: https://www.douyin.com/video/7705833292104305954 (aterrimus, NEXUS).
- Source inspected in the browser, including the full-screen instrument layout and the parameter drawer around 00:29. Local captures: `artifacts/reference-page.jpg`, `artifacts/reference-desktop.jpg`, `artifacts/reference-video-frame.jpg`.
- Implementation: http://127.0.0.1:4180/ . Desktop viewport: 1440 × 960 CSS pixels, DPR 1. Local screenshots: `artifacts/desktop-threebody.jpg`, `artifacts/desktop-neural.jpg`, `artifacts/desktop-final.jpg`, `artifacts/export-preview.jpg`.
- Narrow-screen check: 390 × 844 CSS pixels, DPR 1; `artifacts/mobile.jpg`. The page scrolls vertically and all five mode controls remain within the viewport; no horizontal page overflow was measured.
- Focused comparison: `artifacts/core-comparison.jpg` (960 × 570). Source and implementation core regions are shown together at comparable circle sizes. Source crop (250,125,435,480) comes from the 1282 × 733 embedded-video capture; implementation crop (90,112,565,554) comes from the 1440 × 960 desktop capture. Aspect ratios are preserved.
- Full-view comparisons used both browser-rendered images together to inspect the header, left circular core, right particle field, metric rail and six monitoring cards. The recorded video has its own embedded viewport, margins and playback overlays; these are not app content and were excluded from fidelity judgments. Particle phase and hardware values differ by design because both are live.
- Screenshots are local working evidence under ignored `artifacts/`; they are not part of the repository's source distribution.

## Required fidelity surfaces

**Typography.** Monospaced instrument typography, restrained weights, widely tracked wordmark and tiny technical labels reproduce the source hierarchy. Consolas/Cascadia use local fallbacks. Numeric readings use smaller unit labels, keeping long network rates legible in narrow rails. PulseDeck/PD replaces the source brand. Detail dialogs provide larger readable readings.

**Spacing and layout.** The source's nearly black, square-cornered instrument panels are retained: thin header, dominant left ring and connected right field, five right-side readouts, 3 × 2 monitoring grid, compact footer. Desktop outer padding is 22px, panel gaps 6–7px. Narrow screens use a 2-column monitoring grid, preserving all controls and a vertically scrollable page.

**Colors and tokens.** Background #050809, low-opacity technical lines, ice cyan/silver highlights and warm secondary particle bands. Four palette controls affect the actual canvas/WebGL drawing as well as UI accents. Load warnings use muted amber. Source compression and differing live loads prevent precise per-pixel color equality.

**Image/render quality.** The reference's central content is a functional particle/network visualization, so it is implemented as a live WebGL particle layer plus a crisp Canvas 2D instrument layer. No screenshot background, stock illustration, placeholder graphic or invented raster asset is used. Standard UI icons use Phosphor. WebGL is optional; Canvas 2D remains available. PNG preview includes both layers and the monitoring panels; the observed export dimensions were 2160 × 1440 for a 1440 × 960 page.

**Content.** Chinese mode names, CPU/memory/GPU/network readings, sampling state and technical captions match the purpose of the reference. Actual readings come from the local system. Unavailable GPU temperature or VRAM statistics show N/A. The README documents each collection interval and the difference between artistic visual motion and a physical simulation.

## Comparison history and resolved findings

1. **[P2] Overly regular network mesh.** Initial implementation looked like a uniform triangulated sphere. Replaced the node distribution with seeded random sphere points, reduced edge density/opacity, retained traveling signals and sparse node glows. Post-fix core comparison shows the source-like irregular constellation structure.
2. **[P2] Dense particle rendering overhead.** The first version drew every particle as a 2D stroke. Added a batched WebGL layer, batched ring/network strokes and preserved 2D fallback. Production browser readings included 79 FPS at 12,000 particles in an active desktop view; frame rate varies with load and background-tab throttling, so this is not a universal performance guarantee.
3. **[P2] Long rate units crowded the metric rail.** Reduced the units separately from the numeric value. Rechecked all five mode buttons and rail readings at 390px width with no horizontal page overflow.
4. **[P2] Network aliases inflated totals.** Filtered duplicate, virtual and tunnel interfaces using metadata and names. Real browser samples now identify the physical interface once. Regression tests cover duplicate aliases, virtual adapters and valid zero rates.
5. **[P2] GPU readings could briefly reset during asynchronous sampling.** GPU results are now replaced atomically after the driver/counter request finishes; unsupported fields remain null. Browser checks confirmed real GPU load while unsupported temperature/VRAM remained N/A.
6. **[P2] Export flow offered no review step.** Added an image preview and a PNG download link. The resulting full-resolution image loaded successfully in the production app. Automated media-download validation was restricted by the browser's data-URL policy; the file-save action remains a manual browser check.

## Interactions and validation

- Clicked all five mode controls; checked each selected state and distinct rendered field.
- Changed speed to 1.1×, particle limit to 24,000 and palette to violet; verified corresponding input values and page accent. Restored defaults afterward.
- Paused/resumed the visual field while real telemetry continued updating.
- Verified keyboard mode switching while a mode button had focus.
- Opened/closed the parameter drawer and memory detail dialog; inspected real data and history.
- Toggled immersive display and confirmed the monitor grid hides/restores.
- Added bounded native-fullscreen handling with immersive fallback for embedded windows.
- Verified screenshot preview and image dimensions. Native download remains a manual environment-limited check.
- Inspected browser warning/error logs: no application errors in the inspected run.
- Production build passed. Nine telemetry tests and four build/hosting tests passed.
- Production server returned HTTP 200 and fresh telemetry with application marker `PulseDeck`; startup error log was empty.

## Follow-up polish and limits

- The source video's exact trajectories and shader equations are unavailable. The five independent visual fields recreate the intended effect and interaction without claiming identical mathematics or identical frames.
- Compact instrument labels intentionally follow the desktop source's density. Mobile detail dialogs provide enlarged readings; this is primarily a desktop observatory.
- Driver-dependent GPU temperature/VRAM support varies. GPU values are never fabricated.
- Source playback overlays and live telemetry differences are excluded from the visual comparison.

## Implementation checklist

- [x] Reference observed and core/full-view comparisons inspected.
- [x] Primary instrument layout and five visual modes implemented.
- [x] Local real telemetry, unavailable states and reconnect behavior implemented.
- [x] Core controls and narrow-screen layout exercised in the browser.
- [x] Production build, appropriate automated checks and startup verified.
- [x] Reproducible startup instructions and Windows launcher supplied.

## 0.4.0 三体引力与 Windows 安装包阶段（2026-11-12）

本轮变更是把三颗小黑洞从"预设轨道 + 粒子独立积分"升级为真实三体运动，并交付 0.4.0 Windows 软件包。

- 物理：三颗黑洞由成对软化牛顿引力驱动，位置与速度随加速度演化（figure-8 初值，G=0.018、坐标缩放 0.42 保持轨道形状）；拖动其中一颗时仅固定该颗，另外两颗继续按引力响应。粒子改为沿三处引力场积分出的 72 条连续流线运动，流线从圆环法线出口出发，弯曲、绕行并终止于捕获点或流场边界。
- 光效：圆环加宽；亮区改为 3 组细密梳状径向光栅；WebGL 粒子改为带柔边的实例化线段，线宽可调（新增"粒子线宽"设置项，1–2.8px）。
- 数据/布局未回退：壁纸展示仍保留右侧五项读数与底部六张监测卡片。
- 数值验证：`npm test` 28 项全部通过，其中新增覆盖"移动一颗黑洞会改变另外两颗的加速度与轨迹""拖动只固定被选黑洞、另外两颗继续响应""默认场景连续 5 分钟保持有限且可见"。
- 渲染抽检：无头 Edge + 真实 D3D11 WebGL，1440×960 DPR1，默认三体场景。未出现黑屏；三颗黑洞清晰可见并带亮环与拖尾；粒子流线连续弯曲、绕行与捕获可见；右侧五项读数与底部六卡完整、无遮挡、无文字溢出；状态栏显示 `12,000 PARTICLES / THREE BODY / CHAOS / WEBGL` 与实时帧率。证据：`artifacts/qa-0.4.0/smoke.png`（本机截图，不纳入版本控制）。首屏前约 6 秒网络读数为 N/A 属遥测预热，之后恢复正常速率。
- 打包验证：`npm run package:win` 生成 `release/PulseDeck-Setup-0.4.0-x64.exe`（122,013,735 B）与 `release/PulseDeck-Portable-0.4.0-x64.exe`（110,963,488 B），blockmap 与 Setup 的块数/总字节一致；内置 `app.asar` 的 version=0.4.0，且与 `dist/client` 新构建逐文件哈希一致，Setup payload 内的 `app.asar` 与 `win-unpacked` 完全相同。`release/win-unpacked/PulseDeck.exe` 启动冒烟通过：原生窗口 `PulseDeck · 设置` 与 `PulseDeck Wallpaper` 正常创建，设置页三体实时预览正常渲染（证据 `artifacts/qa-0.4.0/packaged-0.4.0.png`、`smoke-0.4.0.json`）。
- 安装器交互验证：本轮自动审查不允许在当前会话执行安装器静默安装，因此以 payload 列举、字节/哈希一致与 blockmap 自洽替代；安装向导的点击级验证由用户在交互桌面双击 `PulseDeck-Setup-0.4.0-x64.exe` 完成。
- 限制：本轮只对默认三体场景做抽检；五种模式逐项对比、窄屏布局与真实壁纸层画面未在 0.4.0 重跑；最终画面由用户验收，如有问题在后续提交修正。

final result: passed (0.4.0 视觉与打包抽检通过，最终画面待用户验收)
