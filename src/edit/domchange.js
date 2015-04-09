import {fromDOM, Node, Pos, style} from "../model"
import {replace} from "../transform"

import {findByPath} from "./selection"

export function applyDOMChange(pm) {
  let dom = pm.content, node = pm.doc
  let {from, to} = pm.sel.range
  for (let i = 0, path = [];; i++) {
    let fromOffset = from.path[i], toOffset = to.path[i]
    if (fromOffset == toOffset && i < from.path.length - 1) {
      dom = findByPath(dom, fromOffset)
      node = node.content[fromOffset]
      path.push(fromOffset)
    } else {
      let before = findByPath(dom, fromOffset - 1)
      let startOffset = before ? Array.prototype.indexOf.call(dom.childNodes, before) + 1 : 0
      let after = findByPath(dom, toOffset + 1, true)
      let endOffset = (after ? Array.prototype.indexOf.call(dom.childNodes, after) : dom.childNodes.length)

      let updated = docFromDOM(node, dom, startOffset, endOffset)
      let {doc: updatedDoc, path: updatedPath} = wrapAs(pm.doc, path, updated)
      let changeStart = findChangeStart(node, path, fromOffset, toOffset + 1, updated, updatedPath)
      if (changeStart) {
        let changeEnd = findChangeEnd(node, path, toOffset + 1, updated, updatedPath)
        let before = changeEnd.orig.cmp(changeStart.orig) < 0
        pm.apply(replace(pm.doc, changeStart.orig, before ? changeStart.orig : changeEnd.orig,
                         updatedDoc, changeStart.updated, before ? changeStart.updated : changeEnd.updated))
        return true
      } else {
        return false
      }
    }
  }
}

function docFromDOM(parent, dom, from, to) {
  return fromDOM(dom, {topNode: parent.copy(), from: from, to: to})
}

function wrapAs(doc, path, node) {
  let newPath = []
  for (let i = path.length - 1; i >= 0; i--) {
    node = doc.path(path.slice(0, i)).copy([node])
    newPath.push(0)
  }
  return {doc: node, path: newPath}
}

function findChangeStart(orig, origPath, origOffset, origEndOffset,
                         updated, updatedPath) {
  let changeOffset = null
  let inline = orig.type.contains == "inline"
  for (let i = 0, offset = 0;; i++) {
    if (i == updated.content.length) {
      if (i < origEndOffset) changeOffset = offset
      break
    } else if (i == origEndOffset) {
      changeOffset = offset
      break
    } else {
      let origChild = orig.content[i + origOffset]
      let updatedChild = updated.content[i]
      if (!origChild.sameMarkup(updatedChild)) {
        changeOffset = offset
        break
      } else if (inline) {
        if (!style.sameSet(origChild.styles, updatedChild.styles)) {
          changeOffset = offset
          break
        }
        if (origChild.text != updatedChild.text) {
          for (let j = 0; origChild.text[j] == updatedChild.text[j]; j++)
            offset++
          changeOffset = offset
          break
        }
        offset += origChild.text.length
      } else {
        let inner = findChangeStart(origChild, origPath.concat(origOffset + i), 0, origChild.content.length,
                                    updatedChild, updatedPath.concat(i))
        if (inner) return inner
        offset += 1
      }
    }
  }
  if (changeOffset != null)
    return {orig: new Pos(origPath, origOffset + changeOffset, inline),
            updated: new Pos(updatedPath, changeOffset, inline)}
}

function findChangeEnd(orig, origPath, origOffset,
                       updated, updatedPath) {
  let changeOffset = null
  let inline = orig.type.contains == "inline"
  let lenDiff = origOffset - updated.content.length
  let totalUpdatedOffset = inline ? updated.size : updated.content.length
  for (let i = updated.content.length - 1, offset = totalUpdatedOffset;; i--) {
    if (i < 0) {
      if (lenDiff) changeOffset = offset
      break
    } else if (i + lenDiff < 0) {
      changeOffset = offset
      break
    } else {
      let origChild = orig.content[i + lenDiff]
      let updatedChild = updated.content[i]
      if (!origChild.sameMarkup(updatedChild)) {
        changeOffset = offset
        break
      } else if (inline) {
        if (!style.sameSet(origChild.styles, updatedChild.styles)) {
          changeOffset = offset
          break
        }
        if (origChild.text != updatedChild.text) {
          for (let jO = origChild.text.length - 1, jU = updatedChild.text.length - 1;
               origChild.text[jO] == updatedChild.text[jU]; jO--, jU--)
            offset--
          changeOffset = offset
          break
        }
        offset -= origChild.text.length
      } else {
        let inner = findChangeEnd(origChild, origPath.concat(i + lenDiff), origChild.content.length,
                                  updatedChild, updatedPath.concat(i))
        if (inner) return inner
        offset -= 1
      }
    }
  }
  if (changeOffset != null) {
    let totalOrigOffset = inline ? orig.size : orig.content.length
    let resultOrigOffset = totalOrigOffset - (totalUpdatedOffset - changeOffset)
    return {orig: new Pos(origPath, resultOrigOffset, inline),
            updated: new Pos(updatedPath, changeOffset, inline)}
  }
}
