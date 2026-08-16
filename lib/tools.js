/**
 * gh tool definitions for dsh-gh-plugin.
 *
 * Every tool maps model arguments to a gh argv array and passes it to
 * lib/runner.js. Dangerous write operations require `confirm: true` when
 * `confirmDangerous` config is enabled (the default).
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { runGh, parseJsonOutput, ghExitNotice } from './runner.js'

const REPO_VIEW_FIELDS = 'name,nameWithOwner,description,stargazerCount,primaryLanguage,visibility,url,repositoryTopics,defaultBranchRef'
const REPO_LIST_FIELDS = 'nameWithOwner,description,stargazerCount,visibility,updatedAt,url'
const ISSUE_LIST_FIELDS = 'number,title,state,labels,createdAt,updatedAt,url'
const ISSUE_VIEW_FIELDS = 'number,title,state,body,labels,createdAt,updatedAt,url,comments'
const PR_LIST_FIELDS = 'number,title,state,author,baseRefName,headRefName,createdAt,updatedAt,url,isDraft'
const PR_VIEW_FIELDS = 'number,title,state,body,author,baseRefName,headRefName,createdAt,updatedAt,url,mergeable,reviewDecision,isDraft'
const SEARCH_REPO_FIELDS = 'fullName,description,stargazersCount,forksCount,language,visibility,updatedAt,url'
const SEARCH_ISSUE_FIELDS = 'number,title,state,body,labels,repository,createdAt,updatedAt,url'
const SEARCH_CODE_FIELDS = 'path,repository,sha,url,textMatches'
const WORKFLOW_LIST_FIELDS = 'id,name,path,state'
const RUN_LIST_FIELDS = 'databaseId,displayTitle,name,status,conclusion,event,headBranch,createdAt,updatedAt,url,workflowName'
const RUN_VIEW_FIELDS = 'databaseId,displayTitle,name,status,conclusion,event,headBranch,headSha,jobs,createdAt,updatedAt,url'
const RELEASE_LIST_FIELDS = 'tagName,name,isDraft,isPrerelease,isLatest,publishedAt,createdAt'
const RELEASE_VIEW_FIELDS = 'tagName,name,body,isDraft,isPrerelease,publishedAt,url,author'

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean', required: true },
    command: { type: 'string', required: true },
    exitCode: { oneOf: [{ type: 'integer' }, { type: 'null' }], required: true },
    signal: { oneOf: [{ type: 'string' }, { type: 'null' }], required: true },
    timedOut: { type: 'boolean', required: true },
    stdout: { type: 'string', required: true },
    stderr: { type: 'string', required: true },
    parsed: { type: 'json', required: true },
    notice: { type: 'string' },
  },
}

const repoParameter = {
  type: 'string',
  description: 'Target repository in [HOST/]OWNER/REPO form (passed to gh with -R).',
}

const limitParameter = {
  type: 'integer',
  description: 'Maximum number of items to return. The gh command applies its own default when omitted.',
}

const fieldsParameter = {
  type: 'array',
  description: 'JSON fields to request from gh. A sensible default field list is used when omitted.',
  items: { type: 'string' },
}

const confirmParameter = {
  type: 'boolean',
  description: 'Must be exactly true for this destructive/write operation to execute.',
}

const idParameter = {
  oneOf: [{ type: 'string' }, { type: 'integer' }],
  description: 'Numeric id, full URL, or branch name accepted by the corresponding gh command.',
}

const TOOL_DEFS = [
  {
    name: 'gh_auth_status',
    description: 'Show gh authentication status for GitHub hosts. Uses --json hosts and never requests or displays the auth token.',
    parameters: {
      hostname: { type: 'string', description: 'Check only this GitHub hostname.' },
      active: { type: 'boolean', description: 'Display the active account only.' },
    },
    build(args) {
      const argv = ['auth', 'status', '--json', 'hosts']
      if (args.active) argv.push('--active')
      if (args.hostname) argv.push('--hostname', args.hostname)
      return { argv, parse: 'json' }
    },
  },
  {
    name: 'gh_repo_create',
    description: 'Create a new GitHub repository with gh repo create. Returns the URL printed by gh.',
    parameters: {
      name: { type: 'string', required: true, description: 'Repository name (OWNER/NAME is accepted).' },
      visibility: { type: 'string', enum: ['public', 'private', 'internal'], description: 'Repository visibility.' },
      description: { type: 'string', description: 'Repository description.' },
      source: { type: 'string', description: 'Local directory to push from.' },
      remote: { type: 'string', description: 'Remote name for the new repository.' },
      push: { type: 'boolean', description: 'Push local commits to the new repository.' },
      addReadme: { type: 'boolean', description: 'Add a README file.' },
      license: { type: 'string', description: 'Open-source license template name (e.g. mit).' },
    },
    build(args) {
      const argv = ['repo', 'create', args.name]
      if (args.visibility) argv.push(`--${args.visibility}`)
      if (args.description !== undefined) argv.push('--description', args.description)
      if (args.source !== undefined) argv.push('--source', args.source)
      if (args.remote !== undefined) argv.push('--remote', args.remote)
      if (args.push) argv.push('--push')
      if (args.addReadme) argv.push('--add-readme')
      if (args.license !== undefined) argv.push('--license', args.license)
      return { argv, parse: 'none' }
    },
  },
  {
    name: 'gh_repo_view',
    description: 'View metadata for a GitHub repository as JSON.',
    parameters: {
      repo: { ...repoParameter, required: true },
      fields: { ...fieldsParameter },
      web: { type: 'boolean', description: 'Open the repository in a browser instead of returning JSON.' },
    },
    build(args) {
      const argv = ['repo', 'view', args.repo]
      if (args.web) argv.push('--web')
      else argv.push('--json', (args.fields ?? []).join(',') || REPO_VIEW_FIELDS)
      return { argv, parse: args.web ? 'none' : 'json' }
    },
  },
  {
    name: 'gh_repo_list',
    description: 'List repositories for an owner (or the authenticated user when owner is omitted) as JSON.',
    parameters: {
      owner: { type: 'string', description: 'GitHub user or organization name.' },
      limit: { ...limitParameter },
      fields: { ...fieldsParameter },
    },
    build(args) {
      const argv = ['repo', 'list']
      if (args.owner) argv.push(args.owner)
      argv.push('--json', (args.fields ?? []).join(',') || REPO_LIST_FIELDS)
      if (args.limit !== undefined) argv.push('--limit', String(args.limit))
      return { argv, parse: 'json' }
    },
  },
  {
    name: 'gh_repo_edit',
    description: 'Edit repository settings and topics with gh repo edit.',
    parameters: {
      repo: { ...repoParameter, required: true },
      addTopics: { type: 'array', items: { type: 'string' }, description: 'Topics to add.' },
      removeTopics: { type: 'array', items: { type: 'string' }, description: 'Topics to remove.' },
      description: { type: 'string', description: 'New repository description.' },
      homepage: { type: 'string', description: 'New repository home page URL.' },
      defaultBranch: { type: 'string', description: 'New default branch name.' },
      visibility: { type: 'string', enum: ['public', 'private', 'internal'], description: 'New visibility.' },
      acceptVisibilityChange: { type: 'boolean', description: 'Must be true when changing visibility; gh requires acknowledgement of the consequences.' },
    },
    guard(args) {
      if (args.visibility && args.acceptVisibilityChange !== true) {
        return `${this.name} requires acceptVisibilityChange: true when visibility is changed.`
      }
      return undefined
    },
    build(args) {
      const argv = ['repo', 'edit', args.repo]
      for (const topic of args.addTopics ?? []) argv.push('--add-topic', topic)
      for (const topic of args.removeTopics ?? []) argv.push('--remove-topic', topic)
      if (args.description !== undefined) argv.push('--description', args.description)
      if (args.homepage !== undefined) argv.push('--homepage', args.homepage)
      if (args.defaultBranch !== undefined) argv.push('--default-branch', args.defaultBranch)
      if (args.visibility) {
        argv.push('--visibility', args.visibility, '--accept-visibility-change-consequences')
      }
      return { argv, parse: 'none' }
    },
  },
  {
    name: 'gh_repo_delete',
    description: 'Delete a GitHub repository. Destructive: `confirm` must be exactly true (or plugin confirmDangerous config must be false).',
    parameters: {
      repo: { ...repoParameter, required: true },
      confirm: { ...confirmParameter },
    },
    dangerous: true,
    build(args) {
      return { argv: ['repo', 'delete', args.repo, '--yes'], parse: 'none' }
    },
  },
  {
    name: 'gh_issue_create',
    description: 'Create a GitHub issue in a repository.',
    parameters: {
      repo: { ...repoParameter, required: true },
      title: { type: 'string', required: true, description: 'Issue title.' },
      body: { type: 'string', description: 'Issue body (markdown supported).' },
      labels: { type: 'array', items: { type: 'string' }, description: 'Labels to add.' },
      assignee: { type: 'string', description: 'Assignee login (use @me for self).' },
      milestone: { type: 'string', description: 'Milestone title or number.' },
    },
    build(args) {
      const argv = ['issue', 'create', '-R', args.repo, '--title', args.title]
      if (args.body !== undefined) argv.push('--body', args.body)
      for (const label of args.labels ?? []) argv.push('--label', label)
      if (args.assignee !== undefined) argv.push('--assignee', args.assignee)
      if (args.milestone !== undefined) argv.push('--milestone', args.milestone)
      return { argv, parse: 'none' }
    },
  },
  {
    name: 'gh_issue_list',
    description: 'List GitHub issues in a repository as JSON.',
    parameters: {
      repo: { ...repoParameter, required: true },
      state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Issue state filter.' },
      limit: { ...limitParameter },
      labels: { type: 'array', items: { type: 'string' }, description: 'Filter by labels.' },
      assignee: { type: 'string', description: 'Filter by assignee login.' },
      search: { type: 'string', description: 'Filter issues with a search query.' },
      fields: { ...fieldsParameter },
    },
    build(args) {
      const argv = ['issue', 'list', '-R', args.repo]
      if (args.state) argv.push('--state', args.state)
      if (args.limit !== undefined) argv.push('--limit', String(args.limit))
      for (const label of args.labels ?? []) argv.push('--label', label)
      if (args.assignee !== undefined) argv.push('--assignee', args.assignee)
      if (args.search !== undefined) argv.push('--search', args.search)
      argv.push('--json', (args.fields ?? []).join(',') || ISSUE_LIST_FIELDS)
      return { argv, parse: 'json' }
    },
  },
  {
    name: 'gh_issue_view',
    description: 'View one GitHub issue as JSON.',
    parameters: {
      repo: { ...repoParameter, required: true },
      issue: { ...idParameter, required: true },
      fields: { ...fieldsParameter },
    },
    build(args) {
      return {
        argv: ['issue', 'view', args.issue, '-R', args.repo, '--json', (args.fields ?? []).join(',') || ISSUE_VIEW_FIELDS],
        parse: 'json',
      }
    },
  },
  {
    name: 'gh_issue_edit',
    description: 'Edit a GitHub issue title, body, labels, assignees, or milestone.',
    parameters: {
      repo: { ...repoParameter, required: true },
      issue: { ...idParameter, required: true },
      title: { type: 'string', description: 'New issue title.' },
      body: { type: 'string', description: 'New issue body.' },
      addLabels: { type: 'array', items: { type: 'string' }, description: 'Labels to add.' },
      removeLabels: { type: 'array', items: { type: 'string' }, description: 'Labels to remove.' },
      addAssignees: { type: 'array', items: { type: 'string' }, description: 'Assignees to add.' },
      removeAssignees: { type: 'array', items: { type: 'string' }, description: 'Assignees to remove.' },
      milestone: { type: 'string', description: 'Milestone title to set.' },
    },
    build(args) {
      const argv = ['issue', 'edit', args.issue, '-R', args.repo]
      if (args.title !== undefined) argv.push('--title', args.title)
      if (args.body !== undefined) argv.push('--body', args.body)
      for (const label of args.addLabels ?? []) argv.push('--add-label', label)
      for (const label of args.removeLabels ?? []) argv.push('--remove-label', label)
      for (const assignee of args.addAssignees ?? []) argv.push('--add-assignee', assignee)
      for (const assignee of args.removeAssignees ?? []) argv.push('--remove-assignee', assignee)
      if (args.milestone !== undefined) argv.push('--milestone', args.milestone)
      return { argv, parse: 'none' }
    },
  },
  {
    name: 'gh_issue_close',
    description: 'Close a GitHub issue.',
    parameters: {
      repo: { ...repoParameter, required: true },
      issue: { ...idParameter, required: true },
      reason: { type: 'string', enum: ['completed', 'not planned', 'duplicate'], description: 'Closing reason.' },
      comment: { type: 'string', description: 'Closing comment.' },
      duplicateOf: { type: 'string', description: 'Issue number or URL marked as duplicate.' },
    },
    build(args) {
      const argv = ['issue', 'close', args.issue, '-R', args.repo]
      if (args.reason) argv.push('--reason', args.reason)
      if (args.comment !== undefined) argv.push('--comment', args.comment)
      if (args.duplicateOf !== undefined) argv.push('--duplicate-of', args.duplicateOf)
      return { argv, parse: 'none' }
    },
  },
  {
    name: 'gh_issue_reopen',
    description: 'Reopen a closed GitHub issue.',
    parameters: {
      repo: { ...repoParameter, required: true },
      issue: { ...idParameter, required: true },
    },
    build(args) {
      return { argv: ['issue', 'reopen', args.issue, '-R', args.repo], parse: 'none' }
    },
  },
  {
    name: 'gh_issue_comment',
    description: 'Add a comment to a GitHub issue.',
    parameters: {
      repo: { ...repoParameter, required: true },
      issue: { ...idParameter, required: true },
      body: { type: 'string', required: true, description: 'Comment body (markdown supported).' },
    },
    build(args) {
      return { argv: ['issue', 'comment', args.issue, '-R', args.repo, '--body', args.body], parse: 'none' }
    },
  },
  {
    name: 'gh_pr_create',
    description: 'Create a GitHub pull request in a repository.',
    parameters: {
      repo: { ...repoParameter, required: true },
      title: { type: 'string', required: true, description: 'Pull request title.' },
      body: { type: 'string', description: 'Pull request body (markdown supported).' },
      base: { type: 'string', description: 'Base branch.' },
      head: { type: 'string', description: 'Head branch or OWNER:branch.' },
      draft: { type: 'boolean', description: 'Create as a draft pull request.' },
      labels: { type: 'array', items: { type: 'string' }, description: 'Labels to add.' },
      reviewer: { type: 'string', description: 'Request a review from a user or team.' },
    },
    build(args) {
      const argv = ['pr', 'create', '-R', args.repo, '--title', args.title]
      if (args.body !== undefined) argv.push('--body', args.body)
      if (args.base !== undefined) argv.push('--base', args.base)
      if (args.head !== undefined) argv.push('--head', args.head)
      if (args.draft) argv.push('--draft')
      for (const label of args.labels ?? []) argv.push('--label', label)
      if (args.reviewer !== undefined) argv.push('--reviewer', args.reviewer)
      return { argv, parse: 'none' }
    },
  },
  {
    name: 'gh_pr_list',
    description: 'List GitHub pull requests in a repository as JSON.',
    parameters: {
      repo: { ...repoParameter, required: true },
      state: { type: 'string', enum: ['open', 'closed', 'merged', 'all'], description: 'Pull request state filter.' },
      limit: { ...limitParameter },
      base: { type: 'string', description: 'Filter by base branch.' },
      labels: { type: 'array', items: { type: 'string' }, description: 'Filter by labels.' },
      fields: { ...fieldsParameter },
    },
    build(args) {
      const argv = ['pr', 'list', '-R', args.repo]
      if (args.state) argv.push('--state', args.state)
      if (args.limit !== undefined) argv.push('--limit', String(args.limit))
      if (args.base !== undefined) argv.push('--base', args.base)
      for (const label of args.labels ?? []) argv.push('--label', label)
      argv.push('--json', (args.fields ?? []).join(',') || PR_LIST_FIELDS)
      return { argv, parse: 'json' }
    },
  },
  {
    name: 'gh_pr_view',
    description: 'View one GitHub pull request as JSON.',
    parameters: {
      repo: { ...repoParameter, required: true },
      pr: { ...idParameter, required: true },
      fields: { ...fieldsParameter },
    },
    build(args) {
      return {
        argv: ['pr', 'view', args.pr, '-R', args.repo, '--json', (args.fields ?? []).join(',') || PR_VIEW_FIELDS],
        parse: 'json',
      }
    },
  },
  {
    name: 'gh_pr_merge',
    description: 'Merge a GitHub pull request. Destructive write: `confirm` must be exactly true (or plugin confirmDangerous config must be false).',
    parameters: {
      repo: { ...repoParameter, required: true },
      pr: { ...idParameter, required: true },
      method: { type: 'string', enum: ['merge', 'squash', 'rebase'], description: 'Merge method.' },
      deleteBranch: { type: 'boolean', description: 'Delete the local and remote branch after merge.' },
      body: { type: 'string', description: 'Merge commit body.' },
      admin: { type: 'boolean', description: 'Use administrator privileges to merge.' },
      confirm: { ...confirmParameter },
    },
    dangerous: true,
    build(args) {
      const argv = ['pr', 'merge', args.pr, '-R', args.repo]
      const method = args.method ?? 'merge'
      argv.push(method === 'squash' ? '--squash' : method === 'rebase' ? '--rebase' : '--merge')
      if (args.deleteBranch) argv.push('--delete-branch')
      if (args.body !== undefined) argv.push('--body', args.body)
      if (args.admin) argv.push('--admin')
      return { argv, parse: 'none' }
    },
  },
  {
    name: 'gh_pr_review',
    description: 'Submit a review for a GitHub pull request.',
    parameters: {
      repo: { ...repoParameter, required: true },
      pr: { ...idParameter, required: true },
      decision: { type: 'string', enum: ['approve', 'request-changes', 'comment'], required: true, description: 'Review decision.' },
      body: { type: 'string', description: 'Review comment body.' },
    },
    build(args) {
      const argv = ['pr', 'review', args.pr, '-R', args.repo]
      argv.push(args.decision === 'request-changes' ? '--request-changes' : `--${args.decision}`)
      if (args.body !== undefined) argv.push('--body', args.body)
      return { argv, parse: 'none' }
    },
  },
  {
    name: 'gh_pr_checkout',
    description: 'Check out a GitHub pull request branch locally with gh pr checkout.',
    parameters: {
      repo: { ...repoParameter, required: true },
      pr: { ...idParameter, required: true },
      branch: { type: 'string', description: 'Local branch name to use.' },
      detach: { type: 'boolean', description: 'Check out with a detached HEAD.' },
      force: { type: 'boolean', description: 'Reset the existing local branch to the latest state of the pull request.' },
    },
    build(args) {
      const argv = ['pr', 'checkout', args.pr, '-R', args.repo]
      if (args.branch !== undefined) argv.push('--branch', args.branch)
      if (args.detach) argv.push('--detach')
      if (args.force) argv.push('--force')
      return { argv, parse: 'none' }
    },
  },
  {
    name: 'gh_pr_close',
    description: 'Close a GitHub pull request.',
    parameters: {
      repo: { ...repoParameter, required: true },
      pr: { ...idParameter, required: true },
    },
    build(args) {
      return { argv: ['pr', 'close', args.pr, '-R', args.repo], parse: 'none' }
    },
  },
  {
    name: 'gh_pr_reopen',
    description: 'Reopen a closed GitHub pull request.',
    parameters: {
      repo: { ...repoParameter, required: true },
      pr: { ...idParameter, required: true },
    },
    build(args) {
      return { argv: ['pr', 'reopen', args.pr, '-R', args.repo], parse: 'none' }
    },
  },
  {
    name: 'gh_search_repos',
    description: 'Search GitHub repositories and return matching items as JSON.',
    parameters: {
      query: { type: 'string', required: true, description: 'GitHub repository search query.' },
      sort: { type: 'string', enum: ['stars', 'forks', 'updated', 'help-wanted-issues'], description: 'Sort field.' },
      order: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order.' },
      limit: { ...limitParameter },
      fields: { ...fieldsParameter },
    },
    build(args) {
      const argv = ['search', 'repos', args.query]
      if (args.sort) argv.push('--sort', args.sort)
      if (args.order) argv.push('--order', args.order)
      argv.push('--json', (args.fields ?? []).join(',') || SEARCH_REPO_FIELDS)
      if (args.limit !== undefined) argv.push('--limit', String(args.limit))
      return { argv, parse: 'json' }
    },
  },
  {
    name: 'gh_search_issues',
    description: 'Search GitHub issues and return matching items as JSON.',
    parameters: {
      query: { type: 'string', required: true, description: 'GitHub issue search query.' },
      state: { type: 'string', enum: ['open', 'closed'], description: 'Issue state filter.' },
      includePrs: { type: 'boolean', description: 'Include pull requests in results.' },
      limit: { ...limitParameter },
      fields: { ...fieldsParameter },
    },
    build(args) {
      const argv = ['search', 'issues', args.query]
      if (args.state) argv.push('--state', args.state)
      if (args.includePrs) argv.push('--include-prs')
      argv.push('--json', (args.fields ?? []).join(',') || SEARCH_ISSUE_FIELDS)
      if (args.limit !== undefined) argv.push('--limit', String(args.limit))
      return { argv, parse: 'json' }
    },
  },
  {
    name: 'gh_search_prs',
    description: 'Search GitHub pull requests and return matching items as JSON.',
    parameters: {
      query: { type: 'string', required: true, description: 'GitHub pull request search query.' },
      state: { type: 'string', enum: ['open', 'closed'], description: 'Pull request state filter.' },
      limit: { ...limitParameter },
      fields: { ...fieldsParameter },
    },
    build(args) {
      const argv = ['search', 'prs', args.query]
      if (args.state) argv.push('--state', args.state)
      argv.push('--json', (args.fields ?? []).join(',') || SEARCH_ISSUE_FIELDS)
      if (args.limit !== undefined) argv.push('--limit', String(args.limit))
      return { argv, parse: 'json' }
    },
  },
  {
    name: 'gh_search_code',
    description: 'Search GitHub code. Requires an authenticated account with code search access.',
    parameters: {
      query: { type: 'string', required: true, description: 'GitHub code search query.' },
      owner: { type: 'string', description: 'Restrict search to repositories owned by this user or organization.' },
      limit: { ...limitParameter },
      fields: { ...fieldsParameter },
    },
    build(args) {
      const argv = ['search', 'code', args.query]
      if (args.owner) argv.push('--owner', args.owner)
      argv.push('--json', (args.fields ?? []).join(',') || SEARCH_CODE_FIELDS)
      if (args.limit !== undefined) argv.push('--limit', String(args.limit))
      return { argv, parse: 'json' }
    },
  },
  {
    name: 'gh_workflow_list',
    description: 'List GitHub Actions workflows in a repository as JSON.',
    parameters: {
      repo: { ...repoParameter, required: true },
      fields: { ...fieldsParameter },
    },
    build(args) {
      return {
        argv: ['workflow', 'list', '-R', args.repo, '--json', (args.fields ?? []).join(',') || WORKFLOW_LIST_FIELDS],
        parse: 'json',
      }
    },
  },
  {
    name: 'gh_run_list',
    description: 'List GitHub Actions workflow runs in a repository as JSON.',
    parameters: {
      repo: { ...repoParameter, required: true },
      workflow: { type: 'string', description: 'Filter runs by workflow name or id.' },
      branch: { type: 'string', description: 'Filter runs by branch.' },
      status: {
        type: 'string',
        enum: ['queued', 'completed', 'in_progress', 'requested', 'waiting', 'pending', 'action_required', 'cancelled', 'failure', 'neutral', 'skipped', 'stale', 'startup_failure', 'success', 'timed_out'],
        description: 'Filter runs by status.',
      },
      limit: { ...limitParameter },
      fields: { ...fieldsParameter },
    },
    build(args) {
      const argv = ['run', 'list', '-R', args.repo]
      if (args.workflow !== undefined) argv.push('--workflow', args.workflow)
      if (args.branch !== undefined) argv.push('--branch', args.branch)
      if (args.status) argv.push('--status', args.status)
      if (args.limit !== undefined) argv.push('--limit', String(args.limit))
      argv.push('--json', (args.fields ?? []).join(',') || RUN_LIST_FIELDS)
      return { argv, parse: 'json' }
    },
  },
  {
    name: 'gh_run_view',
    description: 'View one GitHub Actions workflow run as JSON, or fetch its log when `log` or `logFailed` is true.',
    parameters: {
      repo: { ...repoParameter, required: true },
      runId: { ...idParameter, required: true },
      log: { type: 'boolean', description: 'Return the full run log instead of JSON.' },
      logFailed: { type: 'boolean', description: 'Return logs for failed steps only.' },
      verbose: { type: 'boolean', description: 'Include job steps in the output.' },
      fields: { ...fieldsParameter },
    },
    build(args) {
      const argv = ['run', 'view', args.runId, '-R', args.repo]
      if (args.log) argv.push('--log')
      if (args.logFailed) argv.push('--log-failed')
      if (args.verbose) argv.push('--verbose')
      if (!args.log && !args.logFailed) argv.push('--json', (args.fields ?? []).join(',') || RUN_VIEW_FIELDS)
      return { argv, parse: args.log || args.logFailed ? 'none' : 'json' }
    },
  },
  {
    name: 'gh_release_create',
    description: 'Create a GitHub release for a repository.',
    parameters: {
      repo: { ...repoParameter, required: true },
      tag: { type: 'string', required: true, description: 'Git tag for the release.' },
      title: { type: 'string', description: 'Release title.' },
      notes: { type: 'string', description: 'Release notes text.' },
      generateNotes: { type: 'boolean', description: 'Automatically generate release notes.' },
      draft: { type: 'boolean', description: 'Save as draft instead of publishing.' },
      prerelease: { type: 'boolean', description: 'Mark as a prerelease.' },
      target: { type: 'string', description: 'Target branch or full commit SHA.' },
    },
    build(args) {
      const argv = ['release', 'create', args.tag, '-R', args.repo]
      if (args.title !== undefined) argv.push('--title', args.title)
      if (args.notes !== undefined) argv.push('--notes', args.notes)
      if (args.generateNotes) argv.push('--generate-notes')
      if (args.draft) argv.push('--draft')
      if (args.prerelease) argv.push('--prerelease')
      if (args.target !== undefined) argv.push('--target', args.target)
      return { argv, parse: 'none' }
    },
  },
  {
    name: 'gh_release_list',
    description: 'List GitHub releases for a repository as JSON.',
    parameters: {
      repo: { ...repoParameter, required: true },
      limit: { ...limitParameter },
      fields: { ...fieldsParameter },
    },
    build(args) {
      const argv = ['release', 'list', '-R', args.repo, '--json', (args.fields ?? []).join(',') || RELEASE_LIST_FIELDS]
      if (args.limit !== undefined) argv.push('--limit', String(args.limit))
      return { argv, parse: 'json' }
    },
  },
  {
    name: 'gh_release_view',
    description: 'View one GitHub release as JSON.',
    parameters: {
      repo: { ...repoParameter, required: true },
      tag: { type: 'string', required: true, description: 'Release tag name.' },
      fields: { ...fieldsParameter },
      web: { type: 'boolean', description: 'Open the release in a browser instead of returning JSON.' },
    },
    build(args) {
      const argv = ['release', 'view', args.tag, '-R', args.repo]
      if (args.web) argv.push('--web')
      else argv.push('--json', (args.fields ?? []).join(',') || RELEASE_VIEW_FIELDS)
      return { argv, parse: args.web ? 'none' : 'json' }
    },
  },
  {
    name: 'gh_api',
    description: 'Call the GitHub REST API through gh api. GET is safe; write methods require `confirm: true` (or plugin confirmDangerous config set to false).',
    parameters: {
      path: { type: 'string', required: true, description: 'GitHub REST API path, e.g. repos/OWNER/REPO.' },
      method: { type: 'string', enum: ['GET', 'POST', 'PATCH', 'DELETE'], description: 'HTTP method. Defaults to GET.' },
      confirm: { ...confirmParameter },
      jq: { type: 'string', description: 'jq expression to filter the JSON response.' },
      field: { type: 'array', items: { type: 'string' }, description: 'Typed parameters in key=value form (gh -F).' },
      rawField: { type: 'array', items: { type: 'string' }, description: 'String parameters in key=value form (gh -f).' },
      paginate: { type: 'boolean', description: 'Fetch all pages of results.' },
      hostname: { type: 'string', description: 'GitHub hostname for the request.' },
    },
    dangerousMethod: (args) => (args.method ?? 'GET') !== 'GET',
    build(args) {
      const argv = ['api', args.path]
      const method = args.method ?? 'GET'
      if (method !== 'GET') argv.push('-X', method)
      if (args.jq !== undefined) argv.push('--jq', args.jq)
      for (const entry of args.field ?? []) argv.push('-F', entry)
      for (const entry of args.rawField ?? []) argv.push('-f', entry)
      if (args.paginate) argv.push('--paginate')
      if (args.hostname !== undefined) argv.push('--hostname', args.hostname)
      return { argv, parse: 'json' }
    },
  },
  {
    name: 'gh_alias_set',
    description: 'Create or update a gh command alias.',
    parameters: {
      alias: { type: 'string', required: true, description: 'Alias name.' },
      expansion: { type: 'string', required: true, description: 'Command the alias expands to.' },
      shell: { type: 'boolean', description: 'Run the expansion through a shell.' },
    },
    build(args) {
      const argv = ['alias', 'set', args.alias, args.expansion]
      if (args.shell) argv.push('--shell')
      return { argv, parse: 'none' }
    },
  },
]


const TOOL_CATEGORY = {
  gh_auth_status: 'auth',
  gh_alias_set: 'auth',
  gh_repo_create: 'repo',
  gh_repo_view: 'repo',
  gh_repo_list: 'repo',
  gh_repo_edit: 'repo',
  gh_repo_delete: 'repo',
  gh_issue_create: 'issue',
  gh_issue_list: 'issue',
  gh_issue_view: 'issue',
  gh_issue_edit: 'issue',
  gh_issue_close: 'issue',
  gh_issue_reopen: 'issue',
  gh_issue_comment: 'issue',
  gh_pr_create: 'pr',
  gh_pr_list: 'pr',
  gh_pr_view: 'pr',
  gh_pr_merge: 'pr',
  gh_pr_review: 'pr',
  gh_pr_checkout: 'pr',
  gh_pr_close: 'pr',
  gh_pr_reopen: 'pr',
  gh_search_repos: 'search',
  gh_search_issues: 'search',
  gh_search_prs: 'search',
  gh_search_code: 'search',
  gh_workflow_list: 'actions',
  gh_run_list: 'actions',
  gh_run_view: 'actions',
  gh_release_create: 'release',
  gh_release_list: 'release',
  gh_release_view: 'release',
  gh_api: 'api',
}

const PARAMETER_LABELS = {
  repo: '仓库 owner/repo',
  owner: 'Owner',
  name: '名称',
  title: '标题',
  body: '正文',
  query: '搜索词',
  tag: 'Tag',
  alias: '别名',
  expansion: '展开命令',
  method: 'HTTP 方法',
  path: 'API 路径',
  jq: 'jq 表达式',
  pr: 'PR',
  issue: 'Issue',
  runId: 'Run ID',
  labels: '标签',
  addLabels: '添加标签',
  removeLabels: '移除标签',
  addTopics: '添加 Topics',
  removeTopics: '移除 Topics',
  fields: 'JSON 字段',
  visibility: '可见性',
  confirm: '确认',
}

function catalogParameter(key, parameter) {
  const type = parameter.oneOf !== undefined ? 'id' : parameter.type
  return {
    key,
    label: PARAMETER_LABELS[key] ?? key,
    description: parameter.description ?? '',
    type,
    enum: parameter.enum ?? [],
    itemType: parameter.items?.type ?? 'string',
    required: parameter.required === true,
  }
}

/**
 * Static UI catalog for the browser settings page. One entry per gh tool,
 * with just enough metadata to render a generic form and confirmation UI.
 */
export function ghToolCatalog() {
  return TOOL_DEFS.map((def) => ({
    name: def.name,
    category: TOOL_CATEGORY[def.name] ?? 'other',
    description: def.description,
    dangerous: def.dangerous === true,
    apiMethodGuard: typeof def.dangerousMethod === 'function',
    parameters: Object.entries(def.parameters).map(([key, parameter]) => catalogParameter(key, parameter)),
  }))
}

function formatResult(argv, raw, parse) {
  const command = ['gh', ...argv].join(' ')
  let notice
  if (raw.timedOut) {
    notice = 'gh 命令执行超时，已终止。可调大插件配置 timeoutMs 后重试。'
  } else if (raw.exitCode !== 0) {
    notice = ghExitNotice(raw.exitCode)
  }

  return {
    ok: !raw.timedOut && raw.exitCode === 0,
    command,
    exitCode: raw.exitCode,
    signal: raw.signal,
    timedOut: raw.timedOut,
    stdout: raw.stdout,
    stderr: raw.stderr,
    parsed: parse === 'none' ? null : (parseJsonOutput(raw.stdout) ?? null),
    ...(notice === undefined ? {} : { notice }),
  }
}

function renderGhResult(_args, value) {
  const body = value.parsed === null
    ? (value.stdout || value.stderr || '(no output)')
    : JSON.stringify(value.parsed, null, 2)
  const lines = [
    `[gh] ${value.command}`,
    value.timedOut ? '[timed out]' : `[exit code: ${value.exitCode}]`,
  ]
  if (value.notice !== undefined) lines.push(`[notice] ${value.notice}`)
  if (value.stderr.length > 0) lines.push(`[stderr]\n${value.stderr}`)
  lines.push(body)
  return [{ type: 'text', text: lines.join('\n') }]
}

function assertConfirmed(def, args, confirmDangerous) {
  if (confirmDangerous === false) return
  const dangerous = def.dangerous === true || def.dangerousMethod?.(args) === true
  if (dangerous && args.confirm !== true) {
    throw new Error(`${def.name} requires confirm: true for this destructive/write operation.`)
  }
}

function assertGuard(def, args) {
  const reason = def.guard?.(args)
  if (reason !== undefined) throw new Error(reason)
}

/**
 * Build registry-ready gh tool definitions for a plugin configuration.
 *
 * @param {{ghBin?: string, timeoutMs?: number, confirmDangerous?: boolean}} [config]
 * @returns {ReturnType<typeof defineTool>[]}
 */
export function buildTools(config = {}) {
  const ghBin = config.ghBin ?? 'gh'
  const timeoutMs = config.timeoutMs ?? 30000
  const confirmDangerous = config.confirmDangerous ?? true

  return TOOL_DEFS.map((def) => defineTool({
    name: def.name,
    description: def.description,
    parameters: def.parameters,
    output: {
      schema: OUTPUT_SCHEMA,
      render: renderGhResult,
    },
    async execute(args) {
      assertConfirmed(def, args, confirmDangerous)
      assertGuard(def, args)
      const { argv, parse } = def.build(args)
      const raw = await runGh(ghBin, argv, { timeoutMs })
      return formatResult(argv, raw, parse)
    },
  }))
}
