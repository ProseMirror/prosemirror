// !! This module implements the ProseMirror editor. It contains
// functionality related to editing, selection, and integration with
// the browser. `ProseMirror` is the class you'll want to instantiate
// and interact with when using the editor.

export {ProseMirror} from "./main"
export {Selection, TextSelection, NodeSelection} from "./selection"
export {MarkedRange} from "./range"
export {chain, deleteSelection, joinBackward, joinForward, deleteCharBefore,
        deleteWordBefore, deleteCharAfter, deleteWordAfter, joinUp, joinDown,
        lift, newlineInCode, createParagraphNear, liftEmptyBlock, splitBlock,
        selectParentNode, undo, redo, defaultEnter, baseKeymap} from "./base_commands"
export {Plugin} from "./plugin"

export {default as Keymap} from "browserkeymap"
