import { PATCH_LAYOUT } from './patch-layout.js'
import { blockedByTerrain, elevation } from './terrain.js'
import { blockedByBuilding, terrainStrength, urbanBuildings } from './environments.js'
export const C = 299792458
export const DURATION = 8
export const PULSE_DURATION = 180e-9
export const FOOTPRINT = { x: 235, y: 145 }
export const AREA = { x: 220, y: 170 }
export const QUALITY = {
  interactive: { bins: 360, ground: 560, width: 92, height: 68 },
  medium: { bins: 460, ground: 950, width: 124, height: 88 },
  high: { bins: 600, ground: 1550, width: 158, height: 112 },
}
export const DEFAULTS = {
  altitude: 530, speed: 82, look: 33, frequency: 42, bandwidth: 64, prf: 24,
  noise: 0.024, clutter: true, scenario: 'road', quality: 'interactive',
  targetX: 12, targetY: 12, targetSpeed: 0, heading: 112, rcs: 1, urbanDensity: 'medium', terrain:'ridge', terrainHeight:95, terrainDirection:0, terrainSteepness:1,
}

export const SCENARIOS = [
  { id: 'road', name: 'Vehicle on dirt road', detail: 'Stationary target', icon: 'truck' },
  { id: 'rocks', name: 'Rock field', detail: 'Multiple scatterers', icon: 'mountain' },
  { id: 'moving', name: 'Moving vehicle', detail: 'Motion and Doppler', icon: 'move' },
  { id: 'urban', name: 'Urban blocks', detail: 'Roof echoes and radar shadow', icon: 'layers' },
  { id: 'terrain', name: 'Terrain Analysis', detail: 'Elevation, layover and radar shadow', icon: 'mountain' },
  { id: 'materials', name: 'Surface patches', detail: 'Water, soil and built surfaces', icon: 'mountain' },
  { id: 'water', name: 'Water’s edge', detail: 'Surface contrast', icon: 'waves' },
]

export function random(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0
    return seed / 4294967296
  }
}
export const road = x => 10 + x * 0.29 + Math.sin(x / 67) * 15
export function reflectivity(x, y, scenario) {
  if (scenario === 'water' && y > 55 + 25 * Math.sin(x / 94)) return 0.022
  if (Math.abs(y - road(x)) < 13) return 0.41
  return 0.67 + 0.27 * Math.sin(x / 37 + y / 32) * Math.cos(y / 29) + 0.12 * Math.sin(x / 11 - y / 19)
}

export function sceneObjects(config) {
  if (config.scenario==='shared-orbital-patch') return PATCH_LAYOUT.map(target=>({...target,id:'point-'+target.id,label:'Reflector '+target.id,z:0}))
  if (config.scenario === 'terrain') return [-105,-72,-39,-6,27,60,93].map((y,i) => ({
    id:'point-'+i, label:'Terrain marker '+(i+1), x:0, y, z:elevation(config,0,y)+.2,
    strength:i === 3 ? 2.1 : 1.35,
  }))
  if (config.scenario === 'study-point') return [
    { id: 'point-a', label: 'Reflector A', x: config.targetX, y: config.targetY, z: 0, strength: 2.6,
      vx: config.targetSpeed*Math.cos(config.heading*Math.PI/180), vy: config.targetSpeed*Math.sin(config.heading*Math.PI/180) },
  ]
  if (config.scenario === 'study-pair') {
    // Choose equal carrier phase modulo one cycle at the demonstration pulse.
    const near = Math.hypot(config.altitude, platform(config, DURATION / 2).y)
    const far = near + C / 56e6
    const separation = Math.sqrt(far ** 2 - config.altitude ** 2) + platform(config, DURATION / 2).y
    return [
      { id: 'point-a', label: 'Reflector A', x: 0, y: 0, z: 0, strength: 2.6 },
      { id: 'point-b', label: 'Reflector B', x: 0, y: separation, z: 0, strength: 2.6 },
    ]
  }
  if (config.scenario === 'study-several') return [
    { id: 'point-a', label: 'Reflector A', x: -70, y: -43, z: 0, strength: 2.6 },
    { id: 'point-b', label: 'Reflector B', x: 56, y: 20, z: 0, strength: 2.25 },
    { id: 'point-c', label: 'Reflector C', x: 16, y: 71, z: 0, strength: 0.4 },
  ]
  const objects = [{ id: 'vehicle', label: 'Survey vehicle', x: config.targetX, y: config.targetY, z: 2,
    vx: config.targetSpeed * Math.cos(config.heading * Math.PI / 180),
    vy: config.targetSpeed * Math.sin(config.heading * Math.PI / 180), strength: 2.6 * config.rcs }]
  if (config.scenario === 'rocks') objects.push(
    { id: 'rock1', label: 'West rock', x: -72, y: -39, z: 3, strength: 0.95 },
    { id: 'rock2', label: 'North rock', x: 75, y: 97, z: 4, strength: 1.18 },
    { id: 'rock3', label: 'East rock', x: 126, y: 3, z: 2, strength: 0.77 },
  )
  return objects
}
export function platform(config, time) {
  return { x: (time - DURATION / 2) * config.speed,
    y: -config.altitude * Math.tan(config.look * Math.PI / 180) * (config.scenario==='terrain' ? config.lookSide ?? 1 : 1), z: config.altitude }
}
export function position(object, time) {
  return { x: object.x + (object.vx || 0) * (time - DURATION / 2),
    y: object.y + (object.vy || 0) * (time - DURATION / 2), z: object.z }
}
export function measure(config, object, time) {
  const sat = platform(config, time)
  const p = position(object, time)
  const dx = p.x - sat.x, dy = p.y - sat.y, dz = p.z - sat.z
  const range = Math.hypot(dx, dy, dz)
  const radial = (dx * ((object.vx || 0) - config.speed) + dy * (object.vy || 0)) / range
  const lambda = C / (config.frequency * 1e6)
  return { ...p, range, delay: 2 * range / C, phase: -4 * Math.PI * range / lambda,
    doppler: -2 * radial / lambda, stationary: 2 * dx * config.speed / (range * lambda) }
}
export function pulseCount(config) {
  return Math.round(config.prf * DURATION) + 1
}
export function pulseTime(config, index) {
  return DURATION * index / (pulseCount(config) - 1)
}

function gatherScatterers(config, count, objects, buildings) {
  const rng = random(6724)
  const ground = Array.from({ length: count }, () => {
    const x = (rng() * 2 - 1) * AREA.x
    const y = (rng() * 2 - 1) * AREA.y
    const strength = terrainStrength(x,y,config,reflectivity(x,y,config.scenario)) * (0.4 + 0.8 * rng()) * Math.sqrt(560 / count) * 0.38
    const source = reflectivity(x,y,config.scenario) < .1 || config.scenario === 'materials' && y < 0 && x < 0
      ? 'water' : config.scenario === 'materials' && y >= 0 && x < -110 ? 'vegetation' : 'terrain'
    return { x,y,z:elevation(config,x,y),strength,bias:rng()*2*Math.PI,group:'ground',source }
  })
  const details = objects.flatMap(obj => obj.id === 'vehicle'
    ? [[0, 0, 1], [-5, -2.2, 0.56], [5, 2.1, 0.46], [3, -2, 0.63], [-3, 2, 0.52]].map(([dx, dy, gain], index) =>
      ({ ...obj, x: obj.x + dx, y: obj.y + dy, strength: obj.strength * gain, bias: index * 0.44, group: obj.id,source:'vehicle' }))
    : [{ ...obj, bias: 0.4, group: obj.id,source:'reflector' }])
  const roofs = buildings.flatMap(({x,y,hx,hy,height},i) => [
    {x,y,z:height,strength:1.15,bias:i*.5,group:'ground',source:'roof'},
    {x:x-hx*.7,y:y-hy*.65,z:height,strength:.65,bias:i*.4,group:'ground',source:'roof'},
    {x,y:y-hy-.1,z:height*.54,strength:.49,bias:i*.82,group:'ground',source:'wall'},
    {x,y:y-hy-.1,z:.1,strength:1.65,bias:i*.35,group:'ground',source:'corner'},
  ])
  return [...(config.clutter ? [...ground,...roofs] : []), ...details]
}

export function createChirp(bandwidth, dr) {
  const dt = 2 * dr / C
  const half = Math.floor(PULSE_DURATION / (2 * dt))
  const slope = bandwidth * 1e6 / PULSE_DURATION
  return { half, slope, dt, samples: Array.from({ length: 2 * half + 1 }, (_, k) => {
    const m = k - half
    const phase = Math.PI * slope * (m * dt) ** 2
    const weight = 0.54 + 0.46 * Math.cos(2 * Math.PI * m * dt / PULSE_DURATION)
    return [weight * Math.cos(phase), weight * Math.sin(phase), weight]
  }) }
}

export function compressPulse(i, q, bins, wave, outI, outQ, offset) {
  const norm = wave.samples.reduce((sum, sample) => sum + sample[2], 0)
  for (let b = 0; b < bins; b++) {
    let re = 0, im = 0
    for (let j = -wave.half; j <= wave.half; j++) {
      const k = b + j
      if (k < 0 || k >= bins) continue
      const [u, v] = wave.samples[j + wave.half]
      re += i[k] * u + q[k] * v
      im += q[k] * u - i[k] * v
    }
    outI[offset + b] = re / norm
    outQ[offset + b] = im / norm
  }
}

export function createAcquisition(config) {
  const { bins: desiredBins, ground, width, height } = QUALITY[config.quality]
  const count = pulseCount(config)
  const objects = sceneObjects(config)
  const buildings = config.scenario === 'urban' ? urbanBuildings(config.urbanDensity) : []
  const scatterers = gatherScatterers(config, ground, objects, buildings)
  const satY = platform(config, 0).y
  const minY = Math.min(...objects.map(o => o.y - Math.abs(o.vy || 0) * DURATION / 2), -AREA.y) - 12
  const maxY = Math.max(...objects.map(o => o.y + Math.abs(o.vy || 0) * DURATION / 2), AREA.y) + 12
  const maxX = Math.max(...objects.map(o => Math.abs(o.x) + Math.abs(o.vx || 0) * DURATION / 2), AREA.x) + 12
  const minRange = Math.hypot(config.altitude - Math.max(8,config.scenario === 'terrain' ? config.terrainHeight ?? 95 : 0,...buildings.map(block => block.height)), Math.max(0,minY-satY,satY-maxY)) - 42
  const maxRange = Math.hypot(config.altitude, Math.max(Math.abs(minY-satY),Math.abs(maxY-satY)), maxX + config.speed * DURATION / 2) + 42
  const minimumBins = Math.ceil((maxRange - minRange) * 2 * config.bandwidth * 1e6 / C) + 1
  const bins = Math.max(desiredBins, minimumBins)
  const dr = (maxRange - minRange) / (bins - 1)
  const wave = createChirp(config.bandwidth,dr)
  const buffer = () => new Float32Array(bins * count)
  const i = buffer(), q = buffer(), rangeI = buffer(), rangeQ = buffer()
  const tracks = Object.fromEntries(objects.map(o => [o.id, []]))
  const noise = random(7993)
  const state = { config, count, bins, width, height, minRange, dr, wave, scatterers, buildings, tracks, i, q, rangeI, rangeQ }
  for (let p = 0; p < count; p++) {
    const [re, im] = synthesizePulse(state, p)
    for (let b = 0; b < bins; b++) {
      re[b] += (noise() + noise() - 1) * config.noise
      im[b] += (noise() + noise() - 1) * config.noise
    }
    const offset = p * bins
    i.set(re, offset)
    q.set(im, offset)
    compressPulse(re, im, bins, wave, rangeI, rangeQ, offset)
    for (const obj of objects) tracks[obj.id].push(measure(config, obj, pulseTime(config, p)))
  }
  return state
}

function synthesizePulse(state, pulse, filter) {
  const { bins, minRange, dr, wave, config, scatterers, buildings } = state
  const re = new Float32Array(bins), im = new Float32Array(bins)
  const t = pulseTime(config, pulse)
  const sat = platform(config, t)
  const refRange = config.altitude / Math.cos(config.look * Math.PI / 180)
  const phaseFactor = -4 * Math.PI * config.frequency * 1e6 / C
  for (const s of scatterers) {
    if (filter && s.group !== filter && s.source !== filter) continue
    const dx = s.x + (s.vx || 0) * (t - DURATION / 2) - sat.x
    const groundY = s.y + (s.vy || 0) * (t - DURATION / 2)
    const dy = groundY - sat.y
    if (buildings.length && blockedByBuilding(sat,{x:sat.x+dx,y:groundY,z:s.z},buildings)) continue
    if (config.scenario==='terrain' && blockedByTerrain(config,sat,{x:sat.x+dx,y:groundY,z:s.z})) continue
    const r = Math.sqrt(dx * dx + dy * dy + (s.z - sat.z) ** 2)
    const cell = (r - minRange) / dr
    const beam = 0.5 ** ((dx / FOOTPRINT.x) ** 2 + (groundY / FOOTPRINT.y) ** 2)
    const amplitude = s.strength * (refRange / r) ** 2 * beam
    const phase = phaseFactor * r + s.bias
    addChirpEcho(re,im,wave,cell,amplitude,phase)
  }
  return [re, im]
}

export function addChirpEcho(re,im,wave,cell,amplitude,phase) {
  const support = PULSE_DURATION/(2*wave.dt)
  for (let j=Math.max(0,Math.ceil(cell-support)); j<=Math.min(re.length-1,Math.floor(cell+support)); j++) {
    const delta = (j-cell)*wave.dt
    const angle = phase+Math.PI*wave.slope*delta**2
    re[j] += amplitude*Math.cos(angle)
    im[j] += amplitude*Math.sin(angle)
  }
}

export function sourceAcquisition(state,source,first,last) {
  const { bins,wave,rangeI,rangeQ } = state
  const i = new Float32Array(rangeI.length), q = new Float32Array(rangeQ.length)
  for (let pulse=first; pulse<=last; pulse++) {
    const [re,im] = synthesizePulse(state,pulse,source)
    compressPulse(re,im,bins,wave,i,q,pulse*bins)
  }
  return {...state,rangeI:i,rangeQ:q}
}

export function components(state, pulse, selected) {
  const total = state.bins * pulse
  const [targetI, targetQ] = synthesizePulse(state, pulse, selected)
  const [groundI, groundQ] = synthesizePulse(state, pulse, 'ground')
  const target = new Float32Array(state.bins)
  const ground = new Float32Array(state.bins)
  const echo = new Float32Array(state.bins)
  for (let index = 0; index < state.bins; index++) {
    target[index] = Math.hypot(targetI[index], targetQ[index])
    ground[index] = Math.hypot(groundI[index], groundQ[index])
    echo[index] = Math.hypot(state.i[total + index], state.q[total + index])
  }
  return { target, ground, echo }
}

export function compressedProfile(state, pulse) {
  const offset = state.bins * pulse
  return state.rangeI.slice(offset, offset + state.bins)
    .map((re, index) => Math.hypot(re, state.rangeQ[offset + index]))
}

export function sample(array, offset, index, bins) {
  const k = Math.floor(index)
  if (k < 0 || k >= bins - 1) return 0
  return array[offset + k] * (1 - (index - k)) + array[offset + k + 1] * (index - k)
}
