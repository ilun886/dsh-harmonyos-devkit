/**
 * 从各 skill 的 SKILL.md 提取 frontmatter，生成 skills/_manifest.json。
 *
 * 为什么要有这一步：插件在运行时不便依赖 YAML 解析器（bundle 的 node_modules
 * 解析受 link/junction 影响），而 skill 的 description 里含 `>` 折叠块和引号，
 * 用正则硬解容易出错。故在**构建期**用真正的 YAML 解析器抽好元数据，
 * 运行时只读 JSON。
 *
 * 重新生成：
 *   node scripts/build-skill-manifest.mjs
 *
 * @module dsh-harmonyos-arkts/scripts/build-skill-manifest
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = join(PLUGIN_ROOT, 'skills');

/** 定位可用的 js-yaml（依次尝试若干 node_modules 锚点）。 */
function loadYaml() {
  const anchors = [
    process.env.DSH_PROFILE_DIR,
    join(process.env.DSH_HOME ?? '', 'profiles'),
    join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.dsh', 'profiles'),
    PLUGIN_ROOT,
  ].filter((a) => typeof a === 'string' && a !== '');
  for (const anchor of anchors) {
    let dir = resolve(anchor);
    for (let depth = 0; depth < 12; depth += 1) {
      try {
        const requireFrom = createRequire(join(dir, '__anchor__.cjs'));
        return requireFrom('js-yaml');
      } catch {
        // 换上级继续
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  throw new Error('js-yaml not found; cannot parse skill frontmatter');
}

const yaml = loadYaml();

/** 取出 SKILL.md 开头的 YAML frontmatter 与其后的正文。 */
function splitFrontmatter(text) {
  const normalized = text.replace(/^\uFEFF/, '');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(normalized);
  if (match === null) return { data: {}, body: normalized };
  return { data: yaml.load(match[1]) ?? {}, body: normalized.slice(match[0].length) };
}

const manifest = [];
for (const entry of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const skillFile = join(SKILLS_DIR, entry.name, 'SKILL.md');
  if (!existsSync(skillFile)) continue;
  const { data } = splitFrontmatter(readFileSync(skillFile, 'utf8'));
  if (typeof data.name !== 'string' || typeof data.description !== 'string') {
    console.warn(`skip ${entry.name}: missing name/description`);
    continue;
  }
  manifest.push({
    name: data.name,
    description: data.description.replace(/\s+/g, ' ').trim(),
    dir: entry.name,
    ...(typeof data.whenToUse === 'string' ? { whenToUse: data.whenToUse } : {}),
    ...(data.metadata !== undefined && data.metadata !== null && typeof data.metadata === 'object'
      ? { metadata: data.metadata }
      : {}),
  });
}

manifest.sort((a, b) => a.name.localeCompare(b.name));
const outFile = join(SKILLS_DIR, '_manifest.json');
writeFileSync(outFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`wrote ${manifest.length} skills -> ${outFile}`);
for (const s of manifest) {
  console.log(`  ${s.name.padEnd(34)} ${String(s.description.length).padStart(4)} chars  (dir ${s.dir})`);
}
