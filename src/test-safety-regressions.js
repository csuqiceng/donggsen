const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = __dirname;
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const reset = fs.readFileSync(path.join(root, 'api', 'reset.php'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const phpState = fs.readFileSync(path.join(root, 'api', 'state.php'), 'utf8');

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

function normalizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function userKeyFromName(name) {
  return 'name_' + crypto.createHash('sha256').update(normalizeName(name)).digest('hex').slice(0, 24);
}

console.log('');
console.log('安全/同步回归测试');
console.log('');

assert(!sw.includes("'./',") && !sw.includes('"./",'), 'Service Worker 不应预缓存 ./ 壳页面');
assert(!sw.includes("'./index.html'") && !sw.includes('"./index.html"'), 'Service Worker 不应预缓存 index.html');
assert(/request\.mode\s*===\s*'navigate'/.test(sw), 'Service Worker 应对导航请求使用网络优先');
assert(!/register\(['"]\.\/service-worker\.js/.test(html), '开发期页面不应继续注册 Service Worker');
assert(/getRegistrations\(\)/.test(html) && /unregister\(\)/.test(html), '页面应注销旧 Service Worker');
assert(/<script src="\.\/app\.js"><\/script>/.test(html), 'app.js 应使用固定引用，不带 sync 版本参数');
assert(/href="\.\/styles\.css"/.test(html), 'styles.css 应使用固定引用，不带 sync 版本参数');
assert(!/sync\d+/.test(html), 'index.html 不应再包含 sync 缓存破坏参数');

assert(!reset.includes("?: 'reset-fitness-island'"), 'reset.php 不应保留公开默认 token');
assert(!/\blocalStorage\b/.test(app), 'app.js 不应再读取或写入 localStorage');
assert(/GIFT_RULES/.test(app), '应定义真实礼物兑换规则');
assert(/giftClaims/.test(app) && /renderGiftDock/.test(app), '应渲染礼物码头并同步兑换状态');
assert(/handleGiftRequest/.test(app) && /handleGiftRedeem/.test(app), '应支持申请兑换和确认兑现');
assert(/viewGift/.test(html) && /data-view="gift"/.test(html), '页面应包含礼物码头入口');
assert(/'giftClaims'/.test(phpState), '后端应允许同步 giftClaims');
assert(/'shared'\s*=>/.test(phpState) && /merge_shared_state/.test(phpState), '后端应提供 shared 共享区');
assert(/sharedGiftClaims/.test(app) && /wishList/.test(app), '前端应有共享礼物和心愿单状态');
assert(/syncSharedPatch/.test(app), '前端应能提交 shared patch');
assert(/sharedGiftClaims\[claimId\]\.status\s*=\s*'redeemed'/.test(app), '对方确认应更新共享礼物状态');
assert(/retrySharedPatchAfterConflict/.test(app), '共享补丁遇到 409 后应恢复并重试提交');
assert(/ensureStableUserKey/.test(app), '共享操作前应确保拿到稳定 userKey');
assert(/DECOR_ITEMS/.test(app) && /handlePlaceDecor/.test(app) && /sharedDecor/.test(app), '应支持共享岛屿装饰');
assert(/coopNeed/.test(app) && /getContributorCount/.test(app), '协作建筑应校验参与人数');
assert(/mailboxEntry/.test(app) && /mailboxEntries/.test(app), '留言板应保留共享历史');
assert(/weeklyEvent/.test(app) && /handleWeeklySettlement/.test(app), '应支持每周结算公告');
assert(/PLAN_MODES/.test(app) && /selectedPlanMode/.test(app), '应支持计划路线切换');
assert(/getUserTitle/.test(app), '应支持成就称号');
assert(/getFestivalToday/.test(app) && /applyFestivalBonus/.test(app), '应支持节日彩蛋');
assert(/decorItem/.test(phpState) && /mailboxEntry/.test(phpState) && /weeklyEvent/.test(phpState), '后端应合并装饰、信箱和周事件共享补丁');
assert(/Cannot redeem own gift/.test(phpState) && /Cannot reopen redeemed gift/.test(phpState), '后端应限制礼物自兑和已兑现回退');
assert(/resetUserSessionState/.test(app), '切换账号时应重置当前内存用户状态');
assert(/pullSelfFromServer/.test(app), '登录/切换账号时应先按名字拉取服务端自己的数据');
assert(/await\s+pullSelfFromServer\(\)/.test(app), '首次 POST 前应先完成服务端自有数据恢复');

assert(/recoverConflictFromServer/.test(app), '409 JSON 解析失败时应回退拉取服务端最新状态');
assert(!/409 response JSON parse failed:[\s\S]{0,180}syncVersion\s*=\s*syncVersion\s*\+\s*1/.test(app), '409 JSON 解析失败不应靠本地版本号自增绕过冲突');
assert(/getConflictVersion/.test(app), '冲突恢复应从服务端真实版本计算本地 syncVersion');
assert(!/syncVersion\s*=\s*payload\?\.version\s*\|\|\s*syncVersion/.test(app), '冲突恢复不应只依赖 payload.version fallback');
assert(/Conflict recovery JSON parse failed/.test(app), 'GET 回退的 JSON 解析失败应单独处理和记录');

assert(/escapeHtml\(note\.name\)/.test(app), '留言板用户名渲染前应转义');
assert(/escapeHtml\(name\)/.test(app), '伙伴卡用户名渲染前应转义');
assert(/escapeHtml\(r\.name\)/.test(app), '贡献页用户名渲染前应转义');
assert(/escapeHtml\(p\.name\)/.test(app), '动态记录用户名渲染前应转义');
assert(/escapeHtml\(r\.name\.charAt\(0\)/.test(app), '岛上居民头像 fallback 应转义');

const keyA = userKeyFromName('  Alice   Chen ');
const keyB = userKeyFromName('alice chen');
const keyC = userKeyFromName('Bob');
assert(keyA === keyB, '同名不同空格/大小写应映射到同一用户 key');
assert(keyA !== keyC, '不同名字应映射到不同用户 key');

console.log('');
console.log(`结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
