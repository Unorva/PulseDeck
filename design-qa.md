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

final result: passed
