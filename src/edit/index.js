// !! This module implements the ProseMirror editor. It contains
// functionality related to editing, selection, and integration with
// the browser. `ProseMirror` is the class you'll want to instantiate
// and interact with when using the editor.

export {ProseMirror} from "./main"
export {defineOption} from "./options"
export {Selection, TextSelection, NodeSelection} from "./selection"
export {MarkedRange} from "./range"
export {CommandSet, Command} from "./command"
export {baseCommands} from "./base_commands"
import "./schema_commands"

import Keymap from "browserkeymap"
export {Keymap}
