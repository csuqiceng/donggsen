import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Input,
  Loading,
  Modal,
  Title,
  Wallet,
} from 'animal-island-ui';
import type { ReactNode } from 'react';
import 'animal-island-ui/style';
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
import { findSelfRecord, normalizeMailbox, restoreUserFromServer, sanitizeFixedUser } from './domain/compat';
import {
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
import { diffBuildStages, type BuildStage } from './domain/buildings';
import { BuildUpdateModal } from './components/BuildUpdateModal';
import { Leaderboard } from './components/Leaderboard';
import { AvatarPicker } from './components/AvatarPicker';
import { CuteTip } from './components/CuteTip';
import type { FixedUserName, LocalUserState, MailboxEntry, PlanDay, ServerState, TrainingPlan } from './domain/types';

type ViewKey = 'today' | 'island' | 'bag' | 'collection' | 'gift' | 'coop';

const navItems: Array<{ key: ViewKey; label: string }> = [
  { key: 'today', label: '今日' },
  { key: 'island', label: '岛屿' },
  { key: 'bag', label: '背包' },
  { key: 'gift', label: '礼物' },
  { key: 'coop', label: '贡献' },
];

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
  const [detailModal, setDetailModal] = useState<{ title: string; body?: string; lines?: string[] } | null>(null);
  const [exportModal, setExportModal] = useState<{ title: string; text: string } | null>(null);
  const [toast, setToast] = useState('');
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [buildUpdates, setBuildUpdates] = useState<Array<{ id: string; name: string; from: string; to: string }>>([]);
  const serverRef = useRef<ServerState | null>(server);
  serverRef.current = server;
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
    try {
      const minimumLoading = new Promise(resolve => window.setTimeout(resolve, 650));
      const [loadedPlan, loadedServer] = await Promise.all([fetchPlan(), fetchServerState(), minimumLoading]);
      const initial = createInitialState(fixed);
      const serverSelf = findSelfRecord(loadedServer.users, fixed);
      const restoredBase = serverSelf ? { ...initial, ...restoreUserFromServer(serverSelf) } : initial;
      const restored = { ...restoredBase, currentDayIndex: getAvailableDayIndex(loadedPlan, restoredBase) };
      setPlan(loadedPlan);
      setServer(loadedServer);
      setUserState(restored);
      await sync(restored);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!userState) return;
    const timer = window.setInterval(async () => {
      try {
        const next = await fetchServerState();
        setServer(next);
        const serverSelf = findSelfRecord(next.users, userState.username);
        if (serverSelf?.syncVersion && serverSelf.syncVersion > userState.syncVersion) {
          setUserState(current => current ? { ...current, ...restoreUserFromServer(serverSelf) } : current);
          setSyncText('已更新旧数据');
        }
      } catch {
        setSyncText('同步失败');
      }
    }, 8000);
    return () => window.clearInterval(timer);
  }, [userState]);

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
        onPlanMode={selectedPlanMode => updateState({ ...activeUserState, selectedPlanMode }, '路线已切换')}
        onToggle={index => updateState(toggleTask(activeUserState, dayKey, index, activeAdjustedDay.exercises.length), '任务已更新')}
        onSettle={() => {
          const next = settleToday(activeUserState, dayKey, activeAdjustedDay);
          setRewardModal(next.dayStates[dayKey].rewards || []);
          updateState(next, '今日已结算');
        }}
        onRest={() => updateState(restToday(activeUserState, dayKey, activeAdjustedDay.exercises.length), '已记录休息日')}
        archiveRows={archiveRows}
        onArchiveDay={showArchiveDay}
        onViewIsland={() => setView('island')}
      />
    ),
    island: <IslandView state={activeUserState} server={server} onDetail={setDetailModal} onDecorPlace={placeDecor} onViewMuseum={() => setView('collection')} />,
    bag: <BagView state={activeUserState} onDetail={setDetailModal} />,
    collection: <CollectionView state={activeUserState} onDetail={setDetailModal} />,
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
    coop: <CoopView state={activeUserState} server={server} mailbox={mailbox} plan={activePlan} onSettle={event => { sync(activeUserState, { weeklyEvent: event }).then(() => showToast('周结算公告已贴到贡献页')).catch(() => showToast('周结算同步失败')); }} />,
  };

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
          <Button size="small" type="default" onClick={() => { setSelectedUser(null); setUserState(null); }}>切换</Button>
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
      <Modal open={Boolean(detailModal)} title={detailModal?.title} typewriter={false} onClose={() => setDetailModal(null)} footer={<Button type="primary" onClick={() => setDetailModal(null)}>知道了</Button>}>
        <div className="modal-lines">
          {(detailModal?.lines || (detailModal?.body ? [detailModal.body] : [])).map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
        </div>
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

function LegacyLoading() {
  return (
    <div className="legacy-loading-mask" role="status" aria-live="polite" aria-label="正在加载训练岛">
      <div className="legacy-loading-animal">正在加载训练岛</div>
      <div className="legacy-loading-text">正在加载训练岛...</div>
      <div className="legacy-loading-bar">
        <div className="legacy-loading-bar-inner" />
      </div>
    </div>
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
  onPlanMode: (value: LocalUserState['selectedPlanMode']) => void;
  onToggle: (index: number) => void;
  onSettle: () => void;
  onRest: () => void;
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
        <div className="hidden-quest">{PLAN_MODES[props.userState.selectedPlanMode].hint}</div>
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
          {hiddenStatuses.map(item => (
            <div key={item.id} className={`hidden-status ${item.status}`}>
              <span>{item.name}</span>
              <small>{item.label}</small>
            </div>
          ))}
        </div>
      </Card>

      <Card color="app-teal" pattern="app-teal" className="route-card island-panel">
        <div className="route-header">
          <strong>{props.day.weekTheme || '本周路线'}</strong>
          <span>{PLAN_MODES[props.userState.selectedPlanMode].label}</span>
        </div>
        <div className="segmented route-mode-segmented">
          {Object.entries(PLAN_MODES).map(([key, item]) => (
            <button
              key={key}
              type="button"
              className={`route-mode-btn ${props.userState.selectedPlanMode === key ? 'active' : ''}`}
              onClick={() => props.onPlanMode(key as LocalUserState['selectedPlanMode'])}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="route-nodes">
          {weekDays.map(index => (
            <div key={index} className={`route-node ${index === (props.day.dayInWeek || 0) ? 'current' : ''} ${index < (props.day.dayInWeek || 0) ? 'done' : ''}`}>
              <span>{index + 1}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="task-card island-panel">
        <div className="task-section-title">{props.day.title}</div>
        <div className="task-list">
          {props.day.exercises.map((exercise, index) => (
            <label className="task-row" key={`${exercise[0]}-${index}`}>
              <Checkbox
                value={props.checked[index] ? ['done'] : []}
                options={[{ label: '', value: 'done' }]}
                onChange={() => props.onToggle(index)}
              />
              <span>{exercise[0]}</span>
              <em>{exercise[1]}</em>
            </label>
          ))}
        </div>
      </Card>

      <div className="complete-strip">
        <Button type="primary" size="large" block onClick={props.onSettle}>完成今天</Button>
      </div>
      <Button type="default" size="large" block onClick={props.onRest}>今天休息</Button>

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

function IslandView({ state, server, onDetail, onDecorPlace, onViewMuseum }: {
  state: LocalUserState;
  server: ServerState | null;
  onDetail: (value: { title: string; body?: string; lines?: string[] }) => void;
  onDecorPlace: (id: string) => void;
  onViewMuseum: () => void;
}) {
  const checkins = countSettledDays(state);
  const minutes = countMinutes(state);
  const collectionCount = state.collection.discovered.length;
  const placedDecor = normalizeDecor(server?.shared?.decor);
  const metrics = { checkins, minutes, collection: collectionCount };
  const warehouse = getSharedWarehouse(state, server);
  const warehouseChips = createWarehouseChips(warehouse);
  const residents = [
    { name: state.username, avatar: state.avatar, x: 45, y: 58 },
    ...Object.values(server?.users || {})
      .filter(user => (user.displayName || user.username) !== state.username)
      .slice(0, 1)
      .map((user, idx) => ({ name: user.displayName || user.username || '伙伴', avatar: user.avatar, x: 55 + idx * 8, y: 58 })),
  ];
  return (
    <section className="view-stack">
      <section className="island-map-shell">
        <div className="island-map" aria-label="两个人的小基地地图">
          <span className="map-tree tree-a" />
          <span className="map-tree tree-b" />
          <span className="map-tree tree-c" />
          <span className="map-rock rock-a" />
          <span className="map-rock rock-b" />
          <span className="map-bridge" />
          <button
            type="button"
            className="bottle-point"
            onClick={() => onDetail({ title: '瓶中信', lines: createBottleHintLines(state) })}
            aria-label="瓶中信隐藏任务线索"
          >
            💌
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
                className={`map-point building-${building.id} ${status.unlocked ? 'unlocked' : 'locked'} ${status.pct >= 80 && !status.unlocked ? 'almost' : ''} ${status.stageClass}`}
                style={{ left: `${building.x}%`, top: `${building.y}%` }}
                onClick={() => building.id === 'museum'
                  ? onViewMuseum()
                  : onDetail({
                    title: building.name,
                    lines: [
                      building.desc,
                      building.reward,
                      `状态：${status.label}`,
                      `进度：${status.value}/${status.need}`,
                      `协作人数：${status.coopCount}/${status.coopNeed}`,
                      `共同材料：${status.materialText}`,
                    ],
                  })}
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
          {residents.map(resident => {
            const residentAvatar = AVATARS.find(item => item.id === resident.avatar) || AVATARS[0];
            return (
              <div key={resident.name} className="map-resident" style={{ left: `${resident.x}%`, top: `${resident.y}%` }}>
                <img className="resident-avatar" src={residentAvatar.img} alt={resident.name} />
                <span className="resident-name">{resident.name}</span>
              </div>
            );
          })}
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
      <Card>
        <Title size="small">共享动态</Title>
        <MessageList entries={normalizeMailbox(server?.shared?.mailbox || [])} />
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

function createBottleHintLines(state: LocalUserState) {
  const discovered = new Set(state.collection.discovered);
  const inventory = state.inventory || {};
  const lines = [
    '隐藏线索会继续从旧图鉴和训练记录中解锁。',
    `已发现隐藏：${HIDDEN_QUESTS.filter(item => discovered.has(item.id)).length}/${HIDDEN_QUESTS.length}`,
    `里数券：${inventory.nookMilesTicket || 0} 张`,
  ];
  HIDDEN_QUESTS.forEach(quest => {
    const found = discovered.has(quest.id);
    const lockedLegend = quest.tier === '传说' && !found;
    const name = lockedLegend ? '???' : quest.name;
    lines.push(`${found ? '已触发' : '未触发'} · ${quest.tier} · ${name}`);
    lines.push(`线索：${lockedLegend ? '先发现更多普通和稀有传闻。' : quest.source}`);
    lines.push(`用途：${quest.use}`);
  });
  if ((inventory.nookMilesTicket || 0) > 0) {
    lines.push('额外线索：里数券可以用来查看瓶中信的额外提示，旧数据会继续记录这类探索。');
  }
  return lines;
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

function BagView({ state, onDetail }: { state: LocalUserState; onDetail: (value: { title: string; body: string }) => void }) {
  const entries = Object.entries(ITEMS);
  return (
    <section className="item-grid bag-grid">
      {entries.map(([key, item]) => {
        const source = getItemSource(key);
        const use = getItemUse(key);
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
          </Card>
        );
      })}
    </section>
  );
}

type CollectionFilter = '全部' | '材料' | '建筑' | '隐藏' | '礼物';

interface CollectionEntry {
  id: string;
  name: string;
  icon: string;
  img?: string;
  type: Exclude<CollectionFilter, '全部'>;
  meta: string;
  source: string;
  use: string;
}

const collectionFilters: CollectionFilter[] = ['全部', '材料', '建筑', '隐藏', '礼物'];

function CollectionView({ state, onDetail }: { state: LocalUserState; onDetail: (value: { title: string; body?: string; lines?: string[] }) => void }) {
  const [filter, setFilter] = useState<CollectionFilter>('全部');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 700);
    return () => window.clearTimeout(timer);
  }, []);
  const discovered = new Set(state.collection.discovered);
  const entries = createCollectionEntries().filter(entry => filter === '全部' || entry.type === filter);
  if (loading) {
    return (
      <section className="view-stack museum-loading">
        <Loading />
      </section>
    );
  }
  return (
    <section className="collection-section view-stack">
      <Card className="island-panel collection-head-card">
        <div className="section-head">
          <div>
            <div className="section-title">博物馆</div>
            <p>材料、建筑、隐藏传闻和礼物都会在这里留下记录</p>
          </div>
        </div>
        <div className="collection-tabs">
          {collectionFilters.map(item => (
            <button key={item} type="button" className={`collection-tab ${filter === item ? 'active' : ''}`} onClick={() => setFilter(item)}>
              {item}
            </button>
          ))}
        </div>
      </Card>
      <section className="item-grid collection-grid">
        {entries.map(entry => {
          const found = discovered.has(entry.id);
          return (
            <Card
              key={entry.id}
              className={`collection-card ${found ? 'is-discovered' : 'is-locked'}`}
              onClick={() => onDetail({
                title: found ? entry.name : '未发现项目',
                lines: [
                  `类型：${entry.type}`,
                  `来源：${entry.source}`,
                  `用途：${entry.use}`,
                ],
              })}
            >
              <div className="collection-item-main">
                <span className="collection-item-icon">{found && entry.img ? <img src={entry.img} alt="" /> : found ? entry.icon : '？'}</span>
                <span className="collection-item-name">
                  {found ? entry.name : '???'}
                  <small>{found ? entry.meta : entry.type}</small>
                </span>
              </div>
              <span className="collection-item-status">{found ? '已发现' : '未发现'}</span>
            </Card>
          );
        })}
      </section>
    </section>
  );
}

function createCollectionEntries(): CollectionEntry[] {
  const itemEntries = Object.entries(ITEMS).map(([id, item]) => ({
    id,
    name: item.name,
    icon: item.emoji,
    img: item.img,
    type: '材料' as const,
    meta: '材料',
    source: getItemSource(id),
    use: getItemUse(id),
  }));
  const buildingEntries = BUILDINGS.map(building => ({
    id: building.id,
    name: building.name,
    icon: building.icon,
    type: '建筑' as const,
    meta: '建筑',
    source: building.desc,
    use: building.reward,
  }));
  const decorEntries = DECOR_ITEMS.map(item => ({
    id: `decor_${item.id}`,
    name: item.name,
    icon: item.icon,
    type: '建筑' as const,
    meta: '装饰',
    source: item.desc,
    use: `放置成本：${Object.entries(item.cost).map(([key, value]) => `${ITEMS[key]?.name || key} ${value}`).join(' · ')}`,
  }));
  const giftEntries = GIFT_RULES.map(rule => ({
    id: `gift_${rule.id}`,
    name: rule.title,
    icon: rule.icon,
    type: '礼物' as const,
    meta: '真实礼物',
    source: rule.target,
    use: '训练成果可以变成真实的小礼物。',
  }));
  const hiddenEntries = HIDDEN_QUESTS.map(quest => ({
    id: quest.id,
    name: quest.name,
    icon: quest.icon,
    type: '隐藏' as const,
    meta: `隐藏任务 · ${quest.tier}`,
    source: quest.source,
    use: quest.use,
  }));
  return [...itemEntries, ...buildingEntries, ...decorEntries, ...giftEntries, ...hiddenEntries];
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
        <div className="wish-list">
          {ownWishList.length ? ownWishList.map((item, index) => (
            <div className="wish-chip" key={`${item}-${index}`}>
              <span>{item}</span>
              <button type="button" onClick={() => props.onWishRemove(index)}>移除</button>
            </div>
          )) : <p className="muted">还没有写下心愿。</p>}
        </div>
      </Card>

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
                  <small>{rule.id === 'dinner_together' || rule.id === 'weekend_gift' || rule.id === 'base_decor' ? '双人奖励' : '个人奖励'}</small>
                </div>
              </div>
              <p>{rule.target}</p>
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

function CoopView({ state, server, mailbox, plan, onSettle }: { state: LocalUserState; server: ServerState | null; mailbox: MailboxEntry[]; plan: TrainingPlan; onSettle: (event: { id: string; type: string; title: string; summary: string; createdAt: number }) => void }) {
  const summary = createCoopSummary(state, server, mailbox.length);
  const leaderboardParticipants = [
    { name: state.username, settledDays: countSettledDays(state), minutes: countMinutes(state), lastActive: Date.now() },
    ...Object.values(server?.users || {})
      .filter(user => (user.displayName || user.username) !== state.username)
      .map(user => ({
        name: user.displayName || user.username || '伙伴',
        settledDays: Object.values(user.dayStates || {}).filter(day => day?.settled && !day?.rest).length,
        minutes: Object.values(user.dayStates || {}).reduce((sum, day) => sum + (day?.settled && !day?.rest ? Number(day.minutes || 0) : 0), 0),
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
  activityParticipants.forEach(participant => {
    if (Object.values(participant.dayStates || {}).some(day => day?.settled && day.settledDate === today)) activityItems.push(`${participant.name} 今天已登岛`);
    const materialCount = Object.values(participant.warehouseContribution || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
    if (materialCount > 0) activityItems.push(`${participant.name} 已贡献 ${materialCount} 份仓库材料`);
    const giftCount = Object.values(participant.giftClaims || {}).filter(claim => claim && typeof claim === 'object' && claim.status === 'redeemed').length;
    if (giftCount > 0) activityItems.push(`${participant.name} 已兑现 ${giftCount} 张礼物券`);
  });
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
    onSettle(buildWeeklyEvent({ weekIndex, yearMonth, weeklyCheckins: summary.goals[0].value, sameDay: summary.goals[1].value, warehouseTotal: summary.goals[2].value, insights: reviewInsights, now: Date.now() }));
  }
  return (
    <section className="view-stack">
      <Card className="island-panel">
        <Title size="small">排行榜</Title>
        <Leaderboard participants={leaderboardParticipants} now={Date.now()} />
      </Card>
      <Card className="island-panel">
        <Title size="small">活动动态</Title>
        {activityItems.slice(0, 5).map((item, index) => (
          <p key={index} className="activity-item">{item}</p>
        ))}
      </Card>
      <Card color="purple" pattern="purple" className="coop-section island-panel">
        <Title size="middle">本周贡献</Title>
        <p>不是排名，是两个人一起给小岛供能</p>
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
        <Title size="small">博物馆</Title>
        <div className="gift-target">建设进度 {summary.museum.value}/{summary.museum.need}</div>
        <div className="gift-bar"><span style={{ width: `${summary.museum.pct}%` }} /></div>
      </Card>
      <Card className="island-panel">
        <Title size="small">个人贡献</Title>
        <TableLike rows={summary.rows} />
      </Card>
    </section>
  );
}

function createCoopSummary(state: LocalUserState, server: ServerState | null, mailboxCount: number) {
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
  const museum = BUILDINGS.find(building => building.id === 'museum');
  const museumValue = state.collection.discovered.length;
  const museumNeed = museum?.need || 10;
  return {
    goals: [
      { label: '本周合计登岛', value: weeklyCheckins, target: 8, reward: '服务处贴纸' },
      { label: '双人同日登岛', value: sameDay, target: 2, reward: '里数券气泡' },
      { label: '共同仓库材料', value: warehouseTotal, target: 20, reward: '仓库装饰' },
    ],
    readyForCeremony: weeklyCheckins >= 8 || sameDay >= 2 || warehouseTotal >= 20,
    museum: { value: museumValue, need: museumNeed, pct: Math.min(100, Math.round((museumValue / museumNeed) * 100)) },
    rows: participants.map(participant => [
      participant.name,
      `完成 ${countSettledInRange(participant.dayStates, 0, 999)} 天`,
      `仓库贡献 ${sumCounts(participant.warehouseContribution)} · 留言 ${mailboxCount}`,
    ]),
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

function TableLike({ rows }: { rows: string[][] }) {
  return (
    <div className="table-like">
      {rows.map(row => <div className="table-row" key={row.join('-')}>{row.map(cell => <span key={cell}>{cell}</span>)}</div>)}
    </div>
  );
}
