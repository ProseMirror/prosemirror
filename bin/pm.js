#!/usr/bin/env node

// FIXME
//
// Add a pre-release command that takes release note entries from the
// commits, adds them to the changelog, and determines what kind of
// version change is necessary.
//
// Describe some logic for automatically updating dependency numbers
// -- i.e. when a package's major version changes, bump it for all
// dependents. For minor versions, I guess we'll do it manually.

let origDir = process.cwd()
process.chdir(__dirname + "/..")

// NOTE: Don't require anything from node_modules here, since the
// install script has to be able to run _before_ that exists.
let child = require("child_process"), fs = require("fs"), path = require("path")

let main = ["model", "transform", "state", "view",
            "keymap", "inputrules", "history", "collab", "commands", "gapcursor",
            "schema-basic", "schema-list"]
let mods = main.concat(["menu", "example-setup", "markdown", "dropcursor", "test-builder"])
let modsAndWebsite = mods.concat("website")

function start() {
  let command = process.argv[2]

  if (command == "status") status()
  else if (command == "lint") lint()
  else if (command == "commit") commit()
  else if (command == "install") install()
  else if (command == "build") build()
  else if (command == "test") test()
  else if (command == "push") push()
  else if (command == "grep") grep()
  else if (command == "run") runCmd()
  else if (command == "watch") watch()
  else if (command == "changes") changes()
  else if (command == "changelog") buildChangelog(process.argv[3])
  else if (command == "set-version") setVersions(process.argv[3])
  else if (command == "modules") listModules()
  else if (command == "dev-start") devStart()
  else if (command == "dev-stop") devStop()
  else if (command == "mass-change") massChange()
  else if (command == "--help") help(0)
  else help(1)
}

function help(status) {
  console.log(`Usage:
  pm install [--ssh]      Clone and symlink the packages, install dependencies, build
  pm build                Build all modules
  pm status               Print out the git status of packages
  pm commit <args>        Run git commit in all packages that have changes
  pm push                 Run git push in packages that have new commits
  pm test                 Run the tests from all packages
  pm watch                Set up a process that rebuilds the packages on change
  pm grep <pattern>       Grep through the source code for all packages
  pm run <command>        Run the given command in each of the package dirs
  pm changes              Show commits since the last release for all packages
  pm mass-change <files> <pattern> <replacement>
                          Run a regexp-replace on the matching files in each package
  pm --help`)
  process.exit(status)
}

function run(cmd, args, wd) {
  return child.execFileSync(cmd, args, {cwd: wd, encoding: "utf8", stdio: ["ignore", "pipe", process.stderr]})
}

function failNotInstalled(module) {
  console.error("module `%s` is missing. Did you forget to run `pm install`?", module)
  process.exit(1)
}

function handleENOENT(f) {
  try {
    return f()
  } catch (e) {
    if (e.code == "ENOENT" && modsAndWebsite.includes(e.options.cwd)) failNotInstalled(e.options.cwd)
    else throw e
  }
}

function status() {
  handleENOENT(() => {
    modsAndWebsite.forEach(repo => {
      let output = run("git", ["status", "-sb"], repo)
      if (output != "## master...origin/master\n")
        console.log(repo + ":\n" + run("git", ["status"], repo))
    })
  })
}

function lintOptions(browser) {
  return {
    browser,
    ecmaVersion: 6,
    semicolons: false,
    namedFunctions: true,
    trailingCommas: true
  }
}

function lint() {
  let blint = require("blint")
  mods.forEach(repo => {
    let options = lintOptions(["view", "menu", "example-setup", "dropcursor", "gapcursor"].indexOf(repo) > -1)
    blint.checkDir(repo + "/src/", options)
    if (fs.existsSync(repo + "/test")) {
      options.allowedGlobals = ["it", "describe"]
      blint.checkDir(repo + "/test/", options)
    }
  })
  let websiteOptions = Object.assign(lintOptions(true), {
    allowedGlobals: ["__dirname", "process"],
    console: true
  })
  blint.checkDir("website/src/", websiteOptions)
  require("glob").sync("website/pages/examples/*/example.js").forEach(file => blint.checkFile(file, websiteOptions))
}

function commit() {
  handleENOENT(() => {
    modsAndWebsite.forEach(repo => {
      if (run("git", ["diff"], repo) || run("git", ["diff", "--cached"], repo))
        console.log(repo + ":\n" + run("git", ["commit"].concat(process.argv.slice(3)), repo))
    })
  })
}

function install() {
  let base = "https://github.com/prosemirror/"

  for (let i = 3; i < process.argv.length; i++) {
    let arg = process.argv[i]
    if (arg == "--ssh") { base = "git@github.com:ProseMirror/" }
    else help(1)
  }

  modsAndWebsite.forEach(repo => {
    if (fs.existsSync(repo)) {
      console.warn("Skipping cloning of " + repo + " (directory exists)")
      return
    }
    let origin = base + (repo == "website" ? "" : "prosemirror-") + repo + ".git"
    run("git", ["clone", origin, repo])
  })

  console.log("Running yarn install")
  run("yarn", ["install"])
  console.log("Building modules")
  build()
}

function build() {
  handleENOENT(() => {
    mods.forEach(repo => {
      console.log(repo + "...")
      run("npm", ["run", "build"], repo)
    })
  })
}

function test() {
  let mocha = new (require("mocha"))
  mods.forEach(repo => {
    if (!fs.existsSync(repo)) failNotInstalled(repo)
    if (repo == "view" || !fs.existsSync(repo + "/test")) return
    fs.readdirSync(repo + "/test").forEach(file => {
      if (/^test-/.test(file)) mocha.addFile(repo + "/test/" + file)
    })
  })
  mocha.run(failures => process.exit(failures))
}

function push() {
  handleENOENT(() => {
    modsAndWebsite.forEach(repo => {
      if (/\bahead\b/.test(run("git", ["status", "-sb"], repo)))
        run("git", ["push"], repo)
    })
  })
}

function grep() {
  let pattern = process.argv[3] || help(1), files = []
  let glob = require("glob")
  mods.forEach(repo => {
    if (!fs.existsSync(repo)) failNotInstalled(repo)
    files = files.concat(glob.sync(repo + "/src/*.js")).concat(glob.sync(repo + "/test/*.js"))
  })
  if (!fs.existsSync("website")) failNotInstalled("website")
  files = files.concat(glob.sync("website/src/**/*.js")).concat(glob.sync("website/pages/examples/*/*.js"))
  try {
    console.log(run("grep", ["--color", "-nH", "-e", pattern].concat(files.map(f => path.relative(origDir, f))), origDir))
  } catch(e) {
    process.exit(1)
  }
}

function runCmd() {
  let cmd = process.argv.slice(3)
  if (!cmd.length) help(1)
  try {
    handleENOENT(() => {
      mods.forEach(repo => {
        console.log(repo + ":")
          console.log(run(cmd[0], cmd.slice(1), repo))
      })
    })
  } catch (e) {
    console.log(e.toString())
    process.exit(1)
  }
}

function changes() {
  handleENOENT(() => {
    mods.forEach(repo => {
      let lastTag = run("git", ["describe", "master", "--tags", "--abbrev=0"], repo).trim()
      if (!lastTag) return console.log("No previous tag for " + repo + "\n")
      let history = run("git", ["log", lastTag + "..master"], repo).trim()
      if (history) console.log(repo + ":\n" + "=".repeat(repo.length + 1) + "\n\n" + history + "\n")
    })
  })
}

function changelog(repo, since) {
  let tag = since || run("git", ["describe", "master", "--tags", "--abbrev=0"], repo).trim()
  let commits = run("git", ["log", "--format=%B", "--reverse", tag + "..master"], repo)
  let result = {fix: [], feature: [], breaking: [], tag}
  let re = /\n\n(BREAKING|FIX|FEATURE):\s*([^]*?)(?=\n\n|\n?$)/g, match
  while (match = re.exec(commits)) result[match[1].toLowerCase()].push(match[2].replace(/\n/g, " "))
  return result
}

function buildChangelog(version) {
  function pad(n) { return n < 10 ? "0" + n : n }
  let d = new Date, date = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())

  let file = "http://prosemirror.net/docs/ref/version/" + version + ".html"
  let types = {breaking: "Breaking changes", fix: "Bug fixes", feature: "New features"}

  main.forEach(repo => {
    let log = changelog(repo)
    if (log.fix.length || log.feature.length || log.breaking.length) {
      console.log(`## [prosemirror-${repo}](${file}#${repo}) ${version} (${date})` + "\n")
      for (let type in types) {
        let messages = log[type]
        if (messages.length) console.log("### " + types[type] + "\n")
        messages.forEach(message => console.log(message.replace(/\]\(##/g, "](" + file + "#") + "\n"))
      }
    }
  })
}

let semver = /^(\^|~)?(\d+)\.(\d+)\.(\d+)$/

function updateVersion(repo, versions) {
  let file = repo + "/package.json"
  let result = fs.readFileSync(file, "utf8")
    .replace(/"version":\s*".*?"/, `"version": "${versions[repo]}"`)
    .replace(/"prosemirror-(.*?)":\s*"(.*)?"/g, (match, mod, version) => {
      let newVer = semver.exec(versions[mod])
      if (!newVer) return match
      let oldVer = semver.exec(version)
      // If only patch version, or nothing at all, changed, leave alone
      if (oldVer[2] == newVer[2] && oldVer[3] == newVer[3]) return match
      return `"prosemirror-${mod}": "${oldVer[1]}${versions[mod]}"`
    })
  fs.writeFileSync(file, result)
}

function setVersions(version) {
  let versions = {}
  mods.forEach(repo => versions[repo] = version)
  versions["website"] = "0.0.1"
  modsAndWebsite.forEach(repo => updateVersion(repo, versions))
}

function listModules() {
  console.log((process.argv.indexOf("--core") > -1 ? main : mods).join("\n"))
}

function watch() {
  const {watch} = require("rollup")
  let configs = mods.map(repo => {
    if (!fs.existsSync(repo)) failNotInstalled(repo)
    let conf = require("../" + repo + "/rollup.config")
    conf.input = path.resolve(repo, conf.input)
    conf.output.file = path.resolve(repo, conf.output.file)
    conf.watch = {exclude: ['node_modules/**']}
    return conf
  })
  let watcher = watch(configs), cwd = process.cwd()
  function name(input) { return input.slice(cwd.length + 1).match(/[^\/]*/)[0] }
  watcher.on("event", event => {
    if (event.code == "FATAL") {
      console.log(event.error + "")
      process.exit(1)
    } else if (event.code == "ERROR") {
      console.log(event.error + "")
    } else if (event.code == "BUNDLE_START") {
      console.log("Bundling " + name(event.input))
    } else if (event.code == "BUNDLE_END") {
      console.log("Finished bundling " + name(event.input))
    }
  })
  process.on("exit", () => watcher.close())
}

const pidFile = __dirname + "/.pm-dev.pid"
function devPID() {
  try { return JSON.parse(fs.readFileSync(__dirname + "/.pm-dev.pid", "utf8")) }
  catch(_) { return null }
}

function devStart() {
  let pid = devPID()
  if (pid != null) {
    console.log("Dev server already running at pid " + pid)
    return
  }

  fs.writeFileSync(pidFile, process.pid + "\n")
  function del() { fs.unlink(pidFile); console.log("Stop") }
  function delAndExit() { del(); process.exit() }
  process.on("exit", del)
  process.on("SIGINT", delAndExit)
  process.on("SIGTERM", delAndExit)

  let root = path.resolve(__dirname, "../demo")
  let ecstatic = require("ecstatic")({root})
  let moduleserver = new (require("moduleserve/moduleserver"))({root})

  require("http").createServer(function(req, resp) {
    moduleserver.handleRequest(req, resp) || ecstatic(req, resp)
  }).listen(8080, "127.0.0.1")
  console.log("Dev server listening on 8080")

  watch()
}

function devStop() {
  let pid = devPID()
  if (pid == null) {
    console.log("Dev server not running")
  } else {
    process.kill(pid, "SIGTERM")
    console.log("Killed dev server with pid " + pid)
  }
}

function massChange() {
  if (process.argv.length != 6) help(1) // FIXME: replacement optional?
  let [file, pattern, replacement] = process.argv.slice(3)
  let re = new RegExp(pattern, "g")
  modsAndWebsite.forEach(repo => {
    if (!fs.existsSync(repo)) failNotInstalled(repo)
    let glob = require("glob")
    glob.sync(repo + "/" + file).forEach(file => {
      let content = fs.readFileSync(file, "utf8"), changed = content.replace(re, replacement)
      if (changed != content) {
        console.log("Updated " + file)
        fs.writeFileSync(file, changed)
      }
    })
  })
}

start()
