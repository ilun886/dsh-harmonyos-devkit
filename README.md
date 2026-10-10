# dsh-harmonyos-arkts

HarmonyOS / ArkTS 开发套件，打包为 **一个 DSH 组合包（bundle）**。

装上它，DSH 就同时具备：ArkTS·ArkUI 规则库（按需查询）、离线 ArkTS 静态检查、**44 个鸿蒙官方 skill（全量）**、以及可选的 devecocli MCP（HarmonyOS LSP）。无需再手工改 `cordis.patch.yml`、手工复制 skill 目录。

---

## 它提供什么

| 能力 | 载体 | 说明 |
|---|---|---|
| `arkts_rules` 工具 | 本包 `rules/` | ArkTS/ArkUI 规则库：致命陷阱清单 + API 速查。写 `.ets` 前先查 |
| `arkts_check` 工具 | 本包 `skills/.../linter-cli` | 离线 ArkTS 静态检查，**秒级、无需工程 READY** |
| **44 个鸿蒙 skill** | 本包 `skills/` | 官方 `devecocli skills` 全量，见下 |
| 规则库提示词 | 本包 `lib/index.js` | 只在 `arkts_rules` 可见时注入，不污染无关会话 |
| `mcp__deveco__*`（可选） | devecocli MCP | HarmonyOS LSP：hover / definition / references / documentSymbol / callHierarchy |

### 捆绑的 44 个 skill（按主题）

**ArkTS / ArkUI 开发**

| Skill | 用途 |
|---|---|
| `hmos-arkui-develop-skill` | 写 `.ets` 前必加载：致命陷阱清单 + 组件→规则交叉表 |
| `hmos-arkts-knowledge-retriever` | ArkTS 文档检索（**并自带 `arkts_check` 依赖的 `linter-cli`**） |
| `hmos-arkui-knowledge-retriever` | ArkUI 文档检索（809 篇 md） |
| `hmos-arkts-syntax-checker` | 静态检查 + 循环构建到成功 |
| `hmos-arkui-mvvm-pattern` / `hmos-arkui-statemgt-migration` | MVVM 模式 / 状态管理迁移 |
| `hmos-arkui-longtake-transition` | 长时转场动画 |
| `hmos-arkts-deprecated-interface-checker` | 废弃接口替换检查 |

**DFX / 稳定性分析**（多数含 Python 脚本）

| Skill | 用途 |
|---|---|
| `hmos-jscrash-analysis` / `hmos-runtime-fix-skill` | JS Crash 日志分析 / 运行时崩溃修复 |
| `hmos-cppcrash-analysis` / `hmos-appfreeze-analysis` | C++ 崩溃 / 应用卡死 |
| `hmos-memleak-analysis` / `hmos-native-memleak-analysis` / `hmos-jsleak-analysis` / `hmos-fdleak-analysis` | 内存 / 原生内存 / JS 泄漏 / FD 泄漏 |
| `hmos-apifault-analysis` | API 故障分析 |

**Kit 集成**

`hmos-push-kit`、`hmos-account-kit-quicklogin-client`、`hmos-map-kit-{map-creation,route-planning,poi-search}`、`hmos-scan-kit-{defaultscan,customscan}`、`hmos-payment-kit-huawei-payment-integration`、`hmos-ads-kit-access`、`hmos-live-view-kit-build-location`

**多设备 / 折叠屏**

`hmos-multidevice-{scenario-entry,screen-window-size,avoid-areas,hardware-access,natural-orientation,fold-state,interaction-methods}`

**测试 / 迁移 / 其它**

`hmos-local-test`、`hmos-instrument-test`、`hmos-ascf-convert-{uniapp,taro}`、`hmos-ascf-assistant`、`hmos-atomicservice-assistant`、`hmos-one-sdk-skill`、`hmos-connect-api-cli-skill`、`hmos-design-visual-mobile`、`app-metadata-audit-skill`

> ⚠️ 其中两个 skill 带**未签名的 Windows exe**（`hmos-jsleak-analysis` 的 `rawheap_translator.exe` 0.9 MB、`hmos-native-memleak-analysis` 的 `trace_streamer_windows.exe` 16.9 MB）。来自华为官方仓库但无 Authenticode 签名，仅在跑对应分析时才被调用。
>
> 11 个 skill 带 Python 脚本（共 86 个 `.py`），本机 Python 3.12.5 可用；个别脚本可能还需 `pip install` 额外依赖。

---

## ⚠️ Windows 克隆：必须用短路径（否则会静默缺文件）

本仓库内含超深目录嵌套，**最长相对路径达 240 字符**（位于
`skills/hmos-one-sdk-skill/.../hiappevent-watcher-resourceleak-events-arkts/`）。
Windows 的经典路径上限是 260 字符，因此：

| 克隆到 | 结果 |
|---|---|
| `D:\t`（2 字符） | ✅ 完整 4749 文件 |
| `D:\dsh-harmonyos-arkts`（23 字符） | ❌ **121 个文件创建失败** |

**克隆者拿不到 `core.longpaths` 配置**（它是本地设置，不会随仓库分发），所以克隆时
不会报"配置缺失"，而是直接抛一串：

```
error: unable to create file ...: Filename too long
```

**注意 `git clone` 在这种情况下仍返回 exit code 0**——不检查文件数就会以为成功了。

三种解法，任选其一：

```powershell
# ① 克隆到短路径（推荐，零配置）
git clone <url> D:\t

# ② 克隆时显式开启长路径支持
git -c core.longpaths=true clone <url> <任意路径>

# ③ 先开全局长路径（一次生效，需管理员）
git config --global core.longpaths true
#    可选：同时开启 Windows 系统级支持（Win10 1607+，需管理员 + 重启）
#    New-ItemProperty HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem `
#      -Name LongPathsEnabled -Value 1 -PropertyType DWord -Force
```

克隆后请自检文件数应为 **4749**：

```powershell
(Get-ChildItem . -Recurse -File -Force |
  Where-Object { $_.FullName -notmatch '\\\.git\\' }).Count
```

---

## 安装

```powershell
dsh plugin --profile desktop add link:D:\dsh-harmonyos-arkts
```

装完**重启 DSH**（MCP 与技能目录在启动时注册）。回滚：

```powershell
dsh plugin --profile desktop remove dsh-harmonyos-arkts
```

---

## 两个工具怎么用

### `arkts_rules`

```
arkts_rules                      → 规则总索引（含"组件→规则文件"交叉表）
arkts_rules { query: "..." }     → 全库关键词检索
arkts_rules { file: "05-state.md" }            → 读某一篇
arkts_rules { file: "05-state.md", offset: 1, limit: 50 }  → 按行窗口读
arkts_rules { listFiles: true }  → 列出全部 35 个规则文件
```

规则库重点覆盖：V1/V2 状态管理不混用、禁用 `any` 与匿名对象字面量、Navigation 路由栈、
`@kit.*` 真实成员、以及"构造参数字段名凭记忆编造"这类编译必挂项。

### `arkts_check`

```
arkts_check { files: ["D:\\proj\\entry\\src\\main\\ets\\pages\\Index.ets"] }
```

实测输出：

```
3 error(s), 0 warning(s)

ERROR .../BadPage.ets:8:17 Use explicit types instead of "any", "unknown" (arkts-no-any-unknown)
ERROR .../BadPage.ets:11:20 Object literal must correspond to some explicitly declared class or interface (arkts-no-untyped-obj-literals)
ERROR .../BadPage.ets:26:11 Use "let" instead of "var" (arkts-no-var)
```

SDK 路径自动探测（`DEVECO_SDK_HOME` → 标准 DevEco 安装路径）；排查问题时可用
`sdkPath` / `projectRoot` / `moduleRoot` / `moduleJson` 覆盖。

#### ⚠️ `--sdk-path` 必须指到 `sdk\default`，不能指 `sdk` 根

这是本包踩过的最阴的坑，**会伪造错误**。DevEco 的布局比 linter-cli 预期的多一层：

```
D:\DevEco Studio\sdk\default\openharmony\ets
                     ^^^^^^^ 必须包含这一层
```

实测（API 26 SDK + 官方模板 `EntryAbility.ets`，该文件本身完全正确）：

| 传给 `--sdk-path` | 诊断数 |
|---|---|
| `D:\DevEco Studio\sdk` | **5 条（全是假阳性）** |
| `D:\DevEco Studio\sdk\default` | 0 条 |
| `D:\DevEco Studio\sdk\default\openharmony` | 0 条 |
| 完全不传 | 5 条 |

假阳性长这样——3 条 `Cannot find module '@kit.AbilityKit'` 之类，外加因类型丢失**连锁**
产生的 `Property 'context' does not exist on type 'EntryAbility'` 与 `arkts-no-any-unknown`。
最坏的结果是照着它去"修"官方模板里本来正确的代码。

本包已内置归一化（`resolveSdkRoot()`）：给 `sdk` 根或 `default` 层都会自动落到正确层级，
显式传 `sdkPath` 也一并归一化。**别绕过本工具直接调 linter-cli。**


---

## 三个必须知道的坑

这些是**本机实测**结论，不是推测：

**1. `devecocli check lint` 是坏的。** 在 DevEco 自带模板、ASCII 探针工程、以及真实的
活跃工程上，一律返回 `Files checked: 0`（报告文件照常生成，内容就是空）。**别依赖它** ——
用本包的 `arkts_check`。

**2. `linter-cli` 的 `--input` 只能给一个文件。** 重复传入只有**最后一个**生效，前面的被
静默丢弃（会漏报）。本包已按"每文件单独起一次进程"处理，所以传多个文件是安全的。

**3. 鸿蒙工程不能放在含非 ASCII 字符的路径下。** 例如 `D:\新建文件夹 (2)`：

```
hvigor ERROR: 00306003 Invalid project path.
Current path does not match: D:\新建文件夹 (2)\...
```

`build` / `sync` / MCP 检查全部会失败。工程请放纯 ASCII 路径。

---

## 启用 devecocli MCP（可选）

该 MCP 是 **单工程绑定**的：`PROJECT_PATH` 写死在配置里，一次只对一个鸿蒙工程有效。
默认**关闭**，因为工程路径为空时它只会产生启动噪音。

启用步骤：

```powershell
setx DSH_HARMONY_PROJECT "C:\Users\86198\DevEcoStudioProjects\MyApplication"
```

然后重启 DSH。换工程 = 改这个变量 + 重启。

**为什么默认关？** 本机的 `dsh-mcp-client` 未实现 MCP 的 `roots` 能力
（`lib/index.js` 里搜不到 `listRoots`），服务端无法从客户端自动探测工程，所以路径必须显式给。

**为什么用 `node` + `cli.js` 绝对路径？** npm 生成的 `devecocli.cmd` / `.ps1` 是包装脚本，
MCP 的 stdio spawn 不经过 shell、无法执行；`cli.js` 才是真实入口。可用环境变量覆盖：
`DSH_DEVECO_NODE`、`DSH_DEVECO_CLI`。

**注意**：此 MCP 需工程先完成 `ohpm install` + `hvigor sync` 才可用，冷启动可能要 1 分钟以上
（已把 `toolCallTimeoutMs` 调到 180 秒）。日常改完 `.ets` 想立刻自检，`arkts_check` 更快。

---

## 目录结构

```
dsh-harmonyos-arkts/                    # 173.8 MB（其中 skills 173.5 MB）
├── package.json                     # dsh.bundle.patch 指向下面的 patch
├── cordis.patch.yml                 # 挂载声明：本插件 + MCP（共 2 行）
├── lib/index.js                     # skills 注册 + arkts_rules + arkts_check + 提示词
├── scripts/build-skill-manifest.mjs # 构建期：从 SKILL.md 抽 frontmatter 生成清单
├── rules/                           # 规则库（quick-rules 16 篇 + quick-apis 19 篇）
└── skills/
    ├── _manifest.json               # 由上面的脚本生成，运行时只读它（免 YAML 依赖）
    └── <44 个鸿蒙 skill>/           # 官方 devecocli skills 全量
```

---

## 增删 skill（以及为何不能直接拷目录）

skill 清单是**构建期快照**：`lib/index.js` 运行时只读 `skills/_manifest.json`，
不从磁盘重扫 SKILL.md（避免运行时依赖 YAML 解析器）。所以**新增或删除 skill 后，
必须重跑清单脚本，否则改动不生效**：

```powershell
node scripts\build-skill-manifest.mjs
```

从官方仓库批量安装（`--path` 可绕过「`skills add` 不支持 DSH」的限制）：

```powershell
# 目录必须预先存在，否则报 "Directory not found"
New-Item -ItemType Directory -Path D:\__skill_stage -Force
devecocli skills add --all --path D:\__skill_stage

# 挑单个装（注意：多个 --skill 只有最后一个生效，和 linter-cli --input 同一个坑）
devecocli skills add --skill hmos-push-kit --path D:\__skill_stage
```

⚠️ **装完务必清理 `linter-cache/`**。跑过 `arkts_check` 后，
`skills/hmos-arkts-knowledge-retriever/linter-cli/bin/linter-cache/` 会生成缓存
（`.tsbuildinfo` + 按**本机绝对路径**命名的 `sdk-configs/`）。这些是机器相关的产物，
不应进包：

```powershell
Get-ChildItem skills -Recurse -Directory -Filter linter-cache | Remove-Item -Recurse -Force
```

---

## 改代码后必须重启 DSH

**这是本包开发时最容易踩的坑。** Node 的 ESM 加载器按 URL 记忆已求值的模块，
`set_bundle` 启停**不会**清掉这个缓存：

- 若旧版模块**求值成功**（哪怕 `apply()` 里抛错），改完文件后再次启用，
  **运行中的仍是旧代码**，看起来像"改了没生效"。
- 只有**进程重启**才会重新读盘。

所以改完 `lib/index.js`（或任何被 import 的文件）后：**重启 DSH**，别指望热重载。
patch（`cordis.patch.yml`）倒是每次启用都会重读，所以增删 patch 行不必重启。

> 实测记录：磁盘上的文件已改成零外部依赖（`import` 只有 4 个 `node:` 内置模块，
> junction 与真实文件 MD5 一致），但运行中的宿主仍报旧的
> `Cannot find module '@deepseek-ai/dsh-tools'` —— 就是被这个缓存钉住了。

---

## 实现要点（改代码前先读）

- **本插件零外部依赖：不 import 任何 harness 包，也不 import 任何第三方包**，只用 `node:`
  内置模块。这不是洁癖，是必须：
  - DSH 启动时装了模块解析路由（`dsh-app-boot` 的 `ResolutionRouter`），它按插件
    **真实路径**算 `require.resolve.paths()` 来决定能解析哪些包。本包以 `link:` 装成
    junction 时真实路径在工作区（如 `D:\dsh-harmonyos-arkts`），从那儿向上**找不到**
    `~/.dsh/profiles/node_modules` → 裸包名解析必然失败。
  - 在 `package.json` 里声明 `dependencies` / `peerDependencies` **也救不了**：搜索路径
    同样从真实路径算起。
  - 于是改为手写 JSON Schema。`defineTool` 本身只做「参数规格 → JSON Schema 编译」+ 入参
    校验，这里直接给出**原生 JSON Schema**（`type`/`oneOf`/`properties`/`required`/
    `additionalProperties`/`items`/`enum`/`const` + 注记），并自行校验入参，行为等价。
    已用真实的 `assertSupportedJsonSchema` 验证两个 schema 均通过。
  - ⚠️ 注意方言差异：原生 JSON Schema 的**必填写在对象级 `required: [...]` 数组**里，
    不是 `defineTool` ParameterSchemaSpec 的字段级 `required: true`。
  - ⚠️ **可选字段必须"解构删除"，不能"条件展开补"**。`arkts_check` 曾经这样写：
    ```js
    issues: result.issues.map((i) => ({ ...i, ...(i.rule === null ? {} : { rule: i.rule }) }))
    ```
    这是错的 —— 展开空对象**不会删除**已存在的 `rule: null`，而 schema 声明 `rule` 是
    string，结果整个工具调用失败：`tool "arkts_check" returned invalid output:
    "value.issues[0].rule" must be a string`。正确写法是先解构掉再按需加回：
    ```js
    issues: result.issues.map(({ rule, ...rest }) => rule === null ? rest : { ...rest, rule })
    ```
    （对照：官方 `dsh-mcp-client` 的 `supportedOutputSchema()` 遇到不支持的结构是**丢弃整个
    schema** 而不是报错 —— 说明 harness 对输出结构是**严格校验**的，别指望它宽容。）
  - ⚠️ **`--sdk-path` 的层级陷阱**（最阴的一个，细节见上文 `arkts_check` 章节）：
    指到 `sdk` 根会伪造 5 条假阳性，指到 `sdk\default` 才是 0 条。代码里由
    `resolveSdkRoot()` 统一归一化。

- **skills 由代码注册，不用 patch 的 `bundledSkillDir`。** 后者要拼绝对路径，而
  可用作锚点的环境变量在 host 进程里并不存在 —— **host 进程里没有 `DSH_PROFILE_DIR`**
  （该变量只由 `dsh-shell-env` 注入给 shell 子进程，不写给 host）。首版据此配置导致挂载
  失败，现改为 `import.meta.url` 定位 + `ctx.skills.register()`。
- **skill 元数据取自构建期生成的 `skills/_manifest.json`**，避免运行时依赖 YAML 解析器
  （`description` 里有 `>` 折叠块和引号，正则硬解不可靠）。新增/修改 skill 后重跑：
  ```powershell
  node scripts\build-skill-manifest.mjs
  ```
- **自带资源用 `import.meta.url` 定位**（`rules/`、`skills/`）—— 在 `link:` 与 copy 两种
  安装下都正确。
- **`linter-cli` 必须从它自己的目录启动**（`cwd`），否则它 `node_modules/typescript` 里的
  OpenHarmony 定制版编译器解析不到。
- **`linter-cli` 的 `--input` 一次只能给一个文件**（重复传入仅最后一个生效，其余静默丢弃
  → 假阴性），且其默认 `linter-cache/` 固定在自身安装目录下，所以必须**逐文件串行**执行。
- **诊断写在 stderr 且带 ANSI 颜色码。** 上游把 ERROR/WARN 写 stderr、只把 FAQ 提示写
  stdout；且带 `\x1b[31m` 前缀。只看 stdout 或不去色都会漏报，代码里已处理。
- **patch 里的 `!!js` 表达式**在 loader 的 `with(ctx)` 作用域求值：`process.env` 与
  `dshHomePath()` 可用，`require` / `__dirname` **不可用**。

## 许可

MIT。捆绑的 `linter-cli` 与 skills 来自
[HarmonyOS_Skills/harmonyos-agent-skills](https://gitcode.com/HarmonyOS_Skills/harmonyos-agent-skills)，
`linter-cli` 内含上游 OpenHarmony 定制版 TypeScript，遵循其原始许可。
