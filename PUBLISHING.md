# 发布指南

本仓库已按 DSH 组合包（bundle）规范准备就绪，可发布到 npm 并提交到社区市场。

## 发布到 npm

```bash
npm login
npm publish --access public
```

验证：

```bash
dsh plugin --profile web add dsh-auto-model
```

发布前确认 `engines.dsh` 覆盖目标 DSH 版本，`npm test` 通过。

发布成功后，可在 README 顶部补回 npm 版本徽章：

```markdown
[![npm](https://img.shields.io/npm/v/dsh-auto-model)](https://www.npmjs.com/package/dsh-auto-model)
```

## 进入市场

### dshmarket

目录来自 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)：

1. Fork 该仓库；
2. 在插件列表里按格式加一行：
   ```markdown
   - [dsh-auto-model](https://github.com/vener0/dsh-auto-model) - 由主模型为每个任务选择副模型（自动路由、标签、失败兜底）。
   ```
3. 提交 PR，合并后一般一天内自动收录。

### dsh.so

打开 <https://www.dsh.so/zh/submit/>，粘贴仓库或 npm 包名，检查器会校验格式、许可证、README 并做安全扫描；通过后提交。

### 内置 Discover（可选）

DSH 的 Discover 读取用户配置的 format-1 索引。把 `market-index.example.json` 改成真实域名/时间戳后托管到任意 HTTPS 静态位置，用户在 **Plugins → Discover → Index sources** 添加该 URL 即可。

## 版本

- 严格遵循 SemVer，每次发布更新 `CHANGELOG.md`；
- dshmarket 目前不支持原地升级，升级需卸载后重装；
- 发现 DSH 新版本改动 `ctx.llm` API 时，及时更新 `engines.dsh`。

## 推送重试

GitHub 连接不稳时，用仓库内的重试脚本反复推送，直到远端 tag 指向本地 HEAD：

```powershell
pwsh -File scripts/push-retry.ps1
```

可调参数：`-IntervalSeconds 10`（重试间隔）、`-MaxAttempts 0`（0 = 一直重试）、`-SkipMain`（只推 tag）。

## 安全

- 不要提交 API Key、token、个人路径；
- `exposeApiKeys` 默认关闭，开启会把真实 Key 发给主模型提供方（README 已说明风险）；
- 插件不发起外部网络请求，只通过 DSH 的 `ctx.llm.stream` 调模型；
- 不混淆、不压缩源码，方便社区与市场扫描。
