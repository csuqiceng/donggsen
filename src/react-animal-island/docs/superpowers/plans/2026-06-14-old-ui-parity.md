# Old UI Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the React Animal Island replacement closer to the old static page while preserving old API, saved data, and fixed users.

**Architecture:** Keep existing React state and sync contracts intact. Add derived view models for old-page-only display sections, then render them with animal-island-ui cards styled to old layout proportions.

**Tech Stack:** React, TypeScript, Vite, animal-island-ui, Vitest, in-app Browser QA.

---

### Task 1: Today Page Parity

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Test: `src/domain/training.test.ts`

- [ ] Add helpers for date display, current-day clamping, base overview metrics, hidden clues, and weekly review summaries.
- [ ] Render old-style hero date and progress strip.
- [ ] Re-add base overview between difficulty and route.
- [ ] Re-add hidden clue text and weekly review section.
- [ ] Run `npm test -- src/domain` and `npm run build`.
- [ ] Browser-check `localhost:5173` today view against old `127.0.0.1:8000`.

### Task 2: Collection Page Parity

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/domain/config.ts`
- Test: `src/domain/archive.test.ts`

- [ ] Build a complete collection entry list from items, buildings, decor, gift rules, and hidden tasks.
- [ ] Add filter tabs: `全部 / 材料 / 建筑 / 隐藏 / 礼物`.
- [ ] Render locked entries as `???` with old metadata.
- [ ] Add detail modal content for source and use.
- [ ] Verify collection filters in Browser.

### Task 3: Gift And Coop Parity

**Files:**
- Modify: `src/domain/config.ts`
- Modify: `src/domain/gifts.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Test: `src/domain/gifts.test.ts`

- [ ] Add missing gift rules: welcome-back gift and base-decoration gift.
- [ ] Implement progress calculations for both rules without changing stored shape.
- [ ] Remove repeated gift target text.
- [ ] Rebuild contribution page around weekly goals, settlement ceremony, museum progress, and personal contribution.
- [ ] Verify gift requests and coop tab render in Browser.

### Task 4: Bag And Island Detail Parity

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] Add item source/use text to bag cards.
- [ ] Re-add warehouse strip on island page.
- [ ] Tune island map labels and building status to match old layout density.
- [ ] Verify bag and island mobile layout in Browser.

### Task 5: Navigation And Visual Polish

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] Replace emoji nav symbols with old local SVG icon assets while keeping UI-library button shell.
- [ ] Align card border, shadow, spacing, and selected states with old page.
- [ ] Check mobile viewport for overlap and bottom nav clipping.

### Task 6: Final Verification

**Files:**
- No planned code changes unless verification finds regressions.

- [ ] Run `npm test -- src/domain`.
- [ ] Run `npm run build`.
- [ ] Browser smoke test login, today, island, bag, collection, gift, coop.
- [ ] Compare against old page for remaining visible gaps and report them.
