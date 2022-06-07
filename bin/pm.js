#!/usr/bin/env node

// NOTE: Don't require anything from node_modules here, since the
// install script has to be able to run _before_ that exists.
let child = require("child_process"), fs = require("fs"), path = require("path")

const {join} = path

let main = ["model", "transform", "state", "view",
            "keymap", "inputrules", "history", "collab", "commands", "gapcursor",
            "schema-basic", "schema-list"]
let mods = main.concat(["menu", "example-setup", "markdown", "dropcursor", "test-builder", "changeset"])
let modsAndWebsite = mods.concat("website")

let projectDir = join(__dirname, "..")

function joinP(...args) {
  return join(projectDir, ...args)
}

function mainFile(pkg) {
  let index = joinP(pkg, "src", "index.ts"), self = joinP(pkg, "src", pkg + ".ts")
  if (fs.existsSync(index)) return index
  if (fs.existsSync(self)) return self
  throw new Error("Couldn't find a main file for " + pkg)
}

function start() {
  let command = process.argv[2]
  if (command && !["install", "--help", "modules"].includes(command)) assertInstalled()
  let args = process.argv.slice(3)
  let cmdFn = {
    "status": status,
    "commit": commit,
    "install": install,
    "build": build,
    "test": test,
    "push": push,
    "pull": pull,
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
  pm pull                 Run git pull in all packages
  pm test                 Run the tests from all packages
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
    if (!fs.existsSync(joinP(repo))) {
      console.error("module `%s` is missing. Did you forget to run `pm install`?", repo)
      process.exit(1)
    }
  })
}

function run(cmd, args, pkg) {
  return child.execFileSync(cmd, args, {
    cwd: pkg === null ? undefined : pkg ? joinP(pkg) : projectDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", process.stderr]
  })
}

function status() {
  modsAndWebsite.forEach(repo => {
    let output = run("git", ["status", "-sb"], repo)
    if (output != "## master...origin/master\n")
      console.log(repo + ":\n" + run("git", ["status"], repo))
  })
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
    if (fs.existsSync(joinP(repo))) {
      console.warn("Skipping cloning of " + repo + " (directory exists)")
      return
    }
    let origin = base + (repo == "website" ? "" : "prosemirror-") + repo + ".git"
    run("git", ["clone", origin, repo])
  })

  console.log("Running npm install")
  run("npm", ["install"])
  console.log("Building modules")
  build()
}

async function build() {
  console.info("Building...")
  let t0 = Date.now()
  await require("@marijn/buildtool").build(mods.map(mainFile), buildOptions)
  console.info(`Done in ${((Date.now() - t0) / 1000).toFixed(2)}s`)
}

function test(...args) {
  let runTests = require("@marijn/testtool")
  let {tests, browserTests} = runTests.gatherTests(mods.map(m => joinP(m)))
  let browsers = [], grep, noBrowser = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] == "--firefox") browsers.push("firefox")
    if (args[i] == "--chrome") browser.push("chrome")
    if (args[i] == "--no-browser") noBrowser = true
    if (args[i] == "--grep") grep = args[++i]
  }
  if (!browsers.length && !noBrowser) browsers.push("chrome")
  runTests.runTests({tests, browserTests, browsers, grep}).then(failed => process.exit(failed ? 1 : 0))
}

function push() {
  modsAndWebsite.forEach(repo => {
    if (/\bahead\b/.test(run("git", ["status", "-sb"], repo)))
      run("git", ["push"], repo)
  })
}

function pull() {
  modsAndWebsite.forEach(repo => run("git", ["pull"], repo))
}

function grep(pattern) {
  let files = []
  let glob = require("glob")
  mods.forEach(repo => {
    files = files.concat(glob.sync(joinP(repo, "src", "*.ts"))).concat(glob.sync(joinP(repo, "test", "*.ts")))
  })
  files = files.concat(glob.sync(joinP("website", "src", "**", "*.js")))
    .concat(glob.sync(joinP("website", "pages", "examples", "*", "*.js")))
  try {
    console.log(run("grep", ["--color", "-nH", "-e", pattern].concat(files.map(f => path.relative(process.cwd(), f))), null))
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

function editReleaseNotes(notes) {
  let noteFile = join(projectDir, "notes.txt")
  fs.writeFileSync(noteFile, notes.head + notes.body)
  run(process.env.EDITOR || "emacs", [noteFile], null)
  let edited = fs.readFileSync(noteFile)
  fs.unlinkSync(noteFile)
  if (!/\S/.test(edited)) process.exit(0)
  let split = /^(.*)\n+([^]*)/.exec(edited)
  return {head: split[1] + "\n\n", body: split[2]}
}

function release(mod, ...args) {
  let currentVersion = require(join("..", mod, "package.json")).version
  let noteArg = args.indexOf("--notes")
  let extra = noteArg > -1 ? args[noteArg + 1] : null
  let changes = changelog(mod, currentVersion, extra)
  let newVersion = bumpVersion(currentVersion, changes)
  console.log(`Creating prosemirror-${mod} ${newVersion}`)

  let notes = releaseNotes(mod, changes, newVersion)
  if (args.indexOf("--edit") > -1) nodes = editReleaseNotes(notes)

  setModuleVersion(mod, newVersion)
  if (changes.breaking.length) setDepVersion(mod, newVersion)
  fs.writeFileSync(joinP(mod, "CHANGELOG.md"), notes.head + notes.body + fs.readFileSync(joinP(mod, "CHANGELOG.md"), "utf8"))
  run("git", ["add", "package.json"], mod)
  run("git", ["add", "CHANGELOG.md"], mod)
  run("git", ["commit", "-m", `Mark version ${newVersion}`], mod)
  run("git", ["tag", newVersion, "-m", `Version ${newVersion}\n\n${notes.body}`, "--cleanup=verbatim"], mod)
}

function changelog(repo, since, extra) {
  let commits = run("git", ["log", "--format=%B", "--reverse", since + "..master"], repo)
  if (extra) commits += "\n\n" + extra
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
  let file = joinP(mod, "package.json")
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/"version":\s*".*?"/, `"version": "${version}"`))
}

function setDepVersion(mod, version) {
  modsAndWebsite.forEach(repo => {
    if (repo == mod) return
    let file = joinP(repo, "package.json"), text = fs.readFileSync(file, "utf8")
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

const buildOptions = {
  tsOptions: {allowSyntheticDefaultImports: true}
}

function watch() {
  require("@marijn/buildtool").watch(mods.map(mainFile), [join(__dirname, "..", "demo", "demo.ts")], buildOptions)
}

const pidFile = join(__dirname, ".pm-dev.pid")
function devPID() {
  try { return JSON.parse(fs.readFileSync(pidFile, "utf8")) }
  catch(_) { return null }
}

function startServer() {
  let serve = path.resolve(join(__dirname, "..", "demo"))
  let port = +(process.env.PORT || 8080)
  let moduleserver = new (require("esmoduleserve/moduleserver"))({root: serve, maxDepth: 2})
  let serveStatic = require("serve-static")(serve)
  require("http").createServer((req, resp) => {
    if (/^\/test\/?($|\?)/.test(req.url)) {
      let runTests = require("@codemirror/buildhelper/src/runtests")
      let {browserTests} = runTests.gatherTests(mods.map(m => joinP(m)))
      resp.writeHead(200, {"content-type": "text/html"})
      resp.end(runTests.testHTML(browserTests.map(f => path.relative(serve, f)), false))
    } else {
      moduleserver.handleRequest(req, resp) || serveStatic(req, resp, _err => {
        resp.statusCode = 404
        resp.end('Not found')
      })
    }
  }).listen(port, process.env.OPEN ? undefined : "127.0.0.1")
  console.log(`Dev server listening on ${port}`)
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

  startServer()
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
    glob.sync(joinP(repo, file)).forEach(file => {
      let content = fs.readFileSync(file, "utf8"), changed = content.replace(re, replacement)
      if (changed != content) {
        console.log("Updated " + file)
        fs.writeFileSync(file, changed)
      }
    })
  })
}

start()
