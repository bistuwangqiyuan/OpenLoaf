

### 1. skillsLoader.ts

**路径**: `apps/server/src/ai/services/skillsLoader.ts`

- 负责扫描 skill 摘要，不负责 settings 持久化，也不负责运行时正文展开。
- `loadSkillSummaries()` 的输入只包含三类来源：
  - 全局技能目录 `globalSkillsPath`
  - 当前项目 `projectRootPath`
  - 父项目链 `parentProjectRootPaths`
- `resolveSkillSources()` 的覆盖优先级是 `global → parent-project → project`。
- 返回给 settings 的 `SkillSummary.scope` 只有 `global | project`。
- 父项目技能在摘要阶段仍归到 `project`，后续通过 `ownerProjectId` 和 `ignoreKey` 区分“当前项目”与“继承项目”。
- `readSkillSummaryFromPath()` 只解析 front matter 中的 `name` / `description`。
- `readSkillContentFromPath()` 只在真正展开 skill 时读取正文。

### 2. SkillSelector.ts

**路径**: `apps/server/src/ai/tools/SkillSelector.ts`

- 负责运行时解析 `/skill/<name>` 并读取完整 skill 正文。
- 搜索优先级是 `project → parent-project → global`。
- `SkillSelector` 自身的搜索 scope 为 `project | parent | global`。
- 这里的 `parent` 只用于正文解析优先级，不是 settings 面板对外暴露的持久化 scope。
- 全局 skill 根目录固定为 `~/.agents/skills`。

### 3. settings.ts

**路径**: `apps/server/src/routers/settings.ts`

#### getSkills 查询

- `getSkills(projectId?)` 会先推导当前项目 root 和祖先项目 roots。
- 然后调用 `loadSkillSummaries()` 合并全局、父项目、当前项目 skill 摘要。
- 最后为每个 skill 计算：
  - `ownerProjectId`
  - `ignoreKey`
  - `isEnabled`
  - `isDeletable`

#### ignoreKey 规则

| 来源 | ignoreKey 格式 | 说明 |
|------|---------------|------|
| `global` | `global:<folderName>` | 全局技能统一使用全局前缀 |
| 当前项目 | `<folderName>` | 当前项目自己的 skill |
| 父项目 | `<parentProjectId>:<folderName>` | 继承 skill，保留来源项目 id |

补充说明：

- 服务端仍接受历史 `workspace:<folderName>` 输入，但只用于归一化兼容，最终会转换为 `global:<folderName>`。
- 业务文档不应再把 `workspace:` 当成当前规则。

#### isEnabled / isDeletable 规则

- `global` 技能的启用状态来自全局 app config 的 `ignoreSkills`。
- `project` 技能的启用状态来自当前项目 `project.json` 的 `ignoreSkills`。
- 在项目视图中，已经被全局关闭的 `global` 技能会直接从结果中过滤掉，而不是再让项目配置覆盖一次。
- 只有“当前项目拥有”的 skill 才允许删除。
- 全局 skill 和父项目继承来的 skill 都不允许在当前项目面板删除。

#### setSkillEnabled / deleteSkill

- `setSkillEnabled.scope` 当前只支持 `project | global`。
- `deleteSkill.scope` 当前只支持 `project | global`。
- `global` scope 不允许通过设置面板删除实体目录。
- `project` scope 下只能删除当前项目自己的 skill，不能删继承 skill。

### 4. absSetting.ts

**路径**: `packages/api/src/routers/absSetting.ts`

- settings 对外暴露的 `skillScopeSchema` 当前只有 `project | global`。
- 如果调整 scope，需要同步检查：
  - `apps/server/src/ai/services/skillsLoader.ts`
  - `apps/server/src/ai/tools/SkillSelector.ts`
  - `apps/server/src/routers/settings.ts`
  - `apps/web/src/components/setting/skills/SkillsSettingsPanel.tsx`

### 全局级

- 存储位置：app config 的 `ignoreSkills`。
- 当前规范 key：`global:<folderName>`。
- 历史 `workspace:<folderName>` 只在服务端归一化阶段兼容，不应继续新增。

### 项目级

- 存储位置：`<project>/.openloaf/project.json` 的 `ignoreSkills`。
- 当前项目 skill 使用 `<folderName>`。
- 父项目 skill 使用 `<parentProjectId>:<folderName>`。
- 项目级配置不会覆盖全局禁用列表；全局禁用的全局 skill 会直接从项目视图隐藏。

## 添加新 Scope 的检查清单

如需新增新的技能作用域（例如 `team`），至少同步检查以下模块：

1. `packages/api/src/routers/absSetting.ts`：扩展对外 schema。
2. `apps/server/src/ai/services/skillsLoader.ts`：扩展摘要扫描来源与覆盖顺序。
3. `apps/server/src/ai/tools/SkillSelector.ts`：扩展正文搜索优先级。
4. `apps/server/src/routers/settings.ts`：补齐 ignoreKey、启用状态、删除边界。
5. `apps/web/src/components/setting/skills/SkillsSettingsPanel.tsx`：补齐展示标签与交互逻辑。
