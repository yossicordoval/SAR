export const URBAN_DENSITIES = ['sparse', 'medium', 'dense']
export const SURFACES = ['Calm water','Rough water','Dry soil','Rock','Vegetation','Concrete','Metal','Road']

const blocks = [
  [-145,-106,20,15,24], [-62,-102,17,19,58], [61,-108,27,17,32], [149,-92,22,20,72],
  [-145,-39,24,16,48], [-64,-38,23,18,20], [67,-45,20,21,66], [144,-33,18,18,28],
  [-149,47,20,20,32], [-63,52,16,22,57], [62,49,23,16,24], [147,40,25,15,56],
  [-151,116,21,14,55], [-58,112,20,18,28], [61,113,22,20,63], [150,111,19,22,43],
].map(([x,y,hx,hy,height]) => ({x,y,hx,hy,height}))
const sparse = blocks.filter((_,i) => i % 3 === 0)
const medium = blocks.filter((_,i) => i % 4 !== 2)
export const urbanBuildings = density => density === 'dense' ? blocks : density === 'medium' ? medium : sparse
export const onStreet = (x,y) => Math.abs(x) < 19 || Math.abs(y-7) < 13 || Math.abs(y-80) < 8

// Use a segment-to-box intersection for geometric occlusion by an opaque block.
export function blockedByBuilding(from, to, buildings) {
  return buildings.some(block => {
    let enter = 0, exit = 1
    for (const [key,min,max] of [
      ['x',block.x-block.hx,block.x+block.hx],
      ['y',block.y-block.hy,block.y+block.hy],
      ['z',0,block.height-0.05],
    ]) {
      const delta = to[key]-from[key]
      if (Math.abs(delta) < 1e-10) {
        if (from[key] < min || from[key] > max) return false
        continue
      }
      const a = (min-from[key])/delta, b = (max-from[key])/delta
      enter = Math.max(enter,Math.min(a,b))
      exit = Math.min(exit,Math.max(a,b))
      if (enter >= exit) return false
    }
    return enter < 0.999999 && exit > 0
  })
}

export function terrainStrength(x,y,config,base) {
  const sinus = 0.76+0.24*Math.sin(x*.09+y*.04)
  if (config.scenario === 'urban') return onStreet(x,y) ? 0.26 : base * 0.8
  if (config.scenario !== 'materials') return base
  const weights = [0.024,0.29,0.48,0.94,0.74,0.65,1.16,0.34]
  const patch = Math.min(7,Math.max(0,Math.floor((x+220)/110)+4*(y>=0)))
  const slope = (config.look-18)/35
  const wavelength = 299.79/config.frequency
  const specular = [0.46,0.88,0.96,1,0.91,0.79,0.64,0.7][patch]
  return weights[patch]*sinus*(1-(1-specular)*slope)*(0.75+0.25*Math.min(1,6/wavelength))
}
