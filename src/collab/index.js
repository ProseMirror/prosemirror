const {Plugin} = require("../edit")
const {Transform} = require("../transform")
const {Subscription} = require("subscription")

const {rebaseSteps} = require("./rebase")
exports.rebaseSteps = rebaseSteps

// !! This module implements an API into which a communication channel
// for collaborative editing can be hooked. See [this
// guide](guide/collab.html) for more details and an example.

function randomID() { return Math.floor(Math.random() * 0xFFFFFFFF) }

// ;; This class accumulates changes that have to be sent to the
// central authority in the collaborating group, signals an event when
// it has something to send, and makes it possible to integrate
// changes made by peers into our local document. It is created and
// attached to the editor when the [plugin](#collabEditing) is enabled,
// and can be accessed with
// [`collabEditing.get`](#Plugin.get).
class Collab {
  constructor(pm, options) {
    this.pm = pm
    this.clientID = randomID()

    // :: number
    // The version number of the last update received from the central
    // authority. Starts at 0 or the value of the `version` property
    // in the option object, for the editor's value when the option
    // was enabled.
    this.version = options.version
    this.versionDoc = pm.doc
    if (pm.history) pm.history.preserveItems++

    this.unconfirmedSteps = []
    this.unconfirmedMaps = []

    // :: Subscription<()>
    // Fired when there are new steps to send to the central
    // authority. Consumers should respond by calling
    // `sendableSteps` and pushing those to the authority.
    this.mustSend = new Subscription

    // :: Subscription<(transform: Transform, selectionBeforeTransform: Selection)>
    // Signals that a transformation has been aplied to the editor.
    // Passes the `Transform` and the selection before the transform
    // as arguments to the handler.
    this.receivedTransform = new Subscription

    pm.on.transform.add(this.onTransform = transform => {
      for (let i = 0; i < transform.steps.length; i++) {
        this.unconfirmedSteps.push(transform.steps[i])
        this.unconfirmedMaps.push(transform.maps[i])
      }
      this.mustSend.dispatch()
    })
    pm.on.beforeSetDoc.add(this.onSetDoc = () => {
      throw new RangeError("setDoc is not supported on a collaborative editor")
    })
  }

  detach() {
    this.pm.on.transform.remove(this.onTransform)
    this.pm.on.beforeSetDoc.remove(this.onSetDoc)
    if (this.pm.history) this.pm.history.preserveItems++
  }

  // :: () → bool
  // Reports whether the editor has any unsent steps.
  hasSendableSteps() {
    return this.unconfirmedSteps.length > 0
  }

  // :: () → {version: number, steps: [Step]}
  // Provides the data describing the editor's unconfirmed steps. The
  // version and array of steps are the things you'd send to the
  // central authority. The whole return value must be passed to
  // [`confirmSteps`](#Collab.confirmSteps) when the steps go through.
  sendableSteps() {
    return {
      version: this.version,
      steps: this.unconfirmedSteps.slice(),
      clientID: this.clientID
    }
  }

  // :: ([Step], [number]) → [PosMap]
  // Pushes a set of steps (received from the central authority) into
  // the editor. Will recognize its own changes, and confirm
  // unconfirmed steps as appropriate. Remaining unconfirmed steps
  // will be rebased over remote steps.
  //
  // Returns the [position maps](#PosMap) produced by applying the
  // steps.
  receive(steps, clientIDs) {
    // Find out which prefix of the steps originated with us
    let ours = 0
    while (ours < clientIDs.length && clientIDs[ours] == this.clientID) ++ours

    this.version += steps.length
    if (ours == clientIDs.length && ours == this.unconfirmedSteps.length) {
      // If all steps originated with us, and we didn't make any new
      // steps in the meantime, we simply forward the confirmed state
      // to the current state.
      this.versionDoc = this.pm.doc
      this.unconfirmedSteps.length = this.unconfirmedMaps.length = 0
      return []
    }

    let transform = new Transform(this.versionDoc)
    steps.forEach(step => transform.step(step))
    this.versionDoc = transform.doc

    // Move the remaining unconfirmed steps across the new steps
    let newMaps = transform.maps.slice(ours)
    let rebased = rebaseSteps(transform.doc, newMaps,
                              this.unconfirmedSteps.slice(ours), this.unconfirmedMaps.slice(ours))
    this.unconfirmedSteps = rebased.transform.steps.slice()
    this.unconfirmedMaps = rebased.transform.maps.slice()

    let selectionBefore = this.pm.selection
    this.pm.updateDoc(rebased.doc, rebased.mapping)
    if (this.pm.history) this.pm.history.rebased(newMaps, rebased.transform, rebased.positions)
    this.receivedTransform.dispatch(transform, selectionBefore)
    return transform.maps
  }
}

// :: Plugin
//
// Enables the collaborative editing framework for the editor.
//
// You can pass a `version` option, which determines the starting
// version number of the collaborative editing, and defaults to 0.
const collabEditing = new Plugin(Collab, {
  version: 0
})
exports.collabEditing = collabEditing
