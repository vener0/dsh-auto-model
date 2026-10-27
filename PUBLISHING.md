# 发布指南（Publishing）

本仓库已经按 DSH 组合包（bundle）规范准备就绪，可以发布到 npm 并提交到社区插件市场。

## 1. 发布前检查

- [ ] `package.json` 里的 `name` 改成你的 npm 包名（已改为 `dsh-auto-model`，可换成 `@yourscope/dsh-auto-model`）
- [ ] `author`、`homepage`、`repository`、`bugs` 填上真实地址
- [ ] `engines.dsh` 覆盖你要支持的 DSH 版本（当前 `^0.2.1-rc.2`）
- [ ] `npm test` 通过
- [ ] `README.md` 有安装与使用说明
- [ ] `LICENSE` 为 SPDX 可识别许可证（MIT）

## 2. 发布到 npm

```bash
npm login
npm publish --access public
```

安装验证：

```bash
dsh plugin --profile web add dsh-auto-model
```

> 如果包名带 scope 且是私有 scope，需要 `--access public`（上面的命令已带）。

## 3. 发布到 GitHub

- 新建公开仓库，推送本目录；
- 给仓库加 topic：`dsh-plugin`（市场会自动索引）；
- 建议开启 Discussions / Issues；
- Release 与 npm 版本保持一致。

Git 源安装（可用于预发布测试）：

```bash
dsh plugin --profile web add github:<owner>/<repo>#<40位commit>
```

## 4. 进入市场

### 4.1 dshmarket（社区市场 App）

目录来自 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)：

1. Fork 该仓库；
2. 在插件列表里按格式加一行：
   ```markdown
   - [dsh-auto-model](https://github.com/<owner>/dsh-auto-model) - 由主模型为每个任务选择副模型（自动路由、标签、失败兜底）。
   ```
3. 提交 PR，合并后 dshmarket 与站点一般一天内自动收录。

### 4.2 dsh.so

打开 <https://www.dsh.so/zh/submit/>，粘贴 GitHub 仓库或 npm 包名，检查器会校验格式、许可证、README 与安全扫描；通过后点击“提交到 dsh.so”。

### 4.3 DSH 内置 Discover（可选）

DSH 的 Discover 读取用户配置的 format-1 索引。你可以托管 `market-index.example.json`（改成真实域名/时间戳）到任意 HTTPS 静态位置，例如 GitHub Pages：

```bash
cp market-index.example.json docs/index.json
```

用户随后在 **Plugins → Discover → Index sources** 添加该 URL。

## 5. 版本与升级

- 严格遵循 SemVer；
- dshmarket 目前不支持原地升级：用户需要卸载再安装新版本；
- 每次发布更新 `CHANGELOG.md`（建议下一版本补上）。

## 6. 安全说明

- 不要提交 API Key、token、个人路径；
- `exposeApiKeys` 关闭时不会把真实 Key 发给任何模型；开启是显式风险选项，README 已说明；
- 插件本身不发起外部网络请求，只通过 DSH 的 `ctx.llm.stream` 调用模型；
- 不混淆、不压缩源码，方便社区与市场安全扫描。

## 7. 发布后的维护

- 关注 DSH 新版本对 `ctx.llm` API 的变化，及时更新 `engines.dsh`；
- 收集 issue，优先修复“路由选错/失败兜底”类问题；
- 若计划做付费 Pro 功能，建议核心路由保持 MIT，Pro 走独立包或服务，避免破坏社区信任。
