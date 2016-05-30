// !! This module implements the ProseMirror editor. It contains
// functionality related to editing, selection, and integration with
// the browser. `ProseMirror` is the class you'll want to instantiate
// and interact with when using the editor.

export {ProseMirror} from "./main"
export {Selection, TextSelection, NodeSelection} from "./selection"
export {MarkedRange} from "./range"
export {baseKeymap, defaultEnter} from "./keymap"
export {Plugin} from "./plugin"
import * as command from "./commands"
export {command}

export {default as Keymap} from "browserkeymap"
