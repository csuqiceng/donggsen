export type FixedUserName = '哥哥' | '乖宝';
export type Difficulty = 'easy' | 'standard' | 'challenge';
export type PlanMode = 'recovery' | 'standard' | 'power';

export interface Exercise {
  name: string;
  reps: string;
  category?: string;
}

export interface PlanDay {
  title: string;
  date?: string;
  phase?: string;
  summary?: string;
  minutes?: number;
  review?: boolean;
  exercises: Array<[string, string, string?]>;
  weekIndex?: number;
  weekTheme?: string;
  weekSignal?: string;
  dayInWeek?: number;
}

export interface PlanWeek {
  theme: string;
  signal?: string;
  plant?: string;
  days: PlanDay[];
}

export interface TrainingPlan {
  weeks: PlanWeek[];
}

export interface DayState {
  checked?: boolean[];
  settled?: boolean;
  rest?: boolean;
  missed?: boolean;
  done?: boolean;
  completedAt?: number;
  settledDate?: string;
  missedDate?: string;
  difficulty?: Difficulty;
  planMode?: PlanMode;
  rewards?: string[];
  minutes?: number;
}

export type CountMap = Record<string, number>;

export interface CollectionState {
  discovered: string[];
  completed: string[];
}

export interface GiftClaim {
  id?: string;
  ruleId?: string;
  status?: 'requested' | 'redeemed';
  ownerKey?: string;
  ownerName?: string;
  requestedAt?: number;
  redeemedAt?: number;
  redeemedBy?: string;
}

export interface MailboxEntry {
  id: string;
  authorKey?: string;
  authorName: string;
  text: string;
  createdAt: number;
}

export interface SharedState {
  giftClaims?: Record<string, GiftClaim | boolean>;
  wishLists?: Record<string, { ownerKey: string; ownerName: string; items: string[]; updatedAt: number }>;
  wishFulfillments?: Record<string, unknown>;
  mailbox?: MailboxEntry[];
  events?: Record<string, unknown> | unknown[];
  decor?: Record<string, unknown>;
  placedCrafts?: Array<{ id: string; recipeId: string; x: number; y: number; ownerKey?: string; ownerName?: string; placedAt: number }>;
  buildingPositions?: Record<string, { x: number; y: number; ownerKey?: string; ownerName?: string; updatedAt?: number }>;
}

export interface ServerUserRecord {
  clientId?: string;
  userKey?: string;
  username?: string;
  displayName?: string;
  avatar?: string;
  message?: string;
  dayStates?: Record<string, DayState>;
  currentDayIndex?: number;
  inventory?: CountMap;
  warehouseContribution?: CountMap;
  collection?: CollectionState;
  selectedDifficulty?: Difficulty;
  selectedPlanMode?: PlanMode;
  giftClaims?: Record<string, GiftClaim | boolean>;
  lastLoginDate?: string;
  loginStreak?: number;
  lastActive?: number;
  updated?: number;
  syncVersion?: number;
}

export interface ServerState {
  ok: boolean;
  version?: number;
  room?: string;
  updatedAt?: number;
  users?: Record<string, ServerUserRecord>;
  shared?: SharedState;
  error?: string;
}

export interface LocalUserState {
  clientId: string;
  username: FixedUserName;
  avatar: string;
  syncVersion: number;
  currentDayIndex: number;
  selectedDifficulty: Difficulty;
  selectedPlanMode: PlanMode;
  dayStates: Record<string, DayState>;
  inventory: CountMap;
  warehouseContribution: CountMap;
  collection: CollectionState;
  giftClaims: Record<string, GiftClaim | boolean>;
  message?: string;
  lastLoginDate?: string;
  loginStreak?: number;
}

export type SharedPatch =
  | { mailboxEntry: { id: string; text: string; createdAt: number } }
  | { decorItem: { id: string; placedAt: number } }
  | { craftPlacement: { id: string; recipeId: string; x: number; y: number; placedAt: number } }
  | { craftPosition: { id: string; x: number; y: number } }
  | { buildingPosition: { id: string; x: number; y: number } }
  | { weeklyEvent: { id: string; type: string; title: string; summary: string; createdAt: number } }
  | { wishList: string[] }
  | { giftClaim: GiftClaim }
  | { wishFulfillment: Record<string, unknown> };

export interface SyncPayload {
  user: ServerUserRecord;
  shared?: SharedPatch;
}
