
## 三类媒体节点对比

| 维度 | imageGenerate | videoGenerate | imagePromptGenerate |
|------|--------------|---------------|---------------------|
| **type** | `image_generate` | `video_generate` | `image_prompt_generate` |
| **功能** | 文/图 → 新图片 | 文/图 → 视频 | 图 → 文本描述（图生文） |
| **输入** | 提示词必需，多图可选，最多 9 张 | 提示词和图片至少一项 | 单张图片必需 |
| **输出** | ImageNode 1-5 张 | VideoNode 1 个 | `resultText` 文本 |
| **接口** | `POST /ai/image` | `POST /ai/vedio` | `POST /ai/execute` SSE |
| **异步模式** | LoadingNode 轮询 | LoadingNode 轮询 | SSE 流式更新 |

> 备注：Board 节点走 SaaS HTTP 接口，不再走旧的 tRPC `ai` 路由。

## 输入解析与异步任务

- 图片和视频节点都通过 connector 动态收集上游输入，不把媒体输入冗余存进 props。
- 异步生成流程固定为：
  1. 先创建 LoadingNode
  2. 建立 source → loading 的连接
  3. 提交任务
  4. 将返回的 `taskId` 写回 LoadingNode
  5. 轮询直到创建最终节点并清理 LoadingNode
- LoadingNode 和提交 payload 当前都只使用：
  - `projectId`
  - `saveDir`
  - `sourceNodeId`
- 不要再向 Board 媒体链路写入历史工作空间字段。

## 图生文流程

- `imagePromptGenerate` 通过 `POST /ai/execute` 走 SSE。
- 前端按事件流持续更新 `resultText` / `errorText`。
- 终止条件是收到 `[DONE]` 或主动中止请求。

### imageGenerate

| 条件 | 要求 |
|------|------|
| 基础 | tag: `image_generation` |
| 遮罩 | tag: `image_edit` + `capabilities.input.supportsMask` |
| 多图输入 | tag: `image_multi_input` + `maxImages >= N` |
| 单图输入 | tag: `image_input` 或 `image_multi_input` |
| 多图输出 | `capabilities.output.supportsMulti` |

### videoGenerate

| 条件 | 要求 |
|------|------|
| 基础 | tag: `video_generation` |
| 参考视频 | tag: `video_reference` |
| 首尾帧 | tag: `video_start_end` + `supportsStartEnd` |
| 音频输出 | tag: `video_audio_output` + `supportsAudio` |

### imagePromptGenerate

- 只接受同时满足 `image_input` 与 `text_generation` 的模型。
- 需要显式排除 `image_edit`、`image_generation`、`code` 等无关标签。

## 动态参数与运行时字段

- 视频节点的高级参数来自模型定义里的 `parameters.fields`。
- LoadingNode 关注的核心运行时字段包括：
  - `taskId`
  - `taskType`
  - `sourceNodeId`
  - `promptText`
  - `chatModelId`
  - `projectId`
  - `saveDir`

## Common Mistakes

| 错误 | 正确做法 |
|------|----------|
| 直接提交任务，不先建 LoadingNode | 先建 LoadingNode，再提交并写回 `taskId` |
| LoadingNode 没有 connector | 必须保留源节点到 LoadingNode 的连接 |
| 图片未转 `{ base64, mediaType }` | SaaS 提交前统一转成 base64 payload |
| 视频不区分普通模式与首尾帧模式 | 根据 `supportsStartEnd` 决定 `inputs` 结构 |
| 新模型未补过滤规则 | 同步更新图片/视频节点的过滤逻辑 |
| 清理 LoadingNode 时遗留 connector | 保证节点和连线一起清理 |

## Debugging

1. 模型为空时先检查 SaaS 登录态和模型接口响应。
2. 任务卡住时先看 LoadingNode 上是否写入 `taskId`。
3. 图片或视频不显示时检查最终节点 payload 是否完整。
4. 连线输入未识别时重点检查 connector 的 target/source 关系。
5. SSE 中断时优先确认 `[DONE]` 处理和 AbortController 生命周期。
