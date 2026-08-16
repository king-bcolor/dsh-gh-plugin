# gh CLI DeepSeek Harness 插件 — UI 控件文档说明

## 1. 设计原则
- 所有列表默认分页（20/30/50）。
- JSON 视图开关对所有工具可用。
- 危险操作二次确认。
- 尽量展示 GitHub 链接，可跳转。

## 2. 控件清单
| 控件 | 类型 | 用途 | 数据绑定 |
| --- | --- | --- | --- |
| 认证状态卡 | Card | 账号、scope、协议 | `auth status` |
| 仓库列表 | Table | 名称、描述、stars、topics | `repo list` |
| 仓库详情 | Descriptions | 仓库字段 | `repo view` |
| 创建仓库表单 | Form | 名称、可见性、描述、license、push | `repo create` |
| 仓库删除确认 | ConfirmDialog | 二次确认 | `repo delete` |
| Issue 列表 | Table + Filter | number/title/state/labels | `issue list` |
| Issue 详情 | Timeline | 标题、正文、评论 | `issue view` |
| Issue 创建表单 | Form | title/body/labels | `issue create` |
| Issue 编辑 | Form | title/body/labels | `issue edit` |
| PR 列表 | Table | number/title/state/author | `pr list` |
| PR 详情 | Descriptions | 状态、分支、合并状态 | `pr view` |
| PR 创建表单 | Form | title/body/base/head/draft | `pr create` |
| PR 合并确认 | ConfirmDialog | merge/squash/rebase + delete-branch | `pr merge` |
| 搜索输入 | Input + Select | 查询串、类型、sort/order | `search *` |
| 搜索结果表 | Table | 结果字段 | `search *` |
| Actions 列表 | Table | workflow、run、status | `workflow/run list` |
| 日志视图 | CodeView | 运行日志 | `run view --log` |
| Release 列表 | Table | tag、name、日期 | `release list` |
| 创建 Release 表单 | Form | tag、title、notes | `release create` |
| API 调试器 | Form + JSONView | method/path/jq/响应 | `gh api` |
| 原始 JSON 开关 | Switch | 展示 JSON | 所有工具 |
| 错误提示 | Alert | 未认证、权限、超时 | 工具错误 |
| 外链按钮 | Button | 打开 GitHub 页面 | `--web` 类操作 |

## 3. 关键交互流程
### 3.1 认证
```
[认证状态卡] --未认证--> [登录引导] --> 用户执行 gh auth login --> 刷新状态卡
```
### 3.2 创建 Issue
```
[Issue 表单] --> 工具调用 --> [结果展示 + 链接]
```
### 3.3 合并 PR
```
[PR 详情] --合并--> [合并选项] --> [确认对话框] --> 执行 --> 展示结果
```

## 4. 数据展示逻辑
- 时间字段使用 ISO 字符串，展示时本地化。
- state 字段映射状态标签：open(绿)/closed(红)/merged(紫)。
- 危险操作按钮默认禁用，直到确认勾选。
