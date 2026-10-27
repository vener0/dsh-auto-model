# 自动模型（Auto Model）

[![test](https://github.com/vener0/dsh-auto-model/actions/workflows/test.yml/badge.svg)](https://github.com/vener0/dsh-auto-model/actions/workflows/test.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

给 DeepSeek Harness 增加一个可切换的 **“自动选择”** 模型：模型选择器里出现 **“自动（Auto） → 自动选择”**。选中后，由**主模型**读取副模型清单（参数、输入/输出类型、能力标签、本地配置），为当前任务挑选执行模型；请求由被选中的副模型完成，回复开头标注本次选用。

> 本插件**只做路由**：工具调用、脚本执行、文件修改、审批与沙箱全部沿用当前会话原有机制。

```
用户消息 ──▶ 主模型（只收任务摘要 + 副模型清单）
                 │ {"route":"provider/model","reason":"…"}
                 ▼
           副模型（执行请求、调用工具、生成回复）
                 │
                 ▼
   回复 = 🧭 自动模式｜主模型 X｜任务 … → 执行 Y + 副模型输出
```

## 安装

通过 GitHub 安装（暂未发布到 npm）：

```bash
# 跟随 main
dsh plugin --profile web add github:vener0/dsh-auto-model

# 固定 commit（推荐，避免分支变动）
dsh plugin --profile web add github:vener0/dsh-auto-model#<40位commit>
```

在 GitHub 仓库的 **Commits** 页面可以复制完整 40 位 commit SHA。安装后**重启 Harness**。

## 使用

1. 在会话的模型选择器中选 **“自动（Auto） → 自动选择”**。
2. 打开 **设置 → 自动模型**：
   - **主模型**：负责挑选执行模型（自己不回答用户），建议选响应快、指令稳定的模型。
   - **副模型清单**：主模型只能从这里选；顺序即提示与重试顺序，可勾选 **免费**、设置 **标签**。
   - **自定义标签**：输入自己的标签（字母/数字/中文/`-`/`_`，最多 20 个），用于任意副模型。
   - **优先使用免费模型**：默认关闭；开启后先尝试免费模型，不可用或失败时自动切换。
   - **兜底模型**：副模型全部不可用时使用。
   - **在回复中显示本次选用的模型**：默认开启。
   - **向模型提示中提供 API Key 明文**：默认关闭，见下文。
   - **高级**：上下文窗口 / 最大输出覆盖（0 = 自动 / 模型默认）。

## 标签

### 输入 / 输出类型（纯模态）

`text`、`image`、`audio`、`video`。每个副模型分别声明输入和输出类型，例如：对话模型 `text→text`，视觉模型 `text+image→text`，文生图 `text→image`，图生图 `image→image`。

### 能力标签（软偏好）

| 标签 | 含义 | 标签 | 含义 |
|---|---|---|---|
| `vision` | 图像理解 | `coding` | 代码 |
| `image-gen` | 文生图 | `reasoning` | 推理 |
| `image-to-image` | 图生图 | `math` | 数学 |
| `multimodal` | 多模态 | `long-context` | 长上下文 |
| `audio-gen` | 音频生成 | `fast` | 快速 |
| `video-gen` | 视频生成 | `tools` | 工具调用 |
| `ocr` | 文字识别 | `translation` | 翻译 |
| `summarization` | 摘要 | `creative` | 创意 |
| `agentic` | 自动化 | | |

能力标签**只影响排序与提示**，不做硬过滤；带图片请求的输入模态由宿主 `inputModalities` 硬性保证。未打标签的模型按“通用”参与，仍可被选中；Host 还会从模型名称/元数据自动推导部分标签，设置页显示标签覆盖情况。

### 任务标签（自动推导）

| 条件 | 标签 |
|---|---|
| 最新消息带图片 | `vision` |
| 要求生成图片（“画一张…/文生图/draw an image”） | `image-gen` |
| 带图 + 要求生成图片 | `image-to-image` |
| 带图 + 已有工具调用 | `multimodal` |
| 已有工具调用 | `tools` |
| 估算上下文 ≥ 48k / ≤ 6k（无图） | `long-context` / `fast` |

## 文生图 / 图生图

DSH 没有 `outputModalities`，图片由**工具**生成。给适合画图的模型设置输出含 `image`、能力含 `image-gen` / `image-to-image` + `tools` 即可：

```yaml
- provider: hbec
  model: qwen25-72b
  inputs: [text, image]
  outputs: [text, image]
  tags: [vision, image-gen, image-to-image, multimodal, tools]
  free: false
```

模型只负责理解需求并调用工具，不需要直接输出图片；独立画图服务通常注册为工具，而不是副模型。

## 免费优先与失败处理

- 开启免费优先后，主模型先判断免费模型能否胜任，能胜任就选免费；免费模型失败时自动换其他候选。
- 任何副模型在**产生可见输出之前**失败（鉴权、限流、额度、上下文超限、网络等），按顺序重试下一个，并在回复中提示：
  `⚠️ X 调用失败（原因），已切换到 Y`
- 全部失败时由**主模型带完整对话接管**；主模型也失败则输出可读的失败总结，不再裸报错。
- 失败模型冷却 2 分钟；已产生可见输出后失败不中途换模型。

## 主模型看到什么

路由提示只含**任务摘要**：副模型清单、任务标签、是否含图/文生图/工具、请求大小估算、最后一条用户消息（截断）、助手最近消息、工具名。**不发送完整会话上下文**；而执行时转发给副模型的请求原样携带完整 `messages`、`tools`、`temperature` 等参数。

主模型只输出一行 JSON，解析失败时回退到清单第一个可用副模型。

## API Key

默认 `exposeApiKeys: false`：提示里只有环境变量名和“已配置/未配置”。开启后会把真实 Key 写进路由提示，用于让主模型规划“写本地外部脚本 + 工具调用”的路线；**密钥会发给主模型提供方，有泄露风险**，仅在明确需要时开启。脚本执行仍走当前会话的工具与审批，插件不提供私有执行通道。

## 已知限制

- 每轮多一次轻量路由调用（约几百 token）。
- 请求大小按字符/图片估算，不精确；上下文超限靠失败重试兜底。
- 主模型只看任务摘要，不适合需要通读全文的细粒度决策；副模型执行时仍有完整上下文。
- 计费/用量按 `auto/auto` 记录；系统提示里的 `{{model}}` 显示为 `auto`。
- 上下文窗口默认取候选最小值（安全但可能偏小），可在设置中覆盖。

## 开发

```bash
npm install
npm test        # 33 个路由用例
```

- `index.js`：Host 插件，注册虚拟 Provider `auto`（模型 `auto`），负责路由、转发、失败兜底。
- `client.js`：设置页；`cordis.patch.yml`：bundle 声明；`test/router.test.mjs`：单元测试。
- 配置持久化到 `$DSH_HOME/profiles/<profile>/cordis.patch.yml` 的 `auto-model` 行。

MIT License.
