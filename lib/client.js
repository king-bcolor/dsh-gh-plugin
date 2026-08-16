window.__ModuleLoader__.load({
  id: "dsh-gh-plugin",
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    var React = require("react")
    var create = React.createElement

    var CSS = [
      ".dgh_section{display:flex;flex-direction:column;gap:14px;max-width:880px;width:100%;color:var(--dsw-alias-label-primary)}",
      ".dgh_h1{margin:0;font-size:16px;line-height:24px}",
      ".dgh_sub{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;margin:0}",
      ".dgh_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:10px}",
      ".dgh_card h3{margin:0;font-size:13px;line-height:20px}",
      ".dgh_toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
      ".dgh_select,.dgh_input,.dgh_textarea{box-sizing:border-box;width:100%;min-height:34px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 8px;font:inherit;font-size:13px}",
      ".dgh_textarea{min-height:72px;resize:vertical;font-family:var(--ds-font-family-code);line-height:18px}",
      ".dgh_label{display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--dsw-alias-label-secondary)}",
      ".dgh_label b{color:var(--dsw-alias-label-primary);font-weight:600}",
      ".dgh_required{color:var(--dsw-alias-state-error-primary)}",
      ".dgh_desc{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}",
      ".dgh_check{display:flex;align-items:center;gap:8px;font-size:13px}",
      ".dgh_check input{width:16px;height:16px}",
      ".dgh_actions{display:flex;gap:10px;align-items:center}",
      ".dgh_button{border:1px solid var(--dsw-alias-state-business-primary);background:var(--dsw-alias-state-business-primary);color:#fff;height:34px;border-radius:8px;padding:0 16px;font:inherit;font-size:13px;cursor:pointer}",
      ".dgh_button:disabled{opacity:.5;cursor:not-allowed}",
      ".dgh_button_ghost{background:transparent;color:var(--dsw-alias-label-primary)}",
      ".dgh_grid{display:grid;grid-template-columns:minmax(0,1fr);gap:10px}",
      ".dgh_result{max-height:420px;overflow:auto;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-module-platform);border-radius:10px;padding:12px;margin:0;font-family:var(--ds-font-family-code);font-size:12px;line-height:18px;white-space:pre-wrap;word-break:break-word}",
      ".dgh_ok{color:var(--dsw-alias-state-success-primary)}",
      ".dgh_bad{color:var(--dsw-alias-state-error-primary)}",
      ".dgh_notice{color:var(--dsw-alias-label-secondary);font-size:12px}",
    ].join("\n")

    var CSS_TAG = "dsh-gh-plugin/gh-settings.css"
    if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_TAG) + "]") === null) {
      var tag = document.createElement("style")
      tag.dataset.plugin = "dsh-gh-plugin"
      tag.dataset.pluginCss = CSS_TAG
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    var inject = ["slots", "connection"]

    function makeGhApi(ctx) {
      function call(method, args) {
        return ctx.connection.rpc.call("/api", method, { args }, undefined).then(function (response) {
          if (response && response.ok) return response.value
          var message = response && response.error ? response.error.message : "gh remote call failed"
          var error = new Error(message)
          error.code = response && response.error ? response.error.code : "REMOTE_FAILED"
          throw error
        })
      }
      return {
        catalog: function () { return call("gh/catalog", {}) },
        status: function () { return call("gh/status", {}) },
        execute: function (toolName, args) { return call("gh/execute", { toolName: toolName, args: args || {} }) }
      }
    }

    function uniqueCategories(catalog) {
      var seen = {}
      var result = []
      for (var i = 0; i < catalog.length; i += 1) {
        var category = catalog[i].category
        if (!seen[category]) {
          seen[category] = true
          result.push(category)
        }
      }
      return result
    }

    function defaultArg(parameter) {
      if (parameter.type === "boolean") return false
      return ""
    }

    function emptyDefaults(tool) {
      var values = {}
      for (var i = 0; i < tool.parameters.length; i += 1) values[tool.parameters[i].key] = defaultArg(tool.parameters[i])
      return values
    }

    function splitArray(text) {
      return String(text || "").split(/[\n,]/).map(function (value) { return value.trim() }).filter(Boolean)
    }

    function parseArgs(tool, values) {
      var args = {}
      for (var i = 0; i < tool.parameters.length; i += 1) {
        var parameter = tool.parameters[i]
        if (parameter.key === "confirm") continue
        var raw = values[parameter.key]
        if (parameter.type === "array") {
          var list = splitArray(raw)
          if (list.length > 0) args[parameter.key] = list
        } else if (parameter.type === "integer") {
          if (raw === "") continue
          var number = Number(raw)
          if (!Number.isFinite(number)) throw new Error(parameter.label + " 必须是整数")
          args[parameter.key] = Math.trunc(number)
        } else if (parameter.type === "boolean") {
          if (raw === true) args[parameter.key] = true
        } else if (raw !== "") {
          args[parameter.key] = raw
        }
      }
      return args
    }

    function validateRequired(tool, args) {
      for (var i = 0; i < tool.parameters.length; i += 1) {
        var parameter = tool.parameters[i]
        if (parameter.key === "confirm" || !parameter.required) continue
        var value = args[parameter.key]
        if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
          throw new Error("请填写必填项：" + parameter.label)
        }
      }
    }

    function needsConfirmation(tool, values) {
      if (!tool) return false
      if (tool.dangerous) return true
      if (tool.apiMethodGuard) {
        var method = values.method || "GET"
        return method !== "GET"
      }
      return false
    }

    function fieldValue(values, parameter) {
      return values[parameter.key] === undefined ? defaultArg(parameter) : values[parameter.key]
    }

    function renderField(parameter, value, onChange) {
      var label = parameter.required
        ? create("b", null, parameter.label, create("span", { className: "dgh_required" }, " *"))
        : create("b", null, parameter.label)
      var control
      if (parameter.type === "boolean") {
        control = create("label", { className: "dgh_check" },
          create("input", { type: "checkbox", checked: value === true, onChange: function (event) { onChange(event.currentTarget.checked) } }),
          create("span", null, parameter.description || parameter.label))
      } else if (parameter.type === "enum") {
        control = create("select", { className: "dgh_select", value: value || "", onChange: function (event) { onChange(event.currentTarget.value) } },
          create("option", { value: "" }, "请选择"),
          parameter.enum.map(function (choice) {
            return create("option", { key: choice, value: choice }, choice)
          }))
      } else if (parameter.type === "array") {
        control = create("textarea", {
          className: "dgh_textarea",
          value: value || "",
          placeholder: "每行一个值，也可以用逗号分隔",
          onChange: function (event) { onChange(event.currentTarget.value) }
        })
      } else {
        control = create("input", {
          className: "dgh_input",
          type: parameter.type === "integer" ? "number" : "text",
          value: value || "",
          onChange: function (event) { onChange(event.currentTarget.value) }
        })
      }
      return create("label", { className: "dgh_label", key: parameter.key },
        label,
        control,
        parameter.description ? create("span", { className: "dgh_desc" }, parameter.description) : null)
    }

    function authSummary(auth) {
      if (!auth) return create("p", { className: "dgh_sub" }, "正在读取认证状态…")
      if (auth.ok && auth.parsed && auth.parsed.hosts) {
        var rows = []
        Object.keys(auth.parsed.hosts).forEach(function (host) {
          var accounts = auth.parsed.hosts[host] || []
          accounts.forEach(function (account) {
            rows.push(create("p", { className: "dgh_sub", key: host + "/" + account.login },
              account.login || "未登录", " @ ", host, " — ", account.state || "unknown",
              account.tokenSource ? " · token: " + account.tokenSource : "",
              account.gitProtocol ? " · git: " + account.gitProtocol : ""))
          })
        })
        if (rows.length === 0) return create("p", { className: "dgh_sub" }, "未发现 GitHub 认证账户。请先在终端运行 gh auth login。")
        return create("div", null, rows)
      }
      return create("pre", { className: "dgh_result" }, auth.notice || auth.error || auth.stdout || auth.stderr || JSON.stringify(auth, null, 2))
    }

    function resultText(result) {
      if (!result) return "执行后这里会展示 gh 返回结果。"
      if (result.parsed !== null && result.parsed !== undefined) return JSON.stringify(result.parsed, null, 2)
      if (result.stdout) return result.stdout
      if (result.stderr) return result.stderr
      if (result.error) return result.error
      if (result.notice) return result.notice
      return "(no output)"
    }

    function GhSettingsSection(props) {
      var remote = props.gh
      var catalogState = React.useState([])
      var catalog = catalogState[0]
      var setCatalog = catalogState[1]
      var authState = React.useState(null)
      var auth = authState[0]
      var setAuth = authState[1]
      var categoryState = React.useState("repo")
      var category = categoryState[0]
      var setCategory = categoryState[1]
      var toolNameState = React.useState("")
      var toolName = toolNameState[0]
      var setToolName = toolNameState[1]
      var valuesState = React.useState({})
      var values = valuesState[0]
      var setValues = valuesState[1]
      var confirmedState = React.useState(false)
      var confirmed = confirmedState[0]
      var setConfirmed = confirmedState[1]
      var busyState = React.useState(false)
      var busy = busyState[0]
      var setBusy = busyState[1]
      var resultState = React.useState(null)
      var result = resultState[0]
      var setResult = resultState[1]
      var errorState = React.useState("")
      var error = errorState[0]
      var setError = errorState[1]

      React.useEffect(function () {
        var alive = true
        remote.catalog().then(function (list) {
          if (!alive) return
          setCatalog(list)
        }, function (reason) {
          if (alive) setError(reason && reason.message ? reason.message : String(reason))
        })
        remote.status().then(function (value) {
          if (alive) setAuth(value)
        }, function (reason) {
          if (alive) setAuth({ ok: false, notice: reason && reason.message ? reason.message : String(reason) })
        })
        return function () { alive = false }
      }, [remote])

      React.useEffect(function () {
        if (catalog.length === 0) return
        var tools = catalog.filter(function (entry) { return entry.category === category })
        var first = tools[0] || catalog[0]
        if (toolName && tools.some(function (entry) { return entry.name === toolName })) return
        setToolName(first.name)
        setValues(emptyDefaults(first))
        setResult(null)
        setError("")
      }, [catalog, category])

      var tools = catalog.filter(function (entry) { return entry.category === category })
      var tool = catalog.find(function (entry) { return entry.name === toolName }) || null
      var requireConfirm = needsConfirmation(tool, values)

      function selectTool(name) {
        var next = catalog.find(function (entry) { return entry.name === name })
        setToolName(name)
        setValues(emptyDefaults(next))
        setResult(null)
        setError("")
        setConfirmed(false)
      }

      function submit() {
        var args
        try {
          args = parseArgs(tool, values)
          validateRequired(tool, args)
          if (requireConfirm && !confirmed) {
            setError("危险操作需要先勾选确认。")
            return
          }
          if (requireConfirm) args.confirm = true
        } catch (reason) {
          setError(reason && reason.message ? reason.message : String(reason))
          return
        }
        setBusy(true)
        setError("")
        setResult(null)
        remote.execute(tool.name, args).then(function (value) {
          setResult(value)
          setBusy(false)
        }, function (reason) {
          setResult({ ok: false, parsed: null, stdout: "", stderr: "", error: reason && reason.message ? reason.message : String(reason) })
          setBusy(false)
        })
      }

      return create("div", { className: "dgh_section" },
        create("div", { className: "dgh_card" },
          create("h3", null, "GitHub CLI 控制台"),
          create("p", { className: "dgh_sub" }, "所有工具通过 gh 命令在 DSH Host 侧执行。带 * 为必填项；危险操作必须勾选确认。")),
        create("div", { className: "dgh_card" },
          create("h3", null, "认证状态"),
          authSummary(auth)),
        create("div", { className: "dgh_card" },
          create("h3", null, "选择操作"),
          create("div", { className: "dgh_toolbar" },
            create("select", {
              className: "dgh_select",
              style: { maxWidth: 150 },
              value: category,
              onChange: function (event) { setCategory(event.currentTarget.value) }
            }, uniqueCategories(catalog).map(function (item) {
              return create("option", { key: item, value: item }, item)
            })),
            create("select", {
              className: "dgh_select",
              value: toolName,
              onChange: function (event) { selectTool(event.currentTarget.value) }
            }, tools.map(function (entry) {
              return create("option", { key: entry.name, value: entry.name }, entry.name)
            }))),
          tool ? create("p", { className: "dgh_sub" }, tool.description) : null),
        tool ? create("div", { className: "dgh_card" },
          create("h3", null, "参数"),
          create("div", { className: "dgh_grid" },
            tool.parameters.filter(function (parameter) { return parameter.key !== "confirm" }).map(function (parameter) {
              return renderField(parameter, fieldValue(values, parameter), function (value) {
                setValues(function (current) {
                  var next = {}
                  for (var key in current) next[key] = current[key]
                  next[parameter.key] = value
                  return next
                })
              })
            })),
          requireConfirm ? create("label", { className: "dgh_check" },
            create("input", { type: "checkbox", checked: confirmed, onChange: function (event) { setConfirmed(event.currentTarget.checked) } }),
            create("span", null, "我已确认执行此危险/写操作")) : null,
          create("div", { className: "dgh_actions" },
            create("button", { className: "dgh_button", disabled: busy, onClick: submit }, busy ? "执行中…" : "执行 gh 命令"),
            create("button", {
              className: "dgh_button dgh_button_ghost",
              disabled: busy,
              onClick: function () {
                remote.status().then(setAuth, function (reason) {
                  setAuth({ ok: false, notice: reason && reason.message ? reason.message : String(reason) })
                })
              }
            }, "刷新认证状态"))) : null,
        error ? create("div", { className: "dgh_card" },
          create("p", { className: "dgh_bad" }, error)) : null,
        result ? create("div", { className: "dgh_card" },
          create("h3", null, "执行结果"),
          create("p", { className: result.ok ? "dgh_ok" : "dgh_bad" }, result.ok ? "✓ 成功" : "✕ 失败"),
          result.command ? create("p", { className: "dgh_sub" }, result.command) : null,
          result.notice ? create("p", { className: "dgh_notice" }, result.notice) : null,
          create("pre", { className: "dgh_result" }, resultText(result))) : null)
    }

    function apply(ctx) {
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register({
          name: "settings.section",
          id: "gh",
          order: 40,
          label: function () { return "GitHub" },
          inject: function () { return { gh: makeGhApi(ctx) } }
        }, GhSettingsSection)
      })
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  }
})
