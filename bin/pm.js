#!/usr/bin/env node

process.chdir(__dirname + "/..")

let child = require("child_process"), fs = require("fs")

let core = ["model", "transform", "state", "view", "inputrules", "history", "collab", "schema-basic", "schema-list", "schema-table"]
let all = core.concat(["menu", "prompt", "example-setup"])

let command = process.argv[2]

if (command == "status") {
  status()
} else if (command == "commit") {
  commit()
} else if (command == "clone") {
  clone()
} else if (command == "test") {
  test()
} else if (command == "push") {
  push()
} else if (command == "--help") {
  help(0)
} else {
  help(1)
}

function help(status) {
  console.log(`Usage:
  pm clone [--ssh]
  pm status
  pm commit -m <message>
  pm test
  pm push
  pm --help`)
  process.exit(status)
}

function run(cmd, args, repo) {
  return child.execFileSync(cmd, args, {cwd: repo, encoding: "utf8"})
}

function status() {
  core.forEach(repo => {
    let output = run("git", ["status", "-sb"], repo)
    if (output != "## master...origin/master\n")
      console.log(repo + ":\n" + run("git", ["status"], repo))
  })
}

function commit() {
  let message
  for (let i = 3; i < process.argv.length; i++) {
    let arg = process.argv[i]
    if (arg == "-m") { message = process.argv[++i] }
    else help(1)
  }
  if (!message) help(1)

  core.forEach(repo => {
    if (run("git", ["diff"], repo))
      console.log(repo + ":\n" + run("git", ["commit", "-a", "-m", message], repo))
  })
}

function clone() {
  let origin = "https://github.com/prosemirror/prosemirror-___.git"
  for (let i = 3; i < process.argv.length; i++) {
    let arg = process.argv[i]
    if (arg == "--ssh") { origin = "git@github.com:ProseMirror/prosemirror-___.git" }
    else help(1)
  }

  core.forEach(repo => {
    run("rm", ["-rf", repo])
    run("git", ["clone", origin.replace("___", repo), repo])
  })

  core.forEach(repo => {
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

  core.forEach(repo => {
    run("npm", ["install"], repo)
  })
}

function test() {
  let mocha = new (require("../model/node_modules/mocha"))
  core.forEach(repo => {
    if (repo == "view" || !fs.existsSync(repo + "/test")) return
    fs.readdirSync(repo + "/test").forEach(file => {
      if (/^test-/.test(file)) mocha.addFile(repo + "/test/" + file)
    })
  })
  mocha.run(failures => process.exit(failures))
}

function push() {
  core.forEach(repo => {
    if (/\bahead\b/.test(run("git", ["status", "-sb"], repo)))
      run("git", ["push"], repo)
  })
}
