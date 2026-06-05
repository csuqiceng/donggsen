# 双人小基地 V1 设计方案

## 定位

把当前的个人训练打卡页升级成两个人共同经营的训练小基地。

核心不是竞争排名，而是两个人每天训练、获得材料、建设岛屿、解锁图鉴和隐藏任务。

```text
今日训练 -> 选择难度 -> 打卡结算 -> 获得奖励 -> 背包/仓库累积 -> 岛屿解锁 -> 图鉴记录
```

## 项目边界

当前项目目录：

```text
src/
  index.html
  plan.json
```

`plan.json` 继续只负责训练计划。背包、仓库、图鉴、岛屿解锁和双人同步都属于运行时状态，不写进 `plan.json`。

本项目按私人网页使用场景设计，可以采用《动物森友会》风格命名和彩蛋文本，整体体验更接近粉丝自用小岛。不要直接打包、分发或公开部署官方图片、音频、角色立绘、家具图标等素材；如果后续要对外发布，需要把官方命名和素材替换成原创森系版本。

## 页面结构

底部导航从当前三键操作升级为五个页签：

```text
今日 / 岛屿 / 背包 / 图鉴 / 排行
```

### 今日

保留现有训练能力：

- 训练计划加载
- 周路线
- 今日动作列表
- 勾选动作
- 结算当天
- 伙伴状态

新增：

- 难度选择
- 奖励预览
- 今日隐藏任务提示
- 结算后奖励弹窗

### 岛屿

两个人的小基地地图。第一版先做五个建筑点：

```text
服务处帐篷：默认解锁
收纳仓库：双人累计 3 次打卡
狸端机：双人累计 5 次打卡
博物馆：发现 10 个图鉴项目
海边码头：累计 120 分钟
```

每个建筑点展示：

```text
状态：已解锁 / 建设中 / 未发现
进度：12 / 20 木材
贡献：你 7，对方 5
```

### 背包

个人物品和材料，只显示属于当前用户的资源：

```text
树枝
木材
软木材
硬木材
石头
铁矿石
黏土
杂草
贝壳
星星碎片
铃钱
里数券
金色树叶
```

### 图鉴

第一版做轻量收藏册：

```text
材料图鉴
建筑图鉴
隐藏任务图鉴
鱼虫化石彩蛋图鉴
```

图鉴项状态：

```text
未发现
已发现
已完成
```

### 排行

将“排行榜”弱化为“本周贡献”，避免两个人互相卷。

展示：

```text
本周积分
完成天数
挑战次数
仓库贡献
合作完成率
```

同时展示双人合作目标：

```text
本周一起完成 8 次打卡，给服务处升级
```

## 难度选择

每天可以单独选择难度，不永久绑定。

```text
轻松 / 标准 / 挑战
```

规则：

- 轻松：奖励 x1，适合保连续。
- 标准：奖励 x2，沿用当前计划。
- 挑战：奖励 x3，可能触发隐藏任务。

V1 不改 `plan.json` 的动作内容，只在 UI 上显示难度提示和奖励差异。这样不会破坏已有打卡记录。

## 结算奖励

完整完成当天时：

```text
score = 完成动作数 * 难度倍率
materials = 按难度发放 1-3 个
warehouseContribution = 部分材料进入共享仓库
```

如果选择“今天到这”，也算出现，但奖励少一些。目标是保留训练连续性，而不是惩罚没有做满的用户。

## 隐藏任务

隐藏任务只奖励，不影响主线完成。

V1 先做五个：

```text
同日双人都打卡 -> 里数券
晚上打卡 -> 星星碎片
轻松难度连续 3 天 -> 金色树叶
挑战完整完成 -> 铃钱袋
周复盘日完成 -> 博物馆图鉴条目
```

## 数据结构

运行时状态保存在 `localStorage`，并通过 Gun.js 同步给伙伴。

建议结构：

```js
{
  profile: {
    username,
    difficulty
  },
  dayStates: {
    [dayIndex]: {
      checked: [0, 1, 2],
      settled: true,
      difficulty: "standard",
      score: 12,
      rewards: ["wood", "nook_miles_ticket"],
      hiddenTasks: ["same_day_checkin"],
      settledAt: 1780000000000
    }
  },
  inventory: {
    branch: 2,
    wood: 3,
    softwood: 1,
    hardwood: 1,
    stone: 2,
    ironNugget: 0,
    clay: 0,
    weed: 0,
    shell: 2,
    starFragment: 1,
    bells: 300,
    nookMilesTicket: 1,
    goldenLeaf: 0
  },
  warehouse: {
    wood: 8,
    shell: 5,
    stone: 3,
    ironNugget: 1
  },
  island: {
    unlocked: ["resident_services_tent"],
    progress: {
      storage: 2,
      nook_stop: 4,
      museum: 6
      pier: 80
    }
  },
  collection: {
    discovered: ["wood", "shell", "resident_services_tent"],
    completed: []
  }
}
```

## 同步设计

当前项目已经使用 Gun.js。V1 继续沿用，但需要扩展同步字段：

```text
username
dayStates
currentDayIndex
inventory
warehouseContribution
collection
lastActive
updated
```

共享仓库和岛屿进度可以从两个人同步状态计算出来，避免多人同时写同一份共享对象造成覆盖。

## 视觉方向

参考完整 skill 的 `fitness-island/assets/design.md`：

- 先组件，后页面。
- 复用现有 Card、Button、Checkbox、Collapse、Modal、Toast 形态。
- 不堆解释文案。
- 状态尽量通过颜色、位置、图标表达。
- 风格保持圆润、低压力、手账、岛屿、木牌、贴纸、贝壳、树叶。
- 私人版本可以使用动森式命名：铃钱、里数券、服务处、狸端机、博物馆、码头、化石、鱼虫、星星碎片。
- 视觉素材优先用原创插图或 CSS/emoji/简单图标表达，不直接内置官方截图、角色立绘、家具图标或游戏音频。

新增组件建议：

```text
DifficultySelector
RewardPreview
IslandMap
IslandBuildingNode
InventoryBag
SharedWarehouse
CollectionBook
WeeklyContributionBoard
HiddenQuestCard
CoopUnlockPanel
```

## 实现顺序

建议按以下顺序实现：

```text
1. 拆分 src/index.html 为 index.html / styles.css / app.js
2. 加难度选择和结算奖励
3. 加背包和仓库数据
4. 改底部导航为 5 页
5. 做岛屿页 5 个建筑点
6. 排行改成本周贡献
7. 加隐藏任务和图鉴
8. 最后做视觉优化和动森风插图
```

## V1 验收标准

- 两个人输入不同用户名后能互相看到对方状态。
- 每天能选择轻松、标准、挑战三种难度。
- 结算后能获得积分和材料。
- 个人背包能显示材料。
- 双人贡献能汇总到共享仓库。
- 岛屿页能显示至少五个建筑点和解锁进度。
- 本周贡献能展示两个人的积分、完成天数和贡献。
- 至少三个隐藏任务可以触发并进入图鉴。

## 暂不做

V1 暂不做以下内容：

- 复杂 3D 岛屿。
- 完整故事线。
- 用户账号系统。
- 私密房间码。
- 云端数据库。
- 每个动作的精细三档训练处方。

这些可以放到 V2。
