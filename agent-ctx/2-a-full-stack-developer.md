# Task ID 2-a — full-stack-developer

## Task
Build Analytics, SignalControl, and LiveMonitoring section components (replace stubs).

## Inputs Read
- `/home/z/my-project/worklog.md` — full project context (emerald/teal design system, store API, mockData generators, shared UI components)
- `src/app/globals.css` — design tokens (chart-1..5, success, warning, destructive, primary)
- `src/lib/store.ts` — Zustand store (realtimeCams, signalState, signalRec, aiForecast, chartHistory + actions: setSignalMode, setSignalDuration, refreshRealtime)
- `src/lib/constants.ts` — DIRECTIONS, CAMERAS (7), SIGNAL_PHASES, VEHICLE_TYPES, TRAFFIC_LABELS
- `src/lib/mockData.ts` — generateHourlyData, generateWeeklyHeatmap, generateAIForecast, generateSignalCorrelation, trafficMultiplier
- `src/lib/formatters.ts` — formatNumber, formatClockTime, timeAgo
- `src/components/shared/ui.tsx` — StatusBadge, StatCard, SectionCard
- `src/components/shared/IntersectionMap.tsx` — getLightState pattern reused in SignalControl
- `src/components/sections/Dashboard.tsx` — design patterns reference
- shadcn/ui components: dialog, slider, switch, progress, button, tabs

## Files Created/Modified
1. `src/components/sections/Analytics.tsx` (replaced stub)
2. `src/components/sections/SignalControl.tsx` (replaced stub)
3. `src/components/sections/LiveMonitoring.tsx` (replaced stub)

## Implementation Highlights

### Analytics.tsx
- 4 StatCards (total vehicles, peak hour, avg density, AI accuracy)
- recharts stacked AreaChart aggregating `generateHourlyData(1)` by hour for motorbike/car/truck/bus with gradient fills
- 7×24 weekly heatmap (CSS grid, opacity-scaled primary color, peak ring highlight, staggered row entrance)
- AI Forecast panel: LineChart (actual solid + forecast dashed) bridged at last actual point, per-route delta cards, confidence indicators, daysLearned badge
- Vehicle distribution donut: recharts PieChart with center total overlay + side legend
- Signal correlation: recharts ComposedChart — bar (traffic volume, left axis) + 2 lines (greenPhase1/greenPhase2, right axis)
- Custom ChartTooltip with colored dots + tabular nums
- All Framer Motion entrances with stagger

### SignalControl.tsx
- Current phase card: SVG circular progress ring (animated strokeDashoffset), big countdown number with AnimatePresence (key=countdown)
- Mode toggle: Switch + animated icon (Bot/Hand) + status badge
- Phase duration sliders: Slider components (15-90s, step 5s) for phase_1 and phase_2, disabled-style in auto mode
- 4-direction grid: 2x2 with 3-dot traffic light indicator, light state from `getLightState(dirId, signalState)` (active→green/yellow, inactive→red), animated countdown per direction
- AI Recommendations: per-phase cards with currentGreen → suggestedGreen arrow, delta badge, reason text, confidence Progress bar
- Phase history timeline: vertical line with 7 alternating phase transitions, current phase highlighted

### LiveMonitoring.tsx
- Header bar: online/offline counts, LIVE indicator (pulsing red dot), refresh button with spinner
- Summary strip: last update time, total detected vehicles, status
- Camera grid: responsive 1/2/3/4 cols, each card with:
  - Name + location + StatusBadge (pulse if non-green)
  - Simulated video feed (aspect-video): gradient bg, grid overlay, animated scan line (Framer Motion top 0→100%), center crosshair, direction label, REC indicator (ping), timestamp, vehicle count overlay
  - Error overlay: CameraOff icon + shimmer + error message when status=ERROR
  - Click-to-expand button on hover → opens Dialog with iframe
  - Footer: vehicle count + direction short code
- Dialog: large iframe loading camera.url with sandbox/referrerPolicy, graceful fallback (alert circle + open-external-link button) when iframe blocked, status pill overlay, LIVE timestamp

## Design Adherence
- All colors via CSS vars (no blue/indigo)
- Vietnamese text throughout
- `cn()` for conditional classes
- Framer Motion entrance: `initial={{opacity:0, y:10}} animate={{opacity:1, y:0}}` with `delay={i*0.05}` stagger
- SectionCard / StatCard / StatusBadge reused
- Responsive grids mobile-first
- "use client" directive on all 3 files

## Verification
- `bun run lint` — passes clean (no errors, no warnings)
- Dev log shows clean compiles (✓ Compiled in 13.x s) — no errors
- No globals.css, store.ts, constants.ts, or Dashboard.tsx modifications
