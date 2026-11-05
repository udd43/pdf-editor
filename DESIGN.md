# Design System (`DESIGN.md`)

## Aesthetic Direction
- **Archetype**: High-Craft Neutral Functional Workspace (Linear / Raycast / Figma inspired precision UI)
- **Anti-Slop Commitments (Impeccable Standard)**:
  - No purple-to-blue or neon gradients (`ai-color-palette`)
  - No warm cream/beige default AI backgrounds (`cream-palette`)
  - No eyebrow chips or tracked uppercase kickers above headings (`kicker-above-heading`, `hero-eyebrow-chip`)
  - No repetitive numbered chapter labels (`numbered-section-labels`)
  - No stacked icon tiles above headings (`icon-tile-stack`) — icons always sit inline beside headings
  - No thick left-border accents on cards (`side-tab`)
  - No cards nested inside cards (`nested-cards`)
  - No functional UI text below 12px (`undersized-ui-text`)
  - No bounce or elastic animations (`bounce-easing`)

## Color Palette
- **Light Mode**:
  - Canvas Background: `#F8F9FB` (Cool Alabaster Slate)
  - Elevated Surface: `#FFFFFF` (Pure Surface)
  - Recessed Well / Muted Surface: `#F1F3F7`
  - Hairline Border: `#E2E6EE`
  - Strong Border: `#CBD2E0`
  - Primary Ink: `#0F141C`
  - Secondary Ink: `#4B5565`
  - Muted Ink: `#697586`
  - Primary Accent: `#2563EB` (Hover: `#1D4ED8`)
  - Danger / Redaction Accent: `#DC2626`
- **Dark Mode**:
  - Canvas Background: `#0B0D11` (Obsidian Slate)
  - Elevated Surface: `#12151C`
  - Recessed Well / Muted Surface: `#181C26`
  - Hairline Border: `#232936`
  - Strong Border: `#333B4D`
  - Primary Ink: `#F3F5F8`
  - Secondary Ink: `#94A0B8`
  - Muted Ink: `#647087`
  - Primary Accent: `#3B82F6` (Hover: `#2563EB`)

## Typography
- **Font Family**: `"NotoSansKR", -apple-system, BlinkMacSystemFont, system-ui, sans-serif`
- **Monospace**: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
- **Size Scale**:
  - Display / H1: `28px` – `32px` (`text-2xl` to `text-3xl`), `font-bold`, `tracking-tight`, `text-wrap: balance`
  - Section H2: `18px` – `20px` (`text-lg` to `text-xl`), `font-semibold`, `tracking-tight`
  - Card H3: `15px` – `16px` (`text-base`), `font-semibold`
  - Body Copy: `14px` (`text-sm`), `leading-relaxed` (`1.6`), `text-wrap: pretty`
  - UI Controls / Labels / Meta: `12px` (`text-xs`) minimum floor

## Radius & Elevation
- **Radius Scale**: `6px` (`rounded-md`), `8px` (`rounded-lg`), `12px` (`rounded-xl`)
- **Elevation**: Crisp `1px` borders (`#E2E6EE` / `#232936`) with subtle background shift on hover instead of heavy drop shadows.

