import { geocodeFlatImage, sourceColors } from './terrain.js'
import { compressedProfile, components, createAcquisition, AREA, DURATION, platform, pulseTime, sceneObjects, sourceAcquisition } from './physics.js'
import { createFocuser, imageMetrics, migration } from './processing.js'

let state, focus, adjustedFocus, adjustmentKey, sourceFocus, sourceKey
const comparisons = new Map()

self.onmessage = ({ data: msg }) => {
  if (msg.config) {
    state = createAcquisition(msg.config)
    focus = createFocuser(state)
    adjustmentKey = sourceKey = undefined
    const raw = state.i.map((re, j) => Math.hypot(re, state.q[j]))
    const compressed = state.rangeI.map((re, j) => Math.hypot(re, state.rangeQ[j]))
    const { count, bins, width, height, minRange, dr, tracks } = state
    self.postMessage({ type: 'acquisition', revision: msg.revision, count, bins, width, height, minRange, dr,
      tracks, raw, compressed }, [raw.buffer, compressed.buffer])
  }
  const { count, bins, i, q } = state
  const pulse = Math.max(0, Math.min(count - 1, msg.pulse))
  const first = msg.instant ? pulse : Math.max(0,Math.min(pulse,msg.first ?? 0))
  const profiles = components(state, pulse, msg.selected)
  const motion = msg.focusModel === 'moving'
  const drift = msg.trajectoryDrift || 0
  const elevationAware = msg.focusModel === 'elevation'
  if (motion || drift || elevationAware) {
    const key = [motion,drift,elevationAware,msg.selected].join('/')
    if (key !== adjustmentKey) {
      const target = motion ? sceneObjects(state.config).find(object => object.id === msg.selected) : null
      adjustedFocus = createFocuser(state,{ vx:target?.vx, vy:target?.vy, trajectoryDrift:drift,elevationAware })
      adjustmentKey = key
    }
  }
  let image = msg.stage === 'focused' ? (motion || drift || elevationAware ? adjustedFocus : focus)(pulse,msg.instant,first) : null
  const midpoint = platform(state.config,DURATION/2)
  if (image && msg.focusModel === 'geocoded') image = geocodeFlatImage(image,state,state.config,midpoint,AREA)
  let sourceImage, sourcePoints
  if (image && Object.hasOwn(sourceColors,msg.source)) {
    const key = [msg.source,first,pulse,msg.focusModel].join('/')
    if (key !== sourceKey) {
      const subset = sourceAcquisition(state,msg.source,first,pulse)
      sourceFocus = createFocuser(subset,{elevationAware})(pulse,msg.instant,first)
      if (msg.focusModel === 'geocoded') sourceFocus = geocodeFlatImage(sourceFocus,state,state.config,midpoint,AREA)
      sourceKey = key
    }
    sourceImage = sourceFocus
    sourcePoints = state.scatterers.filter(point=>point.source===msg.source).filter((point,i)=>i%Math.max(1,Math.ceil(state.scatterers.length/130))===0 || point.group!=='ground' || ['roof','wall','corner'].includes(point.source))
  }
  const corrected = msg.stage === 'migration' ? migration(state, first, pulse, msg.selected) : null
  let comparison
  if (msg.study) {
    const { id, baseline, profile, time, visualBandwidth, compareImage, apertureMetrics, motionExample, instant } = msg.study
    if (!comparisons.has(id)) {
      const reference = createAcquisition(baseline)
      const referencePulse = Math.round(time / DURATION * (reference.count - 1))
      let wide
      if (visualBandwidth) {
        const example = createAcquisition({ ...baseline, bandwidth: visualBandwidth })
        wide = { profile: compressedProfile(example, referencePulse), minRange: example.minRange, dr: example.dr }
      }
      const referenceImage = compareImage || apertureMetrics || motionExample
        ? createFocuser(reference)(referencePulse, instant || apertureMetrics) : null
      let motionImage
      if (motionExample) {
        const motion = createAcquisition({ ...baseline, scenario: 'road', targetSpeed: 20, heading: 90 })
        motionImage = createFocuser(motion)(referencePulse,false)
      }
      const start = referencePulse * reference.bins
      comparisons.set(id, {
        wide, image: referenceImage, motionImage, width: reference.width, height: reference.height,
        imageMetrics: apertureMetrics ? imageMetrics(reference,referenceImage,referencePulse,referencePulse,Object.keys(reference.tracks)[0]) : null,
        iqI: reference.i.slice(start,start+reference.bins), iqQ: reference.q.slice(start,start+reference.bins),
        tracks: reference.tracks, pulse: referencePulse, minRange: reference.minRange, dr: reference.dr,
        profile: profile === 'compressed' ? compressedProfile(reference, referencePulse)
          : profile === 'range' ? components(reference, referencePulse, Object.keys(reference.tracks)[0]).echo : null,
      })
    }
    comparison = comparisons.get(id)
  }
  self.postMessage({ type: 'frame', studyId: msg.study?.id, comparison,
    compressed: msg.study?.profile === 'compressed' ? compressedProfile(state, pulse) : null, revision: msg.revision, request: msg.request, pulse, first, time: pulseTime(state.config, pulse),
    profiles, image, sourceImage, sourcePoints, source:msg.source, focusModel:msg.focusModel, focusReference:msg.study?.id === '3-6' ? Math.floor(count/2) : pulse, imageMetrics: msg.study?.apertureMetrics && image ? imageMetrics(state,image,first,pulse,msg.selected) : null, corrected, selected: msg.selected, stage: msg.stage,
    iqI: i.slice(pulse * bins, (pulse + 1) * bins), iqQ: q.slice(pulse * bins, (pulse + 1) * bins) })
}
