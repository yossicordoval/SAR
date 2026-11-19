import { PATCH_LAYOUT } from './patch-layout.js'
import { addChirpEcho, C, compressPulse, createChirp, sample } from './physics.js'
import { EARTH_RADIUS, orbitalObservation } from './space-model.js'

export const ORBIT_PATCH = { x:140,y:105 }
export function sphericalPoint(x,y,center,height=0) {
  const theta = center+y/EARTH_RADIUS
  const lon = x/EARTH_RADIUS
  const radius = EARTH_RADIUS+height
  return [radius*Math.cos(theta)*Math.cos(lon),radius*Math.cos(theta)*Math.sin(lon),radius*Math.sin(theta)]
}

export function orbitalPlatform(config,observation,time) {
  const radius = EARTH_RADIUS+config.altitude*1e3
  const angle = time*observation.speed/radius
  return { point:[radius*Math.cos(angle),radius*Math.sin(angle),0],
    velocity:[-observation.speed*Math.sin(angle),observation.speed*Math.cos(angle),0] }
}

const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])

export function orbitalMeasurement(sensor,target,time,wavelength,radial=0) {
  const range = distance(sensor.point,target)+radial*time
  const rate = sensor.velocity.reduce((total,v,i)=>total+v*(sensor.point[i]-target[i]),0) / distance(sensor.point,target)+radial
  return {range,delay:2*range/C,doppler:-2*rate/wavelength,phase:-4*Math.PI*range/wavelength}
}

export function patchElevation(config,x,y) {
  if (config.terrain==='urban') {
    if (Math.abs(x-5)<16 && Math.abs(y-5)<13) return 22
    if (config.urbanDensity!=='sparse' && Math.abs(x+64)<14 && Math.abs(y+44)<11) return 16
    if (config.urbanDensity==='dense' && Math.abs(x-57)<14 && Math.abs(y-47)<10) return 31
  }
  if (config.terrain==='rural' || config.terrain==='ridge') return 45*Math.max(0,1-Math.abs(y)/85)*Math.exp(-x*x/18000)
  return 0
}

export function nadirPair(config,crossRange=60) {
  const o = orbitalObservation({...config,look:0})
  const sensor = orbitalPlatform(config,o,0)
  return [-crossRange,crossRange].map(y=>orbitalMeasurement(sensor,sphericalPoint(0,y,0),0,o.wavelength))
}

export function rangeTiming(config,observation,start=0) {
  const period=1/config.prf
  if (!observation.look) return {period,returns:[],overlap:false}
  const near=2*observation.near.range/C, far=2*observation.far.range/C
  const sourceIndex = Math.floor(near/period)
  const returns = [0,1,2].map(index=>({index,start:start+index*period,near:start+index*period+near,far:start+index*period+far}))
  return {period,returns,firstWindow:sourceIndex,overlap:far-near>=period,unambiguousRange:C*period/2}
}

export function createOrbitalAcquisition(config) {
  const observation = orbitalObservation(config)
  if (!observation.look) return null
  const center = observation.look.central
  const targets = PATCH_LAYOUT.map(target=>({...target,z:patchElevation(config,target.x,target.y)}))
  if (config.look===0) targets.push({id:'Left',x:0,y:-84,z:0,strength:.9},{id:'Right',x:0,y:84,z:0,strength:.9})
  const count = Math.max(5,Math.min(161,2*Math.floor(.045*Math.min(2,config.observation/12)*config.prf)+1))
  const times = Array.from({length:count},(_,i)=>(i-(count-1)/2)/config.prf)
  const sensors = times.map(time=>orbitalPlatform(config,observation,time))
  const worlds = targets.map(t=>sphericalPoint(t.x,t.y,center,t.z))
  const tracks = targets.map((target,k)=>sensors.map((sensor,p)=>orbitalMeasurement(sensor,worlds[k],times[p],observation.wavelength,k===1?config.radial:0)))
  const min = Math.min(...tracks.flat().map(point=>point.range),observation.look.range-ORBIT_PATCH.y)-23
  const max = Math.max(...tracks.flat().map(point=>point.range),observation.look.range+ORBIT_PATCH.y)+23
  const dr = C/(4*config.bandwidth*1e6)
  const bins = Math.ceil((max-min)/dr)+1
  const rawI = new Float32Array(bins*count), rawQ = new Float32Array(bins*count)
  const rangeI = new Float32Array(rawI.length), rangeQ = new Float32Array(rawI.length)
  const wave = createChirp(config.bandwidth,dr)
  for (let p=0; p<count; p++) {
    const start=p*bins
    const re=rawI.subarray(start,start+bins), im=rawQ.subarray(start,start+bins)
    for (let k=0;k<targets.length;k++) {
      const {range,phase} = tracks[k][p]
      addChirpEcho(re,im,wave,(range-min)/dr,targets[k].strength*(observation.look.range/range)**2,phase+k*.7-observation.phaseError)
    }
    compressPulse(re,im,bins,wave,rangeI,rangeQ,start)
  }
  return {config,center,observation,targets,count,times,sensors,tracks,minRange:min,dr,bins,rawI,rawQ,rangeI,rangeQ}
}

export function focusOrbital(state, elevationAware=false, end=state.count-1) {
  const width=80, height=72
  const {config,center,rangeI,rangeQ,bins,minRange,dr,sensors,observation} = state
  const result = new Float32Array(width*height)
  const phaseFactor = 4*Math.PI/observation.wavelength
  const weights = sensors.slice(0,end+1).map((_,i)=>.54-.46*Math.cos(2*Math.PI*i/Math.max(1,end)))
  const total = weights.reduce((sum,value)=>sum+value,0)
  for (let y=0;y<height;y++) for (let x=0;x<width;x++) {
    const localX = ORBIT_PATCH.x*(2*(x+.5)/width-1)
    const localY = ORBIT_PATCH.y*(2*(y+.5)/height-1)
    const world=sphericalPoint(localX,localY,center,elevationAware?patchElevation(config,localX,localY):0)
    let re=0, im=0
    for (let p=0;p<=end;p++) {
      const range=distance(sensors[p].point,world)
      const cell=(range-minRange)/dr, offset=p*bins
      const i=sample(rangeI,offset,cell,bins), q=sample(rangeQ,offset,cell,bins)
      const phase=phaseFactor*range, cos=Math.cos(phase), sin=Math.sin(phase)
      re+=(i*cos-q*sin)*weights[p]
      im+=(q*cos+i*sin)*weights[p]
    }
    result[y*width+x]=Math.hypot(re,im)/total
  }
  return {width,height,values:result}
}
