# dsh-gh-plugin

> **English README**：[README.md](./README.md)

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件，把 [GitHub CLI（`gh`）](https://cli.github.com) 封装为模型可调用的工具集。

## 它是什么
`dsh-gh-plugin` 把 GitHub 操作暴露给 DSH Agent：仓库、issue、PR、搜索、Actions、Release、GitHub API，全部通过结构化 JSON 工具调用完成。

## 功能
- 认证状态与登录引导。
- 仓库创建/查看/列表/编辑/删除，支持 topic 维护。
- Issue 创建/列表/查看/关闭/重开/评论/编辑。
- PR 创建/列表/查看/合并/检出/审查。
- 搜索仓库/issue/PR/代码。
- Actions workflow/run 查看；Release 创建/列表/查看。
- 高级用 `gh api` 工具。
- 危险操作默认需要显式确认。

## 用例
- 让 Agent 列出未关闭 issue 并总结。
- 从对话中创建 issue 或 PR。
- 搜索 GitHub 上匹配某主题的仓库。
- 查看 CI 运行状态和日志。
- 创建带自动生成说明的 release。

完整命令/用例/参数目录见 [docs/用例目录/README.md](./docs/用例目录/README.md)。

## 安装
### 前置条件
- Node.js 22+，已安装 `dsh` CLI。
- 已安装并登录 `gh`（`gh auth login`）。

### 从 GitHub 安装
```bash
dsh plugin --profile default add github:<owner>/dsh-gh-plugin
# 如 pnpm 请求构建许可，请在 profile 的 pnpm-workspace.yaml 中 allowBuilds 后重试
```

### 本地安装
```bash
git clone https://github.com/<owner>/dsh-gh-plugin.git
cd dsh-gh-plugin
dsh plugin --profile default add .
```

## 使用
```bash
dsh --profile default
```
示例提示词：
- `用 gh_issue_list 列出当前仓库未关闭的 issue。`
- `搜索 GitHub 上 dsh-plugin 主题的仓库，按 stars 排序。`

## 配置
```yaml
- id: gh
  name: dsh-gh-plugin
  config:
    ghBin: /usr/local/bin/gh
    timeoutMs: 30000
    confirmDangerous: true
```

## 开发
本项目全程 TDD：
```bash
pnpm install
npm test
```

## License
MIT
