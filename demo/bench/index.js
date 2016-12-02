const {Fragment} = require("prosemirror-model")
const {doc, blockquote, p} = require("prosemirror-model/test/build")
const {EditorState} = require("prosemirror-state")
const {EditorView} = require("prosemirror-view")
const {history} = require("prosemirror-history")

const {example} = require("./example")
const {typeDoc} = require("./type")
const {mutateDoc} = require("./mutate")

function button(name, run) {
  var dom = document.createElement("button")
  dom.textContent = name
  dom.addEventListener("click", run)
  return dom
}

function group(name, ...buttons) {
  var wrap = document.querySelector("#buttons").appendChild(document.createElement("p"))
  wrap.textContent = name
  wrap.append(document.createElement("br"))
  buttons.forEach(b => wrap.append(" ", b))
}

function run(bench, options) {
  var t0 = Date.now(), steps = 0
  var startState = (options.state || options.view) && EditorState.create({doc: options.doc, plugins: options.plugins})
  var view = options.view && new EditorView(document.querySelector("#workspace"), {state: startState})
  var state, callback = tr => {
    ++steps
    if (state) {
      state = state.applyAction({type: "transform", time: Date.now(), transform: tr})
      if (view) view.updateState(state)
    }
  }
  var profile = document.querySelector("#profile").checked
  if (profile) console.profile(options.name)
  for (var i = 0, e = options.repeat || 1; i < e; i++) {
    state = startState
    bench(options, callback)
  }
  if (profile) console.profileEnd(options.name)
  console.log("'" + options.name + "' took " + (Date.now() - t0) + "ms for " + steps + " steps")
}

group("Type out a document", button("Plain", () => {
  run(typeDoc, {doc: example, name: "Type plain", profile: true, repeat: 6})
}), button("State", () => {
  run(typeDoc, {doc: example, name: "Type with state", profile: true, repeat: 6, state: true})
}), button("State + History", () => {
  run(typeDoc, {doc: example, name: "Type with state + history", profile: true, repeat: 6, state: true, plugins: [history()]})
}), button("View", () => {
  run(typeDoc, {doc: example, name: "Type with view", profile: true, repeat: 6, state: true, view: true})
}))

group("Mutate inside a document", button("small + shallow", () => {
  run(mutateDoc, {doc: doc(p("a"), p("b"), p("c")),
                  pos: 4, n: 100000, name: "Mutate small + shallow"})
}), button("small + deep", () => {
  run(mutateDoc, {doc: doc(p("a"), blockquote(blockquote(blockquote(blockquote(blockquote(blockquote(p("b"))))))), p("c")),
                  pos: 10, n: 100000, name: "Mutate small + deep"})
}), button("large + shallow", () => {
  var d = doc(p("a")), many = []
  for (var i = 0; i < 1000; i++) many.push(d.firstChild)
  run(mutateDoc, {doc: d.copy(Fragment.from(many)),
                  pos: 4, n: 100000, name: "Mutate large + shallow"})
}))
