import {SubmenuItem} from "./menuitem"

export class MenuDefinition {
  constructor() {
    this.submenus = Object.create(null)
    this.items = []
  }

  addSub(name, options) {
    this.submenus[name] = options
  }

  addItem(item, options) {
    this.items.push({item, options: options || {}})
  }

  submenuPath(name) {
    let sub = this.submenus[name]
    if (!sub) throw new Error("Submenu " + name + " not defined")
    let path = [name]
    while (sub.parent) {
      path.unshift(sub.parent)
      let parent = this.submenus[sub.parent]
      if (!parent) throw new Error("Parent submenu " + sub.parent + " not defined")
      sub = parent
    }
    return path
  }

  getItems(pm) {
    let items = []
    let subs = Object.create(null)
    this.items.forEach(({item, options}) => {
      let target = items
      if (options.submenu) {
        let path = this.submenuPath(options.submenu)
        for (let i = 1; i <= path.length; i++) {
          let subPath = path.slice(0, i).join(" "), sub = subs[subPath]
          if (!sub) {
            let desc = this.submenus[path[i - 1]]
            target.push(sub = subs[subPath] = new SubmenuItem(desc.icon, desc.title))
          }
          target = sub.submenu
        }
      }
      target.push(item)
    })

    // FIXME implement collapsing
    return items
  }
}
