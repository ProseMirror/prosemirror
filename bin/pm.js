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

let mods = ["model", "transform", "state", "view",
            "keymap", "inputrules", "history", "collab", "commands",
            "schema-basic", "schema-list", "schema-table",
            "menu", "example-setup"]

let command = process.argv[2]

if (command == "status") status()
else if (command == "lint") lint()
else if (command == "commit") commit()
else if (command == "clone") clone()
else if (command == "test") test()
else if (command == "push") push()
else if (command == "grep") grep()
else if (command == "run") runCmd()
else if (command == "--help") help(0)
else help(1)

function help(status) {
  console.log(`Usage:
  pm clone [--ssh]
  pm status
  pm commit -m <message>
  pm test
  pm push
  pm grep <pattern>
  pm run <command>
  pm --help`)
  process.exit(status)
}

function run(cmd, args, repo) {
  return child.execFileSync(cmd, args, {cwd: repo, encoding: "utf8"})
}

function status() {
  mods.forEach(repo => {
    let output = run("git", ["status", "-sb"], repo)
    if (output != "## master...origin/master\n")
      console.log(repo + ":\n" + run("git", ["status"], repo))
  })
}

function lint() {
  let blint = require("blint")
  mods.forEach(repo => {
    let options = {
      browser: ["view", "menu", "example-setup"].indexOf(repo) > -1,
      ecmaVersion: 6,
      semicolons: false,
      namedFunctions: true
    }
    blint.checkDir(repo + "/src/", options)
    if (fs.existsSync(repo + "/test")) {
      options.allowedGlobals = ["it", "describe"]
      blint.checkDir(repo + "/test/", options)
    }
  })
}

function commit() {
  mods.forEach(repo => {
    if (run("git", ["diff"], repo) || run("git", ["diff", "--cached"], repo))
      console.log(repo + ":\n" + run("git", ["commit"].concat(process.argv.slice(3)), repo))
  })
}

function clone() {
  let base = "https://github.com/prosemirror"
  let all = mods.concat("website")

  for (let i = 3; i < process.argv.length; i++) {
    let arg = process.argv[i]
    if (arg == "--ssh") { base = "git@github.com:ProseMirror" }
    else help(1)
  }

  all.forEach(repo => {
    run("rm", ["-rf", repo])
    let origin = base + (repo == "website" ? "" : "prosemirror-") + repo + ".git"
    run("git", ["clone", origin, repo])
  })

  all.forEach(repo => {
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

  all.forEach(repo => {
    run("npm", ["install"], repo)
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
  mods.forEach(repo => {
    if (/\bahead\b/.test(run("git", ["status", "-sb"], repo)))
      run("git", ["push"], repo)
  })
}

function grep() {
  let pattern = process.argv[3] || help(1), files = []
  mods.forEach(repo => {
    files = files.concat(glob.sync(repo + "/src/*.js")).concat(glob.sync(repo + "/test/*.js"))
  })
  files = files.concat(glob.sync("website/src/**/*.js"))
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
