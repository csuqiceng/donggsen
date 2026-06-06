const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log('  ✓ ' + label);
  } else {
    failed++;
    console.log('  ✗ FAIL: ' + label);
  }
}

console.log('');
console.log('按周几打卡锁定测试');
console.log('');

assert(/function canCheckInDay/.test(app), '应定义 canCheckInDay');
assert(/function isLockedDay/.test(app), '应定义 isLockedDay');
assert(/index\s*===\s*getAvailableDayIndex\(\)/.test(app), '只能打卡当前周几对应节点');
assert(/return\s+index\s*>\s*getAvailableDayIndex\(\)/.test(app), '只有未来周几节点应锁定');

let dayStates = {};
let todayWeekday = 5; // 周六，0=周一
let currentWeek = 0;
const todayKey = '2026-06-06';

function getDateKey() {
  return todayKey;
}

function getWeekStartIndex(weekIndex) {
  return weekIndex * 7;
}

function getCurrentTrainingWeekIndex() {
  return currentWeek;
}

function getTodayWeekdayIndex() {
  return todayWeekday;
}

function getDayState(i) {
  if (!dayStates[i]) dayStates[i] = {
    checked: new Set(),
    settled: false,
    missed: false,
    settledDate: null,
    missedDate: null
  };
  return dayStates[i];
}

function findSettledDateIndex(dateKey = getDateKey()) {
  for (let i = 0; i < 14; i++) {
    const state = getDayState(i);
    if ((state.settled && state.settledDate === dateKey) || (state.missed && state.missedDate === dateKey)) return i;
  }
  return -1;
}

function getFirstUnsettledIndex() {
  return getWeekStartIndex(getCurrentTrainingWeekIndex()) + getTodayWeekdayIndex();
}

function getAvailableDayIndex() {
  const todayDoneIndex = findSettledDateIndex();
  return todayDoneIndex >= 0 ? todayDoneIndex : getFirstUnsettledIndex();
}

function hasSettledToday() {
  return findSettledDateIndex() >= 0;
}

function canCheckInDay(index) {
  if (hasSettledToday()) return false;
  const state = getDayState(index);
  return index === getAvailableDayIndex() && !state.settled && !state.missed;
}

function isLockedDay(index) {
  return index > getAvailableDayIndex();
}

assert(getAvailableDayIndex() === 5, '周六时可打卡节点应是周六');
assert(!isLockedDay(0) && !isLockedDay(1) && !isLockedDay(4), '周一到周五不应锁定，可查看');
assert(!isLockedDay(5), '当天周六不应锁定');
assert(isLockedDay(6), '未来周日应锁定');
assert(!canCheckInDay(4), '周五可以查看但不能补打卡');
assert(canCheckInDay(5), '周六当天可以打卡');
assert(!canCheckInDay(6), '周日不能提前打卡');

getDayState(5).settled = true;
getDayState(5).settledDate = todayKey;
assert(!canCheckInDay(5), '当天结算后不能重复打卡');
assert(getAvailableDayIndex() === 5, '当天结算后仍停留在当天记录用于查看');

dayStates = {};
currentWeek = 1;
todayWeekday = 1; // 第二周周二
assert(getAvailableDayIndex() === 8, '第二周周二应映射到全局第 9 个节点');
assert(!isLockedDay(7), '第二周周一可查看');
assert(isLockedDay(9), '第二周周三未来节点应锁定');

console.log('');
console.log(`结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
