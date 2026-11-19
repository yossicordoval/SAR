import { C } from './physics.js'

const EARTH_RADIUS = 6_371_000
const MU = 3.986004418e14
const rotation = 86164
const radians = degrees => degrees*Math.PI/180
const degrees = angle => angle*180/Math.PI
export const radarBands = { L:1.25, C:5.4, X:9.65 }
export const orbitalDefaults = {
  altitude: 550, speedScale: 1, band:'C', bandwidth:80, prf:2400, look:30,
  beam:4, radial:0, terrain:'ocean', urbanDensity:'medium', pathError:0, observation:12,
}
export const orbitalControls = [
  {key:'altitude',label:'Orbital altitude',min:350,max:850,step:10,unit:'km',summary:'Greater height lengthens the echo path and often broadens the footprint.'},
  {key:'speedScale',label:'Speed relative to circular orbit',min:.8,max:1.2,step:.02,unit:'×',summary:'Faster motion changes phase more quickly and increases sampling demands.'},
  {key:'band',label:'Radar band',values:Object.keys(radarBands),summary:'Shorter wavelengths turn the same path change into more phase cycles.'},
  {key:'bandwidth',label:'Transmit bandwidth',min:20,max:250,step:5,unit:'MHz',summary:'A wider sweep improves ideal slant-range resolution.'},
  {key:'prf',label:'PRF',min:400,max:5200,step:100,unit:'Hz',summary:'A higher PRF increases phase sampling but shortens the unambiguous delay interval.'},
  {key:'look',label:'Off-nadir look angle',min:0,max:68,step:1,unit:'°',summary:'More sideways viewing increases slant range and changes incidence at the surface.'},
  {key:'beam',label:'Elevation beam width',min:1,max:14,step:.5,unit:'°',summary:'A wider beam illuminates a wider swath and spans more echo delays.'},
  {key:'radial',label:'Target radial speed',min:-40,max:40,step:1,unit:'m/s',summary:'Only the velocity component along the sight line contributes to monostatic Doppler.'},
  {key:'terrain',label:'Terrain context',values:['ocean','rural','urban'],summary:'Surface type, roughness, orientation, and wavelength all influence the echo.'},
  {key:'urbanDensity',label:'Urban density',values:['sparse','medium','dense'],summary:'More buildings introduce more elevated and shadowed ground in the illustrative scene.'},
  {key:'pathError',label:'Extra one-way path',min:0,max:8,step:.1,unit:'cm',summary:'Even a small path error can rotate phase at orbital carrier wavelengths.'},
  {key:'observation',label:'Observation interval',min:2,max:30,step:1,unit:'s',summary:'More time extends the observed track and gives more pulse samples.'},
]

export function orbitalConfig(previous, updates) {
  const config = { ...previous }
  for (const [key,value] of Object.entries(updates)) {
    const control = orbitalControls.find(item => item.key === key)
    if (!control) continue
    if (control.values) {
      if (control.values.includes(value)) config[key] = value
    } else if (Number.isFinite(value)) {
      config[key] = Math.min(control.max,Math.max(control.min,value))
    }
  }
  return config
}

export function orbitalObservation(config) {
  const h = config.altitude*1000, r = EARTH_RADIUS+h
  const horizon = Math.asin(EARTH_RADIUS/r)
  const surface = angle => {
    if (angle > horizon) return null
    const incidence = Math.asin(Math.min(1,r/EARTH_RADIUS*Math.sin(angle)))
    return {
      range: r*Math.cos(angle)-EARTH_RADIUS*Math.cos(incidence),
      incidence: degrees(incidence), central: incidence-angle,
    }
  }
  const angle = radians(config.look)
  const look = surface(angle)
  const near = surface(Math.max(0,angle-radians(config.beam/2)))
  const far = surface(Math.min(horizon,angle+radians(config.beam/2)))
  const circularSpeed = Math.sqrt(MU/r)
  const speed = circularSpeed*config.speedScale
  const period = 2*Math.PI*r/circularSpeed
  const wavelength = C/(radarBands[config.band]*1e9)
  const width = look ? (far.central-near.central)*EARTH_RADIUS : null
  const delaySpread = look ? 2*(far.range-near.range)/C : null
  const azimuthLength = speed*EARTH_RADIUS/r*config.observation
  const apertureDoppler = look ? 2*speed*(config.observation*speed/2)/Math.hypot(look.range,config.observation*speed/2)/wavelength : null
  return { look, near, far, horizon:degrees(horizon), circularSpeed, speed, period, wavelength, width, delaySpread,
    beamClips: angle+radians(config.beam/2) > horizon, crossNadir: angle < radians(config.beam/2),
    azimuthLength, apertureDoppler, nadirShift:360*period/rotation,
    rangeResolution:C/(2*config.bandwidth*1e6), unambiguous:C/(2*config.prf),
    radialDoppler:-2*config.radial/wavelength, phaseError:4*Math.PI*(config.pathError/100)/wavelength,
  }
}

export function orbitalDelay(observation, slowTime, config) {
  const cross = observation.look
  if (!cross) return null
  // Exact straight ray on a spherical Earth for a fixed point and circular pass. Earth rotation is omitted over the short pass.
  const r = EARTH_RADIUS+config.altitude*1000
  const along = slowTime*observation.speed/r
  return 2*Math.hypot(r-EARTH_RADIUS,
    2*Math.sqrt(r*EARTH_RADIUS)*Math.sin(Math.acos(Math.cos(cross.central)*Math.cos(along))/2))/C
}
