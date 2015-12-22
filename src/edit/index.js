// !! This module implements the ProseMirror editor. It contains
// functionality related to editing, selection, and integration with
// the browser. `ProseMirror` is the class you'll want to instantiate
// and interact with when using the editor.

export {ProseMirror} from "./main"
export {defineOption, Registry, defaultRegistry} from "./options"
export {Range} from "./selection"
export {Keymap, keyName, keyNames} from "./keys"
export {MarkedRange} from "./range"
export {defineCommand, defineParamHandler, Command} from "./commands"
