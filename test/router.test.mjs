import assert from 'node:assert/strict'
import { apply, Config } from '../index.js'

/** Build one volatile-config reference. */
function ref(value) {
  let current = value
  return { get: () => current, set: (next) => { current = next } }
}

const ROUTES = {
  'main/router': { provider: 'main', id: 'router', name: 'Router', inputModalities: ['text'], context: { contextWindow: 128000 } },
  'p1/text': { provider: 'p1', id: 'text', name: 'P1 Text', inputModalities: ['text'], context: { contextWindow: 128000 }, defaultMaxTokens: 4096 },
  'p1/vision': { provider: 'p1', id: 'vision', name: 'P1 Vision', inputModalities: ['text', 'image'], context: { contextWindow: 64000 } },
  'p2/big': { provider: 'p2', id: 'big', name: 'P2 Big', inputModalities: ['text', 'image'], context: { contextWindow: 96000 } },
  'p3/smallfree': { provider: 'p3', id: 'smallfree', name: 'P3 Small Free', inputModalities: ['text'], context: { contextWindow: 8000 } },
  'p4/text': { provider: 'p4', id: 'text', name: 'P4 Text', inputModalities: ['text'], context: { contextWindow: 128000 } },
  'p5/coder': { provider: 'p5', id: 'coder', name: 'P5 Coder', inputModalities: ['text'], context: { contextWindow: 32000 } },
}

function userMessage(content, id = 'm1') {
  return { id, role: 'user', content }
}
function textBlock(text) {
  return { type: 'text', text }
}
function imageBlock() {
  return { type: 'image', attachment: { attachmentId: 'a1', mediaType: 'image/png', bytes: 10, width: 10, height: 10 } }
}

async function collect(iterable) {
  const chunks = []
  for await (const chunk of iterable) chunks.push(chunk)
  return chunks
}

/** Mock context: a router model plus real providers, recording forwards. */
function makeCtx({
  answer = '{"route":"p2/big","reason":"复杂任务"}',
  mainFails = false,
  mainReplyFails = false,
  failRoutes = [],
  failures = {},
} = {}) {
  const failing = new Map(Object.entries(failures))
  for (const route of failRoutes) failing.set(route, { code: 'RATE_LIMIT', message: 'free model limit' })
  const captured = { adapter: undefined, forwarded: [], routerPrompts: [], mainReplies: [], invalidated: 0 }
  const ctx = {
    logger: { debug() {}, warn() {} },
    llm: {
      listProviders: () => [{ id: 'main' }, { id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }, { id: 'p5' }, { id: 'auto' }],
      resolveModelInfo: async (provider, model) => {
        const info = ROUTES[`${provider}/${model}`]
        if (!info) throw new Error(`no route ${provider}/${model}`)
        return info
      },
      registerAdapter: (providers, adapter) => {
        assert.deepEqual(providers, ['auto'])
        captured.adapter = adapter
        return () => {}
      },
      stream: (options) => {
        captured.forwarded.push(options)
        return (async function* () {
          if (options.provider === 'main') {
            const prompt = options.messages[0]?.content?.[0]?.text ?? ''
            if (prompt.includes('主模型（调度器）')) {
              captured.routerPrompts.push(prompt)
              if (mainFails) {
                yield { type: 'finish', reason: { kind: 'error', failure: { code: 'AUTH', message: 'no key' } } }
                return
              }
              yield { type: 'block-start', index: 0, blockType: 'text' }
              yield { type: 'text-delta', index: 0, text: answer }
              yield { type: 'block-end', index: 0, block: { type: 'text', text: answer } }
              yield { type: 'finish', reason: { kind: 'stop' } }
              return
            }
            // The main model answering the real conversation (fallback).
            captured.mainReplies.push(prompt)
            if (mainReplyFails) {
              yield { type: 'finish', reason: { kind: 'error', failure: { code: 'AUTH', message: 'main key invalid' } } }
              return
            }
            yield { type: 'block-start', index: 0, blockType: 'text' }
            yield { type: 'text-delta', index: 0, text: '主模型接管：已完成总结' }
            yield { type: 'block-end', index: 0, block: { type: 'text', text: '主模型接管：已完成总结' } }
            yield { type: 'finish', reason: { kind: 'stop' } }
            return
          }
          const key = `${options.provider}/${options.model}`
          if (failing.has(key)) {
            yield { type: 'finish', reason: { kind: 'error', failure: failing.get(key) } }
            return
          }
          // A real provider: two indexed blocks so the shift is observable.
          yield { type: 'block-start', index: 0, blockType: 'text' }
          yield { type: 'text-delta', index: 0, text: 'hello from ' + options.provider }
          yield { type: 'block-end', index: 0, block: { type: 'text', text: 'hello from ' + options.provider } }
          yield { type: 'block-start', index: 1, blockType: 'text' }
          yield { type: 'text-delta', index: 1, text: 'second block' }
          yield { type: 'block-end', index: 1, block: { type: 'text', text: 'second block' } }
          yield { type: 'usage', usage: { inputTokens: 1, outputTokens: 1 } }
          yield { type: 'finish', reason: { kind: 'stop' } }
        })()
      },
    },
    get: (service) => {
      if (service === 'settings') {
        return {
          describe: () => [{
            ns: 'llm-pi-ai',
            value: {
              providers: {
                p1: { apiKeyEnv: 'P1_KEY', baseURL: 'https://p1.example/v1', api: 'openai-completions' },
                p2: { apiKeyEnv: 'P2_KEY', baseURL: 'https://p2.example/v1', api: 'openai-completions' },
                p3: { apiKeyEnv: 'P3_KEY', baseURL: 'https://p3.example/v1', api: 'openai-completions' },
                p4: { apiKeyEnv: 'P4_KEY', baseURL: 'https://p4.example/v1', api: 'openai-completions' },
                p5: { apiKeyEnv: 'P5_KEY', baseURL: 'https://p5.example/v1', api: 'openai-completions' },
              },
            },
          }],
        }
      }
      if (service === 'credentials') {
        return {
          resolve: async (name) => (name === 'P4_KEY' ? undefined : { value: `sk-${name}` }),
        }
      }
      return undefined
    },
    on: (name, listener) => {
      if (name === 'llm/adapters-updated') captured.invalidated = listener
      return () => {}
    },
    effect: (fn) => {
      const disposer = fn()
      return () => { if (typeof disposer === 'function') disposer() }
    },
  }
  return { ctx, captured }
}

function makeConfig(overrides = {}) {
  const values = {
    mainProvider: 'main',
    mainModel: 'router',
    subModels: [
      { provider: 'p1', model: 'text', tags: ['text'], free: false },
      { provider: 'p1', model: 'vision', tags: ['vision'], free: false },
      { provider: 'p2', model: 'big', tags: ['vision', 'text'], free: true },
    ],
    strictTags: false,
    customTags: [],
    preferFreeModels: false,
    fallbackProvider: 'p1',
    fallbackModel: 'text',
    contextWindow: 0,
    maxTokens: 0,
    showRoute: true,
    exposeApiKeys: false,
    ...overrides,
  }
  const config = {}
  for (const [key, value] of Object.entries(values)) config[key] = ref(value)
  return config
}

async function run() {
  // 1. schema accepts the new fields
  const parsed = Config({
    mainProvider: 'main', mainModel: 'router',
    subModels: [{ provider: 'p1', model: 'text', tags: ['text', 'fast'] }],
    fallbackProvider: '', fallbackModel: '',
    contextWindow: 0, maxTokens: 0, showRoute: true, exposeApiKeys: false,
  })
  assert.equal(parsed.subModels.get().length, 1)
  assert.deepEqual(parsed.subModels.get()[0].tags, ['text', 'fast'])
  assert.equal(parsed.showRoute.get(), true)

  const { ctx, captured } = makeCtx()
  apply(ctx, makeConfig())
  assert.ok(captured.adapter)
  const adapter = captured.adapter

  // 2. main model chooses p2/big; banner is prepended and indexes shift
  let chunks = await collect(adapter.stream({
    provider: 'auto', model: 'auto', sessionId: 's1',
    messages: [userMessage([textBlock('写一段复杂推理')])],
  }))
  assert.equal(captured.forwarded.length, 2, 'router + executor')
  assert.equal(captured.forwarded[0].provider, 'main')
  assert.equal(captured.forwarded[1].provider, 'p2')
  assert.equal(captured.forwarded[1].model, 'big')
  const banner = chunks.find((chunk) => chunk.type === 'text-delta')
  assert.match(banner.text, /自动模式｜主模型 main\/router｜任务 文本任务（快速） → 执行 p2\/big(（免费）)?：复杂任务/)
  const shifted = chunks.filter((chunk) => chunk.type === 'block-start')
  assert.deepEqual(shifted.map((chunk) => chunk.index), [0, 1, 2])
  assert.equal(chunks.filter((chunk) => chunk.type === 'text-delta')[1].text, 'hello from p2')

  // 3. same turn: decision is reused, no second router call, no repeated banner
  chunks = await collect(adapter.stream({
    provider: 'auto', model: 'auto', sessionId: 's1',
    messages: [userMessage([textBlock('写一段复杂推理')]), { role: 'assistant', content: [textBlock('ok')] }, userMessage([textBlock('继续')], 'm2')],
  }))
  // the second user message starts a new turn -> one more decision
  assert.equal(captured.forwarded.filter((entry) => entry.provider === 'main').length, 2)

  // helper call skips the router entirely
  const before = captured.forwarded.filter((entry) => entry.provider === 'main').length
  chunks = await collect(adapter.stream({
    provider: 'auto', model: 'auto', sessionId: 's1', purpose: 'compaction',
    messages: [userMessage([textBlock('summarize')])],
  }))
  assert.equal(captured.forwarded.filter((entry) => entry.provider === 'main').length, before)
  assert.equal(chunks.some((chunk) => chunk.type === 'text-delta' && String(chunk.text).includes('自动模式')), false)

  // 4. image request: chosen text model is replaced by an image-capable one
  const { ctx: ctx2, captured: cap2 } = makeCtx({ answer: '{"route":"p1/text","reason":"快"}' })
  apply(ctx2, makeConfig())
  chunks = await collect(cap2.adapter.stream({
    provider: 'auto', model: 'auto', sessionId: 's2',
    messages: [userMessage([imageBlock(), textBlock('看图')])],
  }))
  assert.equal(cap2.forwarded[1].provider, 'p1')
  assert.equal(cap2.forwarded[1].model, 'vision')
  assert.match(chunks.find((chunk) => chunk.type === 'text-delta').text, /已自动回退|已切换到支持图片的副模型/)

  // 5. invalid route: fall back to the first capable sub model
  const { ctx: ctx3, captured: cap3 } = makeCtx({ answer: '{"route":"nope/nothing","reason":"x"}' })
  apply(ctx3, makeConfig())
  await collect(cap3.adapter.stream({ provider: 'auto', model: 'auto', sessionId: 's3', messages: [userMessage([textBlock('hi')])] }))
  assert.equal(cap3.forwarded[1].provider, 'p1')
  assert.equal(cap3.forwarded[1].model, 'text')

  // 6. router failure: first capable sub model + a note
  const { ctx: ctx4, captured: cap4 } = makeCtx({ mainFails: true })
  apply(ctx4, makeConfig())
  chunks = await collect(cap4.adapter.stream({ provider: 'auto', model: 'auto', sessionId: 's4', messages: [userMessage([textBlock('hi')])] }))
  assert.equal(cap4.forwarded[1].provider, 'p1')
  assert.match(chunks.find((chunk) => chunk.type === 'text-delta').text, /主模型未给出有效决策/)

  // 7. no sub model at all -> the main model answers with a note
  const { ctx: ctx5, captured: cap5 } = makeCtx()
  apply(ctx5, makeConfig({ subModels: [], fallbackProvider: '', fallbackModel: '' }))
  chunks = await collect(cap5.adapter.stream({ provider: 'auto', model: 'auto', sessionId: 's7', messages: [userMessage([textBlock('hi')])] }))
  const noSubTexts = chunks.filter((chunk) => chunk.type === 'text-delta').map((chunk) => chunk.text)
  assert.ok(noSubTexts.some((text) => text.includes('副模型清单为空')))
  assert.ok(noSubTexts.some((text) => text.includes('已切换为主模型')))
  assert.ok(noSubTexts.some((text) => text.includes('主模型接管：已完成总结')))

  // 8. image request with no image-capable sub model -> main model fallback
  const { ctx: ctx6, captured: cap6 } = makeCtx()
  apply(ctx6, makeConfig({ subModels: [{ provider: 'p1', model: 'text' }], fallbackProvider: '', fallbackModel: '' }))
  chunks = await collect(cap6.adapter.stream({ provider: 'auto', model: 'auto', sessionId: 's8b', messages: [userMessage([imageBlock()])] }))
  assert.ok(chunks.some((chunk) => chunk.type === 'text-delta' && String(chunk.text).includes('没有支持图片的副模型')))
  assert.ok(chunks.some((chunk) => chunk.type === 'text-delta' && String(chunk.text).includes('主模型接管')))

  // 9. context window is the smallest candidate and maxTokens override sticks
  const { ctx: ctx7, captured: cap7 } = makeCtx()
  apply(ctx7, makeConfig({ contextWindow: 0, maxTokens: 2048 }))
  const info = await cap7.adapter.resolveModel('auto', 'auto')
  assert.equal(info.context.contextWindow, 64000)
  assert.equal(info.defaultMaxTokens, 2048)

  // 10. key exposure: default hides the value, enabling shows it in the prompt
  const { ctx: ctx8, captured: cap8 } = makeCtx()
  apply(ctx8, makeConfig())
  await collect(cap8.adapter.stream({ provider: 'auto', model: 'auto', sessionId: 's8', messages: [userMessage([textBlock('hi')])] }))
  assert.equal(cap8.routerPrompts[0].includes('sk-P1_KEY'), false)
  assert.match(cap8.routerPrompts[0], /P1_KEY（已配置）/)

  const { ctx: ctx9, captured: cap9 } = makeCtx()
  apply(ctx9, makeConfig({ exposeApiKeys: true }))
  await collect(cap9.adapter.stream({ provider: 'auto', model: 'auto', sessionId: 's9', messages: [userMessage([textBlock('hi')])] }))
  assert.match(cap9.routerPrompts[0], /sk-P1_KEY/)

  // 11. route line is optional
  const { ctx: ctx10, captured: cap10 } = makeCtx()
  apply(ctx10, makeConfig({ showRoute: false }))
  chunks = await collect(cap10.adapter.stream({ provider: 'auto', model: 'auto', sessionId: 's10', messages: [userMessage([textBlock('hi')])] }))
  assert.equal(chunks.some((chunk) => chunk.type === 'text-delta' && String(chunk.text).includes('自动模式')), false)
  assert.equal(chunks.find((chunk) => chunk.type === 'block-start').index, 0)

  // 12. config changes invalidate the cached decision via adapters-updated
  const { ctx: ctx11, captured: cap11 } = makeCtx()
  apply(ctx11, makeConfig())
  await collect(cap11.adapter.stream({ provider: 'auto', model: 'auto', sessionId: 's11', messages: [userMessage([textBlock('hi')])] }))
  assert.equal(cap11.forwarded.filter((entry) => entry.provider === 'main').length, 1)
  cap11.invalidated()
  await collect(cap11.adapter.stream({ provider: 'auto', model: 'auto', sessionId: 's11', messages: [userMessage([textBlock('hi')])] }))
  assert.equal(cap11.forwarded.filter((entry) => entry.provider === 'main').length, 2)

  // 13. capability tags do not partition: a vision model stays selectable for text
  const { ctx: ctx12, captured: cap12 } = makeCtx({ answer: '{"route":"p2/big","reason":"视觉模型也能写文本"}' })
  apply(ctx12, makeConfig({
    subModels: [
      { provider: 'p2', model: 'big', inputs: ['text', 'image'], tags: ['vision'], free: false },
      { provider: 'p1', model: 'text', inputs: ['text'], tags: [], free: false },
    ],
  }))
  chunks = await collect(cap12.adapter.stream({
    provider: 'auto', model: 'auto', sessionId: 's12',
    messages: [userMessage([textBlock('写个总结')])],
  }))
  assert.equal(cap12.forwarded[1].provider, 'p2')
  assert.equal(cap12.forwarded[1].model, 'big')
  assert.match(cap12.routerPrompts[0], /标签：图像理解/)
  assert.match(chunks.find((chunk) => chunk.type === 'text-delta').text, /任务 文本任务/)

  // 14. capability tags rank candidates: the tools-capable model is listed first
  const { ctx: ctx13, captured: cap13 } = makeCtx({ answer: '{"route":"p1/text","reason":"继续"}' })
  apply(ctx13, makeConfig({
    subModels: [
      { provider: 'p1', model: 'text', inputs: ['text'], tags: [], free: false },
      { provider: 'p2', model: 'big', inputs: ['text'], tags: ['tools'], free: false },
    ],
  }))
  await collect(cap13.adapter.stream({
    provider: 'auto', model: 'auto', sessionId: 's13',
    messages: [
      userMessage([textBlock('hi')]),
      { role: 'assistant', content: [{ type: 'tool-call', id: 'c1', name: 'read', arguments: '{}' }] },
      { role: 'tool', content: [textBlock('ok')], toolCallId: 'c1' },
      userMessage([textBlock('继续')], 'm2'),
    ],
  }))
  const prompt13 = cap13.routerPrompts[0]
  assert.match(prompt13, /任务标签.*工具/)
  assert.ok(prompt13.indexOf('p2/big') < prompt13.indexOf('p1/text'), 'tools capability ranks first')
  assert.equal(cap13.forwarded[1].model, 'text')

  // 15. tags are advisory: the only candidate is still used for a text task
  const { ctx: ctx14, captured: cap14 } = makeCtx({ answer: '{"route":"p1/vision","reason":"只有它"}' })
  apply(ctx14, makeConfig({
    subModels: [{ provider: 'p1', model: 'vision', tags: ['vision'] }],
  }))
  chunks = await collect(cap14.adapter.stream({ provider: 'auto', model: 'auto', sessionId: 's14', messages: [userMessage([textBlock('hi')])] }))
  assert.equal(cap14.forwarded[1].provider, 'p1')
  assert.equal(cap14.forwarded[1].model, 'vision')
  assert.equal(chunks.some((chunk) => chunk.type === 'text-delta' && String(chunk.text).includes('严格标签')), false)

  // 16. an untagged (general) entry is usable from every task
  const { ctx: ctx15, captured: cap15 } = makeCtx({ answer: '{"route":"p2/big","reason":"通用"}' })
  apply(ctx15, makeConfig({
    subModels: [{ provider: 'p2', model: 'big', tags: [] }],
  }))
  chunks = await collect(cap15.adapter.stream({
    provider: 'auto', model: 'auto', sessionId: 's15',
    messages: [userMessage([imageBlock(), textBlock('看图')])],
  }))
  assert.equal(cap15.forwarded[1].provider, 'p2')
  assert.match(chunks.find((chunk) => chunk.type === 'text-delta').text, /任务 图像理解/)

  // 17. legacy category values migrate to inputs + capability tags
  const { ctx: ctx16, captured: cap16 } = makeCtx({ answer: '{"route":"p2/big","reason":"旧配置"}' })
  apply(ctx16, makeConfig({
    subModels: [{ provider: 'p2', model: 'big', category: 'image' }],
  }))
  chunks = await collect(cap16.adapter.stream({
    provider: 'auto', model: 'auto', sessionId: 's16',
    messages: [userMessage([imageBlock(), textBlock('看图')])],
  }))
  assert.match(cap16.routerPrompts[0], /标签：图像理解/)
  assert.equal(cap16.forwarded[1].provider, 'p2')

  // 18. the free flag and the preference toggle parse from config
  const freeParsed = Config({
    mainProvider: 'main', mainModel: 'router',
    subModels: [{ provider: 'p1', model: 'text', free: true }],
    categorizeSubModels: false, preferFreeModels: true,
    fallbackProvider: '', fallbackModel: '',
    contextWindow: 0, maxTokens: 0, showRoute: true, exposeApiKeys: false,
  })
  assert.equal(freeParsed.subModels.get()[0].free, true)
  assert.equal(freeParsed.preferFreeModels.get(), true)

  // 19. preference off: the billing flag is only informational
  const { ctx: ctx17, captured: cap17 } = makeCtx({ answer: '{"route":"p2/big","reason":"复杂"}' })
  apply(ctx17, makeConfig())
  await collect(cap17.adapter.stream({ provider: 'auto', model: 'auto', sessionId: 's17', messages: [userMessage([textBlock('hi')])] }))
  assert.match(cap17.routerPrompts[0], /计费：免费/)
  assert.equal(cap17.routerPrompts[0].includes('优先使用免费模型'), false)
  assert.equal(cap17.forwarded[1].provider, 'p2')

  // 20. preference on: free candidates are listed first and the banner marks them
  const { ctx: ctx18, captured: cap18 } = makeCtx({ answer: '{"route":"p2/big","reason":"免费可用"}' })
  apply(ctx18, makeConfig({ preferFreeModels: true }))
  chunks = await collect(cap18.adapter.stream({ provider: 'auto', model: 'auto', sessionId: 's18', messages: [userMessage([textBlock('hi')])] }))
  assert.match(cap18.routerPrompts[0], /优先使用免费模型/)
  assert.ok(cap18.routerPrompts[0].indexOf('p2/big') < cap18.routerPrompts[0].indexOf('p1/text'))
  assert.equal(cap18.forwarded[1].provider, 'p2')
  assert.match(chunks.find((chunk) => chunk.type === 'text-delta').text, /执行 p2\/big（免费）/)

  // 21. a free model failing before any output retries on the next model
  const { ctx: ctx19, captured: cap19 } = makeCtx({ answer: '{"route":"p2/big","reason":"免费可用"}', failRoutes: ['p2/big'] })
  apply(ctx19, makeConfig({ preferFreeModels: true }))
  chunks = await collect(cap19.adapter.stream({ provider: 'auto', model: 'auto', sessionId: 's19', messages: [userMessage([textBlock('hi')])] }))
  const texts = chunks.filter((chunk) => chunk.type === 'text-delta').map((chunk) => chunk.text)
  assert.ok(texts.some((text) => text.includes('p2/big 调用失败')))
  assert.ok(texts.some((text) => text.includes('已切换到 p1/text')))
  assert.ok(texts.some((text) => text.includes('hello from p1')))
  assert.equal(cap19.forwarded.filter((entry) => entry.provider === 'p2').length, 1)
  assert.equal(cap19.forwarded.filter((entry) => entry.provider === 'p1').length, 1)
  assert.deepEqual(
    chunks.filter((chunk) => chunk.type === 'block-start').map((chunk) => chunk.index),
    [0, 1, 2, 3],
  )

  // 22. a free model whose window is below the estimated request is not offered
  const { ctx: ctx20, captured: cap20 } = makeCtx({ answer: '{"route":"p1/text","reason":"免费上下文不够"}' })
  apply(ctx20, makeConfig({
    preferFreeModels: true,
    subModels: [
      { provider: 'p3', model: 'smallfree', free: true },
      { provider: 'p1', model: 'text', free: false },
    ],
  }))
  await collect(cap20.adapter.stream({
    provider: 'auto', model: 'auto', sessionId: 's20',
    messages: [userMessage([textBlock('x'.repeat(30000))])],
  }))
  assert.equal(cap20.routerPrompts[0].includes('p3/smallfree'), false)
  assert.match(cap20.routerPrompts[0], /没有满足能力要求的免费模型/)
  assert.equal(cap20.forwarded[1].provider, 'p1')

  // 23. a failed free model is skipped on the following turn (cooldown)
  const { ctx: ctx21, captured: cap21 } = makeCtx({ answer: '{"route":"p2/big","reason":"免费可用"}', failRoutes: ['p2/big'] })
  apply(ctx21, makeConfig({ preferFreeModels: true }))
  await collect(cap21.adapter.stream({ provider: 'auto', model: 'auto', sessionId: 's21', messages: [userMessage([textBlock('hi')])] }))
  await collect(cap21.adapter.stream({ provider: 'auto', model: 'auto', sessionId: 's21', messages: [userMessage([textBlock('下一个任务')], 'm9')] }))
  assert.equal(cap21.routerPrompts.length, 2)
  assert.equal(cap21.routerPrompts[1].includes('p2/big'), false, 'the failed free model is cooling down')
  assert.equal(cap21.forwarded.filter((entry) => entry.provider === 'p2').length, 1)

  // 24. a paid model failing also retries the next candidate
  const paidFail = makeCtx({ answer: '{"route":"p2/big","reason":"复杂"}', failRoutes: ['p2/big'] })
  apply(paidFail.ctx, makeConfig())
  chunks = await collect(paidFail.captured.adapter.stream({ provider: 'auto', model: 'auto', sessionId: 's22', messages: [userMessage([textBlock('hi')])] }))
  const paidTexts = chunks.filter((chunk) => chunk.type === 'text-delta').map((chunk) => chunk.text)
  assert.ok(paidTexts.some((text) => text.includes('p2/big 调用失败')))
  assert.ok(paidTexts.some((text) => text.includes('hello from p1')))

  // 25. every sub model fails -> the main model finishes the reply
  const { ctx: ctx23, captured: cap23 } = makeCtx({
    answer: '{"route":"p2/big","reason":"复杂"}',
    failRoutes: ['p1/text', 'p1/vision', 'p2/big'],
  })
  apply(ctx23, makeConfig())
  chunks = await collect(cap23.adapter.stream({ provider: 'auto', model: 'auto', sessionId: 's23', messages: [userMessage([textBlock('hi')])] }))
  const allFailTexts = chunks.filter((chunk) => chunk.type === 'text-delta').map((chunk) => chunk.text)
  assert.ok(allFailTexts.some((text) => text.includes('所有副模型都调用失败')))
  assert.ok(allFailTexts.some((text) => text.includes('主模型接管：已完成总结')))
  const allFailFinish = chunks.find((chunk) => chunk.type === 'finish')
  assert.equal(allFailFinish.reason.kind, 'stop')
  assert.equal(cap23.forwarded.filter((entry) => entry.provider === 'main').length, 2, 'router + main fallback')

  // 26. every model (including the main one) fails -> readable reply, not a bare error
  const { ctx: ctx24, captured: cap24 } = makeCtx({
    answer: '{"route":"p2/big","reason":"复杂"}',
    failRoutes: ['p1/text', 'p1/vision', 'p2/big'],
    mainReplyFails: true,
  })
  apply(ctx24, makeConfig())
  chunks = await collect(cap24.adapter.stream({ provider: 'auto', model: 'auto', sessionId: 's24', messages: [userMessage([textBlock('hi')])] }))
  const summaryTexts = chunks.filter((chunk) => chunk.type === 'text-delta').map((chunk) => chunk.text)
  assert.ok(summaryTexts.some((text) => text.includes('本次请求没有完成')))
  assert.ok(summaryTexts.some((text) => text.includes('main/router：API 密钥无效或未授权')))
  const summaryFinish = chunks.find((chunk) => chunk.type === 'finish')
  assert.equal(summaryFinish.reason.kind, 'stop', 'a readable reply finishes normally')

  // 27. after a context overflow the largest window is tried next
  const { ctx: ctx25, captured: cap25 } = makeCtx({
    answer: '{"route":"p3/smallfree","reason":"先用小的"}',
    failures: { 'p3/smallfree': { code: 'CONTEXT_WINDOW_EXCEEDED', message: 'Prompt exceeds max length' } },
  })
  apply(ctx25, makeConfig({
    subModels: [
      { provider: 'p3', model: 'smallfree', free: false },
      { provider: 'p1', model: 'vision', free: false },
      { provider: 'p1', model: 'text', free: false },
    ],
  }))
  chunks = await collect(cap25.adapter.stream({ provider: 'auto', model: 'auto', sessionId: 's25', messages: [userMessage([textBlock('hi')])] }))
  assert.equal(cap25.forwarded[1].model, 'smallfree')
  assert.equal(cap25.forwarded[2].model, 'text', '128k model is tried before the 64k one')
  assert.ok(chunks.some((chunk) => chunk.type === 'text-delta' && String(chunk.text).includes('上下文超出模型上限')))

  // 28. a provider whose credential is missing is filtered before routing
  const { ctx: ctx26, captured: cap26 } = makeCtx({ answer: '{"route":"p1/text","reason":"只剩 p1"}' })
  apply(ctx26, makeConfig({
    subModels: [
      { provider: 'p4', model: 'text', free: false },
      { provider: 'p1', model: 'text', free: false },
    ],
  }))
  await collect(cap26.adapter.stream({ provider: 'auto', model: 'auto', sessionId: 's26', messages: [userMessage([textBlock('hi')])] }))
  assert.equal(cap26.routerPrompts[0].includes('p4/text'), false)
  assert.equal(cap26.forwarded[1].provider, 'p1')

  // 29. custom tags are accepted, kept in order and shown to the router
  const { ctx: ctx27, captured: cap27 } = makeCtx({ answer: '{"route":"p1/text","reason":"sql 专用"}' })
  apply(ctx27, makeConfig({
    customTags: ['sql', '法律'],
    subModels: [{ provider: 'p1', model: 'text', tags: ['sql', 'text', '法律'] }],
  }))
  await collect(cap27.adapter.stream({ provider: 'auto', model: 'auto', sessionId: 's27', messages: [userMessage([textBlock('写个查询')])] }))
  assert.match(cap27.routerPrompts[0], /标签：sql\+法律/)
  assert.equal(cap27.forwarded[1].model, 'text')

  // 30. text-to-image requests get the image-gen task tag
  const { ctx: ctx28, captured: cap28 } = makeCtx({ answer: '{"route":"p2/big","reason":"会调画图工具"}' })
  apply(ctx28, makeConfig({
    subModels: [
      { provider: 'p1', model: 'text', tags: ['text'], free: false },
      { provider: 'p2', model: 'big', tags: ['image-gen', 'tools'], free: false },
    ],
  }))
  chunks = await collect(cap28.adapter.stream({
    provider: 'auto', model: 'auto', sessionId: 's28',
    messages: [userMessage([textBlock('画一张猫的图片')])],
  }))
  assert.match(cap28.routerPrompts[0], /任务标签.*文生图/)
  assert.match(cap28.routerPrompts[0], /用户想生成图片：是/)
  assert.match(chunks.find((chunk) => chunk.type === 'text-delta').text, /任务 文生图/)

  // 31. the executor receives the full conversation unchanged
  const { ctx: ctx29, captured: cap29 } = makeCtx({ answer: '{"route":"p2/big","reason":"完整上下文"}' })
  apply(ctx29, makeConfig())
  const longHistory = [
    userMessage([textBlock('x'.repeat(5000))], 'm1'),
    { role: 'assistant', content: [textBlock('ok')] },
    { role: 'tool', content: [textBlock('result')], toolCallId: 'c1' },
    userMessage([imageBlock(), textBlock('继续')], 'm2'),
  ]
  const executorOptions = {
    provider: 'auto', model: 'auto', sessionId: 's29',
    messages: longHistory,
    tools: [{ name: 'read' }],
    temperature: 0.2,
  }
  await collect(cap29.adapter.stream(executorOptions))
  const executor = cap29.forwarded[1]
  assert.deepEqual(executor.messages, longHistory, 'full history is forwarded to the executor')
  assert.deepEqual(executor.tools, executorOptions.tools)
  assert.equal(executor.temperature, 0.2)

  // 32. missing tags are derived from model name / metadata
  const { ctx: ctx30, captured: cap30 } = makeCtx({ answer: '{"route":"p5/coder","reason":"代码任务"}' })
  apply(ctx30, makeConfig({ subModels: [{ provider: 'p5', model: 'coder', tags: [] }] }))
  await collect(cap30.adapter.stream({ provider: 'auto', model: 'auto', sessionId: 's30', messages: [userMessage([textBlock('写个排序函数')])] }))
  assert.match(cap30.routerPrompts[0], /自动推导：代码/)
  assert.equal(cap30.forwarded[1].model, 'coder')

  // 33. a script-style answer is not executed: the plugin only routes
  const { ctx: ctx31, captured: cap31 } = makeCtx({
    answer: '{"mode":"script","script":"echo hi","reason":"脚本任务"}',
  })
  apply(ctx31, makeConfig())
  chunks = await collect(cap31.adapter.stream({
    provider: 'auto', model: 'auto', sessionId: 's31',
    messages: [userMessage([textBlock('处理一批数据')])],
  }))
  const scriptTexts = chunks.filter((chunk) => chunk.type === 'text-delta').map((chunk) => chunk.text)
  assert.ok(scriptTexts.some((text) => text.includes('主模型未给出有效决策')))
  assert.equal(cap31.forwarded[1].provider, 'p1')
  assert.equal(chunks.find((chunk) => chunk.type === 'finish').reason.kind, 'stop')

  console.log('router tests: 33/33 passed')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
