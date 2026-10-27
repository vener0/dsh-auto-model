/**
 * Auto model mode — a synthetic `auto` LLM provider driven by a main model.
 *
 * The model picker shows one synthetic route, `auto/auto`. While a session
 * selects it, every request is dispatched like this:
 *
 *   1. The plugin asks the configured **main model** (主模型) to choose one of
 *      the configured **sub models** (副模型) for the upcoming step. The main
 *      model sees each sub model's parameters (context window, output limit,
 *      modalities, endpoint) and local configuration (base URL, API-key
 *      environment reference, whether a credential resolves) — optionally the
 *      resolved key itself when `exposeApiKeys` is enabled.
 *   2. The real request is forwarded to the chosen sub model through
 *      `ctx.llm.stream`, so file/image projection, replay, retry and metering
 *      stay in the normal Harness path.
 *   3. The assistant reply starts with one visible routing line naming the
 *      main model's choice, so the user can see which model executed the task.
 *
 * The routing decision is cached per user turn (keyed by the last user
 * message, the image/tool state and the configured model list): one decision
 * per turn, re-evaluated when the turn, the capabilities or the configuration
 * change. Helper calls (compaction, session titles) skip the main model and
 * use the first text-capable sub model.
 *
 * @module dsh-auto-model
 */
/**
 * Load the schemastery copy that belongs to the running DSH installation.
 *
 * A profile bundle is linked into the profile from its checkout, so a bare
 * `@deepseek-ai/*` import only resolves when the checkout happens to carry
 * node_modules. The installed Harness always does, so fall back to a require
 * anchored at `<app.asar>/dsh/package.json` (Electron exposes `resources`).
 */
async function loadSchemastery() {
  try {
    const loaded = await import('@deepseek-ai/schemastery')
    return loaded.default ?? loaded
  } catch {
    /* fall through to the installation-anchored resolution */
  }
  const [{ createRequire }, { dirname, join }] = await Promise.all([import('node:module'), import('node:path')])
  const resources = typeof process.resourcesPath === 'string' && process.resourcesPath.length > 0
    ? process.resourcesPath
    : join(dirname(process.execPath), 'resources')
  const requireFromInstall = createRequire(join(resources, 'app.asar', 'dsh', 'package.json'))
  const loaded = requireFromInstall('@deepseek-ai/schemastery')
  return loaded.default ?? loaded
}

const z = await loadSchemastery()

/** Route identity of the synthetic provider and its only model. */
const PROVIDER = 'auto'
const MODEL = 'auto'
/** Conservative context window used until the candidate models resolve. */
const FALLBACK_CONTEXT_WINDOW = 65536
/** Display copy for the synthetic route, shown by the model picker. */
const PROVIDER_NAME = '自动（Auto）'
const MODEL_NAME = '自动选择'
const MODEL_DESCRIPTION = '主模型读取副模型清单并选择执行模型；失败自动切换，必要时由主模型兜底回复'

/** Routing-decision cache lifetime and bound. */
const DECISION_TTL_MS = 10 * 60 * 1000
const DECISION_LIMIT = 64

/**
 * Input/output modalities are plain types (text / image / audio / video).
 * Capabilities describe what the model is good at: image understanding,
 * text-to-image, image-to-image, multimodal, coding, ... Capabilities are soft
 * preferences; input capability is enforced by the host metadata and output
 * capability is used for ranking and prompting.
 */
const MODALITIES = ['text', 'image', 'audio', 'video']
const MODALITY_LABELS = { text: '文本', image: '图片', audio: '音频', video: '视频' }
const CAPABILITY_TAGS = [
  'vision', 'image-gen', 'image-to-image', 'multimodal', 'audio-gen', 'video-gen',
  'coding', 'reasoning', 'math', 'long-context', 'fast', 'tools',
  'ocr', 'translation', 'summarization', 'creative', 'agentic',
]
const TAGS = CAPABILITY_TAGS
const TAG_LABELS = {
  vision: '图像理解',
  'image-gen': '文生图',
  'image-to-image': '图生图',
  multimodal: '多模态',
  'audio-gen': '音频生成',
  'video-gen': '视频生成',
  coding: '代码',
  reasoning: '推理',
  math: '数学',
  'long-context': '长上下文',
  fast: '快速',
  tools: '工具',
  ocr: 'OCR',
  translation: '翻译',
  summarization: '摘要',
  creative: '创意',
  agentic: '自动化',
}
const TAG_ALIASES = {
  vision: 'vision',
  'image-understanding': 'vision',
  'image_understanding': 'vision',
  'image-gen': 'image-gen',
  imagegen: 'image-gen',
  'image_generation': 'image-gen',
  'text-to-image': 'image-gen',
  t2i: 'image-gen',
  'image-to-image': 'image-to-image',
  imagetoimage: 'image-to-image',
  'image_to_image': 'image-to-image',
  i2i: 'image-to-image',
  multimodal: 'multimodal',
  'multi-modal': 'multimodal',
  'audio-gen': 'audio-gen',
  audiogen: 'audio-gen',
  'audio_generation': 'audio-gen',
  'text-to-audio': 'audio-gen',
  t2a: 'audio-gen',
  'video-gen': 'video-gen',
  videogen: 'video-gen',
  'video_generation': 'video-gen',
  'text-to-video': 'video-gen',
  t2v: 'video-gen',
  coding: 'coding',
  code: 'coding',
  reasoning: 'reasoning',
  reason: 'reasoning',
  math: 'math',
  maths: 'math',
  'long-context': 'long-context',
  long: 'long-context',
  fast: 'fast',
  tools: 'tools',
  tool: 'tools',
  ocr: 'ocr',
  translation: 'translation',
  translate: 'translation',
  summarization: 'summarization',
  summary: 'summarization',
  summarize: 'summarization',
  creative: 'creative',
  creativity: 'creative',
  agentic: 'agentic',
  agent: 'agentic',
  automation: 'agentic',
}

const ModelRef = z.object({
  provider: z.string().required(),
  model: z.string().required(),
  /** Declared input modalities; empty falls back to the host metadata. */
  inputs: z.array(z.string()).default([]),
  /** Declared output modalities; empty means text only. */
  outputs: z.array(z.string()).default([]),
  /** Soft capability tags; empty tags mean "general purpose". */
  tags: z.array(z.string()).default([]),
  /** Legacy single category, migrated into inputs/capabilities when read. */
  category: z.string().default(''),
  /** User-declared billing flag: free models are preferred when enabled. */
  free: z.boolean().default(false),
})

/**
 * Volatile config fields: each one is live-editable from the browser settings
 * page (`$DSH_PROFILE_DIR/cordis.patch.yml` override of this row).
 */
export const Config = z.object({
  mainProvider: z.string().default('').volatile(),
  mainModel: z.string().default('').volatile(),
  subModels: z.array(ModelRef).default([]).volatile(),
  /** User-defined extra tags, usable on any sub model. */
  customTags: z.array(z.string()).default([]).volatile(),
  /** Deprecated: tags are always advisory; the main model decides. */
  strictTags: z.boolean().default(false).volatile(),
  /** Legacy toggle: ignored. */
  categorizeSubModels: z.boolean().default(false).volatile(),
  /** Prefer free sub models; fall back to paid ones when they fail. */
  preferFreeModels: z.boolean().default(false).volatile(),
  fallbackProvider: z.string().default('').volatile(),
  fallbackModel: z.string().default('').volatile(),
  contextWindow: z.number().default(0).volatile(),
  maxTokens: z.number().default(0).volatile(),
  showRoute: z.boolean().default(true).volatile(),
  exposeApiKeys: z.boolean().default(false).volatile(),
})

export const name = 'auto-model'
export const inject = ['llm']

/** Normalize one declared capability tag. */
function normalizeTag(value, allowed) {
  const raw = String(value ?? '').trim().toLowerCase()
  const tag = TAG_ALIASES[raw] ?? raw
  return tag !== '' && allowed.includes(tag) ? tag : ''
}

/** Normalize one modality value. */
function normalizeModality(value) {
  const raw = String(value ?? '').trim().toLowerCase()
  return MODALITIES.includes(raw) ? raw : ''
}

/** Normalize one modality list, dropping unknown values and duplicates. */
function normalizeModalities(value) {
  const list = []
  for (const item of Array.isArray(value) ? value : []) {
    const modality = normalizeModality(item)
    if (modality !== '' && !list.includes(modality)) list.push(modality)
  }
  return list
}

/** Normalize user-defined custom tags (lowercase, bounded, deduped). */
function normalizeCustomTags(value) {
  const tags = []
  const seen = new Set()
  for (const item of Array.isArray(value) ? value : []) {
    const tag = String(item ?? '').trim().toLowerCase().slice(0, 24)
    if (tag === '' || TAGS.includes(tag) || seen.has(tag)) continue
    if (!/^[a-z0-9\u4e00-\u9fff][a-z0-9\u4e00-\u9fff _-]*$/.test(tag)) continue
    seen.add(tag)
    tags.push(tag)
    if (tags.length >= 20) break
  }
  return tags
}

/**
 * Normalize one entry: declared inputs/outputs first, then legacy flat tags
 * (old configs mixed `text` / `vision` / `image-gen` into `tags`), then the
 * legacy category. Capabilities imply a modality only during migration.
 */
function normalizeEntry(entry, allowed) {
  const inputs = normalizeModalities(entry.inputs)
  const outputs = normalizeModalities(entry.outputs)
  const tags = []
  const addTag = (value) => {
    const tag = normalizeTag(value, allowed)
    if (tag !== '' && !tags.includes(tag)) tags.push(tag)
  }
  // Only infer modalities from flat tags when the entry has no explicit
  // inputs/outputs (old configs). New configs keep the declared modalities.
  const legacy = !Array.isArray(entry.inputs) && !Array.isArray(entry.outputs)
  for (const value of Array.isArray(entry.tags) ? entry.tags : []) {
    if (!legacy) {
      addTag(value)
      continue
    }
    const raw = String(value ?? '').trim().toLowerCase()
    if (raw === 'text') {
      if (!inputs.includes('text')) inputs.push('text')
      continue
    }
    if (raw === 'image' || raw === 'vision' || raw === 'image-input') {
      if (!inputs.includes('image')) inputs.push('image')
      addTag('vision')
      continue
    }
    if (raw === 'audio') {
      if (!inputs.includes('audio')) inputs.push('audio')
      continue
    }
    if (raw === 'video') {
      if (!inputs.includes('video')) inputs.push('video')
      continue
    }
    if (raw === 'multimodal') {
      if (!inputs.includes('image')) inputs.push('image')
      addTag('multimodal')
      continue
    }
    if (raw === 'image-gen') {
      if (!outputs.includes('image')) outputs.push('image')
      addTag('image-gen')
      continue
    }
    if (raw === 'audio-gen') {
      if (!outputs.includes('audio')) outputs.push('audio')
      addTag('audio-gen')
      continue
    }
    if (raw === 'video-gen') {
      if (!outputs.includes('video')) outputs.push('video')
      addTag('video-gen')
      continue
    }
    addTag(raw)
  }
  if (legacy && tags.length === 0 && inputs.length === 0 && typeof entry.category === 'string') {
    if (entry.category === 'text') inputs.push('text')
    else if (entry.category === 'image') { inputs.push('image'); addTag('vision') }
    else if (entry.category === 'multimodal') { inputs.push('image'); addTag('multimodal') }
  }
  return { inputs, outputs, tags }
}

/** Normalize one candidate array, dropping malformed and duplicate entries. */
function normalizePool(value, allowed) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const pool = []
  for (const entry of value) {
    if (!entry || typeof entry.provider !== 'string' || typeof entry.model !== 'string') continue
    if (entry.provider.length === 0 || entry.model.length === 0 || entry.provider === PROVIDER) continue
    const { inputs, outputs, tags } = normalizeEntry(entry, allowed)
    const free = entry.free === true
    const key = `${entry.provider}\u0000${entry.model}`
    if (seen.has(key)) continue
    seen.add(key)
    pool.push({ provider: entry.provider, model: entry.model, inputs, outputs, tags, free })
  }
  return pool
}

/** Rough request-size estimate (tokens) used to judge context capacity. */
function estimateRequestTokens(messages) {
  let chars = 0
  let images = 0
  for (const message of messages) {
    if (!message || !Array.isArray(message.content)) continue
    for (const block of message.content) {
      if (!block || typeof block !== 'object') continue
      if (block.type === 'text' && typeof block.text === 'string') chars += block.text.length
      else if (block.type === 'image' && block.offloaded !== true) images += 1
      else if (block.type === 'tool-call' && typeof block.arguments === 'string') chars += block.arguments.length
    }
  }
  // Chinese text is close to one token per character; the fixed term covers
  // system prompt, tool schemas and the reply the model is about to write.
  return Math.ceil(chars / 2.5) + images * 800 + 2000
}

/** True when typed content carries at least one live (not offloaded) image. */
function hasLiveImage(content) {
  return Array.isArray(content) && content.some((block) => block && block.type === 'image' && block.offloaded !== true)
}

/** True when the request history already shows tool use in this turn. */
function hasToolSignals(messages) {
  return messages.some((message) => {
    if (!message) return false
    if (message.role === 'tool') return true
    return message.role === 'assistant' && Array.isArray(message.content)
      && message.content.some((block) => block && block.type === 'tool-call')
  })
}

/** Collect the model-visible text of one message, flattened. */
function messageText(message) {
  if (!message || !Array.isArray(message.content)) return ''
  return message.content
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
}

/** Names of the most recent tool calls, newest last, at most `limit`. */
function recentToolNames(messages, limit) {
  const names = []
  for (const message of messages) {
    if (!message || !Array.isArray(message.content)) continue
    for (const block of message.content) {
      if (!block || block.type !== 'tool-call' || typeof block.name !== 'string') continue
      names.push(block.name)
    }
  }
  return names.slice(-limit)
}

/** Truncate text at a character budget, appending an ellipsis when cut. */
function truncate(text, max) {
  const value = typeof text === 'string' ? text.trim() : ''
  return value.length <= max ? value : `${value.slice(0, max)}…`
}

/** Is this request an internal helper rather than a user-visible turn? */
function isHelperCall(options) {
  const purpose = options && options.purpose
  return purpose === 'compaction' || purpose === 'session-title'
}

/** Strip content blocks that a candidate cannot take, reporting capability. */
function isImageCapable(info) {
  return Boolean(info) && Array.isArray(info.inputModalities) && info.inputModalities.includes('image')
}

/**
 * Best-effort capability tags derived from host metadata and model naming.
 * Used as a safety net when the user forgot to tag a model; conservative and
 * never persisted (declared tags always come first).
 */
function deriveTags(info) {
  const tags = []
  const add = (tag) => { if (!tags.includes(tag)) tags.push(tag) }
  const modalities = Array.isArray(info?.inputModalities) ? info.inputModalities : []
  if (modalities.includes('image')) {
    add('vision')
    if (modalities.includes('text')) add('multimodal')
  }
  if (modalities.includes('audio') || modalities.includes('video')) add('multimodal')
  const name = String(info?.name ?? info?.id ?? '').toLowerCase()
  if (/(coder|codex|starcoder|codestral|devstral|[-_/]code\b|code[-_])/.test(name)) add('coding')
  if (/(reason|thinking|qwq|deepseek-r|[-_/]r1\b|[-_/]o1\b|[-_/]o3\b)/.test(name)) add('reasoning')
  if (/(math|mathstral)/.test(name)) add('math')
  if (/(flash|mini|lite|turbo|small|nano)/.test(name)) add('fast')
  if (/(vision|[-_/]vl\b|4v\b|omni|multimodal|glm-4\.6v)/.test(name)) {
    add('vision')
    add('multimodal')
  }
  const window = info?.context?.contextWindow
  if (typeof window === 'number' && window >= 128_000) add('long-context')
  return tags
}

/** Parse the main model's JSON answer without trusting surrounding prose. */
function parseDecision(text) {
  if (typeof text !== 'string') return undefined
  const candidates = []
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) candidates.push(fenced[1])
  candidates.push(text)
  for (const candidate of candidates) {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start < 0 || end <= start) continue
    try {
      const value = JSON.parse(candidate.slice(start, end + 1))
      if (value && typeof value.route === 'string') {
        return { route: value.route.trim(), reason: typeof value.reason === 'string' ? value.reason.trim() : '' }
      }
    } catch {
      /* try the next candidate */
    }
  }
  return undefined
}

export function apply(ctx, config) {
  const customTags = () => normalizeCustomTags(config.customTags.get())
  const allTags = () => TAGS.concat(customTags())
  const subs = () => normalizePool(config.subModels.get(), allTags())
  const mainRoute = () => ({
    provider: String(config.mainProvider.get() ?? ''),
    model: String(config.mainModel.get() ?? ''),
  })
  const fallbackRoute = () => ({
    provider: String(config.fallbackProvider.get() ?? ''),
    model: String(config.fallbackModel.get() ?? ''),
  })
  const positiveInteger = (ref) => {
    const value = Number(ref.get())
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
  }
  const showRoute = () => config.showRoute.get() !== false
  const exposeApiKeys = () => config.exposeApiKeys.get() === true
  const preferFree = () => config.preferFreeModels.get() === true

  const providers = () => new Set(ctx.llm.listProviders().map((provider) => provider.id))

  /** Exact-model metadata cache, dropped whenever the provider topology moves. */
  const infoCache = new Map()
  const infoInflight = new Map()
  let contextCache = { key: '', promise: undefined }
  /** Provider local configuration cache (settings.describe is not free). */
  let localCache = { at: 0, value: undefined }

  /** Routing decisions: cacheKey -> { at, decision }; banner state per session. */
  const decisions = new Map()
  const lastBanner = new Map()
  /** Free models that just failed, so the next turn skips them for a while. */
  const cooldowns = new Map()
  const COOLDOWN_MS = 2 * 60 * 1000

  const invalidate = () => {
    infoCache.clear()
    infoInflight.clear()
    contextCache = { key: '', promise: undefined }
    localCache = { at: 0, value: undefined }
    decisions.clear()
    lastBanner.clear()
    cooldowns.clear()
    credentialCache.clear()
  }
  const disposeAdaptersUpdated = ctx.on('llm/adapters-updated', invalidate)
  let disposeSettingsUpdated = () => {}
  try {
    disposeSettingsUpdated = ctx.on('settings/document-updated', invalidate)
  } catch {
    /* the settings service is optional in headless compositions */
  }

  /** Resolve one candidate's metadata; `undefined` means "not currently routable". */
  const resolveInfo = (provider, model) => {
    if (provider === PROVIDER || !providers().has(provider)) return Promise.resolve(undefined)
    const key = `${provider}\u0000${model}`
    if (infoCache.has(key)) return Promise.resolve(infoCache.get(key))
    const inflight = infoInflight.get(key)
    if (inflight !== undefined) return inflight
    const pending = Promise.resolve()
      .then(() => ctx.llm.resolveModelInfo(provider, model))
      .then(
        (info) => {
          infoCache.set(key, info)
          return info
        },
        () => {
          infoCache.set(key, undefined)
          return undefined
        },
      )
      .finally(() => infoInflight.delete(key))
    infoInflight.set(key, pending)
    return pending
  }

  /** Smallest context window among the configured candidates, or the override. */
  const resolveContextWindow = () => {
    const override = positiveInteger(config.contextWindow)
    if (override > 0) return Promise.resolve(override)
    const all = [...subs()]
    const fallback = fallbackRoute()
    if (fallback.provider && fallback.model) all.push(fallback)
    const key = all.map((candidate) => `${candidate.provider}/${candidate.model}`).join(',') || 'empty'
    if (contextCache.key === key && contextCache.promise !== undefined) return contextCache.promise
    const pending = Promise.all(all.map((candidate) => resolveInfo(candidate.provider, candidate.model)))
      .then((infos) => {
        const windows = infos
          .map((info) => (info && info.context ? info.context.contextWindow : undefined))
          .filter((value) => typeof value === 'number' && Number.isFinite(value) && value > 0)
        return windows.length > 0 ? Math.floor(Math.min(...windows)) : FALLBACK_CONTEXT_WINDOW
      })
      .catch(() => FALLBACK_CONTEXT_WINDOW)
    contextCache = { key, promise: pending }
    return pending
  }

  /**
   * Read one provider's local configuration out of the settings document.
   * Returns `{ baseURL, api, apiKeyEnv }` as far as the deployment exposes it.
   */
  const localProviderConfig = (provider) => {
    const now = Date.now()
    if (now - localCache.at > 15_000) {
      let value
      try {
        const settings = typeof ctx.get === 'function' ? ctx.get('settings') : undefined
        const rows = settings !== undefined && settings !== null && typeof settings.describe === 'function'
          ? settings.describe()
          : []
        const providersById = new Map()
        for (const row of rows) {
          const candidate = row && row.value && typeof row.value === 'object' ? row.value.providers : undefined
          if (!candidate || typeof candidate !== 'object') continue
          for (const [id, entry] of Object.entries(candidate)) {
            if (entry && typeof entry === 'object') providersById.set(id, entry)
          }
        }
        value = providersById
      } catch {
        value = new Map()
      }
      localCache = { at: now, value }
    }
    const entry = localCache.value instanceof Map ? localCache.value.get(provider) : undefined
    if (!entry || typeof entry !== 'object') return {}
    return {
      baseURL: typeof entry.baseURL === 'string' ? entry.baseURL : undefined,
      api: typeof entry.api === 'string' ? entry.api : undefined,
      apiKeyEnv: typeof entry.apiKeyEnv === 'string' ? entry.apiKeyEnv : undefined,
    }
  }

  /** Resolve a credential reference to its value and availability. */
  const resolveCredential = async (ref) => {
    if (typeof ref !== 'string' || ref.length === 0) return { present: false }
    try {
      const credentials = typeof ctx.get === 'function' ? ctx.get('credentials') : undefined
      if (credentials !== undefined && credentials !== null && typeof credentials.resolve === 'function') {
        const hit = await credentials.resolve(ref)
        if (hit && typeof hit.value === 'string' && hit.value.length > 0) return { present: true, value: hit.value }
      }
    } catch {
      /* fall back to the launch environment */
    }
    const env = process.env[ref]
    if (typeof env === 'string' && env.length > 0) return { present: true, value: env }
    return { present: false }
  }

  /** One sub-model line for the main model's routing prompt. */
  const describeCandidate = async (candidate, includeKey) => {
    const info = await resolveInfo(candidate.provider, candidate.model)
    if (!info) return undefined
    const local = localProviderConfig(candidate.provider)
    const modalityLabel = (value) => MODALITY_LABELS[value] ?? value
    const inputs = candidate.inputs.length > 0 ? candidate.inputs : ['text']
    const outputs = candidate.outputs.length > 0 ? candidate.outputs : ['text']
    const autoTags = Array.isArray(candidate.derivedTags) ? candidate.derivedTags : []
    const tagsLabel = candidate.tags.length > 0
      ? candidate.tags.map((tag) => TAG_LABELS[tag] ?? tag).join('+')
      : '通用'
    const parts = [
      `${candidate.provider}/${candidate.model}`,
      `名称：${info.name ?? candidate.model}`,
      `上下文：${info.context?.contextWindow ?? '未知'}`,
      `最大输出：${info.defaultMaxTokens ?? '模型默认'}`,
      `输入：${inputs.map(modalityLabel).join('+')}`,
      `输出：${outputs.map(modalityLabel).join('+')}`,
      `计费：${candidate.free === true ? '免费' : '付费'}`,
      `标签：${tagsLabel}${autoTags.length > 0 ? `（自动推导：${autoTags.map((tag) => TAG_LABELS[tag] ?? tag).join('+')}）` : ''}`,
    ]
    if (local.baseURL) parts.push(`接口：${local.baseURL}${local.api ? `（${local.api}）` : ''}`)
    if (local.apiKeyEnv) {
      const credential = await resolveCredential(local.apiKeyEnv)
      if (includeKey && credential.present && credential.value) {
        parts.push(`密钥：${credential.value}（明文，已由本地凭据解析）`)
      } else {
        parts.push(`密钥：${local.apiKeyEnv}（${credential.present ? '已配置' : '未配置'}）`)
      }
    } else {
      parts.push('密钥：由提供方自身处理')
    }
    return `- ${parts.join('｜')}`
  }

  /** Build the routing prompt shown to the main model. */
  const buildRouterPrompt = async (options, messages, capable, context) => {
    const includeKey = exposeApiKeys()
    const taskTagsLabel = context.taskTags.map((tag) => TAG_LABELS[tag] ?? tag).join('+')
    const lines = [
      '你是 DeepSeek Harness「自动模型」模式的主模型（调度器）。你不直接回答用户，只负责从下面的副模型里挑选“接下来的这一步”由哪个模型执行。',
      '',
      `【任务标签】${taskTagsLabel}（${context.taskTags.join(', ')}）`,
      '标签只是软偏好：清单里每个模型都可用；标签匹配的模型更合适，但你可以根据任务判断选择其他模型。',
      '',
      ...(context.freePreferred
        ? ['【计费偏好】已开启“优先使用免费模型”：'
          + (context.freeUsableCount > 0
            ? '在能力足够（上下文窗口 ≥ 估算请求大小、输入模态匹配、任务复杂度可胜任）时优先选择标记为“免费”的副模型；只有免费模型都明显无法胜任时才选“付费”。'
            : '本次没有满足能力要求的免费模型，请直接从“付费”副模型中选择。'),
          '']
        : []),
      `【副模型清单】（${capable.length} 个，均已通过本地配置与能力校验）`,
    ]
    for (const candidate of capable) {
      const line = await describeCandidate(candidate, includeKey)
      if (line) lines.push(line)
    }
    const lastUser = [...messages].reverse().find((message) => message && message.role === 'user')
    const assistants = messages.filter((message) => message && message.role === 'assistant' && messageText(message).trim() !== '')
    const lastAssistant = assistants.length > 0 ? assistants[assistants.length - 1] : undefined
    const tools = recentToolNames(messages, 6)
    lines.push(
      '',
      '【任务信息】',
      `- 用途：${context.helper ? '后台辅助请求' : '普通请求'}（${String(options.purpose ?? 'turn')}）`,
      `- 本次请求包含图片：${context.wantsImage ? '是' : '否'}`,
      `- 用户想生成图片：${context.imageGen ? '是' : '否'}`,
      `- 需要的输入类型：${(context.wantsImage ? ['text', 'image'] : ['text']).map((value) => MODALITY_LABELS[value]).join('+')}`,
      `- 需要的输出类型：${(context.imageGen ? ['text', 'image'] : ['text']).map((value) => MODALITY_LABELS[value]).join('+')}`,
      `- 本轮已发生工具调用：${context.tooling ? '是' : '否'}`,
      `- 估算请求大小：约 ${context.estimate} tokens`,
      `- 用户最后一条消息：${truncate(messageText(lastUser), 1200) || '（无文本）'}`,
      `- 助手最近一条消息：${truncate(messageText(lastAssistant), 400) || '（无）'}`,
      `- 最近工具：${tools.length > 0 ? tools.join('、') : '（无）'}`,
      '',
      '【选择规则】',
      `- 优先选能力标签匹配本次任务（${TAGS.concat(customTags()).join(' / ')}）的模型；标签不匹配的模型同样可用，但通常排在后面。`,
      '- 部分模型可能没有用户标签（显示为“通用”或带“自动推导”）：不要仅因缺少标签就排除它们，请结合模型名称、输入/输出类型和上下文窗口判断。',
      ...(context.freePreferred && context.freeUsableCount > 0
        ? ['- 优先使用免费模型：先判断免费副模型能否胜任；能胜任就选免费的，只有都胜任不了时才选付费。']
        : []),
      '- 有图片时必须选择“输入”包含图片的副模型。',
      '- 文生图 / 图生图任务：优先选能力标签含 image-gen / image-to-image / tools 且“输出”包含图片的模型；图片由工具生成，模型本身只需理解需求并调用工具。',
      '- 简单改写、分类、格式整理等轻量任务优先选更快/更便宜的副模型；复杂推理、代码、长文本优先选上下文更大、能力更强的副模型。',
      '- 只能从上面清单里选择，不要编造模型。',
      '',
      '只输出一行 JSON，不要解释：{"route":"<provider>/<model>","reason":"<不超过30字的理由>"}',
    )
    if (includeKey) {
      lines.push('', '（说明：本部署已开启“向模型提示提供 API Key 明文”，上面密钥字段即真实值。）')
    }
    return lines.join('\n')
  }

  /** Ask the main model to choose a sub model; `undefined` when it cannot. */
  const askMainModel = async (options, prompt) => {
    const main = mainRoute()
    if (!main.provider || !main.model || main.provider === PROVIDER) return undefined
    if (!providers().has(main.provider)) return undefined
    let text = ''
    let failure
    try {
      const stream = ctx.llm.stream({
        provider: main.provider,
        model: main.model,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        temperature: 0,
        maxTokens: 220,
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      })
      for await (const chunk of stream) {
        if (!chunk || typeof chunk !== 'object') continue
        if (chunk.type === 'text-delta' && typeof chunk.text === 'string') text += chunk.text
        else if (chunk.type === 'finish' && chunk.reason && chunk.reason.kind === 'error') {
          failure = chunk.reason.failure
        }
      }
    } catch (error) {
      failure = { message: error instanceof Error ? error.message : String(error) }
    }
    if (failure !== undefined) {
      try {
        ctx.logger.warn(`auto-model: 主模型路由失败，改用默认副模型：${failure.message ?? failure.code ?? 'unknown'}`)
      } catch {
        /* logging must never break routing */
      }
      return undefined
    }
    return parseDecision(text)
  }

  /** How many task tags a candidate advertises (0 = general/other). */
  const tagScore = (candidate, taskTags) => candidate.tags.filter((tag) => taskTags.includes(tag)).length

  /** Bonus when the declared input/output modalities match the task. */
  const modalityScore = (candidate, taskIn, taskOut) => {
    let score = 0
    if (taskIn.includes('image') && candidate.inputs.includes('image')) score += 1
    if (taskOut.includes('image') && candidate.outputs.includes('image')) score += 1
    if (taskOut.includes('audio') && candidate.outputs.includes('audio')) score += 1
    if (taskOut.includes('video') && candidate.outputs.includes('video')) score += 1
    return score
  }

  /** Order: free first when preferred, then capability + modality match (stable). */
  const orderCandidates = (candidates, taskTags, taskIn, taskOut) => candidates
    .map((candidate) => ({
      candidate,
      score: tagScore(candidate, taskTags) + modalityScore(candidate, taskIn, taskOut),
    }))
    .sort((left, right) => {
      if (preferFree()) {
        const leftFree = left.candidate.free === true ? 0 : 1
        const rightFree = right.candidate.free === true ? 0 : 1
        if (leftFree !== rightFree) return leftFree - rightFree
      }
      return right.score - left.score
    })
    .map((entry) => entry.candidate)

  /** Every configured sub model that may serve this request right now. */
  const resolveChoice = async (wantsImage, taskTags) => {
    const capable = []
    const seen = new Set()
    for (const candidate of subs()) {
      const route = `${candidate.provider}/${candidate.model}`
      if (seen.has(route)) continue
      const info = await resolveInfo(candidate.provider, candidate.model)
      if (!info) continue
      if (wantsImage && !isImageCapable(info)) continue
      const hostInputs = Array.isArray(info.inputModalities) ? info.inputModalities : []
      const derived = deriveTags(info)
      const tags = candidate.tags.slice()
      for (const tag of derived) if (!tags.includes(tag)) tags.push(tag)
      seen.add(route)
      capable.push({
        ...candidate,
        tags,
        derivedTags: derived.filter((tag) => !candidate.tags.includes(tag)),
        inputs: candidate.inputs.length > 0 ? candidate.inputs : hostInputs,
        outputs: candidate.outputs.length > 0 ? candidate.outputs : ['text'],
        contextWindow: info.context?.contextWindow,
      })
    }
    return capable
  }

  /** Stable identity of the user turn this request belongs to. */
  const turnIdOf = (options, messages) => {
    let lastUserIndex = -1
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index] && messages[index].role === 'user') {
        lastUserIndex = index
        break
      }
    }
    const lastUser = lastUserIndex >= 0 ? messages[lastUserIndex] : undefined
    const turn = lastUser && typeof lastUser.id === 'string' && lastUser.id.length > 0
      ? lastUser.id
      : `${lastUserIndex}:${truncate(messageText(lastUser), 160)}`
    return `${String(options.sessionId ?? '-')}\u0001${turn}`
  }

  /** Does the last user message ask to generate an image (text-to-image)? */
  const IMAGE_GEN_RE = /(画一张|画一幅|画个|画一个|生成(一张|一幅|一个)?图片|图片生成|文生图|draw (me )?(an? )?(image|picture)|generate (an? )?(image|picture)|text[- ]to[- ]image)/i
  const wantsImageGeneration = (messages) => {
    const lastUser = [...messages].reverse().find((message) => message && message.role === 'user')
    return IMAGE_GEN_RE.test(messageText(lastUser))
  }

  /** Capability tags describing the task; they rank candidates, they do not partition. */
  const taskTagsOf = (wantsImage, tooling, helper, estimate, imageGen) => {
    const tags = []
    if (helper) return tags
    if (wantsImage) tags.push('vision')
    if (imageGen) tags.push('image-gen')
    if (wantsImage && imageGen) tags.push('image-to-image')
    if (wantsImage && tooling) tags.push('multimodal')
    if (tooling) tags.push('tools')
    if (estimate >= 48_000) tags.push('long-context')
    if (!wantsImage && !imageGen && estimate <= 6_000) tags.push('fast')
    return tags
  }

  /** Short human label for the task kind, shown in the routing line. */
  const taskLabelOf = (wantsImage, tooling, imageGen) => (imageGen
    ? '文生图'
    : wantsImage ? '图像理解' : tooling ? '工具任务' : '文本任务')

  /** Cache key for the routing decision: one decision per user turn + state. */
  const decisionKey = (options, messages, wantsImage, capable, taskTags) => {
    const main = mainRoute()
    const routes = capable
      .map((candidate) => `${candidate.provider}/${candidate.model}${candidate.free === true ? '*' : ''}`)
      .join(',')
    return [
      turnIdOf(options, messages),
      wantsImage ? 'image' : 'text',
      hasToolSignals(messages) ? 'tools' : 'notools',
      String(options.purpose ?? 'turn'),
      taskTags.join('+'),
      preferFree() ? 'prefer-free' : 'any-billing',
      `${main.provider}/${main.model}`,
      routes,
    ].join('\u0001')
  }

  /** Human-readable reason for one provider failure (raw JSON never surfaces). */
  const humanizeFailure = (failure) => {
    const code = String(failure?.code ?? '')
    const message = String(failure?.message ?? '')
    if (code === 'MISSING_CREDENTIAL') return '未配置密钥'
    if (code === 'AUTH' || /\b401\b|unauthori[sz]ed|invalid.*(key|token)|api.?key/i.test(message)) return 'API 密钥无效或未授权'
    if (code === 'CONTEXT_WINDOW_EXCEEDED' || /prompt exceeds|max length|context window/i.test(message)) return '上下文超出模型上限'
    if (code === 'QUOTA_EXCEEDED' || /quota|额度|余额/.test(message)) return '额度不足'
    if (code === 'RATE_LIMIT' || /\b429\b|rate.?limit/i.test(message)) return '触发限流'
    if (code === 'NO_ADAPTER') return '提供方不可用'
    if (/network|fetch|timeout|ECONN|ENOTFOUND|socket/i.test(message)) return '网络错误'
    return truncate(message || code || '未知错误', 80)
  }

  /** Credential presence for one provider, cached briefly. */
  const credentialCache = new Map()
  const credentialReady = async (provider) => {
    const now = Date.now()
    const cached = credentialCache.get(provider)
    if (cached !== undefined && now - cached.at < 30_000) return cached.ok
    const local = localProviderConfig(provider)
    let ok = true
    if (local.apiKeyEnv) {
      const credential = await resolveCredential(local.apiKeyEnv)
      ok = credential.present
    }
    credentialCache.set(provider, { at: now, ok })
    return ok
  }

  /** Pick a route for one outgoing request. */
  async function chooseRoute(options) {
    const messages = Array.isArray(options && options.messages) ? options.messages : []
    const wantsImage = messages.some((message) => hasLiveImage(message && message.content))
    const helper = isHelperCall(options)
    const tooling = hasToolSignals(messages)
    const imageGen = wantsImageGeneration(messages)
    const estimate = Math.ceil(estimateRequestTokens(messages) * 1.1)
    const taskTags = taskTagsOf(wantsImage, tooling, helper, estimate, imageGen)
    const taskIn = wantsImage ? ['text', 'image'] : ['text']
    const taskOut = imageGen ? ['text', 'image'] : ['text']

    const capable = await resolveChoice(wantsImage, taskTags)
    if (capable.length === 0) {
      const fallback = fallbackRoute()
      if (fallback.provider && fallback.model && fallback.provider !== PROVIDER) {
        const info = await resolveInfo(fallback.provider, fallback.model)
        if (info && (!wantsImage || isImageCapable(info))) {
          return {
            provider: fallback.provider,
            model: fallback.model,
            free: false,
            alternatives: [],
            helper: false,
            banner: '',
          }
        }
      }
      const reason = wantsImage ? '没有支持图片的副模型' : '副模型清单为空或全部不可用'
      return { mainOnly: reason, helper, alternatives: [], banner: '' }
    }

    // Hard filters before the main model sees the list: recently failed routes,
    // context capacity, and credentials. If nothing survives, let the main
    // model answer directly instead of burning a request on a doomed route.
    const nowTs = Date.now()
    const isCooling = (candidate) => {
      const at = cooldowns.get(`${candidate.provider}/${candidate.model}`)
      return at !== undefined && nowTs - at < COOLDOWN_MS
    }
    const healthy = capable.filter((candidate) => !isCooling(candidate))
    const pool = healthy.length > 0 ? healthy : capable
    const windowOf = (candidate) => (typeof candidate.contextWindow === 'number' && Number.isFinite(candidate.contextWindow)
      ? candidate.contextWindow
      : FALLBACK_CONTEXT_WINDOW)
    const fitting = pool.filter((candidate) => windowOf(candidate) >= estimate)
    if (fitting.length === 0) {
      return {
        mainOnly: `没有副模型的上下文能容纳当前请求（约 ${Math.ceil(estimate)} tokens）`,
        helper,
        alternatives: [],
        banner: '',
      }
    }
    const authorized = []
    for (const candidate of fitting) {
      if (await credentialReady(candidate.provider)) authorized.push(candidate)
    }
    if (authorized.length === 0) {
      return { mainOnly: '副模型的凭据都不可用', helper, alternatives: [], banner: '' }
    }

    // Order: free first when preferred, then tag-match score (stable otherwise).
    const prefer = preferFree()
    const candidates = orderCandidates(authorized, taskTags, taskIn, taskOut)
    const freeUsableCount = candidates.filter((candidate) => candidate.free === true).length

    // Helper calls summarize text; skip the main model and use the first text
    // candidate (an image request never reaches helpers because the llm layer
    // would project its images to placeholders anyway).
    if (helper) {
      const first = candidates[0]
      return {
        provider: first.provider,
        model: first.model,
        free: first.free === true,
        alternatives: candidates.slice(1),
        helper: true,
        banner: '',
      }
    }

    const key = decisionKey(options, messages, wantsImage, candidates, taskTags)
    const now = Date.now()
    const cached = decisions.get(key)
    let decision
    let bannerNote = ''
    if (cached !== undefined && now - cached.at < DECISION_TTL_MS) {
      decision = cached.decision
    } else {
      const prompt = await buildRouterPrompt(options, messages, candidates, {
        wantsImage,
        imageGen,
        tooling,
        helper,
        taskTags,
        taskIn,
        taskOut,
        estimate,
        freePreferred: prefer,
        freeUsableCount,
      })
      const answer = await askMainModel(options, prompt)
      const main = mainRoute()
      if (answer !== undefined) {
        const [provider, ...rest] = answer.route.split('/')
        const model = rest.join('/')
        const match = candidates.find((candidate) => candidate.provider === provider && candidate.model === model)
        if (match) {
          decision = { provider: match.provider, model: match.model }
          bannerNote = truncate(answer.reason, 80)
        } else {
          bannerNote = '主模型给出了清单外的模型，已自动回退'
        }
      } else if (main.provider && main.model) {
        bannerNote = '主模型未给出有效决策，已自动回退'
      }
      if (decision === undefined) decision = { provider: candidates[0].provider, model: candidates[0].model }
      decisions.set(key, { at: now, decision })
      if (decisions.size > DECISION_LIMIT) {
        const oldest = [...decisions.entries()].sort((left, right) => left[1].at - right[1].at)[0]
        if (oldest) decisions.delete(oldest[0])
      }
    }

    // The main model may not know about a mid-turn image; enforce capability.
    if (wantsImage) {
      const info = await resolveInfo(decision.provider, decision.model)
      if (!info || !isImageCapable(info)) {
        const replacement = candidates[0]
        decision = { provider: replacement.provider, model: replacement.model }
        bannerNote = '请求包含图片，已切换到支持图片的副模型'
      }
    }

    const chosen = candidates.find((candidate) => candidate.provider === decision.provider && candidate.model === decision.model)
      ?? candidates[0]
    const isFree = chosen.free === true
    // Every other candidate can take over when this one fails before output.
    const alternatives = candidates.filter((candidate) => !(candidate.provider === chosen.provider && candidate.model === chosen.model))

    let banner = ''
    if (showRoute()) {
      const session = String(options.sessionId ?? '-')
      const turn = turnIdOf(options, messages)
      const route = `${chosen.provider}/${chosen.model}`
      const previous = lastBanner.get(session)
      if (previous === undefined || previous.turn !== turn || previous.route !== route) {
        const main = mainRoute()
        const mainLabel = main.provider && main.model ? `${main.provider}/${main.model}` : '（未配置主模型）'
        const taskLabel = taskLabelOf(wantsImage, tooling, imageGen)
        const tagsLabel = taskTags.map((tag) => TAG_LABELS[tag] ?? tag).join('+')
        const taskPart = tagsLabel === '' || tagsLabel === taskLabel
          ? `｜任务 ${taskLabel}`
          : `｜任务 ${taskLabel}（${tagsLabel}）`
        const freeTag = isFree ? '（免费）' : ''
        const reason = bannerNote.length > 0 ? `：${bannerNote}` : ''
        banner = `🧭 自动模式｜主模型 ${mainLabel}${taskPart} → 执行 ${route}${freeTag}${reason}\n\n`
        lastBanner.set(session, { turn, route })
      }
    }
    return {
      provider: chosen.provider,
      model: chosen.model,
      free: isFree,
      contextWindow: chosen.contextWindow,
      alternatives,
      helper: false,
      banner,
    }
  }

  /** One synthetic text block emitted at `index`. */
  function* syntheticTextBlock(text, index) {
    yield { type: 'block-start', index, blockType: 'text' }
    yield { type: 'text-delta', index, text }
    yield { type: 'block-end', index, block: { type: 'text', text } }
  }

  /** Shift an upstream chunk past the synthetic blocks already emitted. */
  const shiftChunk = (chunk, offset) => (chunk && typeof chunk === 'object' && typeof chunk.index === 'number'
    ? { ...chunk, index: chunk.index + offset }
    : chunk)

  /** Did the upstream produce anything a retry would have to duplicate? */
  const chunkVisible = (chunk) => {
    if (!chunk || typeof chunk !== 'object') return false
    if (chunk.type === 'text-delta' || chunk.type === 'reasoning-delta') {
      return typeof chunk.text === 'string' && chunk.text.trim() !== ''
    }
    if (chunk.type === 'tool-call-delta') return true
    if (chunk.type === 'block-end') {
      const block = chunk.block
      return Boolean(block) && (block.type === 'tool-call'
        || (typeof block.text === 'string' && block.text.trim() !== ''))
    }
    return false
  }

  /**
   * Stream one route and report whether it produced visible output before a
   * failure. The generator yields chunks; its return value is the outcome.
   */
  async function* runAttempt(options, route, offset) {
    const next = { ...options, provider: route.provider, model: route.model }
    delete next.reasoningEffort
    try {
      ctx.logger.debug(`auto-model: ${String(options.sessionId ?? '-')} ${options.purpose ?? 'turn'} -> ${route.provider}/${route.model}`)
    } catch {
      /* logging must never break routing */
    }
    let visible = false
    let failure
    try {
      for await (const chunk of ctx.llm.stream(next)) {
        if (chunk && chunk.type === 'finish' && chunk.reason) {
          if (chunk.reason.kind === 'error') {
            failure = chunk.reason.failure ?? { message: 'provider error' }
            break
          }
          yield shiftChunk(chunk, offset)
          return { visible }
        }
        if (chunkVisible(chunk)) visible = true
        yield shiftChunk(chunk, offset)
      }
    } catch (error) {
      failure = { message: error instanceof Error ? error.message : String(error) }
    }
    return { visible, failure }
  }

  const adapter = {
    providerInfo(provider) {
      return { id: provider, name: PROVIDER_NAME }
    },
    providerRetryPolicy() {
      return undefined
    },
    imageRequestPricing() {
      return undefined
    },
    imageRequestTarget(_provider, _model, image) {
      return { width: image.width, height: image.height, maxBytes: image.bytes }
    },
    listModels(provider) {
      return Promise.resolve([
        {
          provider,
          id: MODEL,
          name: MODEL_NAME,
          description: MODEL_DESCRIPTION,
          inputModalities: ['text', 'image'],
        },
      ])
    },
    async resolveModel(provider, model) {
      const maxTokens = positiveInteger(config.maxTokens)
      return {
        provider,
        id: model,
        name: MODEL_NAME,
        description: MODEL_DESCRIPTION,
        inputModalities: ['text', 'image'],
        context: { contextWindow: await resolveContextWindow() },
        ...(maxTokens > 0 ? { defaultMaxTokens: maxTokens } : {}),
      }
    },
    async prepareCall(provider, model, signal) {
      const info = await this.resolveModel(provider, model, signal)
      return { model: info, stream: (options) => this.stream(options) }
    },
    async *stream(options) {
      if (!options || options.provider !== PROVIDER) {
        throw new Error('auto-model: the synthetic adapter only serves the "auto" provider')
      }
      const target = await chooseRoute(options)
      let offset = 0
      if (target.banner) {
        yield* syntheticTextBlock(target.banner, offset)
        offset += 1
      }

      // Background helpers (compaction, titles) never show notes and never
      // fall back to the main model: another subsystem consumes their stream.
      if (target.helper === true) {
        const main = mainRoute()
        const route = target.mainOnly !== undefined
          ? { provider: main.provider, model: main.model }
          : { provider: target.provider, model: target.model }
        if (route.provider && route.model && route.provider !== PROVIDER) {
          const result = yield* runAttempt(options, route, offset)
          if (result.failure === undefined) return
          yield { type: 'finish', reason: { kind: 'error', failure: result.failure } }
          return
        }
        yield { type: 'finish', reason: { kind: 'error', failure: { message: target.mainOnly ?? 'no routable model' } } }
        return
      }

      const failures = []
      const seen = new Set()
      const order = (target.mainOnly !== undefined
        ? []
        : [{ provider: target.provider, model: target.model, free: target.free === true, contextWindow: target.contextWindow }, ...target.alternatives])
        .filter((route) => {
          const key = `${route.provider}/${route.model}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })

      while (order.length > 0) {
        const route = order.shift()
        const result = yield* runAttempt(options, route, offset)
        if (result.failure === undefined) return
        failures.push({ route, failure: result.failure })
        cooldowns.set(`${route.provider}/${route.model}`, Date.now())
        if (result.visible) {
          // Part of the answer is already delivered; switching would duplicate it.
          yield { type: 'finish', reason: { kind: 'error', failure: result.failure } }
          return
        }
        if (order.length > 0) {
          // After an overflow, try the model with the largest window first.
          if (String(result.failure.code ?? '') === 'CONTEXT_WINDOW_EXCEEDED') {
            order.sort((left, right) => (right.contextWindow ?? FALLBACK_CONTEXT_WINDOW) - (left.contextWindow ?? FALLBACK_CONTEXT_WINDOW))
          }
          const next = order[0]
          yield* syntheticTextBlock(
            `⚠️ ${route.provider}/${route.model} 调用失败：${humanizeFailure(result.failure)}，已切换到 ${next.provider}/${next.model}\n\n`,
            offset,
          )
          offset += 1
        }
      }

      // No sub model could answer: let the main model finish the turn.
      const main = mainRoute()
      const canMain = main.provider.length > 0 && main.model.length > 0
        && main.provider !== PROVIDER && providers().has(main.provider)
      const failureSummary = failures
        .map(({ route, failure }) => `${route.provider}/${route.model}（${humanizeFailure(failure)}）`)
        .join('、')
      if (canMain) {
        const head = failures.length > 0
          ? `⚠️ 所有副模型都调用失败：${failureSummary}。已切换为主模型 ${main.provider}/${main.model} 完成本次回复。\n\n`
          : `⚠️ ${target.mainOnly ?? '没有可用的副模型'}，已切换为主模型 ${main.provider}/${main.model} 处理。\n\n`
        yield* syntheticTextBlock(head, offset)
        offset += 1
        const result = yield* runAttempt(options, { provider: main.provider, model: main.model }, offset)
        if (result.failure === undefined) return
        if (result.visible) {
          yield { type: 'finish', reason: { kind: 'error', failure: result.failure } }
          return
        }
        failures.push({ route: { provider: main.provider, model: main.model }, failure: result.failure })
      }

      // Guarantee a readable reply even when every model failed.
      const detail = failures
        .map(({ route, failure }) => `- ${route.provider}/${route.model}：${humanizeFailure(failure)}`)
        .join('\n')
      const summary = [
        '❗ 自动模型：本次请求没有完成，所有候选模型都调用失败。',
        detail.length > 0 ? `\n失败明细：\n${detail}` : '',
        '',
        '可以检查 设置 → 模型 里的 API Key、额度与上下文限制，或在 设置 → 自动模型 里调整副模型清单。',
      ].join('\n')
      yield* syntheticTextBlock(summary, offset)
      yield { type: 'finish', reason: { kind: 'stop' } }
    },
  }

  ctx.llm.registerAdapter([PROVIDER], adapter)
  ctx.effect(() => () => {
    disposeAdaptersUpdated()
    disposeSettingsUpdated()
  }, 'auto-model: cache invalidation')
}
