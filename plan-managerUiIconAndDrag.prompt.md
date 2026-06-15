## Plan: 管理页图标化与拖拽

本次改造聚焦 manager 页面，目标是把高频文字按钮替换为图标按钮，压缩操作区密度，同时补上分组卡片、组内标签、跨组标签移动三层拖拽能力，并将排序结果持久化到现有 sortOrder 字段。推荐方案是新增轻量图标依赖 lucide-svelte 与 Svelte 原生拖拽库 svelte-dnd-action，尽量复用现有 group:update、tab:update 与 storage 排序模型，避免改动数据结构。

**Steps**

1. Phase 1 - 交互定稿与 UI 收口：盘点 manager 页面现有按钮，按“仅图标”“图标+tooltip”“保留文字”三类拆分，确认图标来源统一采用 icones 可检索到的 Lucide 图标集；保留搜索框、标题输入框和状态消息的现状，不扩散到 options 页。
2. Phase 1 - 视觉组件准备：在 manager 页面引入统一的图标按钮样式层，基于现有 .btn 扩展 .btn-icon、.btn-icon-danger、拖拽手柄样式和必要的悬停/聚焦态；补充 title 或 aria-label，保证锁定、归档、恢复、删除等操作在纯图标状态下仍可识别。_可与步骤 1 并行_
3. Phase 2 - 图标替换：替换 manager 页头部与分组卡片中的高频按钮，包括设置、展开/折叠、恢复整组、锁定、归档、删除、单标签打开、单标签删除；保留危险操作 confirm 流程不变，优先调整 [d:/Projects/Personal/park-tab/src/apps/manager/Manager.svelte](d:/Projects/Personal/park-tab/src/apps/manager/Manager.svelte) 中现有按钮节点，而不是重写布局。_依赖 1, 2_
4. Phase 2 - 分组拖拽排序：在分组列表层增加 dnd zone，把 groups 映射为可拖拽条目，拖拽完成后重新计算每个分组的 sortOrder，并通过现有 updateGroup(groupId, { sortOrder }) 路径批量落库；必要时在 background 侧新增 group:reorder 消息，避免前端逐条发送导致闪烁或 revision 膨胀。_依赖 3_
5. Phase 3 - 组内标签拖拽排序：在每个未折叠分组内为 tabs 建立独立 dnd zone，支持同组内重排；拖拽完成后更新相关 TabRecord 的 sortOrder，并通过 tab:update 或新增 tab:reorder 批量消息持久化。排序生成策略建议沿用现有 1000 间隔规则，统一抽成 helper，避免多次拖拽后数值失控。_依赖 4_
6. Phase 3 - 跨组移动标签：开启多 zone 拖拽，把标签从源分组移入目标分组时同步更新 groupId、sortOrder、updatedAt、revision、updatedByDeviceId；如果目标分组当前处于 collapsed，需要明确插入位置策略，建议默认追加到尾部并在放下后立即展开或保持现状但数据成功持久化。_依赖 5_
7. Phase 4 - 数据与消息层收口：在 background 中集中处理 reorder/move 消息，复用 mutateData，确保 revision、自设备信息与同步状态更新逻辑一致；如实现批量消息，补充对 group 不存在、tab 不存在、跨组目标不存在等错误分支。_依赖 4, 5, 6_
8. Phase 4 - 需求文档同步：根据 AGENTS 约束，完成后同步更新 [d:/Projects/Personal/park-tab/docs/requirements.md](d:/Projects/Personal/park-tab/docs/requirements.md) 中对应项的状态或补充实现说明，特别是 6.2 与 6.3 中已落地的拖拽能力。_依赖 7_
9. Phase 5 - 验证：先跑类型检查，再在 manager 页面做手工回归，覆盖图标按钮可用性、分组拖拽、组内拖拽、跨组移动、归档/锁定状态下操作、刷新后顺序保留，以及 storage 变更后页面自动刷新。_依赖 7, 8_

**Relevant files**

- d:/Projects/Personal/park-tab/src/apps/manager/Manager.svelte — 主改造面；复用 updateGroup、updateTab、restoreGroup、restoreTab，新增图标按钮、拖拽容器和排序完成回调。
- d:/Projects/Personal/park-tab/src/styles.css — 扩展按钮与拖拽态样式，如 .btn-icon、拖拽占位态、手柄态、仅图标危险按钮态。
- d:/Projects/Personal/park-tab/src/background/index.ts — 现有 group:update、tab:update 消息入口；适合新增 group:reorder、tab:reorder、tab:move 等批量消息。
- d:/Projects/Personal/park-tab/src/lib/storage.ts — 复用 activeGroups、tabsForGroup、mutateData；可新增 sortOrder 归一化 helper 或批量重排 helper。
- d:/Projects/Personal/park-tab/src/lib/types.ts — 现有 TabGroupRecord.sortOrder 与 TabRecord.sortOrder 已满足排序需求；如新增消息 payload 类型可在这里补充。
- d:/Projects/Personal/park-tab/package.json — 新增 lucide-svelte 与 svelte-dnd-action 依赖，并保持现有 scripts 不变。
- d:/Projects/Personal/park-tab/docs/requirements.md — 按项目约束同步记录“分组拖拽排序”和“标签拖拽排序/移动”落地情况。

**Verification**

1. 安装依赖后执行 pnpm check，确认 Svelte 类型、事件与拖拽指令类型全部通过。
2. 执行 pnpm dev，打开 manager 页面，验证图标按钮渲染、title/aria-label、生效状态与危险操作确认框。
3. 手工验证分组拖拽后顺序立即变化，刷新页面后顺序保持一致。
4. 手工验证同组内标签拖拽后顺序保持一致，刷新后不丢失。
5. 手工验证跨组移动标签后目标分组出现该标签、源分组移除该标签，刷新后 groupId 与顺序保持一致。
6. 验证归档组默认隐藏、显示后仍可拖拽的边界是否符合预期；若当前版本不支持归档组拖拽，需要在实现说明中明确排除。
7. 如启用了本地存储监听，验证拖拽完成后无需手动刷新即可由 chrome.storage.onChanged 驱动视图更新。

**Decisions**

- 本次范围按用户确认，包含三层拖拽：分组排序、组内标签排序、跨组移动标签。
- 图标来源以 icones 可检索到的 Lucide 图标为准，工程内直接使用 lucide-svelte，优先减少手写 SVG 成本。
- 首次实现聚焦 manager 页面，不同步改造 popup 与 options 页面，避免范围外扩。
- 优先通过批量 reorder/move 消息一次性提交排序结果，而不是在前端逐条调用 updateGroup/updateTab。

**Further Considerations**

1. 归档组是否允许作为跨组移动的投放目标。推荐先允许，但在 UI 上弱化显示并保持与 showArchived 设置一致。
2. 拖拽手柄是否只放在分组标题和标签行左侧。推荐加显式手柄，避免输入框区域误触拖拽。
3. sortOrder 是否在每次重排后做归一化。推荐每次完成拖拽后直接重写为 1000 间隔，逻辑稳定且便于同步。
