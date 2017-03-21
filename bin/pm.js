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

let child = require("child_process"), fs = require("fs"), path = require("path")
let glob = require("glob")

let main = ["model", "transform", "state", "view",
            "keymap", "inputrules", "history", "collab", "commands",
            "schema-basic", "schema-list", "schema-table"]
let mods = main.concat(["menu", "example-setup", "markdown", "dropcursor", "test-builder"])
let modsAndWebsite = mods.concat("website")

function start() {
  let command = process.argv[2]

  if (command == "status") status()
  else if (command == "lint") lint()
  else if (command == "commit") commit()
  else if (command == "clone") clone()
  else if (command == "test") test()
  else if (command == "push") push()
  else if (command == "grep") grep()
  else if (command == "run") runCmd()
  else if (command == "changes") changes()
  else if (command == "changelog") buildChangelog(process.argv[3])
  else if (command == "link-src") linkSrc()
  else if (command == "set-version") setVersions(process.argv[3])
  else if (command == "modules") listModules()
  else if (command == "--help") help(0)
  else help(1)
}

function help(status) {
  console.log(`Usage:
  pm clone [--ssh]        Clone and symlink the packages
  pm status               Print out the git status of packages
  pm commit <args>        Run git commit in all packages that have changes
  pm push                 Run git push in packages that have new commits
  pm test                 Run the tests from all packages
  pm grep <pattern>       Grep through the source code for all packages
  pm run <command>        Run the given command in each of the package dirs
  pm link-src             Symlink dist to src in all modules
  pm changes              Show commits since the last release for all packages
  pm --help`)
  process.exit(status)
}

function run(cmd, args, wd) {
  return child.execFileSync(cmd, args, {cwd: wd, encoding: "utf8"})
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
  mods.forEach(repo => {
    let options = lintOptions(["view", "menu", "example-setup", "dropcursor"].indexOf(repo) > -1)
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
  glob.sync("website/pages/examples/*/example.js").forEach(file => blint.checkFile(file, websiteOptions))
}

function commit() {
  modsAndWebsite.forEach(repo => {
    if (run("git", ["diff"], repo) || run("git", ["diff", "--cached"], repo))
      console.log(repo + ":\n" + run("git", ["commit"].concat(process.argv.slice(3)), repo))
  })
}

function clone() {
  let base = "https://github.com/prosemirror/"

  for (let i = 3; i < process.argv.length; i++) {
    let arg = process.argv[i]
    if (arg == "--ssh") { base = "git@github.com:ProseMirror/" }
    else help(1)
  }

  modsAndWebsite.forEach(repo => {
    run("rm", ["-rf", repo])
    let origin = base + (repo == "website" ? "" : "prosemirror-") + repo + ".git"
    run("git", ["clone", origin, repo])
  })

  modsAndWebsite.concat("prebuilt").forEach(repo => {
    run("mkdir", ["node_modules"], repo)
    let pkg = JSON.parse(fs.readFileSync(repo + "/package.json"), "utf8"), link = Object.create(null)
    function add(name) {
      let match = /^prosemirror-(.*)$/.exec(name)
      if (match) link[match[1]] = true
    }
    Object.keys(pkg.dependencies || {}).forEach(add)
    Object.keys(pkg.devDependencies || {}).forEach(add)
    for (let dep in link)
      run("ln", ["-s", "../../" + dep, "node_modules/prosemirror-" + dep], repo)
  })

  modsAndWebsite.forEach(repo => {
    run("npm", ["install"], repo)
  })

  mods.forEach(repo => {
    run("ln", ["-s", "../" + repo, "prosemirror-" + repo], "node_modules")
  })
}

function test() {
  let mocha = new (require("../model/node_modules/mocha"))
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

function grep() {
  let pattern = process.argv[3] || help(1), files = []
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

function runCmd() {
  let cmd = process.argv.slice(3)
  if (!cmd.length) help(1)
  mods.forEach(repo => {
    console.log(repo + ":")
    try {
      console.log(run(cmd[0], cmd.slice(1), repo))
    } catch (e) {
      console.log(e.toString())
      process.exit(1)
    }
  })
}

function linkSrc() {
  mods.forEach(repo => {
    run("rm", ["-rf", "dist"], repo)
    run("ln", ["-s", "src", "dist"], repo)
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

start()
