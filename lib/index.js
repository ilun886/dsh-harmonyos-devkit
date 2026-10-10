/**
 * dsh-harmonyos-arkts — HarmonyOS / ArkTS 开发套件（DSH 组合包）
 *
 * 本文件提供全部四件能力：
 *   1. 5 个鸿蒙 skill      —— 从捆绑的 skills/ 读取并注册（无需环境变量指路）
 *   2. `arkts_rules`       —— 按需读取捆绑的 ArkTS/ArkUI 规则库（rules/）
 *   3. `arkts_check`       —— 离线静态检查（捆绑 linter-cli，无需工程 READY）
 *   4. 规则库提示词        —— 仅当 arkts_rules 对本 agent 可见时才注入
 *
 * ── 设计要点（均为本机实测结论，改动前务必先读）─────────────────────────
 *
 * · **本文件不 import 任何 harness 包，也不 import 任何第三方包**，只 import
 *   `node:` 内置模块。这是刻意的，原因见下一条。
 *
 * · 为什么不能 import `@deepseek-ai/dsh-tools` 拿 `defineTool`：
 *   DSH 启动时装了一个模块解析路由（dsh-app-boot 的 ResolutionRouter），它按
 *   插件 package.json 的真实路径计算 `require.resolve.paths()` 来决定能解析哪些
 *   包。而本包常以 `link:` 装成 junction，真实路径在工作区（如 D:\dsh-harmonyos-arkts），
 *   从那儿向上找不到 `~/.dsh/profiles/node_modules`，于是**裸包名解析必然失败**
 *   （报 `Cannot find module '@deepseek-ai/dsh-tools'`，require stack 指向本文件）。
 *   在 package.json 里声明 dependencies/peerDependencies **也救不了**：路由搜索路径
 *   同样从真实路径算起。→ 结论：本插件必须零外部依赖，才能既可用 `link:` 开发、
 *   也能被复制安装。`defineTool` 本身只做「参数规格 → JSON Schema 编译」和入参校验，
 *   故这里直接手写 JSON Schema 并自行校验入参，行为等价。
 *
 * · 手写 schema 用的是**原生 JSON Schema 子集**（type/oneOf/properties/required/
 *   additionalProperties/items/enum/const + 注记 description/title/default/examples），
 *   即 dsh-tools `assertSupportedJsonSchema` 允许的那一套。注意与 defineTool 的
 *   ParameterSchemaSpec 方言不同：**必填写在对象级 `required: [...]` 数组里**，
 *   不是字段级 `required: true`。
 *
 * · **host 进程里没有 `DSH_PROFILE_DIR`**（该变量只由 shell-env 注入给 shell 子进程）。
 *   所以不能用它拼 skill 目录路径 —— 首版据此配置 bundledSkillDir 导致挂载失败。
 *   现在 skill 由代码注册，路径用 import.meta.url 定位，彻底不依赖环境变量。
 *
 * · linter-cli 自带上游 OpenHarmony 定制版 typescript，必须从它自己的目录启动
 *   （cwd），兄弟依赖才能解析。
 *
 * · linter-cli 的 `--input` 一次只能给一个文件（重复传入仅最后一个生效，其余被
 *   静默丢弃 → 假阴性）。故逐文件起进程，且因默认 cache 目录固定在自身安装目录下，
 *   必须**串行**，否则并发争用同一缓存。
 *
 * · linter-cli 把 ERROR/WARN 写 **stderr**、只把 FAQ 提示写 stdout，且带 ANSI 颜色码。
 *   两个流都要解析、且必须去色，否则漏报。
 *
 * @module dsh-harmonyos-arkts
 */
import { fileURLToPath } from 'node:url';
import { dirname, join, isAbsolute, resolve as resolvePath } from 'node:path';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { execFile } from 'node:child_process';

export const name = 'dsh-harmonyos-arkts';

/** 等工具、提示词、skill 三个注册表就绪后再挂载。 */
export const inject = ['tools', 'systemPrompt', 'skills'];

/** 本包根目录（realpath）。自带资源都相对它定位。 */
const PLUGIN_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const RULES_DIR = join(PLUGIN_ROOT, 'rules');
const QUICK_RULES_DIR = join(RULES_DIR, 'quick-rules');
const QUICK_APIS_DIR = join(RULES_DIR, 'quick-apis');
const SKILLS_DIR = join(PLUGIN_ROOT, 'skills');
const SKILL_MANIFEST = join(SKILLS_DIR, '_manifest.json');
const LINTER_CLI = join(
  SKILLS_DIR,
  'hmos-arkts-knowledge-retriever',
  'linter-cli',
  'bin',
  'linter-cli.js',
);

// ── 捆绑 skills 注册 ─────────────────────────────────────────────────────

/** 去掉 SKILL.md 的 YAML frontmatter，返回正文。 */
function skillBody(text) {
  const normalized = text.replace(/^\uFEFF/, '');
  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(normalized);
  return (match === null ? normalized : normalized.slice(match[0].length)).trim();
}

/**
 * 把捆绑的 skills 全部注册进 skill 注册表。
 *
 * 用代码注册（runtime 层，rank 250）而不是 patch 里的 bundledSkillDir：
 * 后者要拼绝对路径，而可用作锚点的环境变量在 host 进程里并不存在。
 * 元数据取自构建期生成的 skills/_manifest.json（见 scripts/build-skill-manifest.mjs），
 * 以免在运行时依赖 YAML 解析器。
 * @param {object} ctx - 携带 skills 注册表的上下文。
 * @returns {number} 成功注册的数量。
 */
function registerBundledSkills(ctx) {
  if (!existsSync(SKILL_MANIFEST)) return 0;
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(SKILL_MANIFEST, 'utf8'));
  } catch {
    return 0;
  }
  let count = 0;
  for (const entry of manifest) {
    const dir = join(SKILLS_DIR, entry.dir);
    const skillFile = join(dir, 'SKILL.md');
    if (!existsSync(skillFile)) continue;
    try {
      ctx.skills.register({
        name: entry.name,
        description: entry.description,
        ...(entry.whenToUse === undefined ? {} : { whenToUse: entry.whenToUse }),
        ...(entry.metadata === undefined ? {} : { metadata: entry.metadata }),
        content: skillBody(readFileSync(skillFile, 'utf8')),
        source: 'dsh-harmonyos-arkts',
        // 让 skill 正文里引用的相对路径（references/、scripts/、docs/）可解析
        resourceBase: { kind: 'directory', path: dir },
        path: skillFile,
      });
      count += 1;
    } catch (error) {
      ctx.logger?.warn?.(`dsh-harmonyos-arkts: skill "${entry.name}" not registered: ${error.message}`);
    }
  }
  return count;
}

// ── 规则库读取 ────────────────────────────────────────────────────────────

/** 规则文件清单（名称 → 绝对路径），按名称排序。 */
function listRuleFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((entry) => entry.endsWith('.md'))
    .sort((a, b) => a.localeCompare(b))
    .map((entry) => ({ name: entry, path: join(dir, entry) }));
}

/** 规则库全部文件，带 quick-rules/ 或 quick-apis/ 前缀。 */
function allRuleFileNames() {
  return [
    ...listRuleFiles(QUICK_RULES_DIR).map((f) => `quick-rules/${f.name}`),
    ...listRuleFiles(QUICK_APIS_DIR).map((f) => `quick-apis/${f.name}`),
  ];
}

/**
 * 在规则库中做大小写不敏感的关键词检索。
 * @param {string} query - 关键词。
 * @param {number} limit - 最多返回的命中条目数。
 * @returns {Array<{file: string, line: number, text: string}>} 命中行。
 */
function searchRules(query, limit) {
  const needle = query.toLowerCase();
  const hits = [];
  for (const { name: fileName, path: filePath } of [
    ...listRuleFiles(QUICK_RULES_DIR),
    ...listRuleFiles(QUICK_APIS_DIR),
  ]) {
    let text;
    try {
      text = readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].toLowerCase().includes(needle)) {
        hits.push({ file: fileName, line: i + 1, text: lines[i].trim().slice(0, 300) });
        if (hits.length >= limit) return hits;
      }
    }
  }
  return hits;
}

/**
 * 读取一个规则文件，可选按行窗口截取。
 * @param {string} file - 规则文件名（可含 quick-rules/ 前缀）。
 * @param {number|undefined} offset - 1-based 起始行。
 * @param {number|undefined} limit - 最多返回行数。
 * @returns {{file: string, path: string, totalLines: number, content: string}|undefined}
 */
function readRuleFile(file, offset, limit) {
  const normalized = file.replace(/^[/\\]+/, '').replace(/\\/g, '/');
  const target = [
    join(RULES_DIR, normalized),
    join(QUICK_RULES_DIR, normalized),
    join(QUICK_APIS_DIR, normalized),
    join(QUICK_RULES_DIR, `${normalized}.md`),
    join(QUICK_APIS_DIR, `${normalized}.md`),
  ].find((p) => existsSync(p) && statSync(p).isFile());
  if (target === undefined) return undefined;
  const lines = readFileSync(target, 'utf8').split(/\r?\n/);
  const start = offset !== undefined && offset > 0 ? offset - 1 : 0;
  const count = limit !== undefined && limit > 0 ? limit : lines.length - start;
  return {
    file: normalized,
    path: target,
    totalLines: lines.length,
    content: lines.slice(start, start + count).join('\n'),
  };
}

// ── ArkTS 静态检查 ───────────────────────────────────────────────────────

/**
 * 判定某目录是否可直接作为 linter-cli 的 `--sdk-path`。
 *
 * linter-cli 内部只在给定路径下找 `ets/`、`openharmony/ets/`、`hms/ets/`
 * 三种布局（见其 `collectSdkRoots`）。而 DevEco 的真实布局是
 * `<sdk>/<default|版本号>/openharmony/ets` —— 多了一层。所以**把 SDK 安装根
 * 直接传进去会踩坑**，见 `resolveSdkRoot` 的实测说明。
 * @param {string} dir - 候选目录。
 * @returns {boolean} 是否可直接交给 linter-cli。
 */
function isEtsSdkRoot(dir) {
  return (
    existsSync(join(dir, 'ets', 'oh-uni-package.json')) ||
    existsSync(join(dir, 'openharmony', 'ets', 'oh-uni-package.json')) ||
    existsSync(join(dir, 'sdkConfig.json'))
  );
}

/**
 * 把「SDK 安装根」归一化成 linter-cli 真正接受的层级。
 *
 * ⚠️ 这一步不是锦上添花，是**必须的**。实测（API 26 SDK + 官方模板
 * EntryAbility.ets，该文件本身完全正确）：
 *
 *   --sdk-path D:\DevEco Studio\sdk          → 5 条假报错
 *       （3 条 `Cannot find module '@kit.AbilityKit'` 等，
 *         外加类型丢失连锁引发的 `Property 'context' does not exist`
 *         与 `arkts-no-any-unknown`）
 *   --sdk-path D:\DevEco Studio\sdk\default  → 0 条
 *
 * **假阳性比漏报更危险** —— 它会让人去"修"本来正确的模板代码。
 * @param {string} base - SDK 安装根或任意候选目录。
 * @returns {string|undefined} 归一化后的目录；路径不存在时返回 undefined。
 */
function resolveSdkRoot(base) {
  if (typeof base !== 'string' || base === '' || !existsSync(base)) return undefined;
  if (isEtsSdkRoot(base)) return base;
  // DevEco 布局：<sdk>/<default|26.0.0.x>/openharmony/ets —— 往下探一层
  let entries;
  try {
    entries = readdirSync(base, { withFileTypes: true });
  } catch {
    return base;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const child = join(base, entry.name);
    if (isEtsSdkRoot(child)) return child;
  }
  // 归一化失败时原样返回，让 linter-cli 自己报错（好过静默给出假阳性）
  return base;
}

/** 候选 HarmonyOS SDK 安装根（首个可归一化的采用）。 */
function defaultSdkCandidates() {
  const candidates = [];
  if (process.env.DEVECO_SDK_HOME) candidates.push(process.env.DEVECO_SDK_HOME);
  if (process.env.HOS_SDK_HOME) candidates.push(process.env.HOS_SDK_HOME);
  candidates.push('D:/DevEco Studio/sdk', 'C:/Program Files/Huawei/DevEco Studio/sdk');
  return candidates;
}

/**
 * 选出实际传给 `--sdk-path` 的目录。
 * 显式传入的 `sdkPath` 同样归一化 —— 传错层级会静默产生假阳性，这个陷阱
 * 靠肉眼几乎无法自查。
 * @param {string|undefined} explicit - 工具入参里的 sdkPath。
 * @returns {string|undefined} 归一化后的 SDK 目录。
 */
function pickSdkRoot(explicit) {
  if (typeof explicit === 'string' && explicit !== '') return resolveSdkRoot(explicit);
  for (const candidate of defaultSdkCandidates()) {
    const resolved = resolveSdkRoot(candidate);
    if (resolved !== undefined) return resolved;
  }
  return undefined;
}

/** 去掉 linter-cli 输出里的 ANSI 颜色转义（实测诊断行带 `\x1b[31m` 前缀）。 */
const ANSI_PATTERN = /\u001B\[[0-9;]*m/g;

/**
 * 解析 linter-cli 的诊断输出。
 * 上游格式为两行一组：`ArkTS:ERROR File: <path>:<line>:<col>` 后跟消息行。
 * @param {string} text - 合并后的 stdout + stderr。
 * @returns {Array<{severity: string, file: string, line: number, column: number, message: string, rule: string|null}>}
 */
function parseDiagnostics(text) {
  const issues = [];
  const lines = text.replace(ANSI_PATTERN, '').split(/\r?\n/);
  const header = /^ArkTS:(ERROR|WARN|WARNING|INFO)\s+File:\s*(.+?):(\d+):(\d+)\s*$/i;
  for (let i = 0; i < lines.length; i += 1) {
    const match = header.exec(lines[i].trim());
    if (match === null) continue;
    const rawMessage = (lines[i + 1] ?? '').trim();
    const ruleMatch = /\(([a-z0-9-]+)\)\s*$/i.exec(rawMessage);
    issues.push({
      severity: match[1].toUpperCase() === 'WARNING' ? 'WARN' : match[1].toUpperCase(),
      file: match[2].trim(),
      line: Number(match[3]),
      column: Number(match[4]),
      message: rawMessage.replace(/\s*\([a-z0-9-]+\)\s*$/i, '').trim(),
      rule: ruleMatch === null ? null : ruleMatch[1],
    });
  }
  return issues;
}

/**
 * 对单个文件运行 linter-cli。
 * @param {string} file - 文件路径（绝对或相对 cwd）。
 * @param {object} args - 工具入参。
 * @returns {Promise<{exitCode: number, issues: Array<object>, stderr: string}>}
 */
function runLinterOnFile(file, args) {
  return new Promise((resolvePromise) => {
    const argv = ['--input', isAbsolute(file) ? file : resolvePath(process.cwd(), file)];
    const sdk = pickSdkRoot(args.sdkPath);
    if (sdk !== undefined) argv.push('--sdk-path', sdk);
    if (args.moduleRoot !== undefined) argv.push('--module-root', args.moduleRoot);
    if (args.projectRoot !== undefined) argv.push('--project-root', args.projectRoot);
    if (args.moduleJson !== undefined) argv.push('--module-json', args.moduleJson);

    execFile(
      process.execPath,
      [LINTER_CLI, ...argv],
      {
        // 必须从 linter-cli 自己的目录启动：其 runtime/typescript 兄弟依赖在此解析，
        // 且默认 linter-cache/ 也落在这里（故逐文件串行，避免并发争用同一缓存）。
        cwd: dirname(LINTER_CLI),
        timeout: args.timeoutMs ?? 600_000,
        maxBuffer: 32 * 1024 * 1024,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const out = String(stdout ?? '');
        const err = String(stderr ?? '');
        resolvePromise({
          exitCode: error === null ? 0 : typeof error.code === 'number' ? error.code : 1,
          // 诊断在 stderr、FAQ 提示在 stdout → 两个流都要解析
          issues: parseDiagnostics(`${out}\n${err}`),
          stderr: err,
        });
      },
    );
  });
}

/**
 * 串行检查多个文件并汇总诊断。
 * @param {object} args - 工具入参。
 * @returns {Promise<{exitCode: number, issues: Array<object>, stderr: string}>}
 */
async function runLinter(args) {
  const issues = [];
  const stderrParts = [];
  let exitCode = 0;
  // 串行：linter-cli 默认 cache 目录固定在自身安装目录下，并发会互相干扰
  for (const file of args.files) {
    const result = await runLinterOnFile(file, args);
    issues.push(...result.issues);
    if (result.stderr.trim() !== '') stderrParts.push(result.stderr);
    if (result.exitCode !== 0 && exitCode === 0) exitCode = result.exitCode;
  }
  return {
    exitCode: issues.length > 0 ? 1 : exitCode,
    issues,
    stderr: stderrParts.join('\n'),
  };
}

// ── 入参校验（替代 defineTool 内置的那一层）──────────────────────────────

/** 入参不合规时抛出的错误，消息面向模型可读。 */
class InvalidArgsError extends Error {
  constructor(message) {
    super(`invalid arguments: ${message}`);
    this.name = 'InvalidArgsError';
  }
}

/**
 * 按需校验 arkts_rules 的入参。
 * @param {object} args - 模型给出的入参。
 * @returns {object} 校验后的入参。
 */
function validateRulesArgs(args) {
  const source = args === null || typeof args !== 'object' ? {} : args;
  for (const key of ['query', 'file']) {
    if (source[key] !== undefined && typeof source[key] !== 'string') {
      throw new InvalidArgsError(`"${key}" must be a string`);
    }
  }
  for (const key of ['offset', 'limit']) {
    if (source[key] !== undefined && !Number.isInteger(source[key])) {
      throw new InvalidArgsError(`"${key}" must be an integer`);
    }
  }
  if (source.listFiles !== undefined && typeof source.listFiles !== 'boolean') {
    throw new InvalidArgsError('"listFiles" must be a boolean');
  }
  return source;
}

/**
 * 按需校验 arkts_check 的入参。
 * @param {object} args - 模型给出的入参。
 * @returns {object} 校验后的入参。
 */
function validateCheckArgs(args) {
  const source = args === null || typeof args !== 'object' ? {} : args;
  if (!Array.isArray(source.files) || source.files.length === 0) {
    throw new InvalidArgsError('"files" must be a non-empty array of .ets file paths');
  }
  if (!source.files.every((f) => typeof f === 'string' && f !== '')) {
    throw new InvalidArgsError('every entry of "files" must be a non-empty string');
  }
  for (const key of ['sdkPath', 'projectRoot', 'moduleRoot', 'moduleJson']) {
    if (source[key] !== undefined && typeof source[key] !== 'string') {
      throw new InvalidArgsError(`"${key}" must be a string`);
    }
  }
  if (source.timeoutMs !== undefined && !Number.isInteger(source.timeoutMs)) {
    throw new InvalidArgsError('"timeoutMs" must be an integer');
  }
  return source;
}

// ── 工具定义（原生 JSON Schema）─────────────────────────────────────────

/**
 * `arkts_rules` 的返回结构。
 * 刻意不写 `additionalProperties`：可选字段按需省略，保持宽松。
 */
const RULES_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    mode: { type: 'string', enum: ['index', 'files', 'search', 'file'] },
    content: { type: 'string' },
    file: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    hits: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          line: { type: 'integer' },
          text: { type: 'string' },
        },
        required: ['file', 'line', 'text'],
      },
    },
    totalLines: { type: 'integer' },
    error: { type: 'string' },
  },
  required: ['mode'],
};

/** `arkts_check` 的返回结构。 */
const CHECK_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    exitCode: { type: 'integer' },
    errorCount: { type: 'integer' },
    warningCount: { type: 'integer' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'integer' },
          column: { type: 'integer' },
          message: { type: 'string' },
          rule: { type: 'string' },
        },
        required: ['severity', 'file', 'line', 'column', 'message'],
      },
    },
    stderr: { type: 'string' },
  },
  required: ['exitCode', 'errorCount', 'warningCount', 'issues'],
};

/** 构造 `arkts_rules` 的工具定义。 */
function rulesTool() {
  return {
    name: 'arkts_rules',
    description:
      'Query the bundled HarmonyOS ArkTS/ArkUI rule library (fatal-gotcha list + API quick reference). ' +
      'Call it before writing any .ets code. With no arguments it returns the rule index — including the ' +
      'component→rule-file cross-reference table. Pass `query` to search all rule files, or `file` to read ' +
      'one rule file (optionally windowed with `offset`/`limit`). Covers V1/V2 state-management separation, ' +
      'forbidden ArkTS syntax, Navigation routing, @kit.* imports, and API parameter correctness.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Case-insensitive keyword to search across all rule and API-reference files.',
        },
        file: {
          type: 'string',
          description:
            'Rule file to read, e.g. "05-state.md" or "quick-rules/05-state.md". Relative to the rules root.',
        },
        offset: { type: 'integer', description: '1-based first line to return when reading `file`.' },
        limit: { type: 'integer', description: 'Maximum lines to return when reading `file`.' },
        listFiles: {
          type: 'boolean',
          description: 'When true, return the full list of available rule files instead of the index.',
        },
      },
    },
    output: {
      schema: RULES_OUTPUT_SCHEMA,
      render(_args, value) {
        if (value.error !== undefined) return [{ type: 'text', text: value.error }];
        if (value.mode === 'search') {
          const hits = value.hits ?? [];
          if (hits.length === 0) return [{ type: 'text', text: 'No matching rules found.' }];
          return [{ type: 'text', text: hits.map((h) => `${h.file}:${h.line}: ${h.text}`).join('\n') }];
        }
        if (value.mode === 'files') {
          return [{ type: 'text', text: (value.files ?? []).join('\n') }];
        }
        const header =
          value.mode === 'file' ? `${value.file ?? ''} (${value.totalLines ?? 0} lines total)\n\n` : '';
        return [{ type: 'text', text: header + (value.content ?? '') }];
      },
    },
    // 纯读文件，可与其他工具并行
    isConcurrencySafe: () => true,
    async execute(rawArgs) {
      const args = validateRulesArgs(rawArgs);
      if (args.listFiles === true) return { mode: 'files', files: allRuleFileNames() };
      if (typeof args.query === 'string' && args.query.trim() !== '') {
        return { mode: 'search', hits: searchRules(args.query.trim(), 60) };
      }
      if (typeof args.file === 'string' && args.file.trim() !== '') {
        const found = readRuleFile(args.file.trim(), args.offset, args.limit);
        if (found === undefined) {
          return {
            mode: 'file',
            error: `Rule file not found: ${args.file}. Call arkts_rules with listFiles:true to see available files.`,
          };
        }
        return { mode: 'file', file: found.file, totalLines: found.totalLines, content: found.content };
      }
      const index = readRuleFile('_index.md');
      return {
        mode: 'index',
        file: '_index.md',
        totalLines: index?.totalLines,
        content: index?.content ?? 'Rule index unavailable.',
      };
    },
    presentCall(args) {
      const source = args === null || typeof args !== 'object' ? {} : args;
      return {
        card: 'generic',
        title:
          source.listFiles === true
            ? 'List ArkTS rules'
            : source.query !== undefined
              ? `Search ArkTS rules: ${source.query}`
              : source.file !== undefined
                ? `Read ArkTS rule ${source.file}`
                : 'ArkTS rule index',
        kind: 'read',
        rawInput: source.query ?? source.file ?? source.listFiles ?? null,
      };
    },
  };
}

/** 构造 `arkts_check` 的工具定义。 */
function checkTool() {
  return {
    name: 'arkts_check',
    description:
      'Run the bundled offline ArkTS static checker (ArkTS linter) over one or more .ets files. ' +
      'Reports ArkTS-specific violations such as arkts-no-any-unknown, arkts-no-untyped-obj-literals and ' +
      'arkts-no-var. Unlike `devecocli check lint` (broken on this machine: always reports 0 files checked) ' +
      'and unlike the devecocli MCP checker (which needs a fully synced project), this needs no project ' +
      'READY state and returns in seconds. Use it after editing .ets files. Files should be absolute paths ' +
      'inside a HarmonyOS project.',
    parameters: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string' },
          description: '`.ets` file paths to check.',
        },
        sdkPath: {
          type: 'string',
          description:
            'HarmonyOS SDK root (contains default/openharmony). Auto-detected from DEVECO_SDK_HOME or the standard DevEco install path when omitted.',
        },
        projectRoot: {
          type: 'string',
          description:
            'Project root override (defaults to the nearest build-profile.json5 / oh-package.json5).',
        },
        moduleRoot: {
          type: 'string',
          description: 'Module root override. Required for files outside src/main/ets.',
        },
        moduleJson: { type: 'string', description: 'module.json / module.json5 override.' },
        timeoutMs: { type: 'integer', description: 'Process timeout in milliseconds (default 600000).' },
      },
      required: ['files'],
    },
    output: {
      schema: CHECK_OUTPUT_SCHEMA,
      render(_args, value) {
        if (value.issues.length === 0) {
          const tail =
            value.exitCode === 0
              ? 'No ArkTS violations found.'
              : `Checker exited with code ${value.exitCode} and produced no parseable diagnostics.`;
          return [{ type: 'text', text: tail + (value.stderr ? `\n${value.stderr}` : '') }];
        }
        const lines = value.issues.map(
          (i) =>
            `${i.severity} ${i.file}:${i.line}:${i.column} ${i.message}${i.rule === undefined ? '' : ` (${i.rule})`}`,
        );
        return [
          {
            type: 'text',
            text: `${value.errorCount} error(s), ${value.warningCount} warning(s)\n\n${lines.join('\n')}`,
          },
        ];
      },
    },
    // linter-cli 的 cache 目录固定在自身安装目录下 → 必须独占执行，不可并行
    isConcurrencySafe: () => false,
    async execute(rawArgs) {
      const args = validateCheckArgs(rawArgs);
      if (!existsSync(LINTER_CLI)) {
        throw new Error(
          `Bundled ArkTS checker is missing at ${LINTER_CLI}. Reinstall the dsh-harmonyos-arkts bundle.`,
        );
      }
      const result = await runLinter(args);
      const errorCount = result.issues.filter((i) => i.severity === 'ERROR').length;
      const warningCount = result.issues.filter((i) => i.severity !== 'ERROR').length;
      // 诊断本身写在 stderr；仅在解析不出任何诊断时才回传原始 stderr 供排查
      const rawStderr = result.stderr.replace(ANSI_PATTERN, '').trim();
      return {
        exitCode: result.exitCode,
        errorCount,
        warningCount,
        // ⚠️ 必须解构掉 rule 再按需加回：写成 `{ ...i, ...(i.rule === null ? {} : { rule: i.rule }) }`
        // 是错的 —— 展开空对象**不会删除**已存在的 `rule: null`，而 schema 声明 rule 是
        // string，null 会让整个工具结果校验失败（实测报 "value.issues[0].rule must be a string"）。
        issues: result.issues.map(({ rule, ...rest }) =>
          rule === null ? rest : { ...rest, rule },
        ),
        ...(result.issues.length === 0 && rawStderr !== '' ? { stderr: rawStderr.slice(0, 4000) } : {}),
      };
    },
    presentCall(args) {
      const source = args === null || typeof args !== 'object' ? {} : args;
      const count = Array.isArray(source.files) ? source.files.length : 0;
      return {
        card: 'generic',
        title: `Check ArkTS (${count} file${count === 1 ? '' : 's'})`,
        kind: 'execute',
        rawInput: source.files ?? null,
      };
    },
  };
}

// ── 提示词 ──────────────────────────────────────────────────────────────

/** 规则库提示词正文。仅在 arkts_rules 工具对本 agent 可见时注入。 */
const RULES_PROMPT = [
  '本机装有 HarmonyOS / ArkTS 开发套件，写或改 `.ets` / ArkTS 代码时用它，不要凭记忆答 API：',
  '',
  '- `arkts_rules` —— 按需查捆绑的 ArkTS/ArkUI 规则库。无参调用返回规则总索引（含「组件→规则文件」交叉表）；',
  '  传 `query` 检索，传 `file` 读某一篇。**写任何组件前先查对应规则**，尤其是：',
  '  V1/V2 状态管理不混用（@State/@Local、@Observed/@ObservedV2）、禁用 any 与匿名对象字面量、',
  '  Navigation 路由栈用法、`@kit.*` 真实成员，以及「构造参数字段名凭记忆编造」这类编译必挂项。',
  '- `arkts_check` —— 对 `.ets` 文件跑离线静态检查（ArkTS linter）。它**不需要工程构建就绪**，秒级返回，',
  '  能报出 `arkts-no-any-unknown`、`arkts-no-untyped-obj-literals`、`arkts-no-var` 等违规。改完 `.ets` 后用它自检。',
  '',
  '另有 5 个鸿蒙 skill 可用（写 `.ets` 前加载 `hmos-arkui-develop-skill`；崩溃诊断用 `hmos-runtime-fix-skill`）。',
  '',
  '注意：`devecocli check lint` 在本机**已损坏**（恒报 `Files checked: 0`），不要依赖它。',
  '鸿蒙工程也不能放在含非 ASCII 字符（如中文）的路径下 —— hvigor 会直接拒绝构建。',
].join('\n');

// ── 插件入口 ────────────────────────────────────────────────────────────

/**
 * 注册捆绑 skills、arkts_rules / arkts_check 工具，以及规则库提示词。
 * @param {object} ctx - 已注入 tools、systemPrompt、skills 的 Cordis 上下文。
 */
export function apply(ctx) {
  const skillCount = registerBundledSkills(ctx);
  if (skillCount > 0) {
    ctx.logger?.info?.(`dsh-harmonyos-arkts: registered ${skillCount} HarmonyOS skill(s)`);
  }

  ctx.tools.register(rulesTool());
  ctx.tools.register(checkTool());

  // 规则库提示词：仅当 arkts_rules 工具确实对本 agent 可见时才注入。
  ctx.systemPrompt.section({
    name: 'harmonyos-arkts',
    order: 200,
    text: ({ scope }) => (ctx.tools.get('arkts_rules', scope) === undefined ? '' : RULES_PROMPT),
  });
}

export default { name, inject, apply };
