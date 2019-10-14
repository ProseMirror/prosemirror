#!/usr/bin/env node

let origDir = process.cwd()
process.chdir(__dirname + "/..")

// NOTE: Don't require anything from node_modules here, since the
// install script has to be able to run _before_ that exists.
let child = require("child_process"), fs = require("fs"), path = require("path")

let main = ["model", "transform", "state", "view",
            "keymap", "inputrules", "history", "collab", "commands", "gapcursor",
            "schema-basic", "schema-list"]
let mods = main.concat(["menu", "example-setup", "markdown", "dropcursor", "test-builder", "changeset"])
let modsAndWebsite = mods.concat("website")

function start() {
  let command = process.argv[2]
  if (command && !["install", "--help"].includes(command)) assertInstalled()
  let args = process.argv.slice(3)
  let cmdFn = {
    "status": status,
    "lint": lint,
    "commit": commit,
    "install": install,
    "build": build,
    "test": test,
    "push": push,
    "grep": grep,
    "run": runCmd,
    "watch": watch,
    "changes": changes,
    "modules": listModules,
    "release": release,
    "dev-start": devStart,
    "dev-stop": devStop,
    "mass-change": massChange,
    "--help": showHelp
  }[command]
  if (!cmdFn || cmdFn.length > args.length) help(1)
  cmdFn.apply(null, args)
}

function showHelp() {
  help(0)
}

function help(status) {
  console.log(`Usage:
  pm install [--ssh]      Clone and symlink the packages, install dependencies, build
  pm build                Build all modules
  pm status               Print out the git status of packages
  pm commit <args>        Run git commit in all packages that have changes
  pm push                 Run git push in packages that have new commits
  pm test                 Run the tests from all packages
  pm lint                 Run the linter over all packages
  pm watch                Set up a process that rebuilds the packages on change
  pm grep <pattern>       Grep through the source code for all packages
  pm run <command>        Run the given command in each of the package dirs
  pm changes              Show commits since the last release for all packages
  pm mass-change <files> <pattern> <replacement>
                          Run a regexp-replace on the matching files in each package
  pm release <module>     Generate a new release for the given module.
  pm modules [--core]     Emit a list of all package names
  pm dev-start            Start development server
  pm dev-stop             Stop development server, if running
  pm --help`)
  process.exit(status)
}

function assertInstalled() {
  modsAndWebsite.forEach(repo => {
    if (!fs.existsSync(repo)) {
      console.error("module `%s` is missing. Did you forget to run `pm install`?", repo)
      process.exit(1)
    }
  })
}

function run(cmd, args, wd) {
  return child.execFileSync(cmd, args, {cwd: wd, encoding: "utf8", stdio: ["ignore", "pipe", process.stderr]})
}

function status() {
  modsAndWebsite.forEach(repo => {
    let output = run("git", ["status", "-sb"], repo)
    if (output != "## master...origin/master\n")
      console.log(repo + ":\n" + run("git", ["status"], repo))
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
  
  function checkDir(dir, options) {
    fs.readdirSync(dir).forEach(file => {
      let fname = dir + "/" + file
      if (/\.js$/.test(file)) {
        let opts = file === 'warn.js' ? Object.assign(options, {console: true}) : options
        blint.checkFile(fname, opts)
      }
      else if (fs.lstatSync(fname).isDirectory()) checkDir(fname, options)
    });
  }

  mods.forEach(repo => {
    let options = lintOptions(["view", "menu", "example-setup", "dropcursor", "gapcursor", "inputrules"].indexOf(repo) > -1)
    checkDir(repo + "/src/", options)
    if (fs.existsSync(repo + "/test")) {
      options.allowedGlobals = ["it", "describe"]
      checkDir(repo + "/test/", options)
    }
  })
  let websiteOptions = Object.assign(lintOptions(true), {
    allowedGlobals: ["__dirname", "process"],
    console: true
  })
  checkDir("website/src/", websiteOptions)
  require("glob").sync("website/pages/examples/*/example.js").forEach(file => blint.checkFile(file, websiteOptions))
}

function commit(...args) {
  modsAndWebsite.forEach(repo => {
    if (run("git", ["diff"], repo) || run("git", ["diff", "--cached"], repo))
      console.log(repo + ":\n" + run("git", ["commit"].concat(args), repo))
  })
}

function install(arg = null) {
  let base = "https://github.com/prosemirror/"
  if (arg == "--ssh") { base = "git@github.com:ProseMirror/" }
  else if (arg != null) help(1)

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
  mods.forEach(repo => {
    console.log(repo + "...")
    run("npm", ["run", "build"], repo)
  })
}

function test() {
  let mocha = new (require("mocha"))
  mods.forEach(repo => {
    if (repo == "view" || !fs.existsSync(repo + "/test")) return
    fs.readdirSync(repo + "/test").forEach(file => {
      if (/^test-/.test(file)) mocha.addFile(repo + "/test/" + file)
    })
  })
  mocha.run(failures => process.exit(failures))
}

function push() {
  modsAndWebsite.forEach(repo => {
    if (/\bahead\b/.test(run("git", ["status", "-sb"], repo)))
      run("git", ["push"], repo)
  })
}

function grep(pattern) {
  let files = []
  let glob = require("glob")
  mods.forEach(repo => {
    files = files.concat(glob.sync(repo + "/src/*.js")).concat(glob.sync(repo + "/test/*.js"))
  })
  files = files.concat(glob.sync("website/src/**/*.js")).concat(glob.sync("website/pages/examples/*/*.js"))
  try {
    console.log(run("grep", ["--color", "-nH", "-e", pattern].concat(files.map(f => path.relative(origDir, f))), origDir))
  } catch(e) {
    process.exit(1)
  }
}

function runCmd(cmd, ...args) {
  mods.forEach(repo => {
    console.log(repo + ":")
    try {
      console.log(run(cmd, args, repo))
    } catch (e) {
      console.log(e.toString())
      process.exit(1)
    }
  })
}

function changes() {
  mods.forEach(repo => {
    let lastTag = run("git", ["describe", "master", "--tags", "--abbrev=0"], repo).trim()
    if (!lastTag) return console.log("No previous tag for " + repo + "\n")
    let history = run("git", ["log", lastTag + "..master"], repo).trim()
    if (history) console.log(repo + ":\n" + "=".repeat(repo.length + 1) + "\n\n" + history + "\n")
  })
}

function release(mod) {
  let currentVersion = require("../" + mod + "/package.json").version
  let changes = changelog(mod, currentVersion)
  let newVersion = bumpVersion(currentVersion, changes)
  console.log(`Creating prosemirror-${mod} ${newVersion}`)

  let notes = releaseNotes(mod, changes, newVersion)

  setModuleVersion(mod, newVersion)
  if (changes.breaking.length) setDepVersion(mod, newVersion)
  fs.writeFileSync(mod + "/CHANGELOG.md", notes.head + notes.body + fs.readFileSync(mod + "/CHANGELOG.md", "utf8"))
  run("git", ["add", "package.json"], mod)
  run("git", ["add", "CHANGELOG.md"], mod)
  run("git", ["commit", "-m", `Mark version ${newVersion}`], mod)
  run("git", ["tag", newVersion, "-m", `Version ${newVersion}\n\n${notes.body}`, "--cleanup=verbatim"], mod)
}

function changelog(repo, since) {
  let commits = run("git", ["log", "--format=%B", "--reverse", since + "..master"], repo)
  let result = {fix: [], feature: [], breaking: []}
  let re = /\n\r?\n(BREAKING|FIX|FEATURE):\s*([^]*?)(?=\r?\n\r?\n|\r?\n?$)/g, match
  while (match = re.exec(commits)) result[match[1].toLowerCase()].push(match[2].replace(/\r?\n/g, " "))
  return result
}

function bumpVersion(version, changes) {
  let [major, minor, patch] = version.split(".")
  if (changes.breaking.length) return `${Number(major) + 1}.0.0`
  if (changes.feature.length) return `${major}.${Number(minor) + 1}.0`
  if (changes.fix.length) return `${major}.${minor}.${Number(patch) + 1}`
  throw new Error("No new release notes!")
}

function releaseNotes(mod, changes, version) {
  let pad = n => n < 10 ? "0" + n : n
  let d = new Date, date = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())

  let types = {breaking: "Breaking changes", fix: "Bug fixes", feature: "New features"}

  let refTarget = "https://prosemirror.net/docs/ref/"
  let head = `## ${version} (${date})\n\n`, body = ""
  for (let type in types) {
    let messages = changes[type]
    if (messages.length) body += `### ${types[type]}\n\n`
    messages.forEach(message => body += message.replace(/\]\(##/g, "](" + refTarget + "#") + "\n\n")
  }
  return {head, body}
}

function setModuleVersion(mod, version) {
  let file = mod + "/package.json"
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/"version":\s*".*?"/, `"version": "${version}"`))
}

function setDepVersion(mod, version) {
  modsAndWebsite.forEach(repo => {
    if (repo == mod) return
    let file = repo + "/package.json", text = fs.readFileSync(file, "utf8")
    let result = text.replace(/"prosemirror-(.*?)":\s*".*?"/g, (match, dep) => {
      return dep == mod ? `"prosemirror-${mod}": "^${version}"` : match
    })
    if (result != text) {
      fs.writeFileSync(file, result)
      run("git", ["add", "package.json"], repo)
      run("git", ["commit", "-m", `Upgrade prosemirror-${mod} dependency`], repo)
    }
  })
}

function listModules() {
  console.log((process.argv.includes("--core") ? main : mods).join("\n"))
}

function watch() {
  const {watch} = require("rollup")
  let configs = mods.map(repo => {
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
  try { return JSON.parse(fs.readFileSync(pidFile, "utf8")) }
  catch(_) { return null }
}

function devStart() {
  let pid = devPID()
  if (pid != null) {
    try { run("ps", ["-p", String(pid)]) }
    catch (_) { pid = null }
  }
  if (pid != null) {
    console.log("Dev server already running at pid " + pid)
    return
  }

  fs.writeFileSync(pidFile, process.pid + "\n")
  function del() { fs.unlink(pidFile, () => {}); console.log("Stop") }
  function delAndExit() { del(); process.exit() }
  process.on("exit", del)
  process.on("SIGINT", delAndExit)
  process.on("SIGTERM", delAndExit)

  let root = path.resolve(__dirname, "../demo")
  let ecstatic = require("ecstatic")({root})
  let moduleserver = new (require("moduleserve/moduleserver"))({root})

  require("http").createServer(function(req, resp) {
    moduleserver.handleRequest(req, resp) || ecstatic(req, resp)
  }).listen(8080, process.argv.includes("--open") ? undefined : "127.0.0.1")
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

function massChange(file, pattern, replacement = "") {
  let re = new RegExp(pattern, "g")
  modsAndWebsite.forEach(repo => {
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
