/**
 * "Auto model" settings page — browser half.
 *
 * The page edits the `auto-model` settings namespace the Host plugin serves:
 * one main model, an ordered sub-model list, a fallback model, and the reply
 * visibility / API-key exposure switches. Every control writes straight back
 * through the shared configuration form, so the page keeps no draft of its
 * own; live values come from the form snapshot and the model choices from the
 * Host model catalog.
 *
 * Plain browser module: no build step, no JSX, no client-package imports.
 */
window.__ModuleLoader__.load({
	id: "dsh-auto-model",
	factory(require) {
		var module = { exports: {} };
		var exports = module.exports;
		const React = require("react");
		const h = React.createElement;

		/** Dictionary namespace owned by this plugin. */
		const NS = "settings.autoModel";

		/** English copy (fallback language). */
		const en = {
			nav: "Auto model",
			title: "Auto model",
			intro: "When a session uses Auto, the main model reads the sub-model catalog — parameters, tags and the free flag — and chooses which sub model executes each task. Tags are soft preferences: matching models are listed first, but every capable model stays selectable. With “Prefer free models” on, it first checks whether a free model can handle the task. The reply names the chosen model.",
			tagsLabel: "Tags",
			tagsHint: "Capabilities are soft preferences: matching models are listed first, but every capable model stays selectable. Input/output types describe the modalities and are matched against the request.",
			modalityText: "Text",
			modalityImage: "Image",
			modalityAudio: "Audio",
			modalityVideo: "Video",
			tagVision: "Image understanding",
			tagImageGen: "Text-to-image",
			tagImageToImage: "Image-to-image",
			tagMultimodal: "Multimodal",
			tagAudioGen: "Text-to-audio",
			tagVideoGen: "Text-to-video",
			groupInputs: "Input types",
			groupOutputs: "Output types",
			groupCapabilities: "Capabilities",
			untaggedHint: "{n} sub model(s) have no capability tags. They stay selectable as general models, and the router derives some tags from model name and context window.",
			tagsCoverage: "{n}/{m} sub models have capability tags.",
			untaggedBadge: "No tags",
			tagCoding: "Coding",
			tagReasoning: "Reasoning",
			tagMath: "Math",
			tagLongContext: "Long context",
			tagFast: "Fast",
			tagTools: "Tools",
			tagOcr: "OCR",
			tagTranslation: "Translation",
			tagSummarization: "Summarization",
			tagCreative: "Creative",
			tagAgentic: "Agentic",
			customTags: "Custom tags",
			customTagsHint: "Add your own tags (letters, digits, CJK, - and _). They work as soft preferences on any sub model.",
			customTagPlaceholder: "e.g. legal, finance, sql",
			addTag: "Add tag",
			removeTag: "Remove tag",
			legendSeparator: ": ",
			orderHint: "Candidates are tried from top to bottom; earlier entries win. Tags reorder this list per task, they do not remove entries.",
			add: "Add",
			chooseModel: "Choose a provider and model",
			remove: "Remove",
			moveUp: "Move up",
			moveDown: "Move down",
			labelSeparator: ": ",
			unavailableTag: "Unavailable",
			rangeEmpty: "Nothing configured yet; the fallback model below will be used.",
			fallbackTitle: "Fallback model",
			fallbackHint: "Used when none of the sub models above is currently routable.",
			fallbackEmpty: "No fallback model",
			catalogPartial: "Some model providers could not be loaded.",
			catalogEmpty: "No model provider currently advertises a model.",
			catalogLoadFailed: "Models could not be loaded.",
			retry: "Retry",
			loading: "Loading models…",
			loadingSettings: "Loading settings…",
			readOnly: "This deployment stores settings read-only.",
			unavailable: "This plugin is not loaded, so it cannot be configured right now.",
			saving: "Saving…",
			saveFailed: "The deployment did not accept this change; please try again.",
			invalidNumber: "Enter a whole number of 0 or more.",
			imageNote: "Image understanding candidates need models that accept image input (Settings → Models → that model → Input types → Image); otherwise images are sent as placeholders.",
			advancedTitle: "Advanced",
			contextWindow: "Context window override",
			contextWindowHint: "0 uses the smallest window among the candidate models automatically.",
			maxTokens: "Maximum output tokens",
			maxTokensHint: "0 uses the model default.",
			mainTitle: "Main model",
			mainHint: "Reads the sub-model catalog and decides which model executes the task; it does not answer the user itself.",
			mainEmpty: "No main model configured",
			subTitle: "Sub models",
			subHint: "The main model can only choose from this ordered list. Image requests require a model that accepts images; tags rank candidates but never exclude capable models.",
			subEmpty: "No sub model configured yet; the fallback model below will be used.",
			showRoute: "Show the chosen model in the reply",
			showRouteHint: "Adds one line naming the main model's choice at the start of the reply.",
			exposeApiKeys: "Send resolved API keys to the model",
			exposeApiKeysHint: "Off by default: the prompt only carries the environment-variable name and whether a key is configured. Turn it on when the main model must build local external scripts — for example a Python/curl script that calls a provider API directly, or a special task script that picks a suitable model. It writes real keys into the prompt (leak risk), so enable it only when needed.",
			freeLabel: "Free",
			preferFree: "Prefer free models",
			preferFreeHint: "The main model checks whether a free sub model can handle the task; it uses one when possible and switches automatically when a free model is unavailable or fails.",
			legendMain: "Main model",
			legendMainDesc: "Decides which sub model runs the next task.",
			legendSub: "Sub models",
			legendSubDesc: "Execute the request; mark any of them as free and give them tags.",
			legendShow: "Visibility",
			legendShowDesc: "The routing line appears in the reply.",
		};

		/** Simplified Chinese copy (primary language). */
		const zh = {
			nav: "自动模型",
			title: "自动模型",
			intro: "当会话使用「自动选择」时，主模型会读取副模型清单（参数、标签与免费标记），为当前任务挑选一个副模型执行；标签只是软偏好，匹配的模型排在前面，但所有能力满足的模型都可被选中。开启“优先使用免费模型”时会先判断免费模型能否胜任。回复开头会标注本次选用的模型。",
			tagsLabel: "标签",
			tagsHint: "能力标签是软偏好：匹配的模型排在前面，但所有能力满足的模型都保持可选。输入/输出类型描述模态，会与请求的实际模态匹配。",
			modalityText: "文本",
			modalityImage: "图片",
			modalityAudio: "音频",
			modalityVideo: "视频",
			tagVision: "图像理解",
			tagImageGen: "文生图",
			tagImageToImage: "图生图",
			tagMultimodal: "多模态",
			tagAudioGen: "音频生成",
			tagVideoGen: "视频生成",
			groupInputs: "输入类型",
			groupOutputs: "输出类型",
			groupCapabilities: "能力",
			untaggedHint: "{n} 个副模型还没有能力标签。它们仍会作为“通用”模型参与选择；主模型也会根据模型名称与上下文窗口自动推导部分标签。",
			tagsCoverage: "{n}/{m} 个副模型已标注能力标签。",
			untaggedBadge: "未标注",
			tagCoding: "代码",
			tagReasoning: "推理",
			tagMath: "数学",
			tagLongContext: "长上下文",
			tagFast: "快速",
			tagTools: "工具",
			tagOcr: "OCR",
			tagTranslation: "翻译",
			tagSummarization: "摘要",
			tagCreative: "创意",
			tagAgentic: "自动化",
			customTags: "自定义标签",
			customTagsHint: "可以添加自己的标签（字母、数字、中文、- 和 _），它们和内置标签一样作为软偏好使用。",
			customTagPlaceholder: "例如：法律、财务、sql",
			addTag: "添加标签",
			removeTag: "移除标签",
			legendSeparator: "：",
			orderHint: "候选按从上到下的顺序尝试；标签会按任务重新排序，但不会删除条目。",
			add: "添加",
			chooseModel: "选择提供方与模型",
			remove: "移除",
			moveUp: "上移",
			moveDown: "下移",
			labelSeparator: "：",
			unavailableTag: "不可用",
			rangeEmpty: "尚未配置，将回退到下面配置的兜底模型",
			fallbackTitle: "兜底模型",
			fallbackHint: "当上面的副模型都不可路由时，使用该模型。",
			fallbackEmpty: "未设置兜底模型",
			catalogPartial: "部分模型提供方暂时无法加载。",
			catalogEmpty: "当前没有可用的模型提供方。",
			catalogLoadFailed: "无法加载模型列表。",
			retry: "重试",
			loading: "正在加载模型…",
			loadingSettings: "正在读取设置…",
			readOnly: "本部署的设置为只读。",
			unavailable: "该插件当前未加载，暂时无法配置。",
			saving: "保存中…",
			saveFailed: "保存失败，部署没有接受这次修改，请重试。",
			invalidNumber: "请输入不小于 0 的整数。",
			imageNote: "需要理解图片的候选模型必须支持图片输入（在 设置 → 模型 → 该模型 → 输入类型 勾选 Image），否则图片会以占位符发送。纯文本模型不会被派去处理带图片的请求。",
			advancedTitle: "高级",
			contextWindow: "上下文窗口覆盖",
			contextWindowHint: "0 表示按候选模型的最小值自动决定。",
			maxTokens: "最大输出 tokens",
			maxTokensHint: "0 表示使用模型默认值。",
			mainTitle: "主模型",
			mainHint: "读取副模型清单（参数与本地配置）并决定由哪个副模型执行当前任务；主模型自己不直接回答用户。",
			mainEmpty: "未设置主模型",
			subTitle: "副模型清单",
			subHint: "主模型只能从这份有序清单里选择。带图片的请求需要副模型支持图片输入；标签只影响排序，不会排除能力满足的模型。",
			subEmpty: "尚未配置副模型，将回退到下面配置的兜底模型",
			showRoute: "在回复中显示本次选用的模型",
			showRouteHint: "在回复开头加一行，写明主模型选择了哪个副模型。",
			exposeApiKeys: "向模型提示中提供 API Key 明文",
			exposeApiKeysHint: "默认关闭：提示里只给环境变量名以及是否已配置。开启后主模型会拿到真实 Key，可用于构建本地外部脚本——例如用 Python/curl 直接调用某个提供方 API，或为特殊处理任务生成脚本并选择合适的模型。注意：这会把密钥发送给主模型提供方，存在泄露风险，仅在明确需要时开启。",
			freeLabel: "免费",
			preferFree: "优先使用免费模型",
			preferFreeHint: "开启后主模型先判断免费副模型能否胜任；能胜任就优先用免费模型，免费模型不可用或调用报错时自动切换到其他模型。",
			legendMain: "主模型",
			legendMainDesc: "决定接下来的任务交给哪个副模型。",
			legendSub: "副模型",
			legendSubDesc: "真正执行请求，可勾选“免费”并设置标签；回复里会标注被选中的模型。",
			legendShow: "展示",
			legendShowDesc: "路由信息会出现在回复中。",
		};

		/** The synthetic provider this plugin registers; it is never a candidate. */
		const SYNTHETIC_PROVIDER_ID = "auto";

		/** Opaque key for provider/model pair lookups. */
		function routeKey(route) {
			return `${route.provider}\u0000${route.model}`;
		}

		/** Input/output modality types (not capabilities). */
		const MODALITIES = ["text", "image", "audio", "video"];
		const MODALITY_LABEL_KEYS = {
			text: "modalityText",
			image: "modalityImage",
			audio: "modalityAudio",
			video: "modalityVideo",
		};

		/** Capability tags: what the model is good at. */
		const TAG_VALUES = [
			"vision", "image-gen", "image-to-image", "multimodal", "audio-gen", "video-gen",
			"coding", "reasoning", "math", "long-context", "fast", "tools",
			"ocr", "translation", "summarization", "creative", "agentic",
		];
		const TAG_LABEL_KEYS = {
			vision: "tagVision",
			"image-gen": "tagImageGen",
			"image-to-image": "tagImageToImage",
			multimodal: "tagMultimodal",
			"audio-gen": "tagAudioGen",
			"video-gen": "tagVideoGen",
			coding: "tagCoding",
			reasoning: "tagReasoning",
			math: "tagMath",
			"long-context": "tagLongContext",
			fast: "tagFast",
			tools: "tagTools",
			ocr: "tagOcr",
			translation: "tagTranslation",
			summarization: "tagSummarization",
			creative: "tagCreative",
			agentic: "tagAgentic",
		};
		const TAG_ALIASES = {
			vision: "vision",
			"image-understanding": "vision",
			image_understanding: "vision",
			"image-gen": "image-gen",
			imagegen: "image-gen",
			image_generation: "image-gen",
			"text-to-image": "image-gen",
			t2i: "image-gen",
			"image-to-image": "image-to-image",
			imagetoimage: "image-to-image",
			image_to_image: "image-to-image",
			i2i: "image-to-image",
			multimodal: "multimodal",
			"multi-modal": "multimodal",
			"audio-gen": "audio-gen",
			audiogen: "audio-gen",
			audio_generation: "audio-gen",
			"text-to-audio": "audio-gen",
			t2a: "audio-gen",
			"video-gen": "video-gen",
			videogen: "video-gen",
			video_generation: "video-gen",
			"text-to-video": "video-gen",
			t2v: "video-gen",
			coding: "coding",
			code: "coding",
			reasoning: "reasoning",
			reason: "reasoning",
			math: "math",
			maths: "math",
			"long-context": "long-context",
			long: "long-context",
			fast: "fast",
			tools: "tools",
			tool: "tools",
			ocr: "ocr",
			translation: "translation",
			translate: "translation",
			summarization: "summarization",
			summary: "summarization",
			summarize: "summarization",
			creative: "creative",
			creativity: "creative",
			agentic: "agentic",
			agent: "agentic",
			automation: "agentic",
		};

		/** Normalize user-defined custom tags; keep them short and unique. */
		function normalizeCustomTags(raw) {
			const tags = [];
			const seen = new Set();
			for (const item of Array.isArray(raw) ? raw : []) {
				const tag = String(item ?? "").trim().toLowerCase().slice(0, 24);
				if (tag === "" || TAG_VALUES.includes(tag) || seen.has(tag)) continue;
				if (!/^[a-z0-9\u4e00-\u9fff][a-z0-9\u4e00-\u9fff _-]*$/.test(tag)) continue;
				seen.add(tag);
				tags.push(tag);
				if (tags.length >= 20) break;
			}
			return tags;
		}

		/** Localized label of one capability tag value. */
		function tagLabel(t, value) {
			const key = TAG_LABEL_KEYS[value];
			return key === undefined ? value : t(key);
		}

		/** Localized label of one modality value. */
		function modalityLabel(t, value) {
			const key = MODALITY_LABEL_KEYS[value];
			return key === undefined ? value : t(key);
		}

		/** Normalize one modality list. */
		function normalizeModalities(raw) {
			const list = [];
			for (const item of Array.isArray(raw) ? raw : []) {
				const value = String(item ?? "").trim().toLowerCase();
				if (MODALITIES.includes(value) && !list.includes(value)) list.push(value);
			}
			return list;
		}

		/** Normalize one capability tag against built-ins + custom tags. */
		function normalizeTag(value, extraTags) {
			const allowed = TAG_VALUES.concat(normalizeCustomTags(extraTags));
			const rawTag = String(value ?? "").trim().toLowerCase();
			const tag = TAG_ALIASES[rawTag] ?? rawTag;
			return tag !== "" && allowed.includes(tag) ? tag : "";
		}

		/** Normalize one capability tag list. */
		function normalizeTags(raw, extraTags) {
			const tags = [];
			for (const value of Array.isArray(raw) ? raw : []) {
				const tag = normalizeTag(value, extraTags);
				if (tag !== "" && !tags.includes(tag)) tags.push(tag);
			}
			return tags;
		}

		/**
		 * Read one entry into inputs / outputs / capability tags, migrating the
		 * legacy flat tag layout (text / vision / image-gen in `tags`).
		 */
		function migrateEntry(entry, extraTags) {
			const inputs = normalizeModalities(entry.inputs);
			const outputs = normalizeModalities(entry.outputs);
			const tags = [];
			const addTag = (value) => {
				const tag = normalizeTag(value, extraTags);
				if (tag !== "" && !tags.includes(tag)) tags.push(tag);
			};
			// Only infer modalities from flat tags for old configs without
			// explicit inputs/outputs; new configs keep declared modalities.
			const legacy = !Array.isArray(entry.inputs) && !Array.isArray(entry.outputs);
			for (const value of Array.isArray(entry.tags) ? entry.tags : []) {
				if (!legacy) {
					addTag(value);
					continue;
				}
				const rawTag = String(value ?? "").trim().toLowerCase();
				if (rawTag === "text") {
					if (!inputs.includes("text")) inputs.push("text");
					continue;
				}
				if (rawTag === "image" || rawTag === "vision" || rawTag === "image-input") {
					if (!inputs.includes("image")) inputs.push("image");
					addTag("vision");
					continue;
				}
				if (rawTag === "audio") {
					if (!inputs.includes("audio")) inputs.push("audio");
					continue;
				}
				if (rawTag === "video") {
					if (!inputs.includes("video")) inputs.push("video");
					continue;
				}
				if (rawTag === "multimodal") {
					if (!inputs.includes("image")) inputs.push("image");
					addTag("multimodal");
					continue;
				}
				if (rawTag === "image-gen") {
					if (!outputs.includes("image")) outputs.push("image");
					addTag("image-gen");
					continue;
				}
				if (rawTag === "audio-gen") {
					if (!outputs.includes("audio")) outputs.push("audio");
					addTag("audio-gen");
					continue;
				}
				if (rawTag === "video-gen") {
					if (!outputs.includes("video")) outputs.push("video");
					addTag("video-gen");
					continue;
				}
				addTag(rawTag);
			}
			if (legacy && tags.length === 0 && inputs.length === 0 && typeof entry.category === "string") {
				if (entry.category === "text") inputs.push("text");
				else if (entry.category === "image") { inputs.push("image"); addTag("vision"); }
				else if (entry.category === "multimodal") { inputs.push("image"); addTag("multimodal"); }
			}
			return { inputs, outputs, tags };
		}

		/** Identity of one sub-model entry (one row per provider/model). */
		function entryKey(route) {
			return routeKey(route);
		}

		/**
		 * Read one ordered sub-model list out of a form value.
		 * @param value - the form snapshot's effective settings object.
		 * @param field - `subModels` (or any ordered route array field).
		 * @param extraTags - user-defined capability tags.
		 * @returns provider/model/inputs/outputs/tags entries in saved order.
		 */
		function readRoutes(value, field, extraTags) {
			const raw = value !== null && typeof value === "object" && Array.isArray(value[field]) ? value[field] : [];
			const routes = [];
			const seen = new Set();
			for (const entry of raw) {
				if (entry === null || typeof entry !== "object") continue;
				const provider = entry.provider;
				const model = entry.model;
				if (typeof provider !== "string" || provider === "") continue;
				if (typeof model !== "string" || model === "") continue;
				const { inputs, outputs, tags } = migrateEntry(entry, extraTags);
				const free = entry.free === true;
				const route = { provider, model, inputs, outputs, tags, free };
				const key = entryKey(route, extraTags);
				if (seen.has(key)) continue;
				seen.add(key);
				routes.push(route);
			}
			return routes;
		}

		/** Read a string field, tolerating a missing or malformed value. */
		function readString(value, field) {
			if (value === null || typeof value !== "object") return "";
			const raw = value[field];
			return typeof raw === "string" ? raw : "";
		}

		/** Read a non-negative integer field, tolerating a missing or malformed value. */
		function readCount(value, field) {
			if (value === null || typeof value !== "object") return 0;
			const raw = value[field];
			return typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0 ? raw : 0;
		}

		/**
		 * Normalize the catalog answer into provider groups, dropping the
		 * synthetic provider this plugin registers and any empty group.
		 * @param raw - host `ModelCatalog` value.
		 * @returns provider groups in host order.
		 */
		function catalogGroups(raw) {
			const source = raw !== null && typeof raw === "object" && Array.isArray(raw.groups) ? raw.groups : [];
			const groups = [];
			for (const group of source) {
				if (group === null || typeof group !== "object") continue;
				if (typeof group.id !== "string" || group.id === "" || group.id === SYNTHETIC_PROVIDER_ID) continue;
				const models = [];
				for (const model of Array.isArray(group.models) ? group.models : []) {
					if (model === null || typeof model !== "object") continue;
					if (typeof model.id !== "string" || model.id === "") continue;
					models.push({
						id: model.id,
						name: typeof model.name === "string" && model.name !== "" ? model.name : model.id,
					});
				}
				if (models.length === 0) continue;
				groups.push({
					id: group.id,
					name: typeof group.name === "string" && group.name !== "" ? group.name : group.id,
					models,
				});
			}
			return groups;
		}

		/** Count the isolated provider failures the host reported. */
		function catalogFailureCount(raw) {
			if (raw === null || typeof raw !== "object" || !Array.isArray(raw.failures)) return 0;
			return raw.failures.length;
		}

		/** Flatten provider groups into select options in catalog order. */
		function flattenRoutes(groups) {
			const routes = [];
			for (const group of groups) {
				for (const model of group.models) {
					routes.push({
						provider: group.id,
						providerName: group.name,
						model: model.id,
						modelName: model.name,
					});
				}
			}
			return routes;
		}

		/** Index live catalog routes by opaque key for availability lookups. */
		function indexRoutes(groups) {
			const index = new Map();
			for (const route of flattenRoutes(groups)) index.set(routeKey(route), route);
			return index;
		}

		/** Initial catalog state: the first read is in flight. */
		const EMPTY_CATALOG = { status: "loading", groups: [], failures: 0 };

		/**
		 * Load the host model catalog and keep it fresh on pushed invalidations.
		 * @param remote - the browser remote service.
		 * @returns the catalog state and a retry action.
		 */
		function useModelCatalog(remote) {
			const [attempt, setAttempt] = React.useState(0);
			const [catalog, setCatalog] = React.useState(EMPTY_CATALOG);
			React.useEffect(() => {
				let disposed = false;
				let generation = 0;
				const load = () => {
					const current = (generation += 1);
					setCatalog((previous) => (
						previous.status === "ready" ? previous : { ...previous, status: "loading" }
					));
					let request;
					try {
						const session = remote === undefined || remote === null ? undefined : remote.session;
						if (session === undefined || typeof session.modelCatalog !== "function") {
							throw new Error("model catalog is unavailable");
						}
						request = Promise.resolve(session.modelCatalog());
					} catch (error) {
						request = Promise.reject(error);
					}
					request.then((response) => {
						if (disposed || current !== generation) return;
						if (response !== null && typeof response === "object" && response.ok === true) {
							setCatalog({
								status: "ready",
								groups: catalogGroups(response.value),
								failures: catalogFailureCount(response.value),
							});
							return;
						}
						setCatalog((previous) => (
							previous.groups.length === 0 ? { ...EMPTY_CATALOG, status: "error" } : previous
						));
					}, () => {
						if (disposed || current !== generation) return;
						setCatalog((previous) => (
							previous.groups.length === 0 ? { ...EMPTY_CATALOG, status: "error" } : previous
						));
					});
				};
				const disposers = [];
				if (remote !== undefined && remote !== null && typeof remote.$on === "function") {
					disposers.push(remote.$on("llm/adapters-updated", load));
					disposers.push(remote.$on("settings/document-updated", load));
				}
				load();
				return () => {
					disposed = true;
					generation += 1;
					for (const dispose of disposers) {
						if (typeof dispose === "function") dispose();
					}
				};
			}, [remote, attempt]);
			const reload = React.useCallback(() => {
				setAttempt((value) => value + 1);
			}, []);
			return { catalog, reload };
		}

		/**
		 * Auto-save every edit through the shared form and surface its settlement.
		 * @param form - the `auto-model` configuration form.
		 * @returns save state and the two write entry points.
		 */
		function useAutoSave(form) {
			const [state, setState] = React.useState({ pending: 0, failed: false });
			const mounted = React.useRef(true);
			React.useEffect(() => () => {
				mounted.current = false;
			}, []);
			const run = React.useCallback((operation) => {
				setState((previous) => ({ pending: previous.pending + 1, failed: false }));
				Promise.resolve()
					.then(operation)
					.then((accepted) => {
						if (!mounted.current) return;
						setState((previous) => ({
							pending: Math.max(0, previous.pending - 1),
							failed: accepted !== true,
						}));
					}, () => {
						if (!mounted.current) return;
						setState((previous) => ({
							pending: Math.max(0, previous.pending - 1),
							failed: true,
						}));
					});
			}, []);
			const setField = React.useCallback((field, value) => {
				run(() => form.set(field, value));
			}, [form, run]);
			const setMany = React.useCallback((ops) => {
				run(() => form.mutate(ops));
			}, [form, run]);
			return { saving: state.pending > 0, failed: state.failed, setField, setMany };
		}

		/** Inline styles; every color, radius, and surface is a Host theme token. */
		const styles = {
			section: {
				boxSizing: "border-box",
				maxWidth: 720,
				minWidth: 0,
				display: "flex",
				flexDirection: "column",
				gap: 12,
				color: "var(--dsw-alias-label-primary)",
				fontSize: 13,
				lineHeight: "20px",
			},
			title: {
				margin: 0,
				fontSize: 16,
				fontWeight: 500,
				lineHeight: "24px",
				color: "var(--dsw-alias-label-primary)",
			},
			intro: {
				margin: 0,
				color: "var(--dsw-alias-label-tertiary)",
				fontSize: 13,
				lineHeight: "20px",
			},
			legend: {
				margin: 0,
				padding: "0 0 0 18px",
				display: "grid",
				gap: 2,
				color: "var(--dsw-alias-label-tertiary)",
				fontSize: 12,
				lineHeight: "18px",
			},
			legendTerm: {
				color: "var(--dsw-alias-label-secondary)",
				fontWeight: 500,
			},
			muted: {
				margin: 0,
				color: "var(--dsw-alias-label-tertiary)",
				fontSize: 12,
				lineHeight: "18px",
			},
			warning: {
				margin: 0,
				color: "var(--dsw-alias-state-warn-primary)",
				fontSize: 12,
				lineHeight: "18px",
			},
			info: {
				margin: 0,
				color: "var(--dsw-alias-state-business-primary)",
				fontSize: 12,
				lineHeight: "18px",
			},
			warningTag: {
				flex: "none",
				padding: "0 4px",
				border: "0.5px solid var(--dsw-alias-state-warn-primary)",
				borderRadius: "var(--dsw-radius-xs)",
				color: "var(--dsw-alias-state-warn-primary)",
				fontSize: 10,
				lineHeight: "16px",
			},
			error: {
				margin: 0,
				color: "var(--dsw-alias-state-error-primary)",
				fontSize: 12,
				lineHeight: "18px",
			},
			catalogError: {
				display: "flex",
				alignItems: "center",
				gap: 8,
				minWidth: 0,
			},
			body: {
				display: "flex",
				flexDirection: "column",
				gap: 16,
				minWidth: 0,
			},
			field: {
				display: "flex",
				flexDirection: "column",
				gap: 8,
				minWidth: 0,
			},
			subtitle: {
				margin: 0,
				fontSize: 14,
				fontWeight: 500,
				lineHeight: "22px",
				color: "var(--dsw-alias-label-primary)",
			},
			card: {
				boxSizing: "border-box",
				minWidth: 0,
				display: "flex",
				flexDirection: "column",
				gap: 4,
				padding: "6px 10px",
				border: "0.5px solid var(--dsw-alias-settings-card-stroke)",
				borderRadius: "var(--dsw-radius-xl)",
				background: "var(--dsw-alias-settings-card-fill)",
			},
			rows: {
				margin: 0,
				padding: 0,
				listStyle: "none",
				display: "flex",
				flexDirection: "column",
				minWidth: 0,
			},
			row: {
				display: "flex",
				alignItems: "center",
				flexWrap: "wrap",
				gap: 6,
				minWidth: 0,
				minHeight: 34,
				padding: "2px 0",
			},
			rowDivided: {
				borderTop: "0.5px solid var(--dsw-alias-border-l2)",
			},
			rowIndex: {
				flex: "none",
				width: 16,
				textAlign: "right",
				color: "var(--dsw-alias-label-tertiary)",
				fontSize: 11,
				lineHeight: "16px",
				fontVariantNumeric: "tabular-nums",
			},
			rowLabel: {
				flex: "1 1 auto",
				minWidth: 0,
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
				fontSize: 13,
				lineHeight: "20px",
				color: "var(--dsw-alias-label-primary)",
			},
			rowMeta: {
				marginLeft: 6,
				color: "var(--dsw-alias-label-tertiary)",
				fontSize: 12,
				lineHeight: "18px",
			},
			tag: {
				flex: "none",
				padding: "0 6px",
				border: "0.5px solid var(--dsw-alias-border-l3)",
				borderRadius: "var(--dsw-radius-xs)",
				color: "var(--dsw-alias-label-secondary)",
				fontSize: 11,
				lineHeight: "16px",
			},
			tagGroups: {
				display: "flex",
				flexDirection: "column",
				gap: 3,
				flex: "1 1 100%",
				minWidth: 0,
			},
			modalityGroups: {
				display: "flex",
				flexDirection: "column",
				gap: 3,
				flex: "1 1 100%",
				minWidth: 0,
			},
			tagGroupRow: {
				display: "flex",
				alignItems: "flex-start",
				gap: 6,
				minWidth: 0,
			},
			tagGroupLabel: {
				flex: "none",
				width: 56,
				color: "var(--dsw-alias-label-secondary)",
				fontSize: 11,
				lineHeight: "20px",
			},
			tagChipRow: {
				display: "flex",
				flexWrap: "wrap",
				gap: 4,
				flex: "1 1 auto",
				minWidth: 0,
			},
			tagChip: {
				boxSizing: "border-box",
				flex: "none",
				height: 20,
				padding: "0 5px",
				border: "0.5px solid var(--dsw-alias-border-l3)",
				borderRadius: "var(--dsw-radius-xs)",
				background: "transparent",
				color: "var(--dsw-alias-label-secondary)",
				font: "inherit",
				fontSize: 11,
				lineHeight: "18px",
				cursor: "pointer",
				userSelect: "none",
			},
			tagChipActive: {
				borderColor: "transparent",
				background: "var(--dsw-alias-button-primary-fill)",
				color: "var(--dsw-alias-label-primary-foreground)",
			},
			chipRemove: {
				marginLeft: 4,
				padding: 0,
				border: "none",
				background: "transparent",
				color: "inherit",
				font: "inherit",
				fontSize: 10,
				lineHeight: 1,
				cursor: "pointer",
			},
			addButton: {
				boxSizing: "border-box",
				flex: "none",
				height: 32,
				padding: "0 10px",
				border: "0.5px solid var(--dsw-alias-border-l2)",
				borderRadius: "var(--dsw-radius-s)",
				background: "var(--dsw-alias-bg-l2)",
				color: "var(--dsw-alias-label-primary)",
				font: "inherit",
				fontSize: 12,
				cursor: "pointer",
			},
			freeToggle: {
				flex: "none",
				display: "inline-flex",
				alignItems: "center",
				gap: 4,
				color: "var(--dsw-alias-label-secondary)",
				fontSize: 12,
				lineHeight: "18px",
				cursor: "pointer",
				userSelect: "none",
			},
			empty: {
				margin: 0,
				padding: "8px 0",
				color: "var(--dsw-alias-label-tertiary)",
				fontSize: 12,
				lineHeight: "18px",
			},
			controlRow: {
				display: "flex",
				alignItems: "center",
				gap: 8,
				minWidth: 0,
				paddingTop: 2,
			},
			select: {
				boxSizing: "border-box",
				flex: "1 1 auto",
				minWidth: 0,
				height: 32,
				padding: "0 8px",
				border: "none",
				borderRadius: "var(--dsw-radius-md)",
				background: "var(--dsw-alias-bg-module-platform)",
				color: "var(--dsw-alias-label-primary)",
				font: "inherit",
				fontSize: 13,
				cursor: "pointer",
			},
			selectDisabled: {
				boxSizing: "border-box",
				flex: "1 1 auto",
				minWidth: 0,
				height: 32,
				padding: "0 8px",
				border: "none",
				borderRadius: "var(--dsw-radius-md)",
				background: "var(--dsw-alias-bg-module-platform)",
				color: "var(--dsw-alias-label-primary)",
				font: "inherit",
				fontSize: 13,
				cursor: "default",
				opacity: 0.6,
			},
			numberRow: {
				display: "flex",
				alignItems: "center",
				gap: 16,
				minWidth: 0,
				padding: "6px 0",
			},
			numberDivided: {
				borderTop: "0.5px solid var(--dsw-alias-border-l2)",
			},
			numberText: {
				display: "flex",
				flexDirection: "column",
				gap: 2,
				flex: "1 1 auto",
				minWidth: 0,
			},
			numberLabel: {
				color: "var(--dsw-alias-label-primary)",
				fontSize: 13,
				lineHeight: "20px",
			},
			numberInput: {
				boxSizing: "border-box",
				flex: "none",
				width: 96,
				height: 32,
				padding: "0 8px",
				border: "none",
				borderRadius: "var(--dsw-radius-md)",
				background: "var(--dsw-alias-bg-module-platform)",
				color: "var(--dsw-alias-label-primary)",
				font: "inherit",
				fontSize: 13,
				lineHeight: "20px",
				fontVariantNumeric: "tabular-nums",
				textAlign: "right",
			},
		};

		/**
		 * Track pointer hover for controls that need a hover surface without CSS.
		 * @returns the hovered flag and the handlers to spread onto the element.
		 */
		function useHoverState() {
			const [hovered, setHovered] = React.useState(false);
			return [hovered, {
				onMouseEnter: () => setHovered(true),
				onMouseLeave: () => setHovered(false),
			}];
		}

		/**
		 * A 28px square icon button with an accessible name.
		 * @param props - locale label, glyph, disabled flag, danger styling, and click action.
		 * @returns the button element.
		 */
		function IconButton(props) {
			const [hovered, hoverProps] = useHoverState();
			const disabled = props.disabled === true;
			return h("button", {
				type: "button",
				"aria-label": props.label,
				title: props.label,
				disabled,
				onClick: disabled ? undefined : props.onClick,
				...hoverProps,
				style: {
					boxSizing: "border-box",
					flex: "none",
					width: 28,
					height: 28,
					display: "inline-flex",
					alignItems: "center",
					justifyContent: "center",
					padding: 0,
					border: "none",
					borderRadius: "var(--dsw-radius-sm)",
					background: hovered && !disabled ? "var(--dsw-alias-interactive-bg-hover)" : "transparent",
					color: props.danger === true && hovered && !disabled
						? "var(--dsw-alias-state-error-primary)"
						: "var(--dsw-alias-label-secondary)",
					opacity: disabled ? 0.35 : 1,
					cursor: disabled ? "default" : "pointer",
					font: "inherit",
					fontSize: 13,
					lineHeight: "16px",
				},
			}, h("span", { "aria-hidden": "true" }, props.glyph));
		}

		/**
		 * A compact primary action button.
		 * @param props - localized label, disabled flag, and click action.
		 * @returns the button element.
		 */
		function PrimaryButton(props) {
			const [hovered, hoverProps] = useHoverState();
			const disabled = props.disabled === true;
			return h("button", {
				type: "button",
				disabled,
				onClick: disabled ? undefined : props.onClick,
				...hoverProps,
				style: {
					boxSizing: "border-box",
					flex: "none",
					height: 32,
					padding: "0 14px",
					border: "none",
					borderRadius: "var(--dsw-radius-md)",
					background: hovered && !disabled
						? "var(--dsw-alias-button-primary-hover)"
						: "var(--dsw-alias-button-primary-fill)",
					color: "var(--dsw-alias-label-primary-foreground)",
					font: "inherit",
					fontSize: 13,
					fontWeight: 500,
					lineHeight: "20px",
					cursor: disabled ? "default" : "pointer",
					opacity: disabled ? 0.5 : 1,
				},
			}, props.label);
		}

		/**
		 * An inline text action (retry links and similar secondary affordances).
		 * @param props - localized label, disabled flag, and click action.
		 * @returns the button element.
		 */
		function TextButton(props) {
			const [hovered, hoverProps] = useHoverState();
			const disabled = props.disabled === true;
			return h("button", {
				type: "button",
				disabled,
				onClick: disabled ? undefined : props.onClick,
				...hoverProps,
				style: {
					flex: "none",
					padding: 0,
					border: "none",
					background: "transparent",
					color: hovered && !disabled
						? "var(--dsw-alias-label-primary)"
						: "var(--dsw-alias-label-secondary)",
					font: "inherit",
					fontSize: 12,
					lineHeight: "18px",
					textDecoration: "underline",
					textUnderlineOffset: 3,
					cursor: disabled ? "default" : "pointer",
					opacity: disabled ? 0.5 : 1,
				},
			}, props.label);
		}

		/**
		 * One non-negative integer override, committed on blur or Enter so that
		 * typing never writes half an answer, with a localized invalid hint.
		 * @param props - field identity, localization, current value, and commit action.
		 * @returns the labelled numeric field.
		 */
		function NumberField(props) {
			const { id, t, label, hint, value, disabled, onCommit } = props;
			const committed = String(value);
			const [draft, setDraft] = React.useState(committed);
			const [invalid, setInvalid] = React.useState(false);
			const focused = React.useRef(false);
			const hintId = `${id}-hint`;
			const invalidId = `${id}-invalid`;
			React.useEffect(() => {
				if (focused.current) return;
				setDraft(committed);
				setInvalid(false);
			}, [committed]);
			const commit = () => {
				const text = draft.trim();
				const parsed = text === "" ? 0 : Number(text);
				if (!Number.isSafeInteger(parsed) || parsed < 0) {
					setInvalid(true);
					return;
				}
				setInvalid(false);
				if (parsed !== value) onCommit(parsed);
			};
			return h("div", { style: styles.numberRow },
				h("div", { style: styles.numberText },
					h("label", { htmlFor: id, style: styles.numberLabel }, label),
					h("p", { id: hintId, style: styles.muted }, hint),
					invalid ? h("p", { id: invalidId, role: "alert", style: styles.error }, t("invalidNumber")) : null
				),
				h("input", {
					id,
					type: "number",
					inputMode: "numeric",
					min: 0,
					step: 1,
					value: draft,
					disabled,
					"aria-invalid": invalid ? "true" : undefined,
					"aria-describedby": invalid ? `${hintId} ${invalidId}` : hintId,
					onFocus: () => {
						focused.current = true;
					},
					onChange: (event) => {
						setDraft(event.target.value);
						setInvalid(false);
					},
					onBlur: () => {
						focused.current = false;
						commit();
					},
					onKeyDown: (event) => {
						if (event.key !== "Enter") return;
						event.preventDefault();
						event.currentTarget.blur();
					},
					style: {
						...styles.numberInput,
						opacity: disabled ? 0.6 : 1,
						cursor: disabled ? "default" : "text",
					},
				})
			);
		}

		/**
		 * One chip row shared by capability tags and modality types.
		 * @returns a wrapping row of toggle buttons.
		 */
		function ChipRow(props) {
			const { t, values, selected, disabled, spoken, labelOf, onToggle } = props;
			return h("div", { style: styles.tagChipRow },
				values.map((value) => {
					const active = selected.includes(value);
					const suffix = spoken === undefined ? "" : `${t("labelSeparator")}${spoken}`;
					return h("button", {
						key: value,
						type: "button",
						"aria-pressed": active ? "true" : "false",
						"aria-label": `${labelOf(value)}${suffix}`,
						disabled: disabled === true,
						onClick: () => onToggle(value),
						style: {
							...styles.tagChip,
							...(active ? styles.tagChipActive : null),
							opacity: disabled === true ? 0.5 : 1,
							cursor: disabled === true ? "default" : "pointer",
						},
					}, labelOf(value));
				})
			);
		}

		/**
		 * Capability tags (image understanding, text-to-image, image-to-image,
		 * multimodal, coding, ... plus user-defined custom tags).
		 * @param props - locale, selected tags, disabled flag, spoken label, write action.
		 * @returns the chip group.
		 */
		function TagChips(props) {
			const { t, tags, extraTags, disabled, spoken, onChange } = props;
			const selected = normalizeTags(tags, extraTags);
			const options = TAG_VALUES.concat(normalizeCustomTags(extraTags));
			return h(ChipRow, {
				t,
				values: options,
				selected,
				disabled,
				spoken,
				labelOf: (value) => tagLabel(t, value),
				onToggle: (value) => onChange(selected.includes(value)
					? selected.filter((tag) => tag !== value)
					: selected.concat([value])),
			});
		}

		/**
		 * Input or output modality types (text / image / audio / video).
		 * @param props - locale, selected modalities, disabled flag, spoken label, write action.
		 * @returns the chip group.
		 */
		function ModalityChips(props) {
			const { t, values, disabled, spoken, onChange } = props;
			const selected = normalizeModalities(values);
			return h(ChipRow, {
				t,
				values: MODALITIES,
				selected,
				disabled,
				spoken,
				labelOf: (value) => modalityLabel(t, value),
				onToggle: (value) => onChange(selected.includes(value)
					? selected.filter((item) => item !== value)
					: selected.concat([value])),
			});
		}

		/**
		 * One ordered candidate-range editor: saved order, reorder/remove
		 * actions, unavailable tags, and the add control over the live catalog.
		 * @param props - locale, range copy, host groups, saved routes, and write action.
		 * @returns the editor section.
		 */
		function CandidateRangeEditor(props) {
			const { t, title, hint, groups, routes, lookup, disabled, catalogLoading, customTags, onCustomTagsChange } = props;
			const headingId = React.useId();
			const addOptions = React.useMemo(() => flattenRoutes(groups), [groups]);
			const optionIndex = React.useMemo(() => {
				const index = new Map();
				addOptions.forEach((option, position) => index.set(routeKey(option), position));
				return index;
			}, [addOptions]);
			const [pick, setPick] = React.useState("");
			const [pickInputs, setPickInputs] = React.useState(["text"]);
			const [pickOutputs, setPickOutputs] = React.useState(["text"]);
			const [pickTags, setPickTags] = React.useState([]);
			const [pickFree, setPickFree] = React.useState(false);
			const [tagDraft, setTagDraft] = React.useState("");
			React.useEffect(() => {
				setPick("");
			}, [addOptions]);
			const chosen = pick === "" ? undefined : addOptions[Number(pick)];
			const duplicate = chosen !== undefined
				&& routes.some((route) => entryKey(route, customTags) === entryKey({
					provider: chosen.provider,
					model: chosen.model,
					inputs: pickInputs,
					outputs: pickOutputs,
					tags: pickTags,
				}, customTags));
			const canAdd = chosen !== undefined && !duplicate && disabled !== true;
			const addCustomTag = () => {
				const next = normalizeCustomTags(customTags.concat([tagDraft]));
				if (next.length !== customTags.length) onCustomTagsChange(next);
				setTagDraft("");
			};
			const add = () => {
				if (!canAdd) return;
				props.onChange(routes.concat([{
					provider: chosen.provider,
					model: chosen.model,
					inputs: pickInputs,
					outputs: pickOutputs,
					tags: pickTags,
					free: pickFree === true,
				}]));
				setPick("");
			};
			const move = (position, offset) => {
				const target = position + offset;
				if (target < 0 || target >= routes.length) return;
				const next = routes.slice();
				const moved = next.splice(position, 1)[0];
				next.splice(target, 0, moved);
				props.onChange(next);
			};
			const remove = (position) => {
				props.onChange(routes.filter((_, index) => index !== position));
			};
			const setInputs = (position, inputs) => {
				const current = routes[position];
				const candidate = { ...current, inputs };
				if (routes.some((route, index) => index !== position && entryKey(route, customTags) === entryKey(candidate, customTags))) return;
				props.onChange(routes.map((route, index) => (index === position ? candidate : route)));
			};
			const setOutputs = (position, outputs) => {
				const current = routes[position];
				const candidate = { ...current, outputs };
				if (routes.some((route, index) => index !== position && entryKey(route, customTags) === entryKey(candidate, customTags))) return;
				props.onChange(routes.map((route, index) => (index === position ? candidate : route)));
			};
			const setTags = (position, tags) => {
				const current = routes[position];
				const candidate = { ...current, tags };
				if (routes.some((route, index) => index !== position && entryKey(route, customTags) === entryKey(candidate, customTags))) return;
				props.onChange(routes.map((route, index) => (index === position ? candidate : route)));
			};
			const setFree = (position, free) => {
				props.onChange(routes.map((route, index) => (index === position ? { ...route, free } : route)));
			};
			const untagged = routes.filter((route) => normalizeTags(route.tags, customTags).length === 0).length;
			return h("section", { "aria-labelledby": headingId, style: styles.field },
				h("h3", { id: headingId, style: styles.subtitle }, title),
				h("p", { style: styles.muted }, hint),
				h("p", { style: styles.muted }, t("tagsHint")),
				routes.length > 0
					? h("p", { style: untagged > 0 ? styles.warning : styles.info },
						t("tagsCoverage")
							.replace("{n}", String(routes.length - untagged))
							.replace("{m}", String(routes.length)))
					: null,
				untagged > 0
					? h("p", { style: styles.warning }, t("untaggedHint").replace("{n}", String(untagged)))
					: null,
				h("div", { style: { ...styles.controlRow, flexWrap: "wrap" } },
					h("span", { style: styles.muted }, t("customTags")),
					customTags.map((tag) => h("span", { key: tag, style: styles.tag },
						tag,
						h("button", {
							type: "button",
							"aria-label": `${t("removeTag")}${t("labelSeparator")}${tag}`,
							disabled: disabled === true,
							onClick: () => onCustomTagsChange(customTags.filter((value) => value !== tag)),
							style: styles.chipRemove,
						}, "✕"),
					)),
					h("input", {
						type: "text",
						value: tagDraft,
						placeholder: t("customTagPlaceholder"),
						disabled: disabled === true,
						"aria-label": t("customTags"),
						onChange: (event) => setTagDraft(event.target.value),
						onKeyDown: (event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								addCustomTag();
							}
						},
						style: { ...styles.select, flex: "1 1 140px", minWidth: 120, height: 32, fontSize: 12 },
					}),
					h("button", {
						type: "button",
						disabled: disabled === true,
						onClick: addCustomTag,
						style: styles.addButton,
					}, t("addTag")),
				),				h("div", { style: styles.card },
					routes.length === 0
						? h("p", { style: styles.empty }, t("rangeEmpty"))
						: h("ol", { "aria-label": title, style: styles.rows },
							routes.map((route, position) => {
								const live = lookup.get(routeKey(route));
								const modelName = live === undefined ? route.model : live.modelName;
								const providerName = live === undefined ? route.provider : live.providerName;
								const spoken = `${providerName} ${modelName}`;
								return h("li", {
									key: entryKey(route, customTags),
									style: position === 0 ? styles.row : { ...styles.row, ...styles.rowDivided },
								},
									h("span", { style: styles.rowIndex, "aria-hidden": "true" }, String(position + 1)),
									h("span", { style: styles.rowLabel },
										modelName,
										h("span", { style: styles.rowMeta }, `${providerName} · ${route.provider}/${route.model}`)
									),
									live === undefined ? h("span", { style: styles.tag }, t("unavailableTag")) : null,
									route.tags.length === 0 ? h("span", { style: styles.warningTag }, t("untaggedBadge")) : null,
									h("div", { style: styles.modalityGroups },
										h("div", { style: styles.tagGroupRow },
											h("span", { style: styles.tagGroupLabel }, t("groupInputs")),
											h(ModalityChips, {
												t,
												values: route.inputs,
												disabled,
												spoken,
												onChange: (inputs) => setInputs(position, inputs),
											}),
										),
										h("div", { style: styles.tagGroupRow },
											h("span", { style: styles.tagGroupLabel }, t("groupOutputs")),
											h(ModalityChips, {
												t,
												values: route.outputs,
												disabled,
												spoken,
												onChange: (outputs) => setOutputs(position, outputs),
											}),
										),
										h("div", { style: styles.tagGroupRow },
											h("span", { style: styles.tagGroupLabel }, t("groupCapabilities")),
											h(TagChips, {
												t,
												tags: route.tags,
												extraTags: customTags,
												disabled,
												spoken,
												onChange: (tags) => setTags(position, tags),
											}),
										),
									),
									h("label", { style: styles.freeToggle },
										h("input", {
											type: "checkbox",
											checked: route.free === true,
											disabled: disabled === true,
											"aria-label": `${t("freeLabel")}${t("labelSeparator")}${spoken}`,
											onChange: (event) => setFree(position, event.target.checked),
											style: {
												width: 14,
												height: 14,
												accentColor: "var(--dsw-alias-button-primary-fill)",
												cursor: disabled === true ? "default" : "pointer",
											},
										}),
										t("freeLabel")
									),
									h(IconButton, {
										label: `${t("moveUp")}${t("labelSeparator")}${spoken}`,
										glyph: "↑",
										disabled: disabled === true || position === 0,
										onClick: () => move(position, -1),
									}),
									h(IconButton, {
										label: `${t("moveDown")}${t("labelSeparator")}${spoken}`,
										glyph: "↓",
										disabled: disabled === true || position === routes.length - 1,
										onClick: () => move(position, 1),
									}),
									h(IconButton, {
										label: `${t("remove")}${t("labelSeparator")}${spoken}`,
										glyph: "✕",
										danger: true,
										disabled: disabled === true,
										onClick: () => remove(position),
									})
								);
							})
						),
					h("div", { style: { ...styles.controlRow, flexWrap: "wrap" } },
						h("select", {
							"aria-label": `${t("add")}${t("labelSeparator")}${title}`,
							value: pick,
							disabled: disabled === true || addOptions.length === 0,
							onChange: (event) => setPick(event.target.value),
							style: disabled === true || addOptions.length === 0
								? styles.selectDisabled
								: styles.select,
						},
							h("option", { value: "" }, addOptions.length === 0
								? (catalogLoading === true ? t("loading") : t("catalogEmpty"))
								: t("chooseModel")),
							groups.map((group) => h("optgroup", { label: group.name, key: group.id },
								group.models.map((model) => h("option", {
									key: `${group.id}/${model.id}`,
									value: String(optionIndex.get(routeKey({ provider: group.id, model: model.id }))),
								}, `${model.name} · ${group.name}`))
							))
						),
						h("label", { style: styles.freeToggle },
							h("input", {
								type: "checkbox",
								checked: pickFree,
								disabled: disabled === true,
								"aria-label": `${t("add")}${t("labelSeparator")}${t("freeLabel")}`,
								onChange: (event) => setPickFree(event.target.checked),
								style: {
									width: 14,
									height: 14,
									accentColor: "var(--dsw-alias-button-primary-fill)",
									cursor: disabled === true ? "default" : "pointer",
								},
							}),
							t("freeLabel")
						),
						h(PrimaryButton, { label: t("add"), disabled: !canAdd, onClick: add })
					)
				)
			);
		}

		/**
		 * One grouped model picker (main model or fallback): writes both host
		 * fields atomically and keeps a saved-but-missing choice visible.
		 * @param props - locale, section copy, host groups, saved route, and write action.
		 * @returns the picker section.
		 */
		function SingleModelEditor(props) {
			const { t, groups, provider, model, disabled, title, hint, emptyLabel } = props;
			const headingId = React.useId();
			const options = React.useMemo(() => flattenRoutes(groups), [groups]);
			const optionIndex = React.useMemo(() => {
				const index = new Map();
				options.forEach((option, position) => index.set(routeKey(option), position));
				return index;
			}, [options]);
			const hasValue = provider !== "" && model !== "";
			const livePosition = hasValue ? (optionIndex.get(routeKey({ provider, model })) ?? -1) : -1;
			const missing = hasValue && livePosition === -1;
			const value = livePosition >= 0
				? String(livePosition)
				: (missing ? String(options.length) : "");
			const inert = disabled === true || (options.length === 0 && !missing);
			const change = (event) => {
				const position = Number(event.target.value);
				if (!Number.isInteger(position) || position < 0) return;
				const option = position < options.length
					? options[position]
					: (missing ? { provider, model } : undefined);
				if (option === undefined) return;
				props.onSelect(option.provider, option.model);
			};
			return h("section", { "aria-labelledby": headingId, style: styles.field },
				h("h3", { id: headingId, style: styles.subtitle }, title),
				h("p", { style: styles.muted }, hint),
				h("div", { style: styles.card },
					h("div", { style: styles.controlRow },
						h("select", {
							"aria-label": title,
							value,
							disabled: inert,
							onChange: change,
							style: inert ? styles.selectDisabled : styles.select,
						},
							hasValue ? null : h("option", { value: "" }, emptyLabel),
							groups.map((group) => h("optgroup", { label: group.name, key: group.id },
								group.models.map((entry) => h("option", {
									key: `${group.id}/${entry.id}`,
									value: String(optionIndex.get(routeKey({ provider: group.id, model: entry.id }))),
								}, `${entry.name} · ${group.name}`))
							)),
							missing
								? h("optgroup", { label: t("unavailableTag"), key: "saved-unavailable" },
									h("option", { value: String(options.length) }, `${provider} / ${model}`))
								: null
						)
					)
				)
			);
		}

		/**
		 * One labelled checkbox with a description and auto-saved write action.
		 * @param props - field identity, copy, current value, disabled flag, and write action.
		 * @returns the toggle row.
		 */
		function ToggleField(props) {
			const { id, label, hint, value, disabled, onChange } = props;
			const hintId = `${id}-hint`;
			return h("div", { style: styles.numberRow },
				h("div", { style: styles.numberText },
					h("label", { htmlFor: id, style: styles.numberLabel }, label),
					h("p", { id: hintId, style: styles.muted }, hint)
				),
				h("input", {
					id,
					type: "checkbox",
					checked: value === true,
					disabled,
					"aria-describedby": hintId,
					onChange: (event) => onChange(event.target.checked),
					style: {
						flex: "none",
						width: 18,
						height: 18,
						accentColor: "var(--dsw-alias-button-primary-fill)",
						cursor: disabled ? "default" : "pointer",
					},
				})
			);
		}

		/**
		 * Compact advanced settings: the context-window and output-token overrides.
		 * @param props - locale, form value, and field write action.
		 * @returns the advanced section.
		 */
		function AdvancedFields(props) {
			const { t, value, disabled, onChange } = props;
			const headingId = React.useId();
			return h("section", { "aria-labelledby": headingId, style: styles.field },
				h("h3", { id: headingId, style: styles.subtitle }, t("advancedTitle")),
				h("div", { style: styles.card },
					h(NumberField, {
						id: "auto-model-context-window",
						t,
						label: t("contextWindow"),
						hint: t("contextWindowHint"),
						value: readCount(value, "contextWindow"),
						disabled,
						onCommit: (next) => onChange("contextWindow", next),
					}),
					h("div", { style: styles.numberDivided },
						h(NumberField, {
							id: "auto-model-max-tokens",
							t,
							label: t("maxTokens"),
							hint: t("maxTokensHint"),
							value: readCount(value, "maxTokens"),
							disabled,
							onCommit: (next) => onChange("maxTokens", next),
						})
					)
				)
			);
		}

		/**
		 * The Auto model page: live form values auto-saved, host catalog driven.
		 * @param props - injected `form`, locale reader `t`, and `remote` service.
		 * @returns the settings section.
		 */
		function AutoModelPage(props) {
			const { form, t, remote } = props;
			const subscribe = React.useCallback((listener) => form.subscribe(listener), [form]);
			const getSnapshot = React.useCallback(() => form.getSnapshot(), [form]);
			const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
			const { catalog, reload } = useModelCatalog(remote);
			const autosave = useAutoSave(form);
			const groups = catalog.groups;
			const lookup = React.useMemo(() => indexRoutes(groups), [groups]);
			const value = snapshot.value !== null && typeof snapshot.value === "object" ? snapshot.value : {};
			const writable = snapshot.status === "ready" && snapshot.writable === true;
			const readOnly = snapshot.status === "ready" && snapshot.writable !== true;
			const selectMain = (provider, model) => {
				autosave.setMany([
					{ op: "set", path: ["mainProvider"], value: provider },
					{ op: "set", path: ["mainModel"], value: model },
				]);
			};
			const selectFallback = (provider, model) => {
				autosave.setMany([
					{ op: "set", path: ["fallbackProvider"], value: provider },
					{ op: "set", path: ["fallbackModel"], value: model },
				]);
			};
			const body = snapshot.status !== "ready" ? null : h("div", { style: styles.body },
				h(SingleModelEditor, {
					t,
					groups,
					title: t("mainTitle"),
					hint: t("mainHint"),
					emptyLabel: t("mainEmpty"),
					provider: readString(value, "mainProvider"),
					model: readString(value, "mainModel"),
					disabled: !writable,
					onSelect: selectMain,
				}),
				h("p", { style: styles.muted }, t("orderHint")),
				h(CandidateRangeEditor, {
					t,
					title: t("subTitle"),
					hint: t("subHint"),
					groups,
					lookup,
					routes: readRoutes(value, "subModels", value.customTags),
					customTags: normalizeCustomTags(value.customTags),
					onCustomTagsChange: (next) => autosave.setField("customTags", next),
					disabled: !writable,
					catalogLoading: catalog.status === "loading",
					onChange: (next) => autosave.setField("subModels", next),
				}),
				h(SingleModelEditor, {
					t,
					groups,
					title: t("fallbackTitle"),
					hint: t("fallbackHint"),
					emptyLabel: t("fallbackEmpty"),
					provider: readString(value, "fallbackProvider"),
					model: readString(value, "fallbackModel"),
					disabled: !writable,
					onSelect: selectFallback,
				}),
				h("p", { style: styles.muted }, t("imageNote")),
				h("section", { style: styles.field },
					h("div", { style: styles.card },
						h(ToggleField, {
							id: "auto-model-prefer-free",
							label: t("preferFree"),
							hint: t("preferFreeHint"),
							value: value.preferFreeModels === true,
							disabled: !writable,
							onChange: (next) => autosave.setField("preferFreeModels", next),
						}),
						h("div", { style: styles.numberDivided },
							h(ToggleField, {
								id: "auto-model-show-route",
								label: t("showRoute"),
								hint: t("showRouteHint"),
								value: value.showRoute !== false,
								disabled: !writable,
								onChange: (next) => autosave.setField("showRoute", next),
							})
						),
						h("div", { style: styles.numberDivided },
							h(ToggleField, {
								id: "auto-model-expose-keys",
								label: t("exposeApiKeys"),
								hint: t("exposeApiKeysHint"),
								value: value.exposeApiKeys === true,
								disabled: !writable,
								onChange: (next) => autosave.setField("exposeApiKeys", next),
							})
						)
					)
				),
				h(AdvancedFields, {
					t,
					value,
					disabled: !writable,
					onChange: (field, next) => autosave.setField(field, next),
				})
			);
			return h("div", { style: styles.section },
				h("h2", { style: styles.title }, t("title")),
				h("p", { style: styles.intro }, t("intro")),
				h("ul", { style: styles.legend, "aria-label": t("title") },
					[
						["legendMain", "legendMainDesc"],
						["legendSub", "legendSubDesc"],
						["legendShow", "legendShowDesc"],
					].map(([name, description]) => h("li", { key: name },
						h("strong", { style: styles.legendTerm }, t(name)),
						`${t("legendSeparator")}${t(description)}`))
				),
				snapshot.status === "loading"
					? h("p", { role: "status", style: styles.muted }, t("loadingSettings"))
					: null,
				snapshot.status === "unavailable"
					? h("p", { style: styles.muted }, t("unavailable"))
					: null,
				readOnly
					? h("p", { style: styles.muted }, t("readOnly"))
					: null,
				autosave.failed
					? h("p", { role: "alert", style: styles.error }, t("saveFailed"))
					: autosave.saving
						? h("p", { role: "status", style: styles.muted }, t("saving"))
						: null,
				snapshot.status === "ready" && catalog.status === "error"
					? h("div", { role: "alert", style: styles.catalogError },
						h("span", { style: styles.error }, t("catalogLoadFailed")),
						h(TextButton, { label: t("retry"), onClick: reload }))
					: null,
				snapshot.status === "ready" && catalog.status === "ready" && groups.length === 0
					? h("p", { style: styles.muted }, t("catalogEmpty"))
					: null,
				snapshot.status === "ready" && catalog.status === "ready" && catalog.failures > 0
					? h("p", { style: styles.muted }, t("catalogPartial"))
					: null,
				body
			);
		}

		/**
		 * Slot entry point: renders the page, or its unavailable notice before
		 * the shared form is injected.
		 * @param props - slot props merged with the registration's inject face.
		 * @returns the settings section.
		 */
		function AutoModelSection(props) {
			if (props.form === undefined || props.form === null) {
				return h("div", { style: styles.section },
					h("p", { style: styles.muted }, props.t("unavailable")));
			}
			return h(AutoModelPage, props);
		}

		/** Required services (cordis fiber inject). */
		const inject = ["slots", "locale", "remote", "remote.session", "configForms"];

		/**
		 * Mount the Auto model settings page while the Host serves the
		 * `auto-model` settings namespace.
		 * @param ctx - the browser plugin context.
		 */
		function apply(ctx) {
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "auto-model: dictionaries");
			const form = ctx.configForms.get("auto-model");
			ctx.effect(() => ctx.configForms.whileServed(["auto-model"], () => ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "auto-model",
				order: 30,
				label: () => t("nav"),
				locale: NS,
				inject: () => ({ form, t, remote: ctx.remote }),
			}, AutoModelSection))), "auto-model: page");
		}

		exports.NS = NS;
		exports.inject = inject;
		exports.apply = apply;
		return module.exports;
	},
});
