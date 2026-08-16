# gh CLI 用例目录（GitHub CLI → DeepSeek Harness 插件）

> 数据来源：本机 `gh` 2.97.0 `gh --help`、`gh repo --help`、`gh pr --help`、`gh issue --help` 及官方手册 https://cli.github.com/manual 。

## 全局说明
- 大部分命令支持 `-R, --repo [HOST/]OWNER/REPO` 指定目标仓库。
- JSON 输出命令支持 `--json <fields>`，字段列表用 `gh <cmd> <sub> --help` 查看。
- 分页参数通常为 `-L, --limit <int>`（默认 30）。
- 鉴权依赖 `gh auth login`；CI 场景可用 `GH_TOKEN`。
- 退出码：0 成功，1 失败，4 未认证等，详见 `gh help exit-codes`。

## 1. 认证与状态
### 1.1 `gh auth status`
- **示例**：`gh auth status`
- **说明**：查看登录账号、token 范围、协议。
- **参数限制**：无关键参数。

### 1.2 `gh auth login`
- **示例**：`gh auth login --hostname github.com --git-protocol https --web`
- **说明**：登录 GitHub。
- **参数限制**：`--hostname`、`--git-protocol https|ssh`、`--web|--with-token`。

## 2. 仓库管理
### 2.1 `gh repo create`
- **示例**：`gh repo create my-repo --public --source=. --remote=origin --push`
- **说明**：创建 GitHub 仓库并可选推送本地代码。
- **参数限制**：`--public|--private|--internal`；`--source <path>`；`--remote <name>`；`--push`；`--description`；`--add-readme`；`--license`。

### 2.2 `gh repo clone`
- **示例**：`gh repo clone owner/repo`
- **说明**：克隆仓库。
- **参数限制**：仓库参数必填。

### 2.3 `gh repo view`
- **示例**：`gh repo view owner/repo --web` / `gh repo view --json name,description,stargazerCount`
- **说明**：查看仓库信息。
- **参数限制**：`--web` 打开浏览器；`--json` 指定字段。

### 2.4 `gh repo list`
- **示例**：`gh repo list <owner> --limit 20 --json name,description`
- **说明**：列出用户/组织仓库。
- **参数限制**：`--limit` 默认 30；`--json` 字段可选。

### 2.5 `gh repo edit`
- **示例**：`gh repo edit owner/repo --add-topic dsh-plugin`
- **说明**：修改仓库设置和标签。
- **参数限制**：`--add-topic`、`--remove-topic` 可多次。

### 2.6 `gh repo delete`
- **示例**：`gh repo delete owner/repo --yes`
- **说明**：删除仓库。
- **参数限制**：`--yes` 跳过确认，危险操作。

## 3. Issue 管理
### 3.1 `gh issue create`
- **示例**：`gh issue create --title "bug" --body "..." --label bug`
- **说明**：创建 issue。
- **参数限制**：`--title`/`--body` 必填；`--label` 可多次。

### 3.2 `gh issue list`
- **示例**：`gh issue list --state open --limit 20 --json number,title,labels`
- **说明**：列出 issue。
- **参数限制**：`--state open|closed|all`；`--limit`；`--label` 过滤；`--assignee`。

### 3.3 `gh issue view`
- **示例**：`gh issue view 123 --json number,title,body`
- **说明**：查看 issue 详情。
- **参数限制**：issue 参数可用数字或 URL。

### 3.4 `gh issue close/reopen`
- **示例**：`gh issue close 123` / `gh issue reopen 123`
- **说明**：关闭/重开 issue。
- **参数限制**：issue 必填。

### 3.5 `gh issue comment`
- **示例**：`gh issue comment 123 --body "..."` 
- **说明**：评论 issue。
- **参数限制**：issue 与 body 必填。

### 3.6 `gh issue edit`
- **示例**：`gh issue edit 123 --title "new" --add-label bug`
- **说明**：编辑 issue。
- **参数限制**：`--title`、`--body`、`--add-label`、`--remove-label`。

## 4. Pull Request 管理
### 4.1 `gh pr create`
- **示例**：`gh pr create --title "feat" --body "..." --base main --head feature`
- **说明**：创建 PR。
- **参数限制**：`--title`/`--body`；`--base`；`--head`；`--draft`；`--fill` 自动填充。

### 4.2 `gh pr list`
- **示例**：`gh pr list --state open --limit 20 --json number,title,author`
- **说明**：列出 PR。
- **参数限制**：`--state open|closed|merged|all`；`--limit`；`--base`。

### 4.3 `gh pr view`
- **示例**：`gh pr view 123 --json number,title,state`
- **说明**：查看 PR。
- **参数限制**：PR 可用数字/URL/分支名。

### 4.4 `gh pr merge`
- **示例**：`gh pr merge 123 --merge --delete-branch`
- **说明**：合并 PR。
- **参数限制**：`--merge|--squash|--rebase`；`--delete-branch`；`--admin`。

### 4.5 `gh pr checkout`
- **示例**：`gh pr checkout 123`
- **说明**：检出 PR 分支。
- **参数限制**：PR 必填。

### 4.6 `gh pr review`
- **示例**：`gh pr review 123 --approve --body "LGTM"`
- **说明**：提交 PR 审查。
- **参数限制**：`--approve|--request-changes|--comment`。

### 4.7 `gh pr close/reopen`
- **示例**：`gh pr close 123`
- **说明**：关闭/重开 PR。

## 5. 搜索
### 5.1 `gh search repos`
- **示例**：`gh search repos "deepseek harness" --limit 20 --sort stars --json fullName,description`
- **说明**：搜索仓库。
- **参数限制**：查询串必填；`--sort` 可取 stars/forks/updated；`--order asc|desc`；`--limit` 最大 1000 分页。

### 5.2 `gh search issues/prs`
- **示例**：`gh search issues "bug" --state open --limit 20`
- **说明**：搜索 issue/PR。
- **参数限制**：查询串必填；`--state`；`--limit`。

### 5.3 `gh search code`
- **示例**：`gh search code "defineTool" --owner deepseek-ai`
- **说明**：搜索代码（需 repo 范围）。
- **参数限制**：查询串必填；`--owner` 限定组织。

## 6. Actions 与 Release
### 6.1 `gh workflow list`
- **示例**：`gh workflow list --repo owner/repo`
- **说明**：列出 workflow。
### 6.2 `gh run list`
- **示例**：`gh run list --limit 20 --json databaseId,status,conclusion`
- **说明**：列出运行记录。
- **参数限制**：`--workflow`；`--branch`；`--status`。
### 6.3 `gh run view`
- **示例**：`gh run view <run-id> --log`
- **说明**：查看运行与日志。
### 6.4 `gh release create`
- **示例**：`gh release create v0.1.0 --title v0.1.0 --notes "release"`
- **说明**：创建 release。
- **参数限制**：tag 必填；`--notes`；`--generate-notes`。
### 6.5 `gh release list`
- **示例**：`gh release list --limit 20`
- **说明**：列出 release。

## 7. API 与其他
### 7.1 `gh api`
- **示例**：`gh api repos/owner/repo --jq '.full_name'`
- **说明**：调用 GitHub REST API。
- **参数限制**：路径必填；`-X` 方法；`-f` 字段；`--jq` 过滤。

### 7.2 `gh gist create`
- **示例**：`gh gist create file.txt --public`
- **说明**：创建 gist。

### 7.3 `gh label list/create`
- **示例**：`gh label list --repo owner/repo`
- **说明**：管理标签。

### 7.4 `gh alias set`
- **示例**：`gh alias set co "pr checkout"`
- **说明**：设置命令别名。
