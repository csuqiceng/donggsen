import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Input,
  Modal,
  Title,
  Wallet,
} from 'animal-island-ui';
import type { ReactNode } from 'react';
import 'animal-island-ui/style';
import { NookPhone } from './components/NookPhone';
import type { NookApp } from './components/NookPhone';
import { GAMES } from './components/phone-games';
import './App.css';
import { AVATARS, BUILDINGS, DECOR_ITEMS, DIFFICULTIES, FIXED_USERS, GIFT_RULES, HIDDEN_QUESTS, ITEMS, PLAN_MODES } from './domain/config';
import { fetchPlan, fetchServerState, getSharedMailbox, pushUserState } from './domain/api';
import {
  applyArchivePayload,
  createArchivePayload,
  createArchiveRows,
  createTrainingExportText,
  getArchiveActiveView,
  getDayByArchiveIndex,
} from './domain/archive';
import { findSelfRecord, restoreUserFromServer, sanitizeFixedUser } from './domain/compat';
import {
  calcStreak,
  canCheckInDay,
  countMinutes,
  countSettledDays,
  createInitialState,
  ensureDayState,
  flattenPlanDays,
  formatTodayDate,
  getAdjustedDay,
  getAvailableDayIndex,
  getDayKey,
  getDateKey,
  getTodayWeekdayIndex,
  hasSettledToday,
  restToday,
  settleToday,
  toggleTask,
} from './domain/training';
import {
  createGiftRedeemPatch,
  createGiftRequest,
  createWishFulfillment,
  getGiftClaimId,
  getGiftHistory,
  getGiftProgress,
  getOwnWishList,
  getParticipants,
  getPeerWishEntries,
  normalizeGiftClaims,
  normalizeWishFulfillments,
  updateWishList,
} from './domain/gifts';
import { createDecorPlacement, formatDecorCost, isDecorPlaced, normalizeDecor } from './domain/decor';
import { getWeeklyReviewInsights } from './domain/weekly';
import { buildWeeklyEvent, getWeeklyEventId, getWeeklySettlementStatus } from './domain/settlement';
import { computeLoginStreak, getLoginReward } from './domain/login';
import { GRID_RECIPES, matchGridRecipe, craftFromGrid, placeCraft, type CraftGrid } from './domain/workshop';
import { placeRoomFurniture, removeRoomFurniture } from './domain/room';
import { getUserTitle, countChecked } from './domain/leaderboard';
import { detectHiddenTasks, applyHiddenTaskEffects, retroactiveHiddenCheck, getHiddenQuestHint } from './domain/hidden';
import { getMuseumExhibits, getMuseumRooms, MUSEUM_ROOMS, type MuseumContext, type MuseumRoomId } from './domain/museum';
import { getTrophyProgress, type TrophyContext } from './domain/trophies';
import { getFestivalToday, applyFestivalBonus } from './domain/festival';
import { resolveItemUse, itemUseAction } from './domain/items';
import { revealExtraBottleClue } from './domain/bottle';
import { diffBuildStages, type BuildStage } from './domain/buildings';
import { BuildUpdateModal } from './components/BuildUpdateModal';
import { Leaderboard } from './components/Leaderboard';
import { AvatarPicker } from './components/AvatarPicker';
import { CuteTip } from './components/CuteTip';
import type { DayState, Difficulty, FixedUserName, LocalUserState, MailboxEntry, PlanDay, ServerState, TrainingPlan } from './domain/types';

type ViewKey = 'today' | 'island' | 'bag' | 'collection' | 'gift' | 'coop' | 'storage' | 'workshop' | 'room';

const navItems: Array<{ key: ViewKey; label: string }> = [
  { key: 'today', label: '今日' },
  { key: 'island', label: '岛屿' },
  { key: 'bag', label: '背包' },
  { key: 'gift', label: '礼物' },
  { key: 'coop', label: '贡献' },
];

const SESSION_USER_KEY = 'fitness_island_user';

export default function App() {
  const [selectedUser, setSelectedUser] = useState<FixedUserName | null>(null);
  const [userState, setUserState] = useState<LocalUserState | null>(null);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [server, setServer] = useState<ServerState | null>(null);
  const [view, setView] = useState<ViewKey>('today');
  const [loading, setLoading] = useState(false);
  const [syncText, setSyncText] = useState('未同步');
  const [messageText, setMessageText] = useState('');
  const [wishText, setWishText] = useState('');
  const [rewardModal, setRewardModal] = useState<string[] | null>(null);
  const [loginEgg, setLoginEgg] = useState<{ streak: number; reward: string } | null>(null);
  const [festivalEgg, setFestivalEgg] = useState<{ name: string; text: string; reward: string } | null>(null);
  const [detailModal, setDetailModal] = useState<{ title: string; body?: string; lines?: string[]; cards?: BottleCard[] } | null>(null);
  const [exportModal, setExportModal] = useState<{ title: string; text: string } | null>(null);
  const [toast, setToast] = useState('');
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [buildUpdates, setBuildUpdates] = useState<Array<{ id: string; name: string; from: string; to: string }>>([]);
  const serverRef = useRef<ServerState | null>(server);
  useEffect(() => { serverRef.current = server; }, [server]);
  const archiveImportRef = useRef<HTMLInputElement | null>(null);

  const days = useMemo(() => plan ? flattenPlanDays(plan) : [], [plan]);
  const currentDay = userState ? days[Math.min(userState.currentDayIndex, Math.max(0, days.length - 1))] : null;
  const adjustedDay = currentDay && userState ? getAdjustedDay(currentDay, userState.selectedDifficulty) : null;
  const dayKey = userState ? getDayKey(userState.currentDayIndex) : 'day_0';
  const dayState = userState && adjustedDay ? ensureDayState(userState, dayKey, adjustedDay.exercises.length) : null;
  const peers = useMemo(() => {
    if (!server?.users || !selectedUser) return [];
    return Object.values(server.users).filter(user => sanitizeFixedUser(user.displayName || user.username || '') && (user.displayName || user.username) !== selectedUser);
  }, [server, selectedUser]);
  const mailbox = useMemo(() => getSharedMailbox(server), [server]);
  const archiveRows = useMemo(() => plan && userState ? createArchiveRows(plan, userState) : [], [plan, userState]);

  const showToast = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(''), 1800);
  }, []);

  // 刷新后从 sessionStorage 恢复上次选择的用户，避免重复登录
  useEffect(() => {
    const saved = window.sessionStorage.getItem(SESSION_USER_KEY);
    if (saved) {
      const fixed = sanitizeFixedUser(saved);
      if (fixed) chooseUser(fixed);
    }
    // 只在挂载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sync = useCallback(async (nextState: LocalUserState, shared = null as Parameters<typeof pushUserState>[1]) => {
    setSyncText('同步中');
    const before = snapshotBuildings(nextState, serverRef.current);
    const result = await pushUserState(nextState, shared);
    const merged = { ...nextState, ...result.restored };
    setUserState(merged);
    setServer(result.server);
    const updates = diffBuildStages(before, snapshotBuildings(merged, result.server));
    if (updates.length) setBuildUpdates(updates);
    setSyncText(result.conflict ? '已从旧数据恢复' : '已同步');
    return merged;
  }, []);

  async function chooseUser(name: string) {
    const fixed = sanitizeFixedUser(name);
    if (!fixed) return;
    setLoading(true);
    setSelectedUser(fixed);
    window.sessionStorage.setItem(SESSION_USER_KEY, fixed);
    try {
      const minimumLoading = new Promise(resolve => window.setTimeout(resolve, 650));
      const [loadedPlan, loadedServer] = await Promise.all([fetchPlan(), fetchServerState(), minimumLoading]);
      const initial = createInitialState(fixed);
      const serverSelf = findSelfRecord(loadedServer.users, fixed);
      const restoredBase = serverSelf ? { ...initial, ...restoreUserFromServer(serverSelf) } : initial;
      const restored = { ...restoredBase, currentDayIndex: getAvailableDayIndex(loadedPlan, restoredBase) };
      // 每日登录彩蛋：计算连续登录天数，命中里程碑则发奖励
      const todayKey = getDateKey();
      const loginResult = computeLoginStreak({ lastLoginDate: restored.lastLoginDate, loginStreak: restored.loginStreak || 0, todayKey });
      const reward = loginResult.milestone ? getLoginReward(loginResult.milestone) : null;
      const withLogin: LocalUserState = {
        ...restored,
        lastLoginDate: loginResult.lastLoginDate,
        loginStreak: loginResult.loginStreak,
        inventory: reward ? { ...restored.inventory, [reward.item]: (restored.inventory[reward.item] || 0) + reward.amount } : restored.inventory,
      };
      setPlan(loadedPlan);
      setServer(loadedServer);
      setUserState(withLogin);
      if (reward) setLoginEgg({ streak: loginResult.milestone!, reward: reward.name });
      await sync(withLogin);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!userState || !plan) return;
    const timer = window.setInterval(async () => {
      try {
        const next = await fetchServerState();
        setServer(next);
        const serverSelf = findSelfRecord(next.users, userState.username);
        if (serverSelf?.syncVersion && serverSelf.syncVersion > userState.syncVersion) {
          setUserState(current => current ? { ...current, ...restoreUserFromServer(serverSelf) } : current);
          setSyncText('已更新旧数据');
        }
        const todayKey = getDateKey();
        const todayEntry = Object.entries(userState.dayStates).find(([, state]) => state?.settled && state.settledDate === todayKey);
        if (!todayEntry) return;
        const todayState = todayEntry[1];
        const dayIdx = Number(todayEntry[0].startsWith('day_') ? todayEntry[0].slice(4) : todayEntry[0]);
        const todayDay = flattenPlanDays(plan)[dayIdx];
        if (!todayDay) return;
        const adjusted = getAdjustedDay(todayDay, todayState.difficulty || userState.selectedDifficulty);
        const fullDone = (todayState.checked || []).filter(Boolean).length >= adjusted.exercises.length;
        const retro = retroactiveHiddenCheck({
          todaySettled: true,
          todayDifficulty: todayState.difficulty || userState.selectedDifficulty,
          todayFullDone: fullDone,
          hasPeerSettledToday: () => hasPeerSettledToday(next, userState.username),
          hasPeerSettledTodayWithDifficulty: (difficulty, requireFull) => hasPeerSettledTodayWithDifficulty(next, userState.username, difficulty, requireFull, plan),
          alreadyDiscovered: userState.collection.discovered,
        });
        if (!retro.length) return;
        const effects = applyHiddenTaskEffects(retro);
        const allNew = [...retro, ...effects.discoveries];
        setUserState(current => {
          if (!current) return current;
          let merged = current;
          const addDelta = (field: 'inventory' | 'warehouseContribution', delta: Record<string, number>) => {
            const nextDelta = { ...merged[field] };
            Object.entries(delta).forEach(([key, value]) => { nextDelta[key] = (nextDelta[key] || 0) + value; });
            merged = { ...merged, [field]: nextDelta };
          };
          if (Object.keys(effects.inventoryDelta || {}).length) addDelta('inventory', effects.inventoryDelta);
          if (Object.keys(effects.warehouseDelta || {}).length) addDelta('warehouseContribution', effects.warehouseDelta);
          if (allNew.length) merged = { ...merged, collection: { ...merged.collection, discovered: Array.from(new Set([...merged.collection.discovered, ...allNew])) } };
          return merged;
        });
        showToast('补发隐藏：' + retro.map(id => HIDDEN_QUESTS.find(q => q.id === id)?.name || id).join('、'));
      } catch {
        setSyncText('同步失败');
      }
    }, 8000);
    return () => window.clearInterval(timer);
  }, [userState, plan, showToast]);

  if (!selectedUser || !userState || !plan || !adjustedDay || !dayState) {
    return (
      <main className="login-screen">
        <Card color="app-teal" pattern="app-teal" className="login-card">
          <div className="login-floating-leaf leaf-one">🍃</div>
          <div className="login-floating-leaf leaf-two">🌿</div>
          <div className="login-stamp">🏝</div>
          <Title size="large" color="app-yellow" className="login-title">动森训练岛</Title>
          <p>选择岛民，开始冒险</p>
          <div className="login-actions">
            {FIXED_USERS.map(name => (
              <button key={name} type="button" className="login-wallet-btn" disabled={loading} onClick={() => chooseUser(name)}>
                <Wallet value={name} thousandSeparator="" />
              </button>
            ))}
          </div>
        </Card>
        {loading && <LegacyLoading />}
        {toast && <CuteTip text={toast} />}
      </main>
    );
  }

  const checkedCount = dayState.checked?.filter(Boolean).length || 0;
  const completion = adjustedDay.exercises.length ? Math.round((checkedCount / adjustedDay.exercises.length) * 100) : 0;
  const activeUserState = userState;
  const activeAdjustedDay = adjustedDay;
  const activePlan = plan;
  const bottleStatuses = activeAdjustedDay ? getBottleQuestStatuses(activeUserState, activeAdjustedDay, activePlan, server) : [];

  async function updateState(next: LocalUserState, successText: string) {
    setUserState(next);
    try {
      await sync(next);
      showToast(successText);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '同步失败');
    }
  }

  async function handleMessage() {
    const text = messageText.trim().slice(0, 40);
    if (!text) return;
    setMessageText('');
    try {
      const shared = { mailboxEntry: { id: `mail_${Date.now()}_${activeUserState.clientId.slice(0, 6)}`, text, createdAt: Date.now() } };
      await sync(activeUserState, shared);
      showToast('留言已贴上');
    } catch (error) {
      setMessageText(text);
      showToast(error instanceof Error ? error.message : '留言失败');
    }
  }

  function openTrainingExport() {
    setExportModal({
      title: '复制训练数据',
      text: createTrainingExportText(activePlan, activeUserState),
    });
  }

  function exportArchive() {
    const payload = createArchivePayload(activeUserState, view);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `fitness-island-save-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(link.href);
    link.remove();
    showToast('存档已导出');
  }

  async function importArchive(file: File | null | undefined) {
    if (!file) return;
    const rollback = activeUserState;
    try {
      const raw = await file.text();
      const payload = JSON.parse(raw);
      const next = applyArchivePayload(activeUserState, payload, days.length);
      setUserState(next);
      await sync(next);
      const importedView = getArchiveActiveView(payload);
      if (navItems.some(item => item.key === importedView)) setView(importedView as ViewKey);
      setExportModal(null);
      showToast('存档已导入');
    } catch (error) {
      setUserState(rollback);
      showToast(error instanceof Error ? error.message : '存档导入失败');
    } finally {
      if (archiveImportRef.current) archiveImportRef.current.value = '';
    }
  }

  async function copyExportText() {
    if (!exportModal?.text) return;
    try {
      await navigator.clipboard.writeText(exportModal.text);
      setExportModal(null);
      showToast('已复制到剪贴板');
    } catch {
      showToast('复制失败，请手动复制');
    }
  }

  async function requestGift(ruleId: string) {
    try {
      const { nextState, claim } = createGiftRequest(activeUserState, ruleId, server);
      await updateStateWithShared(nextState, { giftClaim: claim }, '礼物已放进码头');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '礼物申请失败');
    }
  }

  async function redeemGift(claimId: string) {
    const claim = normalizeGiftClaims(server?.shared?.giftClaims)[claimId];
    try {
      const { nextState, claim: updated } = createGiftRedeemPatch(claim, activeUserState);
      await updateStateWithShared(nextState, { giftClaim: updated }, '已记录兑现');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '兑现失败');
    }
  }

  async function addWish() {
    const next = updateWishList(getOwnWishList(server, activeUserState), wishText);
    if (!wishText.trim() || next.length === getOwnWishList(server, activeUserState).length) return;
    setWishText('');
    try {
      await sync(activeUserState, { wishList: next });
      showToast('心愿已放进码头');
    } catch (error) {
      setWishText(wishText);
      showToast(error instanceof Error ? error.message : '心愿同步失败');
    }
  }

  async function removeWish(index: number) {
    const next = updateWishList(getOwnWishList(server, activeUserState), undefined, index);
    try {
      await sync(activeUserState, { wishList: next });
      showToast('心愿已移除');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '心愿同步失败');
    }
  }

  async function fulfillWish(fulfillmentId: string) {
    const entry = getPeerWishEntries(server, activeUserState).find(item => item.fulfillmentId === fulfillmentId);
    if (!entry) return;
    try {
      await sync(activeUserState, { wishFulfillment: createWishFulfillment(entry, activeUserState) });
      showToast('已记录你实现了这个心愿');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '心愿实现同步失败');
    }
  }

  async function placeDecor(id: string) {
    try {
      const { nextState, patch } = createDecorPlacement(activeUserState, server, id);
      await updateStateWithShared(nextState, { decorItem: patch }, '装饰已放到岛上');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '装饰放置失败');
    }
  }

  async function handleCraftGrid(grid: CraftGrid) {
    const result = craftFromGrid(activeUserState, grid);
    if (!result.ok) { showToast(result.reason || '合成失败'); return; }
    await updateState(result.state, result.recipe ? `合成完成：${result.recipe.name}` : '合成完成');
  }

  async function handlePlaceCraft(recipeId: string) {
    const seq = (server?.shared?.placedCrafts || []).length;
    const result = placeCraft(activeUserState, recipeId, seq, Date.now());
    if (!result.ok) { showToast(result.reason || '摆放失败'); return; }
    await updateStateWithShared(result.state, { craftPlacement: result.patch.craftPlacement }, '已摆放到岛上');
  }

  async function handlePlaceRoomFurniture(recipeId: string, tx: number, ty: number) {
    const result = placeRoomFurniture(activeUserState, recipeId, tx, ty);
    if (!result.ok) { showToast(result.reason || '摆放失败'); return; }
    await updateState(result.state, '家具已放入房间');
  }

  async function handleRemoveRoomFurniture(uid: string) {
    await updateState(removeRoomFurniture(activeUserState, uid), '家具已收回');
  }

  async function handleSaveBuildingPosition(id: string, x: number, y: number) {
    await sync(activeUserState, { buildingPosition: { id, x, y } }).then(() => showToast('位置已保存')).catch(() => showToast('位置保存失败'));
  }

  async function handleSaveCraftPosition(id: string, x: number, y: number) {
    await sync(activeUserState, { craftPosition: { id, x, y } }).then(() => showToast('位置已保存')).catch(() => showToast('位置保存失败'));
  }

  async function updateStateWithShared(nextState: LocalUserState, shared: Parameters<typeof sync>[1], successText: string) {
    setUserState(nextState);
    try {
      await sync(nextState, shared);
      showToast(successText);
    } catch (error) {
      setUserState(activeUserState);
      showToast(error instanceof Error ? error.message : '同步失败');
    }
  }

  function showArchiveDay(index: number) {
    const archivedDay = getDayByArchiveIndex(activePlan, index);
    if (!archivedDay) return;
    const archivedState = activeUserState.dayStates[getDayKey(index)] || {};
    const adjusted = getAdjustedDay(archivedDay, archivedState.difficulty || activeUserState.selectedDifficulty);
    const checked = Array.isArray(archivedState.checked) ? archivedState.checked : [];
    const checkedCount = checked.filter(Boolean).length;
    const total = adjusted.exercises.length;
    let status = '未记录';
    if (archivedState.rest) status = '今天休息';
    else if (archivedState.settled && checkedCount >= total) status = '完整完成';
    else if (archivedState.settled) status = `今天到这 ${checkedCount}/${total}`;
    const difficulty = DIFFICULTIES[archivedState.difficulty || activeUserState.selectedDifficulty];
    const planMode = PLAN_MODES[archivedState.planMode || activeUserState.selectedPlanMode];
    const rewards = (archivedState.rewards || []).map(key => ITEMS[key]?.name || key).join('、') || '无';
    const lines = [
      `状态：${status}`,
      `难度：${difficulty.label}`,
      `路线：${planMode.label}`,
      `分钟：${archivedState.minutes || adjusted.minutes || 0}`,
      `奖励：${rewards}`,
      ...adjusted.exercises.map((exercise, exerciseIndex) => `${checked[exerciseIndex] ? '✓' : '○'} ${exercise[0]} · ${exercise[1]}`),
    ];
    setDetailModal({
      title: archivedDay.title,
      lines,
    });
  }

  async function handleUseItem(key: string) {
    const useResult = resolveItemUse(key, activeUserState.inventory);
    if (!useResult) return;
    if (useResult.action === 'reveal_bottle_clue') {
      const reveal = revealExtraBottleClue(activeUserState.inventory.nookMilesTicket || 0, activeUserState.currentDayIndex);
      if (!reveal.ok) { showToast(reveal.error || '里数券不足'); return; }
      const next: LocalUserState = {
        ...activeUserState,
        inventory: { ...activeUserState.inventory, nookMilesTicket: Math.max(0, (activeUserState.inventory.nookMilesTicket || 0) - 1) },
        collection: { ...activeUserState.collection, discovered: Array.from(new Set([...activeUserState.collection.discovered, reveal.discovery!])) },
      };
      updateState(next, '里数券已使用');
      setDetailModal({ title: '瓶中信线索', body: reveal.clue! });
      return;
    }
    if (useResult.discovery && useResult.consume) {
      const next: LocalUserState = {
        ...activeUserState,
        inventory: { ...activeUserState.inventory, [useResult.consume]: Math.max(0, (activeUserState.inventory[useResult.consume] || 0) - 1) },
        collection: { ...activeUserState.collection, discovered: Array.from(new Set([...activeUserState.collection.discovered, useResult.discovery])) },
      };
      updateState(next, useResult.consume === 'starFragment' ? '星星地砖已点亮' : '金色树叶已登记');
      return;
    }
    if (useResult.action === 'navigate_island') {
      setView('island');
    }
  }

  const contentByView: Record<ViewKey, ReactNode> = {
    today: (
      <TodayView
        day={activeAdjustedDay}
        checked={dayState.checked || []}
        completion={completion}
        userState={activeUserState}
        plan={activePlan}
        server={server}
        peers={peers}
        mailbox={mailbox}
        messageText={messageText}
        setMessageText={setMessageText}
        onMessage={handleMessage}
        onDifficulty={difficulty => updateState({ ...activeUserState, selectedDifficulty: difficulty }, '难度已切换')}
        locked={Boolean(dayState?.settled || dayState?.rest)}
        onToggle={index => {
          if (dayState?.settled || dayState?.rest) return;
          updateState(toggleTask(activeUserState, dayKey, index, activeAdjustedDay.exercises.length), '任务已更新');
        }}
        onSettle={() => {
          if (!canCheckInDay(activeUserState.currentDayIndex, activePlan, activeUserState)) {
            showToast(hasSettledToday(activeUserState.dayStates) ? '今天已盖章，明天再继续' : '今天只能打卡今天');
            return;
          }
          const next = settleWithHidden(activeUserState, activeAdjustedDay, dayKey, activePlan, server);
          setRewardModal(next.dayStates[dayKey].rewards || []);
          // 关键日期彩蛋：结算命中节日且首次发现 → 弹彩蛋
          const festivalToday = getFestivalToday(new Date());
          const festivalBonus = applyFestivalBonus(festivalToday, true, activeUserState.collection.discovered);
          if (festivalBonus && festivalToday) setFestivalEgg({ name: festivalToday.name, text: festivalToday.text, reward: festivalBonus.reward });
          updateState(next, '今日已结算');
        }}
        onRest={() => updateState(restToday(activeUserState, dayKey, activeAdjustedDay.exercises.length), '已记录休息日')}
        archiveRows={archiveRows}
        onArchiveDay={showArchiveDay}
        onViewIsland={() => setView('island')}
      />
    ),
    island: <IslandView state={activeUserState} server={server} onDetail={setDetailModal} bottleStatuses={bottleStatuses} onDecorPlace={placeDecor} onViewMuseum={() => setView('collection')} onViewStorage={() => setView('storage')} onViewWorkshop={() => setView('workshop')} onViewRoom={() => setView('room')} onSaveBuildingPosition={handleSaveBuildingPosition} onSaveCraftPosition={handleSaveCraftPosition} />,
    bag: <BagView state={activeUserState} onDetail={setDetailModal} onUse={handleUseItem} />,
    collection: null, // 由 view==='collection' 早返回的 MuseumShell 接管，此处永不渲染
    gift: (
      <GiftView
        state={activeUserState}
        server={server}
        wishText={wishText}
        setWishText={setWishText}
        onWishAdd={addWish}
        onWishRemove={removeWish}
        onWishFulfill={fulfillWish}
        onGiftRequest={requestGift}
        onGiftRedeem={redeemGift}
      />
    ),
    coop: <CoopView state={activeUserState} server={server} plan={activePlan} onSettle={event => { sync(activeUserState, { weeklyEvent: event }).then(() => showToast('周结算公告已贴到贡献页')).catch(() => showToast('周结算同步失败')); }} />,
    storage: <></>,
    workshop: null,
    room: null,
  };

  if (view === 'collection' && activeUserState) {
    return (
      <MuseumShell state={activeUserState} server={server} onLeave={() => setView('island')} onDetail={setDetailModal} detail={detailModal} onDetailClose={() => setDetailModal(null)} />
    );
  }
  if (view === 'storage' && activeUserState) {
    return <StorageShell state={activeUserState} server={server} onLeave={() => setView('island')} />;
  }
  if (view === 'workshop' && activeUserState) {
    return <WorkshopShell state={activeUserState} onLeave={() => setView('island')} onCraftGrid={handleCraftGrid} onPlace={handlePlaceCraft} onDetail={setDetailModal} detail={detailModal} onDetailClose={() => setDetailModal(null)} />;
  }
  if (view === 'room' && activeUserState) {
    return <RoomShell state={activeUserState} onLeave={() => setView('island')} onPlace={handlePlaceRoomFurniture} onRemove={handleRemoveRoomFurniture} />;
  }
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="profile">
          <button type="button" className="profile-avatar-btn" onClick={() => setAvatarModalOpen(true)} aria-label="换头像">
            <Avatar id={userState.avatar} />
          </button>
          <div>
            <strong>{userState.username}</strong>
            <span>{syncText}</span>
          </div>
        </div>
        <div className="topbar-actions">
          <Button size="small" type="primary" onClick={openTrainingExport}>导出</Button>
          <Button size="small" type="default" onClick={() => { window.sessionStorage.removeItem(SESSION_USER_KEY); setSelectedUser(null); setUserState(null); }}>切换</Button>
        </div>
      </header>

      <section className="app-view-shell">
        {contentByView[view]}
      </section>

      <nav className="floating-nav" aria-label="主导航">
        {navItems.map(item => (
          <button
            key={item.key}
            className={`nav-btn ${view === item.key ? 'active' : ''}`}
            type="button"
            onClick={() => setView(item.key)}
          >
            <span className="nav-symbol"><img className="nav-icon-img" src={navIcon(item.key)} alt="" /></span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <Modal open={Boolean(rewardModal)} title="盖章啦" typewriter={false} onClose={() => setRewardModal(null)} footer={<Button type="primary" onClick={() => setRewardModal(null)}>收下</Button>}>
        <div className="reward-list">
          {(rewardModal || []).map(item => <ItemPill key={item} item={item} />)}
          {!rewardModal?.length && <p>今天先守住出现，也算登岛。</p>}
        </div>
      </Modal>
      <Modal open={Boolean(loginEgg)} title="🎉 连续登录彩蛋" typewriter={false} onClose={() => setLoginEgg(null)} footer={<Button type="primary" onClick={() => setLoginEgg(null)}>收下</Button>}>
        {loginEgg && (
          <div className="reward-list">
            <p>连续登录 <strong>{loginEgg.streak}</strong> 天！获得 {loginEgg.reward}。</p>
          </div>
        )}
      </Modal>
      <Modal open={Boolean(festivalEgg)} title={`🎁 ${festivalEgg?.name || ''}`} typewriter={false} onClose={() => setFestivalEgg(null)} footer={<Button type="primary" onClick={() => setFestivalEgg(null)}>收下</Button>}>
        {festivalEgg && (
          <div className="reward-list">
            <p>{festivalEgg.text}</p>
            <p><ItemPill item={festivalEgg.reward} /></p>
          </div>
        )}
      </Modal>
      <Modal open={Boolean(detailModal)} title={detailModal?.title} typewriter={false} onClose={() => setDetailModal(null)} footer={<Button type="primary" onClick={() => setDetailModal(null)}>知道了</Button>}>
        {detailModal?.cards?.length ? (
          <div className="bottle-clues">
            {detailModal.cards.map(card => (
              <div key={card.id} className={`bottle-clue ${card.status}`.trim()}>
                <span className="bottle-clue-tier">{card.tier}</span>
                <span className="bottle-clue-name">{card.name}</span>
                <div className="bottle-clue-body">{card.body}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="modal-lines">
            {(detailModal?.lines || (detailModal?.body ? [detailModal.body] : [])).map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
          </div>
        )}
      </Modal>
      <Modal
        open={Boolean(exportModal)}
        title={exportModal?.title}
        typewriter={false}
        onClose={() => setExportModal(null)}
        footer={(
          <div className="modal-actions">
            <Button type="primary" onClick={copyExportText}>复制</Button>
            <Button type="default" onClick={exportArchive}>导出存档</Button>
            <Button type="default" onClick={() => archiveImportRef.current?.click()}>导入存档</Button>
            <Button type="default" onClick={() => setExportModal(null)}>关闭</Button>
          </div>
        )}
      >
        <textarea className="export-textarea" readOnly value={exportModal?.text || ''} />
        <input
          ref={archiveImportRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={event => importArchive(event.target.files?.[0])}
        />
      </Modal>
      <Modal open={avatarModalOpen} title="选择头像" typewriter={false} onClose={() => setAvatarModalOpen(false)} footer={<Button type="primary" onClick={() => setAvatarModalOpen(false)}>完成</Button>}>
        <AvatarPicker avatars={AVATARS} selected={userState.avatar} onSelect={id => { const next = { ...userState, avatar: id }; setUserState(next); sync(next); }} />
      </Modal>
      <BuildUpdateModal updates={buildUpdates} onClose={() => setBuildUpdates([])} />
      {toast && <CuteTip text={toast} />}
    </main>
  );
}

function LegacyLoading({ text = '正在加载训练岛' }: { text?: string }) {
  return (
    <div className="legacy-loading-mask" role="status" aria-live="polite" aria-label={text}>
      <div className="legacy-loading-animal">{text}</div>
      <div className="legacy-loading-text">{text}…</div>
      <div className="legacy-loading-bar">
        <div className="legacy-loading-bar-inner" />
      </div>
    </div>
  );
}

function MuseumShell({ state, server, onLeave, onDetail, detail, onDetailClose }: { state: LocalUserState; server: ServerState | null; onLeave: () => void; onDetail: (value: { title: string; body?: string; lines?: string[] }) => void; detail: { title: string; body?: string; lines?: string[] } | null; onDetailClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [activeRoom, setActiveRoom] = useState<MuseumRoomId | 'all'>('all');
  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 1200);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(onLeave, 1200);
    return () => window.clearTimeout(timer);
    // 故意只依赖 leaving：onLeave 每次 render 是新函数，加入会导致离开定时器反复重置
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);

  // 奖杯进度上下文（与 trophies.ts TrophyContext 对齐）
  const trophyCtx: TrophyContext = {
    settledDays: countSettledDays(state),
    warehouseTotal: sumCounts(getSharedWarehouse(state, server)),
    discovered: state.collection.discovered,
    starFragment: state.inventory.starFragment || 0,
    wishPickProgress: Object.values(state.dayStates).filter(day => day.difficulty === 'challenge' && day.done).length,
    hasRedeemedGift: Object.values(state.giftClaims).some(claim => typeof claim === 'object' && claim.status === 'redeemed'),
  };
  const museumCtx: MuseumContext = {
    inventory: state.inventory,
    discovered: state.collection.discovered,
    giftProgress: (ruleId: string) => getGiftProgress(ruleId, state, server),
    trophyProgress: (id: string) => getTrophyProgress(id, trophyCtx),
  };
  const rooms = getMuseumRooms(museumCtx);
  const exhibits = getMuseumExhibits(museumCtx);
  const visible = activeRoom === 'all' ? exhibits : exhibits.filter(exhibit => exhibit.room === activeRoom);
  const doneCount = exhibits.filter(exhibit => exhibit.found).length;
  const total = exhibits.length || 1;
  const roomName = activeRoom === 'all' ? '全部馆藏' : MUSEUM_ROOMS.find(room => room.id === activeRoom)?.name || '馆藏';

  if (loading || leaving) return <LegacyLoading text={leaving ? '正在返回小岛' : '正在走进博物馆'} />;
  return (
    <main className="museum-shell">
      <button type="button" className="museum-leave-btn" onClick={() => setLeaving(true)}>← 离开博物馆</button>
      <Card className="island-panel museum-head-card">
        <div className="section-head">
          <div>
            <div className="section-title">博物馆</div>
            <p className="museum-sub">这里只收藏稀有物品、隐藏传闻、真实礼物和奖杯。</p>
          </div>
          <span className="museum-total">已入馆 <strong>{doneCount}</strong> / {exhibits.length}</span>
        </div>
        <div className="museum-room-grid">
          <button type="button" className={`museum-room ${activeRoom === 'all' ? 'active' : ''}`} onClick={() => setActiveRoom('all')}>
            <span className="museum-room-icon">🏛</span>
            <span className="museum-room-name">全部馆藏</span>
            <span className="museum-room-count">{doneCount}/{exhibits.length}</span>
            <span className="museum-room-bar"><span style={{ width: `${Math.round((doneCount / total) * 100)}%` }} /></span>
          </button>
          {rooms.map(room => (
            <button key={room.id} type="button" className={`museum-room ${activeRoom === room.id ? 'active' : ''}`} onClick={() => setActiveRoom(room.id)}>
              <span className="museum-room-icon">{room.icon}</span>
              <span className="museum-room-name">{room.name}</span>
              <span className="museum-room-count">{room.found}/{room.total}</span>
              <span className="museum-room-bar"><span style={{ width: `${room.pct}%` }} /></span>
            </button>
          ))}
        </div>
      </Card>
      <section className="item-grid collection-grid museum-cabinet">
        {visible.map(exhibit => {
          const found = exhibit.found;
          const showProgress = exhibit.progressTarget > 1;
          const exhibitRoomName = MUSEUM_ROOMS.find(room => room.id === exhibit.room)?.name || roomName;
          return (
            <Card
              key={exhibit.id}
              className={`collection-card ${found ? 'is-discovered' : 'is-locked'}`}
              onClick={() => onDetail({
                title: found ? exhibit.name : '未入馆',
                lines: [
                  `展厅：${MUSEUM_ROOMS.find(room => room.id === exhibit.room)?.name || ''}`,
                  `来源：${exhibit.source}`,
                  `用途：${exhibit.use}`,
                  showProgress ? `进度：${exhibit.progressValue} / ${exhibit.progressTarget}` : found ? '已入馆' : '尚未达成',
                ],
              })}
            >
              <div className="collection-item-main">
                <span className="collection-item-name">
                  {found ? exhibit.name : '???'}
                  <small>{exhibitRoomName}</small>
                </span>
              </div>
              <span className="collection-item-status">
                {showProgress ? `${exhibit.progressValue}/${exhibit.progressTarget}` : found ? '已入馆' : '未入馆'}
              </span>
            </Card>
          );
        })}
      </section>
      <Modal open={Boolean(detail)} title={detail?.title} typewriter={false} onClose={onDetailClose} footer={<Button type="primary" onClick={onDetailClose}>知道了</Button>}>
        <div className="modal-lines">
          {(detail?.lines || (detail?.body ? [detail.body] : [])).map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
        </div>
      </Modal>
    </main>
  );
}

const RAW_MATERIALS = ['wood', 'softwood', 'hardwood', 'stone', 'weed', 'clay', 'shell', 'ironNugget'];

function WorkshopShell({ state, onLeave, onCraftGrid, onPlace, onDetail, detail, onDetailClose }: {
  state: LocalUserState;
  onLeave: () => void;
  onCraftGrid: (grid: CraftGrid) => void;
  onPlace: (recipeId: string) => void;
  onDetail: (value: { title: string; body?: string; lines?: string[] }) => void;
  detail: { title: string; body?: string; lines?: string[] } | null;
  onDetailClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [grid, setGrid] = useState<CraftGrid>(Array(9).fill(null));
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 1200);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(onLeave, 1200);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);
  if (loading || leaving) return <LegacyLoading text={leaving ? '正在返回小岛' : '正在走进工坊'} />;

  const placedCounts: Record<string, number> = {};
  grid.forEach(key => { if (key) placedCounts[key] = (placedCounts[key] || 0) + 1; });
  const available = (mat: string) => (state.inventory[mat] || 0) - (placedCounts[mat] || 0);
  const matched = matchGridRecipe(grid);
  // 可放入格子的材料：原材料 + 已拥有的家具产物
  const ownedProducts = GRID_RECIPES.filter(r => (state.inventory[r.id] || 0) > 0).map(r => r.id);
  const placeable = [
    ...RAW_MATERIALS.filter(mat => (state.inventory[mat] || 0) > 0),
    ...ownedProducts,
  ];

  function clickCell(index: number) {
    setGrid(prev => {
      const next = [...prev];
      if (next[index]) {
        next[index] = null; // 清空已填格子
      } else {
        const placed: Record<string, number> = {};
        next.forEach(key => { if (key) placed[key] = (placed[key] || 0) + 1; });
        const left = (state.inventory[selected!] || 0) - (placed[selected!] || 0);
        if (selected && left > 0) next[index] = selected; // 放入选中材料
      }
      return next;
    });
  }

  return (
    <main className="museum-shell">
      <button type="button" className="museum-leave-btn" onClick={() => setLeaving(true)}>← 离开工坊</button>
      <Card className="island-panel museum-head-card">
        <div className="section-head">
          <div>
            <div className="section-title">工坊 · 合成台</div>
            <p className="museum-sub">把材料放进 3×3 格子，组合出不同家具或房子。点材料选中，点格子放入，再点格子清空。</p>
          </div>
        </div>
      </Card>

      <Card className="island-panel">
        <div className="craft-materials">
          {placeable.map(mat => (
            <button
              key={mat}
              type="button"
              className={`craft-mat ${selected === mat ? 'active' : ''}`}
              onClick={() => setSelected(selected === mat ? null : mat)}
            >
              <span className="craft-mat-icon">{ITEMS[mat]?.img ? <img src={ITEMS[mat].img} alt="" /> : ITEMS[mat]?.emoji}</span>
              {ITEMS[mat]?.name || mat} <small>{available(mat)}</small>
            </button>
          ))}
          {placeable.length === 0 && <p className="muted">先去打卡收集材料。</p>}
        </div>
      </Card>

      <Card className="island-panel">
        <div className="craft-stage">
          <div className="craft-grid">
            {grid.map((cell, index) => (
              <button
                key={index}
                type="button"
                className={`craft-cell ${cell ? 'filled' : ''} ${selected && !cell ? 'selectable' : ''}`}
                onClick={() => clickCell(index)}
              >
                {cell ? (ITEMS[cell]?.img ? <img src={ITEMS[cell].img} alt="" /> : ITEMS[cell]?.emoji || cell) : ''}
              </button>
            ))}
          </div>
          <div className="craft-output">
            <div className={`craft-output-slot ${matched ? 'ready' : ''}`}>
              {matched ? `${matched.icon} ${matched.name}` : '（未匹配配方）'}
            </div>
            <Button type="primary" disabled={!matched} onClick={() => { if (matched) { onCraftGrid(grid); setGrid(Array(9).fill(null)); } }}>合成</Button>
          </div>
        </div>
      </Card>

      <Card className="island-panel">
        <Title size="small">已打造</Title>
        <section className="item-grid collection-grid museum-cabinet">
          {GRID_RECIPES.filter(r => (state.inventory[r.id] || 0) > 0).map(recipe => (
            <Card key={recipe.id} className="collection-card is-discovered" onClick={() => onDetail({ title: recipe.name, lines: [recipe.desc, `类别：${recipe.category === 'house' ? '房子' : '家具'}`] })}>
              <div className="collection-item-main">
                <span className="collection-item-name">{recipe.icon} {recipe.name}<small>{recipe.category === 'house' ? '房子' : '家具'}</small></span>
              </div>
              <span className="collection-item-status">拥有 {state.inventory[recipe.id] || 0}</span>
              {recipe.category === 'house' && <Button type="default" size="small" onClick={() => onPlace(recipe.id)}>摆到岛上</Button>}
            </Card>
          ))}
          {!GRID_RECIPES.some(r => (state.inventory[r.id] || 0) > 0) && <p className="muted">还没打造出任何东西。</p>}
        </section>
      </Card>

      <Card className="island-panel">
        <Title size="small">配方图鉴</Title>
        <p className="muted" style={{ marginBottom: 10 }}>把下列材料组合放进 3×3 格子即可合成（与摆放位置无关）。</p>
        <section className="recipe-list">
          {GRID_RECIPES.map(recipe => {
            const owned = state.inventory[recipe.id] || 0;
            const canMake = Object.entries(recipe.ingredients).every(([key, need]) => (state.inventory[key] || 0) >= need);
            return (
              <div key={recipe.id} className={`recipe-row ${canMake ? '' : 'locked'}`}>
                <span className="recipe-output">{recipe.icon} {recipe.name}</span>
                <span className="recipe-ingredients">
                  {Object.entries(recipe.ingredients).map(([key, need]) => (
                    <span key={key} className="recipe-ing">
                      {ITEMS[key]?.img ? <img src={ITEMS[key].img} alt="" /> : ITEMS[key]?.emoji}
                      <small>{ITEMS[key]?.name || key} {state.inventory[key] || 0}/{need}</small>
                    </span>
                  ))}
                </span>
                <span className="recipe-tag">{recipe.category === 'house' ? '房子' : '家具'}{owned > 0 ? ` · 已有 ${owned}` : ''}</span>
              </div>
            );
          })}
        </section>
      </Card>

      <Modal open={Boolean(detail)} title={detail?.title} typewriter={false} onClose={onDetailClose} footer={<Button type="primary" onClick={onDetailClose}>知道了</Button>}>
        <div className="modal-lines">
          {(detail?.lines || (detail?.body ? [detail.body] : [])).map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
        </div>
      </Modal>
    </main>
  );
}

function RoomShell({ state, onLeave, onPlace, onRemove }: {
  state: LocalUserState;
  onLeave: () => void;
  onPlace: (recipeId: string, tx: number, ty: number) => void;
  onRemove: (uid: string) => void;
}) {
  // 房间用 room_assets/01 整图打底；家具固定布局（固定网格位+固定尺寸），无人物、无自由摆放
  const TILE_W = 80;
  const TILE_H = 40;
  const baseW = 600;
  const baseH = 450;
  const originX = 300;
  const baseY = 195;

  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / 600);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const centerC = (tx: number, ty: number) => ({
    x: originX + (tx - ty) * TILE_W / 2,
    y: baseY + (tx + ty) * TILE_H / 2,
  });

  // 固定布局（参照 房间.png）：方位 + 差异化大小；地毯置底层 z
  const FURNITURE_LAYOUT: Record<string, { tx: number; ty: number; w: number; z?: number; flip?: boolean; ground?: boolean; dy?: number }> = {
    bed:           { tx: 0, ty: 2, w: 152, flip: true },   // 左侧单人床·贴左墙（翻转使背面靠墙）
    shelf:         { tx: 3, ty: 0, w: 116, dy: -40 },        // 后墙中部（缩小·往后贴墙）
    rug:           { tx: 2, ty: 2, w: 236, z: 2, ground: true }, // 中央大型圆地毯（平贴地面·底层）
    wooden_table:  { tx: 4, ty: 3, w: 88 },                // 右中小茶几
    lamp:          { tx: 5, ty: 0, w: 34, dy: -40 },         // 后墙右端（缩小·往后贴墙）
    flower_pot:    { tx: 1, ty: 3, w: 46 },                // 地上小植物
    wooden_chair:  { tx: 3, ty: 4, w: 52 },                // 地上坐垫
  };

  const renderFurnitureSvg = (recipeId: string, small = false) => {
    const scale = small ? 0.72 : 1;
    const ink = '#6e4226';
    const wrap = (children: ReactNode, w = 88, h = 84) => (
      <svg className="room-furniture-svg" width={w * scale} height={h * scale} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        {children}
      </svg>
    );

    switch (recipeId) {
      case 'bed':
        return wrap(
          <>
            <ellipse cx="44" cy="77" rx="38" ry="8" fill="rgba(60,38,20,.22)" />
            <path d="M47 60 L79 41 L79 56 L47 75 Z" fill="#7a4a2e" />
            <path d="M14 42 L47 60 L47 75 L14 57 Z" fill="#9a6240" />
            <path d="M14 42 L45 24 L79 41 L47 60 Z" fill="#b57d4e" />
            <path d="M14 42 L45 24 L79 41 L47 60 L14 42" fill="none" stroke={ink} strokeWidth="1" strokeLinejoin="round" />
            <path d="M47 60 L47 75" stroke={ink} strokeWidth="1" />
            <path d="M45 24 L45 13 L51 10 L51 21 Z" fill="#8f5638" stroke={ink} strokeWidth="1" strokeLinejoin="round" />
            <path d="M46 13 L50 11" stroke="#c89370" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M18 49 L47 32 L76 46 L47 63 Z" fill="#d95f52" stroke="#b8443a" strokeWidth="1" strokeLinejoin="round" />
            <path d="M26 45 L54 59 M34 41 L62 55 M42 37 L70 51" stroke="#fff0df" strokeWidth="1.4" opacity=".8" />
            <path d="M21 40 L45 27 L60 34 L37 48 Z" fill="#fffaf2" stroke="#e6d6bc" strokeWidth="1" strokeLinejoin="round" />
            <path d="M24 41 L44 30" stroke="#fff" strokeWidth="2" opacity=".55" strokeLinecap="round" />
          </>,
          90, 86,
        );

      case 'shelf':
        return wrap(
          <>
            <ellipse cx="45" cy="77" rx="33" ry="7" fill="rgba(60,38,20,.22)" />
            <path d="M43 46 L77 28 L77 58 L43 75 Z" fill="#7c4d2e" />
            <path d="M16 28 L43 46 L43 75 L16 56 Z" fill="#9a6240" />
            <path d="M16 28 L50 11 L77 28 L43 46 Z" fill="#b9824f" />
            <path d="M16 28 L50 11 L77 28 L43 46 L16 28" fill="none" stroke={ink} strokeWidth="1" strokeLinejoin="round" />
            <path d="M22 36 L44 47 M22 46 L44 57 M22 56 L44 67" stroke="#5e3820" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M48 44 L72 32 M48 54 L72 42 M48 64 L72 52" stroke="#5e3820" strokeWidth="1.4" strokeLinecap="round" />
            {[
              { x: 25, y: 30, c: '#f4d46a' }, { x: 30, y: 32, c: '#77b7dc' }, { x: 35, y: 29, c: '#d95f52' },
            ].map((b, i) => (
              <rect key={`l${i}`} x={b.x} y={b.y} width="4.5" height="14" rx="1" fill={b.c} stroke="rgba(0,0,0,.15)" strokeWidth="0.5" transform={`rotate(28 ${b.x + 2} ${b.y + 7})`} />
            ))}
            {[
              { x: 53, y: 36, c: '#e88f3e' }, { x: 58, y: 34, c: '#6cb66d' }, { x: 63, y: 37, c: '#c9a06a' },
            ].map((b, i) => (
              <rect key={`r${i}`} x={b.x} y={b.y} width="4.5" height="14" rx="1" fill={b.c} stroke="rgba(0,0,0,.15)" strokeWidth="0.5" transform={`rotate(28 ${b.x + 2} ${b.y + 7})`} />
            ))}
            <path d="M20 28 L50 13" stroke="#fff" strokeWidth="2" opacity=".3" strokeLinecap="round" />
          </>,
          90, 86,
        );

      case 'wooden_table':
        return wrap(
          <>
            <ellipse cx="44" cy="70" rx="32" ry="8" fill="rgba(60,38,20,.22)" />
            <ellipse cx="44" cy="33" rx="27" ry="11" fill="#e3ad74" stroke={ink} strokeWidth="1" />
            <ellipse cx="44" cy="31" rx="22" ry="8" fill="none" stroke="#c98a52" strokeWidth="0.8" opacity=".6" />
            <path d="M17 34 L17 44 M71 34 L71 44" stroke="#7a4a2e" strokeWidth="3" strokeLinecap="round" />
            <path d="M28 41 L28 60 M60 41 L60 60" stroke="#6e4226" strokeWidth="4.5" strokeLinecap="round" />
            <ellipse cx="44" cy="28" rx="6" ry="3" fill="#fff2cc" stroke="#d9b97e" strokeWidth="0.8" />
            <circle cx="44" cy="20" r="4" fill="#e85d8f" />
            <circle cx="40" cy="22" r="3" fill="#f4a8c8" />
            <circle cx="48" cy="22" r="3" fill="#f4a8c8" />
            <path d="M30 28 L40 24" stroke="#fff" strokeWidth="2" opacity=".4" strokeLinecap="round" />
          </>,
        );

      case 'wooden_chair':
        return wrap(
          <>
            <ellipse cx="45" cy="71" rx="27" ry="7" fill="rgba(60,38,20,.22)" />
            <path d="M34 23 L53 12 L59 15 L40 26 Z" fill="#a86d45" stroke={ink} strokeWidth="1" strokeLinejoin="round" />
            <path d="M37 18 L52 11 M39 22 L55 15" stroke="#7a4a2e" strokeWidth="1" />
            <path d="M44 55 L66 43 L66 52 L44 65 Z" fill="#8c5839" />
            <path d="M23 43 L44 55 L44 65 L23 52 Z" fill="#a46843" />
            <path d="M23 43 L45 30 L66 43 L44 55 Z" fill="#d8a26b" stroke={ink} strokeWidth="1" strokeLinejoin="round" />
            <path d="M28 45 L46 35 L60 43 L44 52 Z" fill="#f3d1a4" stroke="#d9b07a" strokeWidth="0.8" />
            <path d="M30 46 L45 38" stroke="#fff" strokeWidth="1.5" opacity=".45" strokeLinecap="round" />
            <path d="M28 53 L28 67 M60 50 L60 64" stroke="#6e4226" strokeWidth="4" strokeLinecap="round" />
          </>,
        );

      case 'flower_pot':
        return wrap(
          <>
            <ellipse cx="43" cy="71" rx="22" ry="6" fill="rgba(60,38,20,.22)" />
            <path d="M30 47 L57 47 L52 67 L35 67 Z" fill="#c77b48" stroke="#9a5a30" strokeWidth="1" strokeLinejoin="round" />
            <ellipse cx="43.5" cy="47" rx="14" ry="5.5" fill="#e09b64" stroke="#9a5a30" strokeWidth="1" />
            <path d="M33 50 L36 64" stroke="#fff" strokeWidth="1.5" opacity=".3" strokeLinecap="round" />
            <path d="M42 45 C33 31 25 30 22 35 C31 36 37 40 42 45Z" fill="#4f9f5e" stroke="#3d7d49" strokeWidth="0.8" />
            <path d="M44 44 C46 29 56 25 62 31 C53 34 49 39 44 44Z" fill="#5cb66d" stroke="#3d7d49" strokeWidth="0.8" />
            <path d="M43 45 C39 28 46 21 52 25 C50 32 47 38 43 45Z" fill="#78c87a" stroke="#3d7d49" strokeWidth="0.8" />
            <circle cx="30" cy="36" r="3.5" fill="#ffe07a" stroke="#e8b94a" strokeWidth="0.6" />
            <circle cx="57" cy="34" r="3.5" fill="#ffd0dc" stroke="#e89aac" strokeWidth="0.6" />
            <circle cx="47" cy="27" r="3" fill="#f4a8c8" stroke="#d97aa0" strokeWidth="0.6" />
          </>,
          88, 78,
        );

      case 'lamp':
        return wrap(
          <>
            <ellipse cx="43" cy="72" rx="23" ry="6" fill="rgba(60,38,20,.22)" />
            <circle cx="43" cy="30" r="20" fill="rgba(255,232,150,.30)" />
            <path d="M27 30 L43 14 L60 30 L54 46 L33 46 Z" fill="#ffe89f" stroke="#d9a94f" strokeWidth="1" strokeLinejoin="round" />
            <path d="M27 30 L33 46 L54 46 L60 30" fill="none" stroke="#c9923f" strokeWidth="1" />
            <path d="M33 46 L54 46" stroke="#b07e2f" strokeWidth="1.5" />
            <path d="M30 28 L40 18" stroke="#fff" strokeWidth="2" opacity=".5" strokeLinecap="round" />
            <path d="M43 46 L43 64" stroke="#8f623d" strokeWidth="4" strokeLinecap="round" />
            <path d="M34 63 L53 63 L58 71 L29 71 Z" fill="#9b6c45" stroke="#6e4226" strokeWidth="1" strokeLinejoin="round" />
            <ellipse cx="43.5" cy="63" rx="9.5" ry="3" fill="#b98a5e" />
          </>,
          88, 80,
        );

      case 'rug':
        return wrap(
          <>
            <ellipse cx="44" cy="56" rx="37" ry="18" fill="#f3ead8" stroke="#d9c8a8" strokeWidth="1.5" />
            <ellipse cx="44" cy="56" rx="30" ry="14" fill="#fffaf0" />
            <ellipse cx="44" cy="56" rx="36" ry="17" fill="none" stroke="#c9a06a" strokeWidth="1" strokeDasharray="3 4" />
            <ellipse cx="44" cy="56" rx="22" ry="10" fill="none" stroke="#d9a06a" strokeWidth="0.8" opacity=".5" />
            <circle cx="44" cy="52" r="4" fill="#77bd72" stroke="#5aa760" strokeWidth="0.6" />
            <path d="M43 52 C35 47 34 41 38 39 C42 42 43 47 43 52Z" fill="#5aa760" />
            <path d="M46 52 C52 45 59 45 61 50 C55 51 50 52 46 52Z" fill="#6cbc70" />
          </>,
          88, 76,
        );

      case 'fence':
        return wrap(
          <>
            <ellipse cx="44" cy="71" rx="34" ry="7" fill="rgba(60,38,20,.22)" />
            <path d="M15 45 L44 29 L73 45" stroke="#9b663f" strokeWidth="7" strokeLinecap="round" fill="none" />
            <path d="M15 56 L44 40 L73 56" stroke="#bd8354" strokeWidth="7" strokeLinecap="round" fill="none" />
            {[19, 33, 47, 61].map((x, i) => (
              <g key={i}>
                <path d={`M${x} ${36 + i * 2} L${x} ${64 + i * 2}`} stroke="#75482e" strokeWidth="5" strokeLinecap="round" />
                <path d={`M${x - 1} ${38 + i * 2} L${x - 1} ${50 + i * 2}`} stroke="#9a6240" strokeWidth="1.5" strokeLinecap="round" />
              </g>
            ))}
          </>,
          88, 78,
        );

      default:
        return wrap(
          <>
            <ellipse cx="44" cy="70" rx="29" ry="7" fill="rgba(60,38,20,.22)" />
            <path d="M44 58 L68 42 L68 53 L44 68 Z" fill="#8f5a3b" />
            <path d="M20 42 L44 58 L44 68 L20 53 Z" fill="#a86d45" />
            <path d="M20 42 L44 27 L68 42 L44 58 Z" fill="#d9a36e" stroke={ink} strokeWidth="1" strokeLinejoin="round" />
            <path d="M24 40 L44 29" stroke="#fff" strokeWidth="1.5" opacity=".35" strokeLinecap="round" />
          </>,
        );
    }
  };

  const FURNITURE_IMG: Record<string, string> = {
    bed: '/assets/room_assets/02_bed.webp',
    shelf: '/assets/room_assets/03_bookshelf.webp',
    wooden_table: '/assets/room_assets/05_coffee_table.webp',
    rug: '/assets/room_assets/04_round_fluffy_rug.webp',
    lamp: '/assets/room_assets/08_wooden_cabinet_lamp.webp',
    wooden_chair: '/assets/room_assets/06_floor_cushion.webp',
  };
  const renderFurniture = (recipeId: string, w: number, flip = false) => {
    const src = FURNITURE_IMG[recipeId];
    if (src) return <img className="room-furniture-img" src={src} alt="" draggable={false} style={{ width: w, height: 'auto', transform: flip ? 'scaleX(-1)' : undefined }} />;
    return renderFurnitureSvg(recipeId);
  };

  const palette = GRID_RECIPES.filter(r => r.category === 'furniture' && (state.inventory[r.id] || 0) > 0 && FURNITURE_LAYOUT[r.id]);
  const placed = state.roomFurniture || [];
  const placedIds = new Set(placed.map(f => f.recipeId));

  const toggleFurniture = (recipeId: string) => {
    const layout = FURNITURE_LAYOUT[recipeId];
    if (!layout) return;
    const exist = placed.find(f => f.recipeId === recipeId);
    if (exist) onRemove(exist.uid);
    else onPlace(recipeId, layout.tx, layout.ty);
  };

  const items = placed
    .map(f => {
      const layout = FURNITURE_LAYOUT[f.recipeId] || { tx: f.tx, ty: f.ty, w: 76 };
      const c = centerC(layout.tx, layout.ty);
      const depth = layout.tx + layout.ty;
      return { ...f, x: c.x, y: c.y, w: layout.w, depth, z: layout.z ?? (10 + depth), flip: layout.flip, ground: layout.ground, dy: layout.dy };
    })
    .sort((a, b) => a.depth - b.depth);

  return (
    <main className="museum-shell room-shell">
      <button type="button" className="museum-leave-btn" onClick={onLeave}>← 离开房间</button>
      <Card className="island-panel museum-head-card">
        <div className="section-head">
          <div>
            <div className="section-title">我的房间</div>
            <p className="museum-sub">点击下方家具添加到房间，再点家具或按钮收回。家具自动摆放到固定位置。</p>
          </div>
        </div>
      </Card>
      <Card className="island-panel">
        <div className="room-stage-wrap" ref={wrapRef}>
          <div className="room-stage" style={{ width: baseW, height: baseH, transform: `scale(${scale})`, transformOrigin: 'top left', backgroundImage: 'url(/assets/room_assets/01_room_background.webp)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="room-ambient" />

          {/* 串灯 — 横跨后墙顶部 */}
          <img className="room-wall-deco room-string-lights" src="/assets/room_assets/09_star_string_lights.webp" alt="" draggable={false} />

          {/* 装饰画 */}
          <img className="room-wall-deco room-painting" src="/assets/room_assets/10_framed_painting.webp" alt="" draggable={false} />

          {/* 挂钟 — SVG 手绘圆形木框时钟 */}
          <svg className="room-wall-deco room-clock" aria-hidden="true" viewBox="0 0 52 52" width="52" height="52">
            <circle cx="26" cy="26" r="23" fill="#f5e6cc" stroke="#a0683a" strokeWidth="3" />
            <circle cx="26" cy="26" r="20" fill="none" stroke="#c89a62" strokeWidth="1" />
            {[0,1,2,3,4,5,6,7,8,9,10,11].map(i => {
              const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
              const r1 = i % 3 === 0 ? 15 : 17;
              const r2 = 20;
              return <line key={i} x1={26 + r1 * Math.cos(a)} y1={26 + r1 * Math.sin(a)} x2={26 + r2 * Math.cos(a)} y2={26 + r2 * Math.sin(a)} stroke="#8b5c30" strokeWidth={i % 3 === 0 ? 2 : 1} strokeLinecap="round" />;
            })}
            {/* 时针 10:10 */}
            <line x1="26" y1="26" x2="19" y2="14" stroke="#6b3f1c" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="26" y1="26" x2="36" y2="15" stroke="#6b3f1c" strokeWidth="2" strokeLinecap="round" />
            <circle cx="26" cy="26" r="2.5" fill="#a0683a" />
          </svg>

          {/* 风铃 — SVG 手绘三角形铃铛 */}
          <svg className="room-wall-deco room-windbell" aria-hidden="true" viewBox="0 0 36 68" width="36" height="68">
            <line x1="18" y1="2" x2="18" y2="10" stroke="#b8a070" strokeWidth="1.5" />
            <ellipse cx="18" cy="8" rx="6" ry="2" fill="#d4b882" />
            {/* 三个铃铛 */}
            {[8, 18, 28].map((x, i) => (
              <g key={i} transform={`translate(${x - 18}, ${i * 4})`}>
                <path d="M14 14 Q18 6 22 14 L22 22 Q18 25 14 22 Z" fill="#ffe9a0" stroke="#c9a84a" strokeWidth="1" />
                <circle cx="18" cy="22" r="2" fill="#c9a84a" />
                <line x1="18" y1="24" x2="18" y2="30" stroke="#b8a070" strokeWidth="1" />
                <polygon points="15,30 21,30 18,35" fill="#ffd166" />
              </g>
            ))}
          </svg>

          {/* 第二段小串灯 — 左墙角 */}
          <svg className="room-wall-deco room-string-lights-2" aria-hidden="true" viewBox="0 0 120 32" width="120" height="32">
            <path d="M4 8 Q20 14 36 10 Q52 6 68 12 Q84 18 100 14 L116 10" fill="none" stroke="#c9a06a" strokeWidth="1" />
            {[10,26,42,58,74,90,106].map((x, i) => {
              const colors = ['#ffd166','#ff9e7a','#a8d8a8','#88ccee','#ffd166','#ff9e7a','#a8d8a8'];
              const y = 10 + (i % 2 === 0 ? 8 : 12);
              return (
                <g key={i}>
                  <line x1={x} y1={y - 5} x2={x} y2={y} stroke="#c9a06a" strokeWidth="0.8" />
                  <ellipse cx={x} cy={y + 3} rx="4" ry="5" fill={colors[i]} opacity="0.9" />
                </g>
              );
            })}
          </svg>

          {items.map(item => (
            <button
              key={item.uid}
              type="button"
              className="room-sprite room-furniture"
              style={item.ground ? { left: item.x, top: item.y + (item.dy || 0), transform: 'translate(-50%, -50%)', zIndex: item.z } : { left: item.x, top: item.y + 18 + (item.dy || 0), zIndex: item.z }}
              onClick={() => onRemove(item.uid)}
              title="点击收回"
            >
              <div className="room-shadow" />
              {renderFurniture(item.recipeId, item.w, item.flip)}
            </button>
          ))}
          <div className="room-light-overlay" />
          </div>
        </div>
      </Card>
      <Card className="island-panel">
        <Title size="small">家具</Title>
        <div className="room-palette">
          {palette.length ? palette.map(r => (
            <button key={r.id} type="button" className={`room-palette-item ${placedIds.has(r.id) ? 'selected' : ''}`} onClick={() => toggleFurniture(r.id)}>
              <span className="room-palette-preview">{renderFurniture(r.id, 54)}</span>
              <span>{r.name}</span>
              <small>{placedIds.has(r.id) ? '已摆放' : `×${state.inventory[r.id]}`}</small>
            </button>
          )) : <p className="muted">先去工坊合成家具。</p>}
        </div>
      </Card>
    </main>
  );
}

function StorageShell({ state, server, onLeave }: { state: LocalUserState; server: ServerState | null; onLeave: () => void }) {
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 1200);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(onLeave, 1200);
    return () => window.clearTimeout(timer);
    // 故意只依赖 leaving：onLeave 每次 render 是新函数，加入会导致离开定时器反复重置
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);
  if (loading || leaving) return <LegacyLoading text={leaving ? '正在返回小岛' : '正在打开仓库'} />;
  const warehouse = getSharedWarehouse(state, server);
  const entries = Object.entries(warehouse).filter(([, count]) => count > 0);
  return (
    <main className="museum-shell">
      <button type="button" className="museum-leave-btn" onClick={() => setLeaving(true)}>← 离开仓库</button>
      <section className="view-stack" style={{ width: 'min(520px, 100%)' }}>
        <Card className="island-panel">
          <Title size="middle">收纳仓库</Title>
          <p className="muted">两个人一起存进来的建设材料</p>
        </Card>
        <Card className="island-panel">
          {entries.length ? (
            <section className="item-grid">
              {entries.map(([key, count]) => (
                <Card key={key} style={{ textAlign: 'center' }}>
                  <div style={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {ITEMS[key]?.img ? <img src={ITEMS[key].img} alt="" style={{ width: 34, height: 34 }} /> : <span>{ITEMS[key]?.emoji}</span>}
                  </div>
                  <strong>{ITEMS[key]?.name || key}</strong>
                  <div style={{ color: 'var(--old-muted)', fontSize: 13 }}>x {count}</div>
                </Card>
              ))}
            </section>
          ) : <p className="muted">仓库还在等第一份材料。</p>}
        </Card>
      </section>
    </main>
  );
}

function TodayView(props: {
  day: PlanDay;
  plan: TrainingPlan;
  checked: boolean[];
  completion: number;
  userState: LocalUserState;
  server: ServerState | null;
  peers: Array<{ displayName?: string; username?: string; avatar?: string; dayStates?: LocalUserState['dayStates']; currentDayIndex?: number }>;
  mailbox: MailboxEntry[];
  messageText: string;
  setMessageText: (value: string) => void;
  onMessage: () => void;
  onDifficulty: (value: LocalUserState['selectedDifficulty']) => void;
  onToggle: (index: number) => void;
  onSettle: () => void;
  onRest: () => void;
  locked: boolean;
  archiveRows: ReturnType<typeof createArchiveRows>;
  onArchiveDay: (index: number) => void;
  onViewIsland: () => void;
}) {
  const weekDays = Array.from({ length: 7 }, (_, index) => index);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const checkedCount = props.checked.filter(Boolean).length;
  const baseOverview = createBaseOverview(props.userState, props.server, props.day, checkedCount);
  const hiddenStatuses = createHiddenStatuses(props.userState, props.day, checkedCount);
  const weeklyReview = createWeeklyReview(props.plan, props.userState, props.day);
  const insights = props.day.weekIndex !== undefined ? getWeeklyReviewInsights(props.plan, props.day.weekIndex, props.userState.dayStates, props.userState.selectedDifficulty) : null;
  return (
    <section className="view-stack">
      <section className="hero-stage">
        <div className="hero-copy">
          <div className="hero-title">Fitness<br />Island</div>
          <div className="hero-date">{formatTodayDate()}</div>
          <div className="hero-prompt">{props.day.summary || props.day.title}</div>
          <div className="hero-meta">
            <span>{props.day.minutes} 分钟</span>
            <span>{props.day.phase || props.day.weekTheme || '上岛训练'}</span>
            <span>连续 {calcStreak(props.userState.dayStates, props.plan.weeks.flatMap(week => week.days).length)} 天</span>
          </div>
        </div>
        <div className="hero-animal">🐱</div>
      </section>
      <div className="progress-meter">
        <div className="progress-bar"><div className="progress-fill" style={{ width: `${props.completion}%` }} /></div>
        <div className="progress-count">{checkedCount}/{props.day.exercises.length}</div>
      </div>

      <Card color="app-yellow" pattern="app-yellow" className="difficulty-card island-panel">
        <div className="section-head">
          <div>
            <Title size="small">今日难度</Title>
            <p>私人小岛模式 · 每天都可以重选</p>
          </div>
        </div>
        <div className="segmented">
          {Object.entries(DIFFICULTIES).map(([key, item]) => (
            <Button key={key} type={props.userState.selectedDifficulty === key ? 'primary' : 'default'} onClick={() => props.onDifficulty(key as LocalUserState['selectedDifficulty'])}>
              {item.label}
            </Button>
          ))}
        </div>
        <div className="reward-preview">{DIFFICULTIES[props.userState.selectedDifficulty].hint}</div>
        <div className="route-nodes">
          {weekDays.map(index => (
            <div key={index} className={`route-node ${index === (props.day.dayInWeek || 0) ? 'current' : ''} ${index < (props.day.dayInWeek || 0) ? 'done' : ''}`}>
              <span>{index + 1}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="base-overview island-panel">
        <div className="base-overview-head">
          <div>
            <div className="base-overview-title">基地总览</div>
            <p>{baseOverview.next ? `下个目标：${baseOverview.next.name} ${baseOverview.next.value}/${baseOverview.next.need}` : '小基地核心设施已开放'}</p>
          </div>
          <Button type="default" onClick={props.onViewIsland}>看岛</Button>
        </div>
        <div className="base-overview-grid">
          {baseOverview.tiles.map(tile => (
            <div key={tile.title} className={`base-tile ${tile.tone || ''}`}>
              <strong>{tile.title}</strong>
              <span>{tile.body}</span>
            </div>
          ))}
        </div>
        <div className="hidden-status-list">
          <p className="hidden-hint">{getHiddenQuestHint(props.userState.selectedDifficulty, props.day)}</p>
          {hiddenStatuses.map(item => (
            <div key={item.id} className={`hidden-status ${item.status}`}>
              <span>{item.name}</span>
              <small>{item.label}</small>
            </div>
          ))}
        </div>
      </Card>

      <Card className="task-card island-panel">
        <div className="task-section-title">{props.day.title}</div>
        <div className="task-list">
          {props.day.exercises.map((exercise, index) => (
            <label className={`task-row ${props.checked[index] ? 'checked' : ''}`} key={`${exercise[0]}-${index}`}>
              <Checkbox
                value={props.checked[index] ? ['done'] : []}
                options={[{ label: '', value: 'done' }]}
                disabled={props.locked}
                onChange={() => props.onToggle(index)}
              />
              <span>{exercise[0]}</span>
              <em>{exercise[1]}</em>
            </label>
          ))}
        </div>
      </Card>

      <div className="complete-strip">
        <Button type="primary" size="large" block disabled={props.locked} onClick={props.onSettle}>完成今天</Button>
      </div>
      <Button type="default" size="large" block disabled={props.locked} onClick={props.onRest}>今天休息</Button>

      <Card color="app-blue" pattern="app-blue" className="island-panel">
        <div className="section-title">训练伙伴</div>
        <div className="buddy-grid">
          {props.peers.length ? props.peers.map(peer => (
            <div className="buddy" key={peer.displayName || peer.username}>
              <Avatar id={peer.avatar || 'rosie'} />
              <span>{peer.displayName || peer.username}</span>
            </div>
          )) : <p>另一个岛民还没有上线。</p>}
        </div>
      </Card>

      <Card className="message-section island-panel">
        <div className="section-head compact">
          <div>
            <div className="section-title">留言板</div>
            <p>给对方留一句今天的状态</p>
          </div>
        </div>
        <div className="message-row">
          <Input value={props.messageText} maxLength={40} allowClear shadow placeholder="今天想说的话" onChange={event => props.setMessageText(event.target.value)} onClear={() => props.setMessageText('')} onKeyDown={event => { if (event.key === 'Enter') props.onMessage(); }} />
          <Button type="primary" onClick={props.onMessage}>贴上</Button>
        </div>
        <MessageList entries={props.mailbox} />
      </Card>

      {weeklyReview && (
        <Card className="review-section island-panel">
          <div className="review-title">周复盘</div>
          <table className="review-table">
            <tbody>
              {weeklyReview.map(row => (
                <tr key={row.name}>
                  <th>{row.name}</th>
                  <td>{row.value}</td>
                  <td>{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {insights && (
            <div className="weekly-insights">
              <div><strong>最稳</strong> {insights.bestDay.label} · {insights.bestDay.detail}</div>
              <div><strong>最弱</strong> {insights.weakest.label} · {insights.weakest.detail}</div>
              <div><strong>下周建议</strong> {insights.nextAdvice.label} · {insights.nextAdvice.detail}</div>
            </div>
          )}
        </Card>
      )}

      <Card className="archive-section island-panel">
        <div className="section-head compact">
          <div>
            <div className="section-title">30 天全图</div>
            <p>旧记录会继续按天展示，点一天看详情。</p>
          </div>
          <Button type="default" onClick={() => setArchiveOpen(open => !open)}>
            {archiveOpen ? '收起' : '展开'}
          </Button>
        </div>
        {archiveOpen && (
          <div className="archive-grid">
            {props.archiveRows.map(row => (
              <button key={row.index} type="button" className={`archive-day ${row.status}`} onClick={() => props.onArchiveDay(row.index)}>
                <span>{row.dayInWeek + 1}</span>
                <strong>{row.title}</strong>
                <em>{row.minutes}min</em>
              </button>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}

function createBaseOverview(state: LocalUserState, server: ServerState | null, day: PlanDay, checkedCount: number) {
  const warehouse = getSharedWarehouse(state, server);
  const metrics = {
    checkins: countSettledDays(state),
    minutes: countMinutes(state),
    collection: state.collection.discovered.length,
  };
  const next = BUILDINGS
    .map(building => ({ building, status: getIslandBuildingStatus(building, metrics, warehouse, server) }))
    .filter(({ building, status }) => building.need > 0 && !status.unlocked)
    .sort((a, b) => b.status.pct - a.status.pct)[0];
  const peerDone = Object.values(server?.users || {}).some(user => {
    if ((user.displayName || user.username) === state.username) return false;
    const peerDay = user.dayStates?.[getDayKey(state.currentDayIndex)] || user.dayStates?.[String(state.currentDayIndex)];
    return Boolean(peerDay?.settled && !peerDay.rest && !peerDay.missed);
  });
  const totalMaterials = sumCounts(warehouse);
  const todayState = state.dayStates[getDayKey(state.currentDayIndex)] || state.dayStates[String(state.currentDayIndex)] || {};
  const todayDone = Boolean(todayState.settled && !todayState.rest && !todayState.missed);
  return {
    next: next ? { name: next.building.name, value: next.status.value, need: next.status.need, pct: next.status.pct } : null,
    tiles: [
      {
        title: todayDone ? '今日已盖章' : `今日 ${checkedCount}/${day.exercises.length}`,
        body: todayDone ? '训练记录已进入小基地' : '完成后会结算材料和铃钱',
        tone: todayDone ? 'good' : '',
      },
      {
        title: peerDone && todayDone ? '双人同日' : peerDone ? '伙伴已登岛' : '等待伙伴',
        body: peerDone && todayDone ? '里数券气泡会出现在岛上' : '两人同日可触发合作奖励',
        tone: peerDone && todayDone ? 'good' : peerDone ? 'warn' : '',
      },
      {
        title: `${totalMaterials} 份材料`,
        body: formatMaterialSummary(warehouse),
        tone: '',
      },
      {
        title: next ? `${next.status.pct}%` : '100%',
        body: next ? `${next.building.name} 建设进度` : '当前目标已完成',
        tone: next && next.status.pct >= 80 ? 'warn' : '',
      },
    ],
  };
}

function createHiddenStatuses(state: LocalUserState, day: PlanDay, checkedCount: number) {
  const fullDone = checkedCount >= day.exercises.length;
  const hasNight = new Date().getHours() >= 20;
  const entries = [
    { id: 'night_star', name: '夜海星光', tier: '普通', ready: hasNight, clue: '晚上登岛会看到星光。' },
    { id: 'same_day_checkin', name: '同日登岛', tier: '普通', ready: false, clue: '两个人同一天都出现。' },
    { id: 'goldenLeaf', name: '金色树叶', tier: '普通', ready: state.selectedDifficulty === 'easy' && fullDone, clue: '轻松路线完整完成。' },
    { id: 'museum_entry', name: '博物馆图鉴条目', tier: '普通', ready: Boolean(day.review && fullDone), clue: '周复盘完整完成。' },
  ];
  return entries.map(item => {
    const found = state.collection.discovered.includes(item.id);
    return {
      ...item,
      status: found ? 'found' : item.ready ? 'ready' : '',
      label: found ? '已发现' : item.ready ? '可触发' : item.tier,
      name: found || item.tier !== '传说' ? item.name : '???',
    };
  });
}

function createWeeklyReview(plan: TrainingPlan, state: LocalUserState, day: PlanDay) {
  if (!day.review || typeof day.weekIndex !== 'number') return null;
  const week = plan.weeks[day.weekIndex];
  if (!week) return null;
  const start = plan.weeks.slice(0, day.weekIndex).reduce((sum, item) => sum + item.days.length, 0);
  let appeared = 0;
  let fullDone = 0;
  let checkedTotal = 0;
  let taskTotal = 0;
  const chips: string[] = [];
  week.days.forEach((weekDay, dayInWeek) => {
    const index = start + dayInWeek;
    const dayState = state.dayStates[getDayKey(index)] || state.dayStates[String(index)] || {};
    const checked = Array.isArray(dayState.checked) ? dayState.checked.filter(Boolean).length : 0;
    const total = weekDay.exercises.length || 0;
    if (dayState.settled && !dayState.rest && !dayState.missed) {
      appeared += 1;
      checkedTotal += checked;
      taskTotal += total;
      if (checked >= total) {
        fullDone += 1;
        chips.push('●');
      } else {
        chips.push('◐');
      }
    } else if (dayState.rest || dayState.missed) {
      chips.push('休');
    } else {
      chips.push('○');
    }
  });
  const completionRate = taskTotal ? Math.round((checkedTotal / taskTotal) * 100) : 0;
  return [
    { name: '周期', value: `第 ${day.weekIndex + 1} 周 · ${week.theme}`, detail: `${week.days.length} 天` },
    { name: '出现', value: `${appeared}/${week.days.length} 天`, detail: appeared >= week.days.length ? '完成' : '继续' },
    { name: '完成', value: `${fullDone}/${week.days.length} 天`, detail: chips.join(' ') },
    { name: '最稳', value: fullDone ? '已完成日' : '还没有记录', detail: fullDone ? `${fullDone} 天完整完成` : '完成一次后会自动分析' },
    { name: '下周建议', value: completionRate >= 65 ? '保持标准难度' : '先守住出现', detail: `${completionRate}% 完成率` },
  ];
}

function navIcon(key: ViewKey) {
  return {
    today: '/ui-assets/nav-icons/today.svg',
    island: '/ui-assets/nav-icons/island.svg',
    bag: '/ui-assets/nav-icons/bag.svg',
    collection: '/ui-assets/nav-icons/collection.svg',
    gift: '/ui-assets/nav-icons/gift.svg',
    coop: '/ui-assets/nav-icons/contribution.svg',
    storage: '/ui-assets/nav-icons/bag.svg',
    workshop: '/ui-assets/nav-icons/bag.svg',
    room: '/ui-assets/nav-icons/bag.svg',
  }[key];
}

function sumCounts(source: Record<string, number>) {
  return Object.values(source || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function formatMaterialSummary(warehouse: Record<string, number>) {
  const entries = Object.entries(warehouse).filter(([, value]) => Number(value) > 0).slice(0, 3);
  if (!entries.length) return '仓库还在等第一份材料';
  return entries.map(([key, value]) => `${ITEMS[key]?.name || key} ${value}`).join(' · ');
}

function IslandView({ state, server, onDetail, bottleStatuses, onDecorPlace, onViewMuseum, onViewStorage, onViewWorkshop, onSaveBuildingPosition, onSaveCraftPosition, onViewRoom }: {
  state: LocalUserState;
  server: ServerState | null;
  onDetail: (value: { title: string; body?: string; lines?: string[]; cards?: BottleCard[] }) => void;
  bottleStatuses: BottleCard[];
  onDecorPlace: (id: string) => void;
  onViewMuseum: () => void;
  onViewStorage: () => void;
  onViewWorkshop: () => void;
  onSaveBuildingPosition: (id: string, x: number, y: number) => void;
  onSaveCraftPosition: (id: string, x: number, y: number) => void;
  onViewRoom: () => void;
}) {
  const checkins = countSettledDays(state);
  const minutes = countMinutes(state);
  const collectionCount = state.collection.discovered.length;
  const placedDecor = normalizeDecor(server?.shared?.decor);
  const buildingPositions = server?.shared?.buildingPositions || {};
  // 长按拖动建筑/房子
  const [dragging, setDragging] = useState<{ kind: 'building' | 'craft'; id: string; x: number; y: number } | null>(null);
  const pressTimer = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const justDragged = useRef(false);
  const buildingPos = (id: string, dx: number, dy: number) => {
    if (dragging?.id === id) return { x: dragging.x, y: dragging.y };
    const saved = buildingPositions[id];
    return saved ? { x: saved.x, y: saved.y } : { x: dx, y: dy };
  };
  const craftPos = (craftId: string, dx: number, dy: number) => {
    if (dragging?.id === craftId) return { x: dragging.x, y: dragging.y };
    return { x: dx, y: dy };
  };
  const pointerToPct = (target: HTMLElement, clientX: number, clientY: number) => {
    const map = target.closest('.island-map') as HTMLElement | null;
    if (!map) return null;
    const rect = map.getBoundingClientRect();
    return {
      x: Math.max(2, Math.min(96, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(2, Math.min(94, ((clientY - rect.top) / rect.height) * 100)),
    };
  };
  const onMapItemPointerDown = (kind: 'building' | 'craft', id: string, e: React.PointerEvent<HTMLButtonElement>) => {
    pressStart.current = { x: e.clientX, y: e.clientY };
    const cx = e.clientX, cy = e.clientY, target = e.currentTarget;
    pressTimer.current = window.setTimeout(() => {
      const p = pointerToPct(target, cx, cy);
      if (p) setDragging({ kind, id, x: p.x, y: p.y });
    }, 350);
  };
  // 容器级：拖动跟踪 + 松手保存（不依赖 pointer capture）
  const onMapPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) {
      if (pressStart.current && pressTimer.current) {
        const d = Math.hypot(e.clientX - pressStart.current.x, e.clientY - pressStart.current.y);
        if (d > 8) { window.clearTimeout(pressTimer.current); pressTimer.current = null; }
      }
      return;
    }
    const p = pointerToPct(e.currentTarget, e.clientX, e.clientY);
    if (p) setDragging({ ...dragging, x: p.x, y: p.y });
  };
  const onMapPointerUp = () => {
    if (pressTimer.current) { window.clearTimeout(pressTimer.current); pressTimer.current = null; }
    if (dragging) {
      justDragged.current = true;
      if (dragging.kind === 'building') onSaveBuildingPosition(dragging.id, dragging.x, dragging.y);
      else onSaveCraftPosition(dragging.id, dragging.x, dragging.y);
      setDragging(null);
    }
    pressStart.current = null;
  };
  const metrics = { checkins, minutes, collection: collectionCount };
  const warehouse = getSharedWarehouse(state, server);
  const warehouseChips = createWarehouseChips(warehouse);
  const RESIDENT_COLORS = ['#59c9a5', '#ef8354', '#ffd166', '#6c5ce7', '#00b894', '#e17055', '#0984e3', '#fdcb6e'];
  const residents = [
    { name: state.username, avatar: state.avatar, x: 45, y: 58, color: RESIDENT_COLORS[0] },
    ...Object.values(server?.users || {})
      .filter(user => (user.displayName || user.username) !== state.username)
      .slice(0, 1)
      .map((user, idx) => ({ name: user.displayName || user.username || '伙伴', avatar: user.avatar, x: 55 + idx * 8, y: 58, color: RESIDENT_COLORS[(idx + 1) % RESIDENT_COLORS.length] })),
  ];
  const [mapZoom, setMapZoom] = useState(false);
  // 手机弹框：贴合手机尺寸的独立弹层
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phonePhase, setPhonePhase] = useState<'phone' | 'app'>('phone');
  const [phoneApp, setPhoneApp] = useState<string>('camera');
  const [phoneScale, setPhoneScale] = useState(0.6);
  // 手机 APP（传给本地 NookPhone，自动按 9 个/页分页）
  const NOOK_APPS: (NookApp & { name: string; emoji: string })[] = [
    { id: 'camera', name: '相机', emoji: '📷', iconName: 'icon-camera', color: '#B77DEE', hasNewMessage: true },
    { id: 'miles', name: '里数中心', emoji: '🎫', iconName: 'icon-miles', color: '#889DF0', offset: true },
    { id: 'critterpedia', name: '生物图鉴', emoji: '🦋', iconName: 'icon-critterpedia', color: '#F7CD67', iconStyle: { width: '82px' } },
    { id: 'diy', name: 'DIY 手册', emoji: '🔨', iconName: 'icon-diy', color: '#E59266' },
    { id: 'shopping', name: '购物', emoji: '🛒', iconName: 'icon-design', color: '#F8A6B2' },
    { id: 'custom', name: '我的设计', emoji: '🎨', iconName: 'icon-map', color: '#82D5BB', hasNewMessage: true, iconStyle: { width: '70px' } },
    { id: 'design', name: '设计板', emoji: '🖌', iconName: 'icon-variant', color: '#8AC68A', iconStyle: { width: '62px' } },
    { id: 'map', name: '岛屿地图', emoji: '🗺', iconName: 'icon-helicopter', color: '#FC736D' },
    { id: 'chat', name: '聊天', emoji: '💬', iconName: 'icon-chat', color: '#D1DA49' },
    // 第 2 页
    { id: 'shopping2', name: '购物', emoji: '🛍', iconName: 'icon-shopping', color: '#F8A6B2' },
    { id: 'rescue', name: '紧急救援', emoji: '🚁', iconName: 'icon-helicopter', color: '#FC736D' },
    { id: 'custom2', name: '定制设计', emoji: '🎨', iconName: 'icon-variant', color: '#8AC68A' },
  ];
  useEffect(() => {
    if (!phoneOpen) return;
    const update = () => {
      const byW = (window.innerWidth - 24) / 527;
      const byH = (window.innerHeight - 24) / 788;
      setPhoneScale(Math.max(0.34, Math.min(0.86, byW, byH)));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [phoneOpen]);
  const closePhone = () => { setPhoneOpen(false); setPhonePhase('phone'); setPhoneApp('camera'); };
  const ActivePhoneGame = GAMES[phoneApp];
  const myTodayKey = getDayKey(state.currentDayIndex);
  const myTodayState = state.dayStates[myTodayKey] || state.dayStates[String(state.currentDayIndex)] || {};
  const todayDone = Boolean(myTodayState.settled && !myTodayState.rest && !myTodayState.missed);
  const peerDoneToday = Object.values(server?.users || {}).some(user => {
    if ((user.displayName || user.username) === state.username) return false;
    const peerDay = user.dayStates?.[myTodayKey] || user.dayStates?.[String(state.currentDayIndex)];
    return Boolean(peerDay?.settled && !peerDay.rest && !peerDay.missed);
  });
  const showCoopBubble = todayDone && peerDoneToday;
  const renderMapBody = (isLarge: boolean) => (
    <>
      <span className="map-tree tree-a" />
      <span className="map-tree tree-b" />
      <span className="map-tree tree-c" />
      <span className="map-rock rock-a" />
      <span className="map-rock rock-b" />
      <span className="map-bridge" />
      {showCoopBubble && (
        <div className="coop-bubble">
          <img src={ITEMS.nookMilesTicket?.img} alt="里数券" />
          <span>双人同日登岛 · 里数券</span>
        </div>
      )}
      {!isLarge && (
        <button type="button" className="island-map-open-btn" aria-label="放大查看岛屿" onClick={() => setMapZoom(true)}>⌕</button>
      )}
      <button
        type="button"
        className="bottle-point"
        onClick={() => onDetail({ title: '瓶中信', cards: bottleStatuses })}
        aria-label="瓶中信隐藏任务线索"
      >
        💌
      </button>
      <button
        type="button"
        className="phone-point"
        onClick={() => setPhoneOpen(true)}
        aria-label="打开手机进入小游戏"
      >
        📱
      </button>
      {Object.values(placedDecor).map(record => {
        const meta = DECOR_ITEMS.find(item => item.id === record.id);
        if (!meta) return null;
        return (
          <button
            key={record.id}
            type="button"
            className="decor-point"
            style={{ left: `${meta.x}%`, top: `${meta.y}%` }}
            onClick={() => onDetail({
              title: meta.name,
              body: `装饰说明：${meta.desc}\n放置人：${record.ownerName || '伙伴'}\n放置时间：${formatShortDate(record.placedAt)}`,
            })}
            aria-label={`${meta.name}，由 ${record.ownerName || '伙伴'} 放置`}
          >
            <span>{meta.icon}</span>
          </button>
        );
      })}
      {BUILDINGS.map(building => {
        const status = getIslandBuildingStatus(building, metrics, warehouse, server);
        return (
          <button
            key={building.id}
            type="button"
            className={`map-point building-${building.id} ${status.unlocked ? 'unlocked' : 'locked'} ${status.pct >= 80 && !status.unlocked ? 'almost' : ''} ${status.stageClass} ${dragging?.id === building.id ? 'dragging' : ''}`}
            style={{ left: `${buildingPos(building.id, building.x, building.y).x}%`, top: `${buildingPos(building.id, building.x, building.y).y}%` }}
            onPointerDown={e => onMapItemPointerDown('building', building.id, e)}
            onClick={() => {
              if (justDragged.current) { justDragged.current = false; return; }
              if (!status.unlocked) {
                onDetail({
                  title: building.name,
                  lines: ['这栋建筑还没有开放。', building.reward, `当前进度：${status.value}/${status.need}`, '完成更多打卡后再来看看吧。'],
                });
                return;
              }
              if (building.id === 'museum') return onViewMuseum();
              if (building.id === 'storage') return onViewStorage();
              if (building.id === 'workshop') return onViewWorkshop();
              onDetail({
                title: building.name,
                lines: [
                  building.desc,
                  building.reward,
                  `状态：${status.label}`,
                  `进度：${status.value}/${status.need}`,
                  `协作人数：${status.coopCount}/${status.coopNeed}`,
                  `共同材料：${status.materialText}`,
                ],
              });
            }}
            aria-label={`${building.name}，${status.label}，进度 ${status.value}/${status.need}`}
          >
            <span className="map-point-status">{status.label}</span>
            <span className="map-point-icon">{building.icon}</span>
            <span className="map-point-label">{building.name}</span>
            <span className="map-point-stage">{status.stage}</span>
            <span className="map-point-progress"><span style={{ width: `${status.pct}%` }} /></span>
          </button>
        );
      })}
      {(server?.shared?.placedCrafts || []).filter(craft => {
        const recipe = GRID_RECIPES.find(item => item.id === craft.recipeId);
        return recipe?.category === 'house';
      }).map(craft => {
        const recipe = GRID_RECIPES.find(item => item.id === craft.recipeId);
        if (!recipe) return null;
        return (
          <button
            key={craft.id}
            type="button"
            className={`map-point placed-craft ${dragging?.id === craft.id ? 'dragging' : ''}`}
            style={{ left: `${craftPos(craft.id, craft.x, craft.y).x}%`, top: `${craftPos(craft.id, craft.x, craft.y).y}%` }}
            onPointerDown={e => onMapItemPointerDown('craft', craft.id, e)}
            onClick={() => {
              if (justDragged.current) { justDragged.current = false; return; }
              onViewRoom();
            }}
            aria-label={recipe.name}
          >
            <span className="map-point-icon">{recipe.icon}</span>
            <span className="map-point-label">{recipe.name}</span>
          </button>
        );
      })}
      {residents.map(resident => {
        const residentAvatar = AVATARS.find(item => item.id === resident.avatar) || AVATARS[0];
        return (
          <div key={resident.name} className="map-resident" style={{ left: `${resident.x}%`, top: `${resident.y}%` }}>
            <div className="resident-avatar" style={{ background: resident.color }}>
              <img className="avatar-img" src={residentAvatar.img} alt={resident.name} />
            </div>
            <span className="resident-name">{resident.name}</span>
          </div>
        );
      })}
    </>
  );
  return (
    <section className="view-stack">
      <section className="island-map-shell">
        <div className="island-map" aria-label="两个人的小基地地图" onPointerMove={onMapPointerMove} onPointerUp={onMapPointerUp}>
          {renderMapBody(false)}
        </div>
        <div className="warehouse-strip">
          {warehouseChips.map(([key, value]) => (
            <span key={key} className="warehouse-chip">{ITEMS[key]?.name || key} {value}</span>
          ))}
        </div>
      </section>
      <Card color="lime-green" pattern="lime-green" className="metric-grid island-metrics">
        <Metric label="完成打卡" value={checkins} />
        <Metric label="训练分钟" value={minutes} />
        <Metric label="图鉴发现" value={collectionCount} />
      </Card>
      <Card className="island-panel">
        <div className="section-head compact">
          <div>
            <div className="section-title">装饰工坊</div>
            <p>使用背包材料，把旧版共享装饰放回小基地。</p>
          </div>
        </div>
        <div className="placed-decor">
          {Object.values(placedDecor).length ? Object.values(placedDecor).map(record => {
            const meta = DECOR_ITEMS.find(item => item.id === record.id);
            return (
              <button
                key={record.id}
                type="button"
                className="placed-decor-chip"
                onClick={() => onDetail({
                  title: meta?.name || record.id,
                  body: `装饰说明：${meta?.desc || '放在小岛上的纪念装饰。'}\n放置人：${record.ownerName || '伙伴'}\n放置时间：${formatShortDate(record.placedAt)}`,
                })}
              >
                <span>{meta?.icon || '🏡'}</span>
                <strong>{meta?.name || record.id}</strong>
              </button>
            );
          }) : <p className="muted">还没有放置装饰。</p>}
        </div>
        <div className="decor-grid">
          {DECOR_ITEMS.map(item => {
            const placed = isDecorPlaced(item.id, server);
            const ready = !placed && Object.entries(item.cost).every(([key, value]) => (state.inventory[key] || 0) >= value);
            return (
              <div key={item.id} className={`decor-card ${placed ? 'placed' : ''}`}>
                <div className="decor-main">
                  <span className="decor-icon">{item.icon}</span>
                  <div>
                    <strong>{item.name}</strong>
                    <small>{item.desc}</small>
                  </div>
                </div>
                <div className="decor-cost">{formatDecorCost(item.id, state.inventory)}</div>
                <Button type={ready ? 'primary' : 'default'} size="small" disabled={placed || !ready} onClick={() => onDecorPlace(item.id)}>
                  {placed ? '已放置' : ready ? '放置' : '材料不足'}
                </Button>
              </div>
            );
          })}
        </div>
      </Card>
      <Modal open={mapZoom} title="小基地地图" typewriter={false} onClose={() => setMapZoom(false)} footer={<Button type="primary" onClick={() => setMapZoom(false)}>关闭</Button>}>
        <div className="island-map large-island-map" aria-label="放大的小基地地图" onPointerMove={onMapPointerMove} onPointerUp={onMapPointerUp}>
          {renderMapBody(true)}
        </div>
      </Modal>
      {phoneOpen && (
        <div className="phone-modal-mask" onClick={closePhone}>
          <div
            className="phone-modal"
            style={{ width: 527 * phoneScale, height: 788 * phoneScale }}
            onClick={e => e.stopPropagation()}
          >
            <button type="button" className="phone-modal-close" onClick={closePhone} aria-label="关闭">×</button>
            {phonePhase === 'phone' ? (
              <div className="phone-scaler" style={{ transform: `scale(${phoneScale})`, transformOrigin: 'top left' }}>
                <NookPhone
                  apps={NOOK_APPS}
                  appsPerPage={9}
                  onAppClick={id => { setPhoneApp(id); setPhonePhase('app'); }}
                />
              </div>
            ) : ActivePhoneGame ? (
              <ActivePhoneGame onBack={() => setPhonePhase('phone')} player={state.username} />
            ) : (
              <div className="phone-game">
                <div className="phone-game-box">
                  <span className="phone-game-emoji">{NOOK_APPS.find(a => a.id === phoneApp)?.emoji || '📱'}</span>
                  <span>{NOOK_APPS.find(a => a.id === phoneApp)?.name || '应用'}页面开发中…</span>
                </div>
                <button type="button" className="phone-game-back" onClick={() => setPhonePhase('phone')}>← 返回手机</button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function getSharedWarehouse(state: LocalUserState, server: ServerState | null) {
  const out: Record<string, number> = {};
  [state, ...Object.values(server?.users || {})].forEach(user => {
    Object.entries(user.warehouseContribution || {}).forEach(([key, value]) => {
      out[key] = (out[key] || 0) + (Number(value) || 0);
    });
  });
  return out;
}

function snapshotBuildings(state: LocalUserState, server: ServerState | null): Record<string, BuildStage> {
  const metrics = { checkins: countSettledDays(state), minutes: countMinutes(state), collection: state.collection.discovered.length };
  const warehouse = getSharedWarehouse(state, server);
  const out: Record<string, BuildStage> = {};
  BUILDINGS.forEach(building => {
    const status = getIslandBuildingStatus(building, metrics, warehouse, server);
    out[building.id] = { name: building.name, stage: status.stage, pct: status.pct };
  });
  return out;
}

function countFullDifficulty(dayStates: Record<string, DayState>, plan: TrainingPlan, difficulty: Difficulty): number {
  const days = flattenPlanDays(plan);
  return Object.entries(dayStates || {}).filter(([key, state]) => {
    if (!state?.settled || state.difficulty !== difficulty) return false;
    const idx = Number(key.startsWith('day_') ? key.slice(4) : key);
    const day = days[idx];
    if (!day) return false;
    const adjusted = getAdjustedDay(day, difficulty);
    const checked = Array.isArray(state.checked) ? state.checked.filter(Boolean).length : 0;
    return checked >= adjusted.exercises.length;
  }).length;
}

function hasPeerSettledToday(server: ServerState | null, username: string): boolean {
  const today = getDateKey();
  return Object.values(server?.users || {}).some(user => (user.displayName || user.username) !== username && Object.values(user.dayStates || {}).some(state => state?.settled && state.settledDate === today));
}

function hasPeerSettledTodayWithDifficulty(server: ServerState | null, username: string, difficulty: Difficulty, requireFull: boolean, plan: TrainingPlan): boolean {
  const today = getDateKey();
  const days = flattenPlanDays(plan);
  return Object.values(server?.users || {}).some(user => {
    if ((user.displayName || user.username) === username) return false;
    return Object.entries(user.dayStates || {}).some(([key, state]) => {
      if (!state?.settled || state.difficulty !== difficulty) return false;
      if (state.settledDate ? state.settledDate !== today : false) return false;
      if (!requireFull) return true;
      const idx = Number(key.startsWith('day_') ? key.slice(4) : key);
      const day = days[idx];
      if (!day) return false;
      const adjusted = getAdjustedDay(day, difficulty);
      const checked = Array.isArray(state.checked) ? state.checked.filter(Boolean).length : 0;
      return checked >= adjusted.exercises.length;
    });
  });
}

function settleWithHidden(state: LocalUserState, day: PlanDay, dayKey: string, plan: TrainingPlan, server: ServerState | null): LocalUserState {
  const fullDone = (state.dayStates[dayKey]?.checked || []).filter(Boolean).length >= day.exercises.length;
  const settled = settleToday(state, dayKey, day);
  const hidden = detectHiddenTasks({
    difficulty: state.selectedDifficulty,
    day,
    fullDone,
    hour: new Date().getHours(),
    countFullDifficulty: difficulty => countFullDifficulty(state.dayStates, plan, difficulty),
    hasPeerSettledToday: () => hasPeerSettledToday(server, state.username),
    hasPeerSettledTodayWithDifficulty: (difficulty, requireFull) => hasPeerSettledTodayWithDifficulty(server, state.username, difficulty, requireFull, plan),
    discovered: state.collection.discovered,
  });
  const effects = applyHiddenTaskEffects(hidden);
  const festival = getFestivalToday(new Date());
  const festivalBonus = applyFestivalBonus(festival, true, state.collection.discovered);
  let merged = settled;
  const addDelta = (field: 'inventory' | 'warehouseContribution', delta: Record<string, number>) => {
    const next = { ...merged[field] };
    Object.entries(delta).forEach(([key, value]) => { next[key] = (next[key] || 0) + value; });
    merged = { ...merged, [field]: next };
  };
  if (Object.keys(effects.inventoryDelta || {}).length) addDelta('inventory', effects.inventoryDelta);
  if (Object.keys(effects.warehouseDelta || {}).length) addDelta('warehouseContribution', effects.warehouseDelta);
  const allNew = [...hidden, ...effects.discoveries];
  if (allNew.length) merged = { ...merged, collection: { ...merged.collection, discovered: Array.from(new Set([...merged.collection.discovered, ...allNew])) } };
  if (festivalBonus && festival) addDelta('inventory', { [festivalBonus.reward]: 1 });
  return merged;
}

function createWarehouseChips(warehouse: Record<string, number>) {
  const core = ['wood', 'shell', 'stone', 'ironNugget'];
  const seen = new Set(core);
  const extras = Object.entries(warehouse)
    .filter(([key, value]) => !seen.has(key) && Number(value) > 0)
    .map(([key, value]) => [key, Number(value)] as [string, number]);
  return [
    ...core.map(key => [key, Number(warehouse[key] || 0)] as [string, number]),
    ...extras,
  ];
}

interface BottleCard {
  id: string;
  name: string;
  tier: string;
  status: 'found' | 'ready' | '';
  body: string;
}

function getBottleQuestStatuses(state: LocalUserState, day: PlanDay, plan: TrainingPlan, server: ServerState | null): BottleCard[] {
  const discovered = state.collection.discovered;
  const dayKey = getDayKey(state.currentDayIndex);
  const fullDone = (state.dayStates[dayKey]?.checked || []).filter(Boolean).length >= day.exercises.length;
  const readyIds = new Set(detectHiddenTasks({
    difficulty: state.selectedDifficulty,
    day,
    fullDone,
    hour: new Date().getHours(),
    countFullDifficulty: difficulty => countFullDifficulty(state.dayStates, plan, difficulty),
    hasPeerSettledToday: () => hasPeerSettledToday(server, state.username),
    hasPeerSettledTodayWithDifficulty: (difficulty, requireFull) => hasPeerSettledTodayWithDifficulty(server, state.username, difficulty, requireFull, plan),
    discovered,
  }));
  const cards: BottleCard[] = HIDDEN_QUESTS.map(quest => {
    const found = discovered.includes(quest.id);
    const ready = !found && readyIds.has(quest.id);
    const lockedLegend = quest.tier === '传说' && !found;
    const label = found ? '已触发' : ready ? '今日可试' : '未触发';
    const clue = lockedLegend ? '先发现更多普通和稀有传闻。' : quest.source;
    return { id: quest.id, name: lockedLegend ? '???' : quest.name, tier: quest.tier, status: found ? 'found' : ready ? 'ready' : '', body: `${label} · ${clue}` };
  });
  const festival = getFestivalToday(new Date());
  if (festival) {
    const found = discovered.includes(festival.id);
    cards.push({ id: festival.id, name: festival.name, tier: '普通', status: found ? 'found' : '', body: `今日传闻 · 今天岛上有${festival.name}的传闻。` });
  }
  return cards;
}

function getIslandBuildingStatus(
  building: (typeof BUILDINGS)[number],
  metrics: { checkins: number; minutes: number; collection: number },
  warehouse: Record<string, number>,
  server: ServerState | null,
) {
  const value = building.metric === 'minutes' ? metrics.minutes : building.metric === 'collection' ? metrics.collection : metrics.checkins;
  const need = building.need || Math.max(1, value);
  const coopNeed = building.coopNeed || 0;
  const coopCount = Math.min(2, Object.values(server?.users || {}).filter(user => countSettledDays({
    clientId: '',
    username: '哥哥',
    avatar: '',
    syncVersion: 0,
    currentDayIndex: 0,
    selectedDifficulty: 'standard',
    selectedPlanMode: 'standard',
    dayStates: user.dayStates || {},
    inventory: {},
    warehouseContribution: {},
    collection: { discovered: [], completed: [] },
    giftClaims: {},
  }) > 0).length || 1);
  const unlocked = value >= building.need && coopCount >= coopNeed;
  const pct = building.need ? Math.min(100, Math.round((value / building.need) * 100)) : 100;
  const materialText = Object.entries(warehouse).length
    ? Object.entries(warehouse).map(([key, amount]) => `${ITEMS[key]?.name || key} ${amount}`).join(' · ')
    : '暂无材料';
  let stage = '地基';
  let stageClass = 'stage-foundation';
  if (unlocked) {
    stage = '建成';
    stageClass = 'stage-built';
  } else if (pct >= 50) {
    stage = '搭架';
    stageClass = 'stage-frame';
  }
  return {
    value,
    need,
    coopNeed,
    coopCount,
    unlocked,
    pct,
    materialText,
    stage,
    stageClass,
    label: unlocked ? '已开放' : pct >= 80 ? '快完成' : '建设中',
  };
}

function BagView({ state, onDetail, onUse }: { state: LocalUserState; onDetail: (value: { title: string; body: string }) => void; onUse: (key: string) => void }) {
  const entries = Object.entries(ITEMS);
  return (
    <section className="item-grid bag-grid">
      {entries.map(([key, item]) => {
        const source = getItemSource(key);
        const use = getItemUse(key);
        const action = itemUseAction(key, state.inventory[key] || 0);
        return (
          <Card
            key={key}
            className="item-card"
            onClick={() => onDetail({
              title: item.name,
              body: `背包 ${state.inventory[key] || 0} 个，共同仓库贡献 ${state.warehouseContribution[key] || 0} 个。\n来源：${source}\n用途：${use}`,
            })}
          >
            <div className="bag-item-main">
              <span className="bag-item-icon">{item.img ? <img src={item.img} alt="" /> : item.emoji}</span>
              <span className="bag-item-name">{item.name}</span>
            </div>
            <span className="bag-item-count">x {state.inventory[key] || 0}</span>
            <span className="bag-item-meta">{source}</span>
            {action && (
              <Button size="small" type={action.enabled ? 'primary' : 'default'} disabled={!action.enabled} onClick={event => { event.stopPropagation(); onUse(key); }}>{action.label}</Button>
            )}
          </Card>
        );
      })}
    </section>
  );
}

function getItemSource(key: string) {
  if (key === 'branch' || key === 'weed') return '轻松难度常见奖励，可作为小基地启动材料。';
  if (key === 'ironNugget' || key === 'clay') return '挑战难度奖励，稀有建设材料。';
  if (key === 'starFragment') return '夜间打卡隐藏奖励。';
  if (key === 'bells') return '每次结算按积分获得。';
  if (key === 'nookMilesTicket') return '双人同日登岛或挑战奖励。';
  if (key === 'goldenLeaf') return '连续轻松难度隐藏奖励。';
  return '标准训练奖励，也会计入共同仓库。';
}

function getItemUse(key: string) {
  if (key === 'bells') return '作为每次训练结算的积分化奖励，也可前往岛屿装饰工坊。';
  if (['wood', 'stone', 'shell', 'ironNugget', 'softwood', 'hardwood', 'weed'].includes(key)) return '用于岛屿建设和装饰放置。';
  return '补齐图鉴，作为训练出现的纪念。';
}

function GiftView(props: {
  state: LocalUserState;
  server: ServerState | null;
  wishText: string;
  setWishText: (value: string) => void;
  onWishAdd: () => void;
  onWishRemove: (index: number) => void;
  onWishFulfill: (fulfillmentId: string) => void;
  onGiftRequest: (ruleId: string) => void;
  onGiftRedeem: (claimId: string) => void;
}) {
  const ownWishList = getOwnWishList(props.server, props.state);
  const peerWishes = getPeerWishEntries(props.server, props.state);
  const participants = getParticipants(props.state, props.server);
  const me = participants[0];
  const selfKey = me.userKey;
  const sharedClaims = normalizeGiftClaims(props.server?.shared?.giftClaims);
  const fulfillments = normalizeWishFulfillments(props.server?.shared?.wishFulfillments);
  const pendingPeerClaims = Object.values(sharedClaims).filter(claim => claim.status === 'requested' && claim.ownerKey !== selfKey);
  const history = getGiftHistory(props.state, props.server);

  return (
    <section className="view-stack">
      <Card color="warm-peach-pink" pattern="warm-peach-pink" className="island-panel">
        <Title size="middle">礼物码头</Title>
        <p>训练成果、心愿和兑现记录继续写入旧共享数据。</p>
      </Card>

      <Card className="wish-panel island-panel">
        <div className="section-head compact">
          <div>
            <div className="section-title">心愿清单</div>
            <p>最多保留 5 个，对方会在礼物码头看到。</p>
          </div>
        </div>
        <div className="message-row">
          <Input
            value={props.wishText}
            maxLength={40}
            allowClear
            shadow
            placeholder="想要的小礼物"
            onChange={event => props.setWishText(event.target.value)}
            onClear={() => props.setWishText('')}
            onKeyDown={event => { if (event.key === 'Enter') props.onWishAdd(); }}
          />
          <Button type="primary" onClick={props.onWishAdd}>放入</Button>
        </div>
      </Card>

      {ownWishList.length > 0 && (
        <section className="gift-grid">
          {ownWishList.map((item, index) => (
            <Card key={`own-wish-${index}`} className="gift-card own-wish-card">
              <span className="wish-badge">心愿</span>
              <div className="gift-top">
                <span className="gift-icon">🎟</span>
                <div>
                  <strong>{item}</strong>
                  <small>我的心愿</small>
                </div>
              </div>
              <p>想要的小礼物，对方可以照着准备。</p>
              <div className="gift-target">心愿 {index + 1}/{ownWishList.length}</div>
              <div className="gift-bar"><span style={{ width: '100%' }} /></div>
              <div className="gift-foot">
                <span>我的心愿</span>
                <Button type="primary" size="small" onClick={() => props.onWishRemove(index)}>移除</Button>
              </div>
            </Card>
          ))}
        </section>
      )}

      {peerWishes.length > 0 && (
        <section className="gift-grid">
          {peerWishes.map((entry, index) => (
            <Card key={entry.fulfillmentId} className="gift-card gift-card-compact">
              <div className="gift-top">
                <span className="gift-icon">🎟</span>
                <div>
                  <strong>{entry.item}</strong>
                  <small>{entry.ownerName}的心愿</small>
                </div>
              </div>
              <p>这是对方写下的心愿，兑换真实礼物时可以照着准备。</p>
              <div className="gift-target">心愿 {index + 1}/{peerWishes.length}</div>
              <div className="gift-bar"><span style={{ width: '100%' }} /></div>
              <div className="gift-foot">
                <span>{fulfillments[entry.fulfillmentId] ? '已实现' : '未实现'}</span>
                <Button type="primary" size="small" onClick={() => props.onWishFulfill(entry.fulfillmentId)}>我已实现</Button>
              </div>
            </Card>
          ))}
        </section>
      )}

      <section className="gift-grid">
        {GIFT_RULES.map(rule => {
          const progress = getGiftProgress(rule.id, props.state, props.server, me);
          const unlocked = progress.value >= progress.target;
          const claimId = getGiftClaimId(rule.id, selfKey);
          const claim = sharedClaims[claimId] || props.state.giftClaims[rule.id] || null;
          const pct = Math.min(100, Math.round((progress.value / progress.target) * 100));
          return (
            <Card key={rule.id} className={`gift-card ${unlocked ? 'unlocked' : 'locked'}`}>
              <div className="gift-top">
                <span className="gift-icon">{rule.icon}</span>
                <div>
                  <strong>{rule.title}</strong>
                  <small>{rule.scope === 'coop' ? '双人奖励' : '个人奖励'}</small>
                </div>
              </div>
              <p>{rule.desc}</p>
              <div className="gift-target">{rule.target}</div>
              <div className="gift-target">{unlocked ? '可以申请兑换' : '继续训练解锁'}</div>
              <div className="gift-bar"><span style={{ width: `${pct}%` }} /></div>
              <div className="gift-foot">
                <span>{progress.value}/{progress.target}</span>
                {renderGiftAction(unlocked, claim, () => props.onGiftRequest(rule.id))}
              </div>
            </Card>
          );
        })}
      </section>

      <Card className="island-panel">
        <Title size="small">待兑现包裹</Title>
        <div className="gift-grid compact">
          {pendingPeerClaims.length ? pendingPeerClaims.map(claim => {
            const rule = GIFT_RULES.find(item => item.id === claim.ruleId);
            return (
              <div className="gift-redeem-row" key={claim.id}>
                <span>{rule?.icon || '🎁'}</span>
                <strong>{claim.ownerName || '伙伴'} · {rule?.title || claim.ruleId}</strong>
                <Button type="primary" size="small" onClick={() => props.onGiftRedeem(claim.id || '')}>确认兑现</Button>
              </div>
            );
          }) : <p className="muted">暂时没有待兑现包裹。</p>}
        </div>
      </Card>

      <Card className="island-panel">
        <Title size="small">兑现记录</Title>
        <div className="gift-history">
          {history.length ? history.map(item => (
            <div className="gift-history-item" key={item.id}>
              <span>{item.name} · {item.title}</span>
              <small>{formatShortDate(item.at)}</small>
            </div>
          )) : <p className="muted">兑现后会留下记录。</p>}
        </div>
      </Card>
    </section>
  );
}

function renderGiftAction(unlocked: boolean, claim: unknown, onRequest: () => void) {
  const status = claim && typeof claim === 'object' ? (claim as { status?: string }).status : null;
  if (status === 'redeemed') return <Button type="default" size="small" disabled>已兑现</Button>;
  if (status === 'requested') return <Button type="default" size="small" disabled>等待兑现</Button>;
  if (unlocked) return <Button type="primary" size="small" onClick={onRequest}>申请兑换</Button>;
  return <Button type="default" size="small" disabled>未解锁</Button>;
}

function formatShortDate(ts: number) {
  if (!ts) return '刚刚';
  const date = new Date(ts);
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function CoopView({ state, server, plan, onSettle }: { state: LocalUserState; server: ServerState | null; plan: TrainingPlan; onSettle: (event: { id: string; type: string; title: string; summary: string; createdAt: number }) => void }) {
  const [now] = useState(() => Date.now());
  const summary = createCoopSummary(state, server);
  const leaderboardParticipants = [
    { name: state.username, avatar: state.avatar, isMe: true, settledDays: countSettledDays(state), minutes: countMinutes(state), totalChecked: countChecked(state.dayStates), materials: state.warehouseContribution, title: getUserTitle({ dayStates: state.dayStates, warehouseContribution: state.warehouseContribution, discovered: state.collection.discovered, plan }), currentDay: state.currentDayIndex, lastActive: now },
    ...Object.values(server?.users || {})
      .filter(user => (user.displayName || user.username) !== state.username)
      .map(user => ({
        name: user.displayName || user.username || '伙伴',
        avatar: user.avatar,
        isMe: false,
        settledDays: Object.values(user.dayStates || {}).filter(day => day?.settled && !day?.rest).length,
        minutes: Object.values(user.dayStates || {}).reduce((sum, day) => sum + (day?.settled && !day?.rest ? Number(day.minutes || 0) : 0), 0),
        totalChecked: countChecked(user.dayStates),
        materials: user.warehouseContribution || {},
        title: getUserTitle({ dayStates: user.dayStates || {}, warehouseContribution: user.warehouseContribution, discovered: user.collection?.discovered || [], plan }),
        currentDay: user.currentDayIndex || 0,
        lastActive: user.lastActive || 0,
      })),
  ];
  const today = getDateKey();
  const activityParticipants = [
    { name: state.username, dayStates: state.dayStates, warehouseContribution: state.warehouseContribution, giftClaims: state.giftClaims },
    ...Object.values(server?.users || {})
      .filter(user => (user.displayName || user.username) !== state.username)
      .map(user => ({ name: user.displayName || user.username || '伙伴', dayStates: user.dayStates || {}, warehouseContribution: user.warehouseContribution || {}, giftClaims: user.giftClaims || {} })),
  ];
  const activityItems: string[] = [];
  const myTodayState = state.dayStates[getDayKey(state.currentDayIndex)] || state.dayStates[String(state.currentDayIndex)] || {};
  const myTodayDone = Boolean(myTodayState.settled && !myTodayState.rest && !myTodayState.missed);
  const peerDoneToday = Object.values(server?.users || {}).some(user => {
    if ((user.displayName || user.username) === state.username) return false;
    const peerDay = user.dayStates?.[getDayKey(state.currentDayIndex)] || user.dayStates?.[String(state.currentDayIndex)];
    return Boolean(peerDay?.settled && !peerDay.rest && !peerDay.missed);
  });
  if (myTodayDone && peerDoneToday) activityItems.push('双人同日登岛，码头送来里数券');
  activityParticipants.forEach(participant => {
    if (Object.values(participant.dayStates || {}).some(day => day?.settled && day.settledDate === today)) activityItems.push(`${participant.name} 今天已登岛`);
    const materialCount = Object.values(participant.warehouseContribution || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
    if (materialCount > 0) activityItems.push(`${participant.name} 已贡献 ${materialCount} 份仓库材料`);
    const giftCount = Object.values(participant.giftClaims || {}).filter(claim => claim && typeof claim === 'object' && claim.status === 'redeemed').length;
    if (giftCount > 0) activityItems.push(`${participant.name} 已兑现 ${giftCount} 张礼物券`);
  });
  const nextTarget = BUILDINGS
    .map(building => ({ building, status: getIslandBuildingStatus(building, { checkins: countSettledDays(state), minutes: countMinutes(state), collection: state.collection.discovered.length }, getSharedWarehouse(state, server), server) }))
    .filter(({ building, status }) => building.need > 0 && !status.unlocked)
    .sort((a, b) => b.status.pct - a.status.pct)[0];
  if (nextTarget) activityItems.push(`${nextTarget.building.name} 建设进度 ${nextTarget.status.value}/${nextTarget.building.need}`);
  const weekIndex = Math.floor(state.currentDayIndex / 7);
  const yearMonth = today.slice(0, 7);
  const eventId = getWeeklyEventId(weekIndex, yearMonth);
  const sharedEvents = server?.shared?.events;
  const alreadySettled = Array.isArray(sharedEvents)
    ? sharedEvents.some(event => event && typeof event === 'object' && (event as { id?: string }).id === eventId)
    : Boolean(sharedEvents && (sharedEvents as Record<string, { id?: string } >)[eventId]);
  const sundayState = state.dayStates[getDayKey(weekIndex * 7 + 6)] || {};
  const settlementStatus = getWeeklySettlementStatus({ todayWeekday: getTodayWeekdayIndex(), sundaySettled: !!sundayState.settled, sundayMissed: !!sundayState.missed, alreadySettled });
  function handleSettle() {
    if (!settlementStatus.allowed) return;
    const reviewInsights = getWeeklyReviewInsights(plan, weekIndex, state.dayStates, state.selectedDifficulty);
    const weeklyMinutes = countMinutesInRange(state.dayStates, weekIndex * 7, weekIndex * 7 + 6);
    onSettle(buildWeeklyEvent({ weekIndex, yearMonth, weeklyCheckins: summary.goals[0].value, sameDay: summary.goals[1].value, warehouseTotal: summary.goals[2].value, weeklyMinutes, insights: reviewInsights, now }));
  }
  const goalsDone = summary.goals.filter(goal => goal.value >= goal.target).length;
  const weeklyEvents = (Array.isArray(server?.shared?.events) ? server.shared.events : Object.values(server?.shared?.events || {}))
    .filter((event): event is { id: string; type: string; title: string; summary: string; createdAt: number } => Boolean(event && typeof event === 'object' && (event as { type?: string }).type === 'weekly'))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 4);
  return (
    <section className="view-stack">
      <Card className="island-panel">
        <Title size="small">排行榜</Title>
        <Leaderboard participants={leaderboardParticipants} now={now} />
      </Card>
      <Card className="island-panel">
        <Title size="small">活动动态</Title>
        {activityItems.length ? activityItems.slice(0, 5).map((item, index) => (
          <p key={index} className="activity-item">{item}</p>
        )) : <p className="muted">还没有动态。</p>}
      </Card>
      <Card color="purple" pattern="purple" className="coop-section island-panel">
        <Title size="middle">本周贡献</Title>
        <p>{goalsDone ? `共同目标完成 ${goalsDone}/${summary.goals.length}` : '不是排名，是两个人一起给小岛供能'}</p>
        <div className="weekly-goals">
          {summary.goals.map(goal => (
            <div className="weekly-goal" key={goal.label}>
              <div>
                <strong>{goal.label}</strong>
                <span>{goal.value}/{goal.target} · {goal.reward}</span>
              </div>
              <div className="gift-bar"><span style={{ width: `${Math.min(100, Math.round((goal.value / goal.target) * 100))}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="weekly-ceremony">
          <strong>周结算仪式</strong>
          <span>{settlementStatus.label}</span>
          <small>{settlementStatus.reason}</small>
          {settlementStatus.allowed && <Button type="primary" size="small" onClick={handleSettle}>生成本周结算</Button>}
        </div>
      </Card>
      <Card className="island-panel">
        <Title size="small">周结算公告</Title>
        {weeklyEvents.length ? weeklyEvents.map(event => (
          <div className="weekly-event" key={event.id}>
            <strong>{event.title}</strong>
            <span>{event.summary}</span>
            <small>{formatShortDate(event.createdAt)}</small>
          </div>
        )) : <p className="muted">本周结算后会出现公告</p>}
      </Card>
    </section>
  );
}

function createCoopSummary(state: LocalUserState, server: ServerState | null) {
  const rangeStart = Math.floor(state.currentDayIndex / 7) * 7;
  const rangeEnd = rangeStart + 6;
  const participants = [
    { name: `${state.username} (我)`, dayStates: state.dayStates, warehouseContribution: state.warehouseContribution },
    ...Object.values(server?.users || {})
      .filter(user => (user.displayName || user.username) !== state.username)
      .map(user => ({
        name: user.displayName || user.username || '伙伴',
        dayStates: user.dayStates || {},
        warehouseContribution: user.warehouseContribution || {},
      })),
  ];
  const weeklyCheckins = participants.reduce((sum, participant) => sum + countSettledInRange(participant.dayStates, rangeStart, rangeEnd), 0);
  let sameDay = 0;
  for (let index = rangeStart; index <= rangeEnd; index += 1) {
    const mine = Boolean((state.dayStates[getDayKey(index)] || state.dayStates[String(index)])?.settled);
    const peer = participants.slice(1).some(participant => Boolean((participant.dayStates[getDayKey(index)] || participant.dayStates[String(index)])?.settled));
    if (mine && peer) sameDay += 1;
  }
  const warehouseTotal = sumCounts(getSharedWarehouse(state, server));
  return {
    goals: [
      { label: '本周合计登岛', value: weeklyCheckins, target: 8, reward: '服务处贴纸' },
      { label: '双人同日登岛', value: sameDay, target: 2, reward: '里数券气泡' },
      { label: '共同仓库材料', value: warehouseTotal, target: 20, reward: '仓库装饰' },
    ],
    readyForCeremony: weeklyCheckins >= 8 || sameDay >= 2 || warehouseTotal >= 20,
  };
}

function countSettledInRange(states: LocalUserState['dayStates'], start: number, end: number) {
  let count = 0;
  for (let index = start; index <= end; index += 1) {
    const dayState = states[getDayKey(index)] || states[String(index)];
    if (dayState?.settled && !dayState.rest && !dayState.missed) count += 1;
  }
  return count;
}

function countMinutesInRange(states: LocalUserState['dayStates'], start: number, end: number) {
  let minutes = 0;
  for (let index = start; index <= end; index += 1) {
    const dayState = states[getDayKey(index)] || states[String(index)];
    if (dayState?.settled && !dayState.rest) minutes += Number(dayState.minutes || 0);
  }
  return minutes;
}

function Avatar({ id }: { id: string }) {
  const avatar = AVATARS.find(item => item.id === id) || AVATARS[0];
  return <img className="avatar" src={avatar.img} alt={avatar.name} />;
}

function ItemPill({ item }: { item: string }) {
  const meta = ITEMS[item];
  if (!meta) return <span>{item}</span>;
  return <span className="item-pill">{meta.img ? <img src={meta.img} alt="" /> : meta.emoji}<span>{meta.name}</span></span>;
}

function MessageList({ entries }: { entries: MailboxEntry[] }) {
  if (!entries.length) return <p className="muted">还没有留言。</p>;
  return (
    <div className="mail-list">
      {entries.slice().reverse().map(entry => (
        <div className="mail" key={entry.id}>
          <strong>{entry.authorName}</strong>
          <span>{entry.text}</span>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="metric"><strong>{value}</strong><span>{label}</span></div>;
}


