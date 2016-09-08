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
  pm --help`)
  process.exit(status)
}

function run(cmd, args, repo) {
  return child.execFileSync(cmd, args, {cwd: repo, encoding: "utf8"})
}

function status() {
  core.forEach(repo => {
    let output = 
    if (output) console.log(repo + ":\n" + output)
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
    if (run("git", ["status", "--short"], repo))
      console.log(repo + ":\n" + run("git", ["commit", "-a", "-m", message], repo))
  })
}

function clone() {
  let origin = "https://github.com/prosemirror/prosemirror-@.git"
  for (let i = 3; i < process.argv.length; i++) {
    let arg = process.argv[i]
    if (arg == "--ssh") { origin = "git@github.com:ProseMirror/prosemirror-@.git" }
    else help(1)
  }
  if (!message) help(1)

  core.forEach(repo => {
    run("rm", ["-rf", repo])
    run("git", ["clone", origin.replace("@", repo), repo])
  })

  core.forEach(repo => {
    let pkg = require(repo + "/package.json"), link = Object.create(null)
    function add(name) {
      let match = /^prosemirror-(.*)$/.exec(name)
      if (match) link[match[1]] = true
    }
    Object.keys(pkg.dependencies || {}).forEach(add)
    Object.keys(pkg.devDependencies || {}).forEach(add)
    for (let dep in link)
      run("ln", ["-s", "../../" + link, "node_modules/prosemirror-" + link], repo)
  })

  core.forEach(repo => {
    run("npm", ["install"], repo)
  })
}
