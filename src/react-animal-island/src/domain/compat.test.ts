import { describe, expect, it } from 'vitest';
import {
  buildUserPayload,
  deriveUserKey,
  normalizeMailbox,
  restoreUserFromServer,
  sanitizeFixedUser,
} from './compat';

describe('旧接口兼容层', () => {
  it('只允许固定用户哥哥和乖宝', () => {
    expect(sanitizeFixedUser('哥哥')).toBe('哥哥');
    expect(sanitizeFixedUser(' 乖宝 ')).toBe('乖宝');
    expect(sanitizeFixedUser('新用户')).toBeNull();
  });

  it('沿用后端按 displayName 生成的稳定 userKey', () => {
    expect(deriveUserKey('哥哥')).toBe('name_6cf70b7c4fa3c4b4627dc026');
    expect(deriveUserKey('乖宝')).toBe('name_fec17638af4ba8bc8b8f46b4');
    expect(deriveUserKey('哥哥')).toBe(deriveUserKey(' 哥哥 '));
  });

  it('POST payload 保持旧 state.php 的 user/shared 结构', () => {
    const payload = buildUserPayload({
      clientId: 'client-1',
      username: '哥哥',
      avatar: 'rosie',
      syncVersion: 7,
      currentDayIndex: 2,
      selectedDifficulty: 'standard',
      selectedPlanMode: 'standard',
      dayStates: { d1: { done: true } },
      inventory: { wood: 2 },
      warehouseContribution: { wood: 1 },
      collection: { discovered: ['wood'], completed: [] },
      giftClaims: {},
    }, { mailboxEntry: { id: 'mail_1', text: '今天完成了', createdAt: 1 } });

    expect(payload).toEqual({
      user: expect.objectContaining({
        clientId: 'client-1',
        username: '哥哥',
        displayName: '哥哥',
        avatar: 'rosie',
        syncVersion: 7,
        currentDayIndex: 2,
        selectedDifficulty: 'standard',
        selectedPlanMode: 'standard',
        message: '',
      }),
      shared: {
        mailboxEntry: { id: 'mail_1', text: '今天完成了', createdAt: 1 },
      },
    });
  });

  it('能从旧服务端用户记录恢复本地状态', () => {
    const restored = restoreUserFromServer({
      syncVersion: 3,
      currentDayIndex: 5,
      selectedDifficulty: 'challenge',
      selectedPlanMode: 'power',
      dayStates: { d5: { done: true } },
      inventory: { stone: 4 },
      warehouseContribution: { stone: 2 },
      collection: { discovered: ['stone'], completed: ['stone'] },
      giftClaims: { gift_1: true },
      avatar: 'isabelle',
    });

    expect(restored.syncVersion).toBe(3);
    expect(restored.currentDayIndex).toBe(5);
    expect(restored.selectedDifficulty).toBe('challenge');
    expect(restored.inventory?.stone).toBe(4);
  });

  it('留言历史兼容 shared.mailbox，并限制为最近 20 条', () => {
    const mailbox = normalizeMailbox(Array.from({ length: 22 }, (_, index) => ({
      id: `mail_${index}`,
      authorName: index % 2 ? '哥哥' : '乖宝',
      text: `留言 ${index}`,
      createdAt: index,
    })));

    expect(mailbox).toHaveLength(20);
    expect(mailbox[0].id).toBe('mail_2');
    expect(mailbox[19].text).toBe('留言 21');
  });
});
