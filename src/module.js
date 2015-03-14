const modules = Object.create(null)

export function defineModule(name, desc) { modules[name] = desc }

export function initModules(pm, spec) {
  let loaded = Object.create(null)
  for (let name in spec)
    initModule(pm, name, spec[name], loaded)
}

function initModule(pm, name, config, loaded) {
  let desc = modules[name]
  if (!desc) throw new Error("Module " + name + " is not loaded")
  if (loaded[name]) {
    if (desc.init.length > 1 && JSON.stringify(loaded[name] != JSON.stringify(config)))
      throw new Error("Inconsistent configuration for module " + name)
    return
  }
  if (desc.dependencies) for (let dep in desc.dependencies)
    initModule(pm, dep, desc.dependencies[dep], loaded)
  pm.modules[name] = desc.init(pm, config)
  loaded[name] = config
}
