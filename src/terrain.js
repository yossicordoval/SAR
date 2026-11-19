import { roofHeight } from './environments.js'
export const terrainTypes = ['flat','hill','ridge','valley','mountain','stepped']
export const sourceNames = {
  terrain:'Terrain',roof:'Roof',wall:'Wall',corner:'Wall–ground corner',
  vehicle:'Vehicle',vegetation:'Vegetation',water:'Water',reflector:'Reference reflector',
}
export const sourceColors = {
  terrain:'#b1bf9a',roof:'#61e9ec',wall:'#af9cff',corner:'#ffc576',
  vehicle:'#ff9aa4',vegetation:'#95e988',water:'#7bbfff',reflector:'#fff7ae',
}

export function elevation(config,x,y) {
  if (config.scenario !== 'terrain') return 0
  const {terrain='flat', terrainHeight=95, terrainDirection=0, terrainSteepness=1} = config
  const angle = terrainDirection*Math.PI/180
  const u = (y*Math.cos(angle)+x*Math.sin(angle))*terrainSteepness
  const v = x*Math.cos(angle)-y*Math.sin(angle)
  const ridge = Math.max(0,1-Math.abs(u)/130)
  switch (terrain) {
    case 'hill': return terrainHeight*Math.exp(-(u*u+v*v)/14500)
    case 'ridge': return terrainHeight*ridge
    case 'valley': return terrainHeight*Math.min(1,Math.abs(u)/115)
    case 'mountain': return terrainHeight*Math.max(0,1-Math.hypot(u*.9,v*.85)/138)
    case 'stepped': return terrainHeight*(u > 36 ? 0 : u > -20 ? .45 : 1)
    default: return 0
  }
}

export function surfaceNormal(config,x,y) {
  const dx = (elevation(config,x+1,y)-elevation(config,x-1,y))/2
  const dy = (elevation(config,x,y+1)-elevation(config,x,y-1))/2
  const length = Math.hypot(dx,dy,1)
  return [-dx/length,-dy/length,1/length]
}

// March only through the height interval in which the ray can intersect this DEM.
export function blockedByTerrain(config,sensor,point) {
  if (config.scenario !== 'terrain' || config.terrain === 'flat') return false
  const height = config.terrainHeight ?? 95
  const rise = sensor.z-point.z
  if (rise <= 0 || point.z >= height) return false
  const end = Math.min(1,(height-point.z)/rise)
  const dx = sensor.x-point.x, dy = sensor.y-point.y
  const steps = Math.max(2,Math.ceil(Math.hypot(dx,dy)*end/4))
  for (let j=1; j<=steps; j++) {
    const t = j*end/steps
    if (elevation(config,point.x+dx*t,point.y+dy*t) > point.z+rise*t+.1) return true
  }
  return false
}

export function flatEquivalentY(sensor,x,y,z) {
  const squared = (y-sensor.y)**2 + (z-sensor.z)**2 - sensor.z**2
  return squared < 0 ? NaN : sensor.y + Math.sign(y-sensor.y)*Math.sqrt(squared)
}

export function geocodeFlatImage(image,{width,height},config,sensor,area) {
  const output = new Float32Array(image.length)
  for (let col=0; col<width; col++) {
    const x = area.x*(2*(col+.5)/width-1)
    for (let row=0; row<height; row++) {
      const y = area.y*(2*(row+.5)/height-1)
      const z = config.scenario === 'urban' ? roofHeight(config.urbanDensity,x,y) : elevation(config,x,y)
      if (blockedByTerrain(config,sensor,{x,y,z})) continue
      const yFlat = flatEquivalentY(sensor,x,y,z)
      const r = (yFlat+area.y)*height/(2*area.y)-.5
      if (!Number.isFinite(r) || r<0 || r>height-1) continue
      const lo = Math.floor(r), hi = Math.min(height-1,lo+1)
      output[row*width+col] = image[lo*width+col]*(1-(r-lo)) + image[hi*width+col]*(r-lo)
    }
  }
  return output
}
