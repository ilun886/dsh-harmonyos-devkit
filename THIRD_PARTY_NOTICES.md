# 第三方软件声明（Third-Party Notices）

`dsh-harmonyos-arkts` 自身代码以 **Apache License 2.0** 授权（见 `LICENSE`）。

本仓库绝大部分内容**并非本项目原创**，而是打包集成的第三方成果。按各上游许可的要求，
其版权与许可声明汇集于此。**本文件不修改任何上游许可条款。**

---

## 1. HarmonyOS Agent Skills（44 个 skill，约占本仓库 74% 体积）

- **来源**：<https://gitcode.com/HarmonyOS_Skills/harmonyos-agent-skills>
- **许可**：MIT License
- **版权**：Copyright (c) 2026 Huawei Device Co., Ltd.

覆盖 `skills/` 下的全部 44 个目录，包括 `hmos-*` 系列与
`app-metadata-audit-skill`。其中 `hmos-design-visual-mobile` 携带的字体资源
（`assets/HMOSColorEmojiCompat.ttf`、`HMOSColorEmojiFlags.ttf`、`HMSymbolVF_1.ttf`）
同属该仓库，共用同一份 MIT 许可，无附加条款。

MIT License 全文：

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 2. linter-cli（`arkts_check` 工具的后端）

- **来源**：随 `hmos-arkts-knowledge-retriever` skill 分发；其 `README.md` 说明系从
  `arkts-cli` 抽取的独立 ArkTS linter
- **许可**：未在其 `package.json` 中声明（上游未标注）

> ⚠️ **状态说明**：该组件的许可未由上游明确声明。它随官方 skill 仓库（MIT）一同分发。
> 若你是权利人或认为此处标注有误，请提 issue 以便更正。

---

## 3. `linter-cli` 捆绑的 npm 依赖

位于 `skills/hmos-arkts-knowledge-retriever/linter-cli/node_modules/`。

| 包 | 版本 | 许可 | 版权 |
|---|---|---|---|
| `ohos-typescript` | 4.9.5-r4 | **Apache-2.0** | Microsoft Corp（OpenHarmony 定制版） |
| `fs-extra` | 8.1.0 | MIT | Copyright (c) 2011-2017 JP Richardson |
| `json5` | 2.2.3 | MIT | Copyright (c) 2012-2018 Aseem Kishore, and [others] |
| `jsonfile` | 4.0.0 | MIT | Copyright (c) 2012-2015, JP Richardson |
| `universalify` | 0.1.2 | MIT | Copyright (c) 2017, Ryan Zimmerman |
| `uglify-js` | 3.17.4 | BSD-2-Clause | Copyright 2012-2019 (c) Mihai Bazon |
| `graceful-fs` | 4.2.11 | ISC | Copyright (c) 2011-2022 Isaac Z. Schlueter, Ben Noordhuis, and Contributors |

各方许可全文见对应目录下的 `LICENSE` / `LICENSE.md` 文件。

### 3.1 `ohos-typescript` 的 NOTICE 义务（Apache-2.0 §4(d)）

`ohos-typescript` 内部还聚合了其他第三方代码，其归属声明位于：

```
skills/hmos-arkts-knowledge-retriever/linter-cli/node_modules/typescript/ThirdPartyNoticeText.txt
```

该文件**原样保留，不得删除**（Apache-2.0 第 4(d) 条要求再分发时保留 NOTICE）。
其内容为 Microsoft 就 TypeScript 中第三方组件的归属声明。

---

## 4. 开发/运行环境依赖（未随本仓库分发）

以下组件由使用者自行安装，**不包含在本仓库中**：

| 组件 | 许可 | 用途 |
|---|---|---|
| `@deveco/deveco-cli` | MIT | 提供 `devecocli` 命令行（可选） |
| HarmonyOS SDK / DevEco Studio | 华为最终用户许可协议 | 构建与运行目标工程 |
| DeepSeek Harness (DSH) | 见其自身许可 | 本插件包的宿主 |

---

## 5. 关于 HarmonyOS / DevEco 商标

"HarmonyOS"、"DevEco"、"ArkTS"、"ArkUI" 等名称与标识归华为技术有限公司所有。
本项目为独立的第三方集成工作，**与华为不存在隶属、赞助或背书关系**。
名称仅用于客观描述兼容目标（Apache-2.0 第 6 条允许的"合理惯用"范围）。
