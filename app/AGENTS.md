# Prototype Instructions

## Accepted product direction (2026-11-12)

- PulseDeck is a Windows desktop application, not only a browser dashboard.
- The user confirmed an animated desktop wallpaper behind desktop icons, with a separate settings/control window and an optional regular display window.
- Keep the wallpaper presentation clean: no parameter drawer, toolbar, buttons, or alerts over the animation. Configure it from the application or tray.
- Ring interiors must resemble the supplied NEXUS video: irregular neural filaments, traveling luminous signals, subtle depth and localized bright computation sectors.
- The circular core and particle field must be visibly connected, including pointer/drag/click reactions and continuous signal discharge from the ring into the field.
- Complete each meaningful stage with a Git commit and push to the existing Unorva/PulseDeck repository. Stage explicit source/document paths; keep screenshots, local logs, build output and telemetry out of commits.
- Latest correction: retain the original bottom six monitoring cards and right-side metric cards in the desktop wallpaper. Clean display means controls stay in Settings; it does not mean removing telemetry cards.
- The three small black holes must attract, bend and capture particles. Use actual shared acceleration, not decorative circles or only preset paths.
- The computation ring should be slightly wider, with fine radial streamlines perpendicular to the rim and continuous normal-direction discharge into the field.
- Black holes must be larger and mutually attract each other. Their positions and velocities evolve from pairwise forces; dragging one changes the other two trajectories as well as the particle field.
- Particle strokes need visible, soft thickness and continuous curved flow. Avoid fixed laser outlets, synchronized emission packets, and disconnected bright spray.
- Latest correction (2026-11-13): desktop wallpaper must visibly render; CPU drives its particle group's speed, memory drives density, GPU and each network direction drive their own speed/density. Match all five groups to the right-hand cards with shared colors. Remove the central English lettering and opaque label plate from the left neural sphere.
- Latest correction: confine the mutually attracting black holes to a bounded central region, including after dragging. Render dark horizons with soft halos, without orbit trails or tilted planetary rings. Particles themselves must travel continuously from the left ring, through the black-hole field, and into their matching metric card; do not draw separate connector lines. Match the wallpaper client surface to each selected monitor's physical full-screen bounds, including mixed DPI, negative screen coordinates and invisible window frame insets; remove wallpaper page gutters and maximum-width limits.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
