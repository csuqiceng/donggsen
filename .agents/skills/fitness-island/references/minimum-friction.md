<!--
[INPUT]: 依赖成人体力活动公共指南、行为改变研究、用户真实环境和 Fitness Island 低压力习惯目标
[OUTPUT]: 对外提供最小阻力运动路线的取舍原则、询问规则、复盘规则和参考来源
[POS]: fitness-island references 的可持续运动参考，被 SKILL.md Phase 1 和 Phase 2 调用
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Minimum Friction Fitness

Goal: make exercise easy enough to repeat before making it impressive.

## Evidence anchors

- WHO guideline principle: some activity is better than none; inactive adults
  should begin with small amounts and gradually increase duration, frequency,
  and intensity.
- CDC starting principle: start slowly and work up to more time or more
  challenging activity; people with chronic conditions should check what is
  appropriate with a health professional.
- NIDDK starting principle: begin slowly, build from there, and attach movement
  to ordinary life windows such as after meals or schedule breaks.
- Implementation intention research: specific if-then plans help turn intention
  into action when a person already wants the behavior.
- Action planning and coping planning research: planning the action and the
  obstacle response helps close the gap between wanting to exercise and doing it.

Sources:

- CDC adult activity overview: https://www.cdc.gov/physical-activity-basics/guidelines/adults.html
- CDC getting started: https://www.cdc.gov/healthy-weight-growth/physical-activity/getting-started.html
- WHO physical activity topic: https://www.who.int/health-topics/noncommunicable-diseases/physical-activity
- WHO guidelines on NCBI Bookshelf: https://www.ncbi.nlm.nih.gov/books/NBK566046/
- NIDDK tips for starting physical activity: https://www.niddk.nih.gov/health-information/weight-management/tips-get-active/tips-starting-physical-activity
- Implementation intentions systematic review: https://pubmed.ncbi.nlm.nih.gov/31923898/
- Action and coping planning study: https://pubmed.ncbi.nlm.nih.gov/17553212/

## Design rules

1. Start below capacity.
2. Reduce first, then add.
3. Time first, load second, complexity last.
4. One default place beats three good options.
5. One first action beats a motivational explanation.
6. One visible settlement button beats a daily questionnaire.
7. Reset route is system maintenance, not failure.

## Minimum route

Use this when the user has low time, resistance, missed days, or uncertain
recovery:

```text
Trigger -> Shoes/water -> 5-10 minutes walk or one low-risk machine -> settle
```

Rules:

- It must start within two minutes.
- It must be possible when motivation is low.
- It should preserve continuity without pretending the full route happened.
- It should never produce guilt copy.

## Default route

Use this when the user has normal energy and no warning symptoms:

```text
Warm entry -> main easy work -> optional small strength block -> settle
```

Rules:

- Keep the first week obviously easy.
- Do not train to failure for beginners.
- Prefer walking, fixed machines, low weight, and simple ranges of motion.
- Add only one variable at a time: minutes, then load, then complexity.

## Reset route

Use this after missed days, poor sleep, schedule collapse, travel, or pain
warning:

```text
Minimum route for 1-3 appearances -> review friction -> return to default
```

Rules:

- Do not punish skipped days with extra volume.
- If skipped for time, shrink duration.
- If skipped for dread, shrink the first action.
- If pain appeared, remove the offending movement before adding alternatives.

## If-then plans

Turn vague goals into cue-based defaults:

```text
If it is after dinner, then I put on shoes and walk 8 minutes.
If the gym is crowded, then I use treadmill + one available machine.
If I miss two days, then I do the minimum route next time.
If knee pain appears, then I stop lower-body loading and switch to walking only.
```

Use if-then plans in `MEMORY.md` only when they are stable enough to help next
time.

## Weekly review

Review once per week by reducing friction:

```text
appeared_days:
full_days:
most_stable_action:
weakest_action:
reduce_next_week:
add_next_week:
```

Decision rules:

- If appeared days are low, reduce the first action.
- If full days are low but appeared days are fine, reduce volume.
- If one action is always skipped, remove or replace it.
- If everything was easy five times, add one small step.

## Stop rules

Stop progression and reduce the route when there is sharp joint pain, numbness,
tingling, dizziness, chest pain, faintness, pain that changes movement quality,
or old injury flare-up.
