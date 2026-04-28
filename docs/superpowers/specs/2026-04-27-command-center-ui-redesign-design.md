# Command Center UI Redesign Design

## Goal

Redesign the multi-agent command center UI using the supplied `C:\Users\micha\Downloads\design.md` guide while preserving the existing Electron, React, IPC, data, task, approval, and runner behavior.

## Product Direction

The app becomes a premium "Mission Studio": an asymmetric operations workspace with a light off-white base, charcoal text, one muted teal accent, deliberate empty space, and live command-center motion. The first screen must feel like a usable tool, not a landing page: mission state, command input, one-click tasks, approvals, agents, usage, and activity stay directly accessible.

## Visual System

- Use plain CSS in the existing renderer; do not introduce Tailwind or new UI libraries.
- Use a high-quality sans-serif stack: Geist/Satoshi/Outfit-style fallbacks before system UI.
- Use one accent color only: a muted teal/blue under 80% saturation.
- Avoid banned patterns from the design guide: centered generic hero, AI purple-blue gradients, neon glows, pure black, emojis, circular spinners, custom cursors, and generic equal card grids.
- Use major rounded surfaces, subtle slate borders, light diffusion shadows, and divide-line/table/list structure where density matters.
- Use `lucide-react`, already installed, as the single icon family.

## Layout

The mission view uses an asymmetric CSS Grid:

- Header command bar with mission title, goal, status pill, refresh action, and compact command-style field.
- Horizontal metric rail for active runs, approvals, tokens, and estimated cost.
- Left rail for mission creation or one-click task launchers.
- Primary column for tasks and approvals.
- Right rail for agent roster and significant events.

Secondary tabs keep the same shell but inherit the redesigned surface system for tables, metrics, and empty states.

## Motion And States

Motion is CSS-only and restricted to transform/opacity, box-shadow changes, and opacity-based shimmer. Buttons get tactile active states. Status indicators breathe subtly. Loading uses a skeleton-style notice rather than a spinner. All perpetual motion must respect `prefers-reduced-motion`.

## Accessibility And Responsiveness

Remove the existing hard desktop minimum width. Layouts collapse to a single column on small screens with safe padding. Form labels remain above inputs. Focus styles stay visible. Tables become horizontally scrollable instead of overflowing the viewport.

## Testing

Existing behavior tests should continue to pass. Verification consists of `npm test`, `npm run typecheck`, `npm run build`, and launching the dev app to check that Electron starts with the redesigned renderer.
