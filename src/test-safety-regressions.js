const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = __dirname;
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const reset = fs.readFileSync(path.join(root, 'api', 'reset.php'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const phpState = fs.readFileSync(path.join(root, 'api', 'state.php'), 'utf8');
const plan = JSON.parse(fs.readFileSync(path.join(root, 'plan.json'), 'utf8'));
const planText = JSON.stringify(plan);

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
assert(/register\(['"]\.\/service-worker\.js/.test(html), '页面应注册 Service Worker 以保留 PWA');
assert(/serviceWorker\.addEventListener\('controllerchange'/.test(html) && /updateNotice/.test(html), '页面应在 Service Worker 更新后提示刷新');
assert(!/getRegistrations\(\)[\s\S]{0,120}unregister\(\)/.test(html), '页面不应主动注销 Service Worker');
assert(/<script src="\.\/app\.js"><\/script>/.test(html), 'app.js 应使用固定引用，不带 sync 版本参数');
assert(/href="\.\/styles\.css"/.test(html), 'styles.css 应使用固定引用，不带 sync 版本参数');
assert(!/sync\d+/.test(html), 'index.html 不应再包含 sync 缓存破坏参数');
assert(/NETWORK_FIRST_PATHS/.test(sw) && /\/app\.js/.test(sw) && /\/styles\.css/.test(sw) && /\/plan\.json/.test(sw), 'app.js/styles.css/plan.json 应使用 network-first 缓存策略');
assert(/CACHE_FIRST_EXTENSIONS/.test(sw) && /svg/.test(sw) && /png/.test(sw) && /webp/.test(sw), '图片和 SVG 应使用 cache-first 缓存策略');
assert(/skipWaiting\(\)/.test(sw) && /clients\.claim\(\)/.test(sw), '新 Service Worker 应立即安装并接管页面');

assert(!reset.includes("?: 'reset-fitness-island'"), 'reset.php 不应保留公开默认 token');
assert(!/\blocalStorage\b/.test(app), 'app.js 不应再读取或写入 localStorage');
assert(/GIFT_RULES/.test(app), '应定义真实礼物兑换规则');
assert(/giftClaims/.test(app) && /renderGiftDock/.test(app), '应渲染礼物码头并同步兑换状态');
assert(/handleGiftRequest/.test(app) && /handleGiftRedeem/.test(app), '应支持申请兑换和确认兑现');
assert(/viewGift/.test(html) && /data-view="gift"/.test(html), '页面应包含礼物码头入口');
assert(/'giftClaims'/.test(phpState), '后端应允许同步 giftClaims');
assert(/'shared'\s*=>/.test(phpState) && /merge_shared_state/.test(phpState), '后端应提供 shared 共享区');
assert(/sharedGiftClaims/.test(app) && /wishList/.test(app), '前端应有共享礼物和心愿单状态');
assert(/mirrorOwnWishList/.test(app) && /我的心愿/.test(app), '添加心愿后应进入下方心愿汇总');
assert(/syncSharedPatch/.test(app), '前端应能提交 shared patch');
assert(/sharedGiftClaims\[claimId\]\.status\s*=\s*'redeemed'/.test(app), '对方确认应更新共享礼物状态');
assert(/retrySharedPatchAfterConflict/.test(app), '共享补丁遇到 409 后应恢复并重试提交');
assert(/ensureStableUserKey/.test(app), '共享操作前应确保拿到稳定 userKey');
assert(/DECOR_ITEMS/.test(app) && /handlePlaceDecor/.test(app) && /sharedDecor/.test(app), '应支持共享岛屿装饰');
assert(/coopNeed/.test(app) && /getContributorCount/.test(app), '协作建筑应校验参与人数');
assert(/mailboxEntry/.test(app) && /mailboxEntries/.test(app), '留言板应保留共享历史');
assert(/weeklyEvent/.test(app) && /handleWeeklySettlement/.test(app), '应支持每周结算公告');
assert(!/id="planModeSelector"/.test(html), '页面不应再显示第二排路线模式按钮');
assert(/getDifficultyDay/.test(app) && /getDifficultyExercises/.test(app), '应按难度生成今日动作内容');
assert(/rewardPool/.test(app) && /baseRewards/.test(app) && /fullBonus/.test(app), '三档难度应绑定不同奖励池和奖励数量');
assert(/TRAINING_REWARD_POOLS/.test(app) && /buildRewardPoolForDay/.test(app) && /getTrainingRewardPool/.test(app), '奖励应同时绑定训练类型和难度');
assert(/chooseRewards\(currentDifficulty, profile\.count, currentDayIndex, day\)/.test(app), '奖励预览应使用当天训练类型');
assert(/chooseRewards\(difficulty, materialCount, currentDayIndex, day\)/.test(app), '结算奖励应使用当天训练类型');
assert(/getAllowedRewardsForDifficulty/.test(app), '不同难度应限制可掉落奖励稀有度');
assert(/matchedCompound/.test(app) && /if \(matchedCompound\) return text/.test(app), '挑战复合动作加量后不应再次被单项规则放大');
assert(/秒\\s\*\[x×\]/.test(app) && /\(个\|次\)/.test(app), '难度生成应支持 ×、x、个、次等训练文本');
assert(plan.weeks.reduce((sum, week) => sum + week.days.length, 0) === 30, 'plan.json 应保持 30 天路线');
assert(!/椅子|V-up/i.test(planText), '默认计划不应包含椅子动作或 V-up');
assert(/开合跳/.test(planText) && /高抬腿/.test(planText) && /登山者/.test(planText), '计划应包含后期心肺动作');
assert(/死虫式/.test(planText) && /鸟狗式/.test(planText) && /侧桥/.test(planText), '计划应包含扩展核心动作');
assert(/髋部拉伸/.test(planText) && /小腿拉伸/.test(planText) && /肩颈放松/.test(planText), '计划应包含扩展收尾动作');
assert(/getUserTitle/.test(app), '应支持成就称号');
assert(/getFestivalToday/.test(app) && /applyFestivalBonus/.test(app), '应支持节日彩蛋');
assert(/getWeeklyReviewInsights/.test(app) && /normalizeExerciseCategory/.test(app), '周复盘应自动分析最稳日和最弱动作类');
assert(!/记录后填写/.test(app), '周复盘不应保留手工填写占位');
assert(/function getWeekEndIndex/.test(app) && /allDays\.length\s*-\s*1/.test(app), '可用日期索引应限制在计划范围内，避免缓冲周越界');
assert(/if \(!day\) \{[\s\S]{0,180}currentDayIndex\s*=\s*getClampedDayIndex/.test(app), '渲染前应兜底修正无效 currentDayIndex');
assert(/decorItem/.test(phpState) && /mailboxEntry/.test(phpState) && /weeklyEvent/.test(phpState), '后端应合并装饰、信箱和周事件共享补丁');
assert(/clean_text\(\(string\)\(\$event\['summary'\][\s\S]*220\)/.test(phpState), '后端周复盘摘要应保留自动分析内容');
assert(/Cannot redeem own gift/.test(phpState) && /Cannot reopen redeemed gift/.test(phpState), '后端应限制礼物自兑和已兑现回退');
assert(/TROPHIES/.test(app) && /showMuseumTrophies/.test(app), '博物馆应展示成就奖杯');
assert(/showCollectionDetail/.test(app) && /data-collection-id/.test(app), '图鉴已发现项目应可点击查看详情');
assert(/useItemAction/.test(app) && /handleUseItem/.test(app), '背包物品应有可执行用途');
assert(/nookMilesTicket/.test(app) && /revealExtraBottleClue/.test(app), '里数券应可用于瓶中信线索');
assert(/getWeeklySettlementStatus/.test(app), '本周结算应有统一可点击状态判断');
assert(/getTodayWeekdayIndex\(\)\s*!==\s*6/.test(app) && /周日完成后结算/.test(app), '周一到周六应禁止生成本周结算');
assert(/先完成今天/.test(app) && /sundayState\.settled/.test(app) && /sundayState\.missed/.test(app), '周日未打卡或未休息时应禁止本周结算');
assert(/const ok = await syncSharedPatch\(\{ weeklyEvent: event \}\)/.test(app) && /周结算同步失败/.test(app), '本周结算应在同步成功后再本地标记完成');
assert(/HIDDEN_QUESTS/.test(app) && /tier:\s*'普通'/.test(app) && /tier:\s*'稀有'/.test(app) && /tier:\s*'传说'/.test(app), '隐藏任务应分为普通、稀有、传说');
assert(/id:\s*'night_star'/.test(app) && !/id:\s*'starFragment',\s*name:\s*'夜海星光'/.test(app), '夜海星光隐藏任务不应复用星星碎片材料 ID');
assert(/retroactiveHiddenCheck[\s\S]*coop_wood_sign/.test(app) && /retroactiveHiddenCheck[\s\S]*secret_pier_parcel/.test(app), '同日隐藏任务回溯应补全标准同日和挑战同日奖励');
assert(/applyHiddenTaskEffect/.test(app) && /uniqueTasks\.forEach\(applyHiddenTaskEffect\)/.test(app), '隐藏任务奖励发放应复用统一副作用函数');
assert(/async function retroactiveHiddenCheck[\s\S]*const synced = await syncMyState\(\)[\s\S]*if \(!synced\)/.test(app), '回溯补发隐藏任务应等待同步成功，失败时回滚');
assert(/async function handleUseItem[\s\S]*const synced = await syncMyState\(\)[\s\S]*if \(!synced\)/.test(app), '背包使用应等待同步成功，失败时回滚');
assert(/async function revealExtraBottleClue[\s\S]*const synced = await syncMyState\(\)[\s\S]*if \(!synced\)/.test(app), '里数券线索应等待同步成功后再提示');
assert(/Object\.entries\(sharedGiftClaims\)/.test(app), '礼物码头应直接展示 shared 中对方申请');
assert(/#avatarModal\s+\.modal-card/.test(css), '头像弹窗应有专门尺寸控制');
assert(/\.hero-export/.test(css) && /min-height:38px/.test(css), '导出按钮应缩小');
assert(/\.collection-tabs\{[^}]*auto-fit/.test(css), '图鉴分类应自适应五个分类按钮');
assert((html.match(/class="[^"]*\bnav-btn\b[^"]*"/g) || []).length === 6, '底部导航应包含 6 个主入口');
assert(!/class="nav-icon">[^<]/.test(html), '底部导航不应继续使用字符或 emoji 作为主图标');
assert(/assets\/nav-icons\/today\.svg/.test(html) && /assets\/nav-icons\/contribution\.svg/.test(html), '底部导航应使用本地 nav-icons 图标');
assert(/resetUserSessionState/.test(app), '切换账号时应重置当前内存用户状态');
assert(/pullSelfFromServer/.test(app), '登录/切换账号时应先按名字拉取服务端自己的数据');
assert(/await\s+pullSelfFromServer\(\)/.test(app), '首次 POST 前应先完成服务端自有数据恢复');

assert(/recoverConflictFromServer/.test(app), '409 JSON 解析失败时应回退拉取服务端最新状态');
assert(/async function syncMyState[\s\S]*return true/.test(app) && /catch \(err\)[\s\S]*return false/.test(app), '同步函数应返回成功或失败');
assert(!/409 response JSON parse failed:[\s\S]{0,180}syncVersion\s*=\s*syncVersion\s*\+\s*1/.test(app), '409 JSON 解析失败不应靠本地版本号自增绕过冲突');
assert(/getConflictVersion/.test(app), '冲突恢复应从服务端真实版本计算本地 syncVersion');
assert(!/syncVersion\s*=\s*payload\?\.version\s*\|\|\s*syncVersion/.test(app), '冲突恢复不应只依赖 payload.version fallback');
assert(/Conflict recovery JSON parse failed/.test(app), 'GET 回退的 JSON 解析失败应单独处理和记录');
assert(/return await recoverConflictFromServer\(sharedPatch\)/.test(app), '409 JSON 解析失败恢复后应继续重试共享补丁');
assert(/async function recoverConflictFromServer\(sharedPatch = null\)/.test(app), 'GET 回退恢复函数应接收共享补丁');
assert(/function handleSettle[\s\S]*const synced = await syncMyState\(\)[\s\S]*if \(!synced\)/.test(app), '打卡结算应等待同步成功后再展示成功结果');
assert(/function applySettlementRewards[\s\S]*applyFestivalBonus/.test(app), '节日奖励应在结算奖励阶段发放');
assert(!/function render[\s\S]{0,900}applyFestivalBonus\(\)/.test(app), 'render 不应触发节日奖励同步副作用');
assert(/function countMinutes[\s\S]*getDifficultyDay\(allDays\[idx\]/.test(app), '训练分钟统计应按当日难度后的计划计算');
assert(/case 'bells':[\s\S]*out\.bells\s*\+=\s*getBellsRewardValue/.test(app), '铃钱掉落应按奖励价值增加，而不是只加 1');
assert(/messageSaveBtn'\)\.addEventListener\('click', async/.test(app) && /const ok = await syncMyState\(patch\)/.test(app), '留言保存应等待同步成功后再提示');
assert(/archiveImportInput'\)\.addEventListener\('change', e =>[\s\S]*const synced = await syncMyState\(\)/.test(app), '导入存档应等待同步成功后再提示');

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
