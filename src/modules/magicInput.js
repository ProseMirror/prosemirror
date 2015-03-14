import {defineModule} from "../module"
import "./interpretInput"

defineModule("magicInput", {
  init(pm) {
    let ii = pm.modules.interpretInput
    ii.defineReplacement("--", "—")
  },

  dependencies: {
    interpretInput: true
  }
})
