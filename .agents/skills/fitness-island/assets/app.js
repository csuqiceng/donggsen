/*
[INPUT]: 依赖 index.html 的路线 DOM、plan.json 的 30 天训练路线、浏览器剪贴板能力、fetch/XMLHttpRequest、可选 localStorage 和 topMeta 打字机容器
[OUTPUT]: 对外提供由 plan.json 的 title/summary/type/phase/minutes 驱动的「动森训练岛」hero 文案、Animal Loading 启动状态、打字机日程行、游戏提示语、今日进度条、无文字状态标签的 7 日路线渲染、每日动作卡、黄色主按钮结算、奖励式每日完成弹窗、周复盘 Table 渲染、导出记录给 Agent、周复盘 Markdown 生成、plan.json 兜底加载和本地临时缓存
[POS]: fitness-island/assets 的静态行为目标，plan.json 是页面数据投影，本文件只做渲染与导出交接
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
*/

const STORAGE_KEY = "fitness-island-v1";
const DAY_MS = 24 * 60 * 60 * 1000;

const $ = (id) => document.querySelector(`#${id}`);

const nodes = {
  islandLoading: $("islandLoading"),
  islandLoadingText: $("islandLoadingText"),
  topMeta: $("topMeta"),
  topTitle: $("topTitle"),
  topSummary: $("topSummary"),
  heroProgressFill: $("heroProgressFill"),
  heroProgressText: $("heroProgressText"),
  weekPlant: $("weekPlant"),
  handoffTrigger: $("handoffTrigger"),
  weekLabel: $("weekLabel"),
  weekSignal: $("weekSignal"),
  weekRoute: $("weekRoute"),
  phaseLabel: $("phaseLabel"),
  sequenceTitle: $("sequenceTitle"),
  completionText: $("completionText"),
  exerciseList: $("exerciseList"),
  completeDay: $("completeDay"),
  reviewPanel: $("reviewPanel"),
  reviewAppear: $("reviewAppear"),
  reviewFull: $("reviewFull"),
  reviewMinimum: $("reviewMinimum"),
  reviewTable: $("reviewTable"),
  copyReview: $("copyReview"),
  calendarGrid: $("calendarGrid"),
  toast: $("toast"),
  completeDialog: $("completeDialog"),
  closeComplete: $("closeComplete"),
  handoffDialog: $("handoffDialog"),
  painInput: $("painInput"),
  resistanceInput: $("resistanceInput"),
  cancelHandoff: $("cancelHandoff"),
  copyHandoff: $("copyHandoff"),
  openResetFromHandoff: $("openResetFromHandoff"),
  resetDialog: $("resetDialog"),
  cancelReset: $("cancelReset"),
  confirmReset: $("confirmReset"),
  navPrev: $("navPrev"),
  navComplete: $("navComplete"),
  navNext: $("navNext")
};

let route = { weeks: [] };
let days = [];
let state = createState();
let toastTimer;
let heroTypeKey = "";
let heroTypeTimer;

function todayKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateKey, offset) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + offset);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function createState() {
  return {
    startDate: todayKey(),
    lastSeen: todayKey(),
    selectedDay: 1,
    checks: {},
    days: {},
    settled: {}
  };
}

function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    return { ...createState(), ...saved };
  } catch {
    return createState();
  }
}

function writeState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage 是缓存，不是系统真相源；不可用时保持当前会话可用。
  }
}

function loadJson(url) {
  if (typeof fetch === "function") {
    return fetch(url).then((response) => {
      if (!response.ok) throw new Error("plan.json load failed");
      return response.json();
    }).catch(() => loadJsonWithRequest(url));
  }

  return loadJsonWithRequest(url);
}

function loadJsonWithRequest(url) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("GET", url);
    request.responseType = "json";
    request.addEventListener("load", () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(`HTTP ${request.status}`));
        return;
      }

      resolve(request.response || JSON.parse(request.responseText));
    });
    request.addEventListener("error", () => reject(new Error("plan load failed")));
    request.send();
  });
}

function loadDays(plan) {
  const weekDays = plan.weeks.flatMap((week, weekIndex) =>
    week.days.map((day, dayIndex) => normalizeDay(day, week, weekIndex, dayIndex))
  );
  const bufferDays = (plan.buffer?.days || []).map((day, dayIndex) =>
    normalizeDay(day, plan.buffer, plan.weeks.length, dayIndex)
  );

  return [...weekDays, ...bufferDays]
    .slice(0, 30)
    .map((day, index) => ({ ...day, planDay: index + 1 }));
}

function normalizeDay(day, group, weekIndex, dayIndex) {
  return {
    ...day,
    weekIndex,
    dayIndex,
    weekTheme: group.theme,
    weekSignal: group.signal,
    weekSentence: group.sentence,
    plant: group.plant
  };
}

function currentPlanDay() {
  const [startYear, startMonth, startDay] = state.startDate.split("-").map(Number);
  const [nowYear, nowMonth, nowDay] = todayKey().split("-").map(Number);
  const start = new Date(startYear, startMonth - 1, startDay);
  const now = new Date(nowYear, nowMonth - 1, nowDay);
  const diff = Math.floor((now - start) / DAY_MS) + 1;
  return Math.min(days.length, Math.max(1, diff));
}

function planFor(day) {
  return days[Math.min(days.length, Math.max(1, day)) - 1];
}

function weekFor(day) {
  const plan = planFor(day);
  return {
    theme: plan.weekTheme,
    signal: plan.weekSignal,
    sentence: plan.weekSentence,
    plant: plan.plant
  };
}

function weekRangeFor(day) {
  const weekIndex = planFor(day).weekIndex;
  const sameWeek = days.filter((item) => item.weekIndex === weekIndex);
  const startDay = sameWeek[0].planDay;
  const endDay = sameWeek.at(-1).planDay;
  return { startDay, endDay };
}

function dayChecks(day) {
  return state.checks[day] || [];
}

function setDayChecks(day, checks) {
  state.checks[day] = checks;
}

function isDayDone(day) {
  return Boolean(state.days[day]);
}

function isDaySettled(day) {
  return Boolean(state.settled?.[day]);
}

function dayAppeared(day) {
  return isDayDone(day) || isDaySettled(day) || dayChecks(day).some(Boolean);
}

function checkedCount(day) {
  return dayChecks(day).filter(Boolean).length;
}

function dayStatus(day) {
  if (isDayDone(day)) return "完整";
  if (dayAppeared(day)) return "出现";
  return "待补";
}

function routeStatusLabel(day, current) {
  if (isDayDone(day)) return "完成";
  if (day === current) return dayAppeared(day) ? "进行" : "今天";
  if (day < current && !dayAppeared(day)) return "未完成";
  if (dayAppeared(day)) return "出现";
  return "待做";
}

function peakAppearedStreak(weekDays) {
  let peak = 0;
  let count = 0;

  weekDays.forEach((day) => {
    count = dayAppeared(day) ? count + 1 : 0;
    peak = Math.max(peak, count);
  });

  return peak;
}

function exerciseReviewStats(weekDays) {
  const stats = new Map();

  weekDays.forEach((day) => {
    const checks = dayChecks(day);
    planFor(day).exercises.forEach(([name], index) => {
      const stat = stats.get(name) || { name, done: 0, total: 0 };
      stat.total += 1;
      if (checks[index]) stat.done += 1;
      stats.set(name, stat);
    });
  });

  const list = [...stats.values()];
  const byRatio = (item) => item.done / item.total;
  const active = list.filter((item) => item.done > 0);
  const stable = active.sort((a, b) => byRatio(b) - byRatio(a) || b.done - a.done)[0];
  const weakest = list.sort((a, b) => byRatio(a) - byRatio(b) || a.done - b.done)[0];
  const format = (item) => item ? `${item.name} (${item.done}/${item.total})` : "待记录";

  return {
    stable: format(stable),
    weakest: format(weakest)
  };
}

function dayTrailItem(day) {
  if (isDayDone(day)) return { label: `D${day}`, status: "done", text: "✓" };
  if (dayAppeared(day)) return { label: `D${day}`, status: "appeared", text: "·" };
  return { label: `D${day}`, status: "missed", text: "x" };
}

function weeklyReview(day = state.selectedDay, input = {}) {
  const { startDay, endDay } = weekRangeFor(day);
  const weekDays = Array.from({ length: endDay - startDay + 1 }, (_, index) => startDay + index);
  const appeared = weekDays.filter(dayAppeared).length;
  const full = weekDays.filter(isDayDone).length;
  const minimum = weekDays.filter((item) => dayAppeared(item) && !isDayDone(item)).length;
  const weekNumber = planFor(day).weekIndex + 1;
  const startDate = addDays(state.startDate, startDay - 1);
  const endDate = addDays(state.startDate, endDay - 1);
  const stats = exerciseReviewStats(weekDays);
  const trailItems = weekDays.map(dayTrailItem);
  const trail = weekDays
    .map((item) => `Day ${item}${isDayDone(item) ? "✓" : dayAppeared(item) ? "·" : "x"}`)
    .join(" ");
  const lines = [
    `## Last Week (Week ${weekNumber}, ${startDate} ~ ${endDate})`,
    `完成: ${full}/${weekDays.length} (${trail})`,
    `最稳: ${stats.stable}`,
    `最弱: ${stats.weakest}`,
    `连续到场峰值: ${peakAppearedStreak(weekDays)} 天`
  ];

  const pain = input.pain?.trim();
  const resistance = input.resistance?.trim();
  if (pain) lines.push(`疼痛: ${pain}`);
  if (resistance) lines.push(`阻力: ${resistance}`);
  lines.push("", "→ 按 Next Week Rule 生成下周");

  return {
    appeared,
    full,
    minimum,
    trailItems,
    rows: [
      { key: "period", item: "周期", value: `第 ${weekNumber} 周`, note: `${startDate} ~ ${endDate}` },
      { key: "completion", item: "完成", value: `${full}/${weekDays.length}`, note: trailItems },
      { key: "stable", item: "最稳", value: stats.stable, note: "保持这个入口" },
      { key: "weakest", item: "最弱", value: stats.weakest, note: "下周别加码" },
      { key: "streak", item: "连续", value: `${peakAppearedStreak(weekDays)} 天`, note: "到场峰值" }
    ],
    text: lines.join("\n")
  };
}

function appendTextCell(row, text, className) {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  cell.textContent = text;
  row.appendChild(cell);
  return cell;
}

function appendTrailCell(row, items) {
  const cell = document.createElement("td");
  cell.className = "review-trail-cell";
  const wrap = document.createElement("div");
  wrap.className = "review-trail";

  items.forEach((item) => {
    const chip = document.createElement("span");
    chip.className = `review-day-chip ${item.status}`;
    chip.textContent = `${item.label}${item.text}`;
    wrap.appendChild(chip);
  });

  cell.appendChild(wrap);
  row.appendChild(cell);
}

function renderReviewTable(review) {
  nodes.reviewTable.replaceChildren();

  const table = document.createElement("table");
  table.className = "review-table";

  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["项目", "结果", "记录"].forEach((title) => appendTextCell(headRow, title));
  head.appendChild(headRow);

  const body = document.createElement("tbody");
  review.rows.forEach((item, index) => {
    const row = document.createElement("tr");
    if (index % 2 === 1) row.className = "striped";
    appendTextCell(row, item.item, "review-item-cell");
    appendTextCell(row, item.value, "review-value-cell");
    if (Array.isArray(item.note)) appendTrailCell(row, item.note);
    else appendTextCell(row, item.note, "review-note-cell");
    body.appendChild(row);
  });

  table.append(head, body);
  nodes.reviewTable.appendChild(table);
}

function typewriterLine(node, text, key) {
  window.clearTimeout(heroTypeTimer);
  if (heroTypeKey === key || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    node.textContent = text;
    heroTypeKey = key;
    return;
  }

  heroTypeKey = key;
  node.textContent = "";
  let index = 0;
  const tick = () => {
    node.textContent = text.slice(0, index);
    index += 1;
    if (index <= text.length) heroTypeTimer = window.setTimeout(tick, 42);
  };
  tick();
}

function renderTop(day) {
  const plan = planFor(day);
  const weekName = plan.weekIndex >= route.weeks.length ? "缓冲" : `第 ${plan.weekIndex + 1} 周`;
  const week = weekFor(day);
  const done = isDayDone(day);
  const appeared = dayAppeared(day);
  const checked = checkedCount(day);
  const total = plan.exercises.length;
  const statusLine = done ? "锻炼啦！已盖章" : appeared ? (plan.summary || "锻炼啦！继续走") : (plan.summary || week.sentence || "锻炼啦！待盖章");
  const metaParts = [`${weekName} · 第 ${day} 天`];
  if (plan.minutes) metaParts.push(`${plan.minutes} 分钟`);
  nodes.topTitle.textContent = "动森训练岛";
  typewriterLine(nodes.topMeta, metaParts.join(" · "), `${day}:${weekName}:${plan.minutes || ""}`);
  nodes.topSummary.textContent = statusLine;
  nodes.heroProgressFill.style.width = `${Math.round((checked / total) * 100)}%`;
  nodes.heroProgressText.textContent = `${checked}/${total}`;
  nodes.weekLabel.textContent = `${weekName} · 第 ${day} 天`;
  nodes.weekSignal.textContent = done ? "今天已完成" : appeared ? "今天进行中" : (week.signal || "今天未完成");
  nodes.weekPlant.dataset.plant = week.plant || "sprout";
  nodes.phaseLabel.textContent = [plan.type, plan.phase].filter(Boolean).join(" · ");
  nodes.sequenceTitle.textContent = plan.title || "今日顺序";
}

function renderWeekRoute(day) {
  const current = currentPlanDay();
  const { startDay, endDay } = weekRangeFor(day);
  nodes.weekRoute.innerHTML = "";

  for (let item = startDay; item <= endDay; item += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "route-node";
    const label = routeStatusLabel(item, current);
    button.setAttribute("aria-label", `第 ${item} 天，${label}`);
    if (item === day) {
      button.classList.add("selected");
      button.setAttribute("aria-current", "true");
    }
    if (item === current) button.classList.add("today");
    if (isDayDone(item)) button.classList.add("done");
    if (dayAppeared(item) && !isDayDone(item)) button.classList.add("appeared");
    if (item < current && !dayAppeared(item)) button.classList.add("late");
    if (planFor(item).review) button.classList.add("review");
    button.innerHTML = `
      <span>${item}</span>
    `;
    button.addEventListener("click", () => {
      state.selectedDay = item;
      writeState();
      transitionRender();
    });
    nodes.weekRoute.appendChild(button);
  }
}

function renderExercises(day) {
  const plan = planFor(day);
  const checks = dayChecks(day);
  nodes.exerciseList.innerHTML = "";

  plan.exercises.forEach(([name, detail, note], index) => {
    const item = document.createElement("li");
    item.className = `exercise-item${checks[index] ? " done" : ""}`;
    item.innerHTML = `
      <button class="check-button" type="button" aria-label="切换 ${name} 完成状态" aria-pressed="${Boolean(checks[index])}">${checks[index] ? "✓" : ""}</button>
      <div class="exercise-copy">
        <h3 class="exercise-title-row">
          <span class="exercise-name">${name}</span>
        </h3>
        <p class="exercise-detail">${detail}</p>
        <small class="exercise-note">${note}</small>
      </div>
    `;

    item.querySelector("button").addEventListener("click", () => {
      const wasDone = isDayDone(day);
      const next = [...dayChecks(day)];
      next[index] = !next[index];
      setDayChecks(day, next);
      state.days[day] = next.filter(Boolean).length === plan.exercises.length;
      writeState();
      showToast(next[index] ? `${name} 已记录` : `${name} 已取消`);
      transitionRender();
      if (!wasDone && state.days[day]) openCompleteDialog();
    });

    nodes.exerciseList.appendChild(item);
  });
}

function renderArchive(day) {
  const current = currentPlanDay();
  nodes.calendarGrid.innerHTML = "";

  days.forEach((plan, index) => {
    const item = index + 1;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.textContent = item;
    if (item === day) button.classList.add("selected");
    if (isDayDone(item)) button.classList.add("done");
    if (item < current && !dayAppeared(item)) button.classList.add("late");
    button.addEventListener("click", () => {
      state.selectedDay = item;
      writeState();
      transitionRender();
    });
    nodes.calendarGrid.appendChild(button);
  });
}

function renderReview(day) {
  const review = weeklyReview(day);
  nodes.reviewPanel.hidden = !planFor(day).review;
  nodes.reviewAppear.textContent = review.appeared;
  nodes.reviewFull.textContent = review.full;
  nodes.reviewMinimum.textContent = review.minimum;
  renderReviewTable(review);
}

function render(options = {}) {
  const day = state.selectedDay || currentPlanDay();
  const plan = planFor(day);
  const done = isDayDone(day);
  const checked = checkedCount(day);

  renderTop(day);
  renderWeekRoute(day);
  renderExercises(day);
  renderArchive(day);
  renderReview(day);

  const actionText = completionActionText(day);
  nodes.completionText.textContent = `${checked}/${plan.exercises.length}`;
  nodes.completeDay.textContent = actionText;
  nodes.completeDay.classList.toggle("done", done);
  nodes.completeDay.setAttribute("aria-pressed", String(done));
  nodes.navComplete.setAttribute("aria-label", actionText);

  if (options.toast) showToast(options.toast);
  writeState();
}

function transitionRender(options = {}) {
  if (document.startViewTransition) {
    document.startViewTransition(() => render(options));
    return;
  }

  render(options);
}

function completionActionText(day) {
  const checked = checkedCount(day);
  const total = planFor(day).exercises.length;
  if (isDayDone(day)) return "今天已完成";
  if (checked > 0 && checked < total) return "今天到这";
  return "完成今天";
}

function settleDay() {
  const day = state.selectedDay;
  state.settled = state.settled || {};
  state.settled[day] = true;
  state.selectedDay = Math.min(days.length, day + 1);
  writeState();
  transitionRender({ toast: "已按当前进度收摊" });
}

function completeDay() {
  const day = state.selectedDay;
  const checked = checkedCount(day);
  const total = planFor(day).exercises.length;
  if (isDayDone(day)) {
    openCompleteDialog();
    return;
  }
  if (checked > 0 && checked < total) {
    settleDay();
    return;
  }

  setDayChecks(day, planFor(day).exercises.map(() => true));
  state.days[day] = true;
  writeState();
  transitionRender();
  openCompleteDialog();
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.top = "-1000px";
  document.body.appendChild(field);
  field.select();
  document.execCommand("copy");
  field.remove();
}

function showToast(message) {
  if (!nodes.toast) return;
  window.clearTimeout(toastTimer);
  nodes.toast.textContent = message;
  nodes.toast.classList.add("show");
  toastTimer = window.setTimeout(() => {
    nodes.toast.classList.remove("show");
  }, 2200);
}

function finishLoading() {
  if (!nodes.islandLoading) return;
  nodes.islandLoading.classList.add("is-hidden");
  nodes.islandLoading.setAttribute("aria-hidden", "true");
  window.setTimeout(() => {
    nodes.islandLoading.hidden = true;
  }, 280);
}

function showLoadingError() {
  if (nodes.islandLoadingText) nodes.islandLoadingText.textContent = "plan.json 加载失败";
  if (nodes.islandLoading) nodes.islandLoading.classList.add("is-error");
}

function openCompleteDialog() {
  nodes.completeDialog.hidden = false;
  document.body.classList.add("modal-open");
  nodes.closeComplete.focus();
}

function closeCompleteDialog() {
  nodes.completeDialog.hidden = true;
  document.body.classList.remove("modal-open");
  nodes.completeDay.focus();
}

function openHandoffDialog() {
  nodes.handoffDialog.hidden = false;
  document.body.classList.add("modal-open");
  nodes.painInput.focus();
}

function closeHandoffDialog() {
  nodes.handoffDialog.hidden = true;
  document.body.classList.remove("modal-open");
  nodes.handoffTrigger.focus();
}

async function copyHandoff() {
  const text = weeklyReview(state.selectedDay, {
    pain: nodes.painInput.value,
    resistance: nodes.resistanceInput.value
  }).text;

  await copyText(text);
  closeHandoffDialog();
  showToast("已复制，贴回对话给 Agent");
}

function openResetDialog() {
  nodes.handoffDialog.hidden = true;
  nodes.resetDialog.hidden = false;
  document.body.classList.add("modal-open");
  nodes.cancelReset.focus();
}

function closeResetDialog() {
  nodes.resetDialog.hidden = true;
  document.body.classList.remove("modal-open");
  nodes.handoffTrigger.focus();
}

function resetPlan() {
  state = createState();
  writeState();
  closeResetDialog();
  transitionRender({ toast: "路线已重置，从第一天重新开始" });
}

function bindEvents() {
  nodes.completeDay.addEventListener("click", () => completeDay());
  nodes.navComplete.addEventListener("click", () => completeDay());
  nodes.navPrev.addEventListener("click", () => {
    state.selectedDay = Math.max(1, state.selectedDay - 1);
    transitionRender();
  });
  nodes.navNext.addEventListener("click", () => {
    state.selectedDay = Math.min(days.length, state.selectedDay + 1);
    transitionRender();
  });
  nodes.handoffTrigger.addEventListener("click", () => openHandoffDialog());
  nodes.closeComplete.addEventListener("click", () => closeCompleteDialog());
  nodes.completeDialog.addEventListener("click", (event) => {
    if (event.target === nodes.completeDialog) closeCompleteDialog();
  });
  nodes.copyReview.addEventListener("click", () => openHandoffDialog());
  nodes.cancelHandoff.addEventListener("click", () => closeHandoffDialog());
  nodes.copyHandoff.addEventListener("click", async () => {
    try {
      await copyHandoff();
    } catch {
      showToast("复制失败，请手动选中复盘文本");
    }
  });
  nodes.handoffDialog.addEventListener("click", (event) => {
    if (event.target === nodes.handoffDialog) closeHandoffDialog();
  });
  nodes.openResetFromHandoff.addEventListener("click", () => openResetDialog());
  nodes.cancelReset.addEventListener("click", () => closeResetDialog());
  nodes.confirmReset.addEventListener("click", () => resetPlan());
  nodes.resetDialog.addEventListener("click", (event) => {
    if (event.target === nodes.resetDialog) closeResetDialog();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !nodes.completeDialog.hidden) closeCompleteDialog();
    if (event.key === "Escape" && !nodes.handoffDialog.hidden) closeHandoffDialog();
    if (event.key === "Escape" && !nodes.resetDialog.hidden) closeResetDialog();
  });
}

async function init() {
  route = await loadJson("./plan.json?v=20260524-route");
  days = loadDays(route);
  state = readState();

  if (state.lastSeen !== todayKey()) {
    state.selectedDay = currentPlanDay();
    state.lastSeen = todayKey();
  }

  state.selectedDay = Math.min(days.length, Math.max(1, state.selectedDay || currentPlanDay()));
  bindEvents();
  render();
  finishLoading();
}

init().catch(() => {
  showLoadingError();
});
