import { C, DEFAULTS, measure, sceneObjects } from './physics.js'
import { orbitalObservation } from './space-model.js'
import { orbitalVocabulary } from './space-lessons.js'

export const curvatureStages = [
  'Start with a flat reference plane','Replace the plane with a sphere','Locate nadir beneath the satellite',
  'Tilt the ray away from nadir','Find the surface intersection','Draw the local surface normal',
  'Compare look angle with incidence angle','Increase the look angle','Find the tangent at the horizon',
  'Pass the geometric horizon: the ray misses Earth',
]
export const termNames = orbitalVocabulary.map(([name])=>name)

export function overviewRows(config) {
  const o=orbitalObservation(config)
  const ground=measure(DEFAULTS,sceneObjects(DEFAULTS)[0],4)
  const airborneEdge = Math.abs(measure(DEFAULTS,sceneObjects(DEFAULTS)[0],0).doppler)
  const stats=[
    ['Altitude','530 m',config.altitude+' km'],
    ['Speed','82 m/s',(o.speed/1000).toFixed(2)+' km/s'],
    ['Central slant range',Math.round(ground.range)+' m',o.look?(o.look.range/1000).toFixed(0)+' km':'Misses Earth'],
    ['Round trip',(ground.delay*1e6).toFixed(2)+' µs',o.look?(o.look.range*2e3/C).toFixed(2)+' ms':'—'],
    ['Ground reference','Local flat scene','Curved surface + local terrain'],
    ['Across-range coverage','≈290 m teaching footprint',o.width?(o.width/1e3).toFixed(0)+' km swath':'—'],
    ['Platform path','8 s straight pass',config.observation+' s observation on orbital arc'],
    ['Illustrative PRF','24 Hz',config.prf+' Hz'],
    ['Doppler scale (pass edge)',airborneEdge.toFixed(1)+' Hz',o.apertureDoppler===null?'—':Math.round(o.apertureDoppler).toLocaleString('en-US')+' Hz model estimate'],
    ['Antenna / timing','Local beam and nearby echoes',config.beam+'° elevation beam + delayed receive gate'],
    ['Range loss','Relative signal scale','Long two-way path and spreading'],
  ]
  return stats.map(([label,a,b])=>`<tr><th scope="row">${label}</th><td>${a}</td><td>${b}</td></tr>`).join('')
}

function overview(config) {
  return `<section class="orbit-overview"><h4>Compare the two observations</h4>
    <table aria-label="Airborne and orbital scale comparison"><thead><tr><th>Quantity</th><th>Airborne lab</th><th>Spaceborne</th></tr></thead><tbody data-orbit-overview>${overviewRows(config)}</tbody></table>
    <ol class="orbit-process"><li>Airborne principles</li><li>Same radio echoes and I/Q</li><li>Orbital motion, longer paths and curved Earth</li><li>Geometry, timing and sampling corrections</li><li>Spaceborne SAR image</li></ol>
    <h4>Orbital vocabulary</h4>
    ${orbitalVocabulary.map(([name,description,bottom],i)=>`<details><summary>${name}</summary><p>${description}</p>
      <button type="button" data-orbit-term="${i}">Show on monitors</button><p class="study-scale">${bottom}</p></details>`).join('')}
  </section>`
}

const ranges = {
  nadir:['Compare the two equal paths','Tilt the antenna to one side','Read the measured range profile'],
  altitude:['Compare altitude and slant path','Follow the conceptual round trip','Read the millisecond receive gate'],
  incidence:['Find local nadir at the satellite','Draw the normal at the surface','Read the two angles'],
  swath:['Find the near edge','Find the far edge','Compare receive-window width'],
  velocity:['Mark a satellite position','Track its signed range rate','Inspect the Doppler history'],
  timing:['Send the first pulse','Transmit again before the far return','Read the receive windows'],
  track:['Follow the current nadir point','Rotate Earth beneath the orbit','Compare the shifted next pass'],
  band:['Compare the carrier wavelengths','Inspect I/Q phase','Compare delay resolution'],
  raw:['Locate the pulse gate','Append the acquired I/Q rows','Reveal the focused image'],
  image:['Inspect the same map points','Compare the range histories','Read the two focused images'],
  terrain:['Read the elevated patch','Compare the reference surface','Focus using known elevation'],
  urban:['Inspect the elevated reference points','Read nearby returns','Compare shifted responses'],
  motion:['Start with a stationary hypothesis','Change the target’s radial component','Inspect the phase history and focus'],
  power:['Transmit toward the patch','Observe outward spreading','Observe return spreading'],
  phase:['Start from the reference path','Add a small one-way path','Read the phase rotation'],
  strip:['Follow one footprint','Extend it along the track','Locate the small processed patch'],
}

export const orbitChapters = mark => mark==='curvature'?curvatureStages:ranges[mark]??[]
export function storyMarkup(lesson,config) {
  if (lesson.mark==='overview') return overview(config)
  const steps=orbitChapters(lesson.mark)
  return `<section class="orbit-story"><h4>Mental visualization</h4>
    <p class="study-scale">Follow the highlighted monitor · conceptual slow motion</p>
    <p data-orbit-caption>${steps[0]}</p>
    <div class="space-switch"><button data-orbit-chapter="previous">Previous view</button>
      <button data-orbit-chapter="next">Next view</button><button data-orbit-chapter="replay">Replay</button></div>
    ${lesson.mark==='curvature'?'<p class="study-scale">The visual sequence introduces the local normal and tangent before testing impossible looks.</p>':''}
  </section>`
}
