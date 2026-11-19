import { C, DEFAULTS, measure, platform } from './physics.js'
import { blockedByTerrain, sourceNames } from './terrain.js'

const terrain = {...DEFAULTS,scenario:'terrain',terrain:'ridge',terrainHeight:92,quality:'medium',prf:20,noise:0}
const urban = {...DEFAULTS,scenario:'urban',urbanDensity:'single',targetX:-47,targetY:10,noise:0}
const look = {key:'look',label:'Radar look angle',min:22,max:59,step:1,unit:'°'}
const height = {key:'terrainHeight',label:'Terrain height',min:0,max:150,step:2,unit:'m'}
const reconstruction = {key:'focusModel',label:'Reconstruction model',min:0,max:2,step:1,view:true,
  values:['flat','elevation','geocoded'],labels:['Flat-ground focusing','Elevation-aware focusing','Geocode the flat image']}
const source = {key:'studySource',label:'Scatterer source',min:0,max:4,step:1,view:true,
  values:['off','roof','wall','corner','vehicle'],labels:['All returns','Roof','Wall','Wall–ground corner','Vehicle']}
const question = (prompt,options,correct,feedback) => ({prompt,options,correct,feedback})

function lesson(id,title,baseline,control,details) {
  const {intro,watch,why,math,changed,fixed,predict,check,evidence=false} = details
  return {id,title,baseline,controls:[control],intro,watch,why,math,changed,fixed,predict,check,bottom:details.bottom,
    evidence, time:4,instant:false,tab:'range',stage:'focused',profile:'compressed',
    focus:baseline.scenario==='terrain'?'point-3':'vehicle',
    sceneLabel:baseline.scenario==='terrain'?'Digital elevation model':'Building and reference vehicle',
    visual:'terrain',panels:['optical','geometry','signal','image'],compareImage:true,zoom:112,magnitude:10,
    task:`Change ${control.label.toLowerCase()} and compare the same map coordinates in both reconstructions.`,
    metrics:[
      {label:'Selected slant range',unit:'m',digits:1,read:(_,track)=>track.range},
      {label:'Selected echo delay',unit:'µs',digits:2,read:(_,track)=>track.range*2e6/C},
      {label:'Selected elevation',unit:'m',digits:1,read:(_,track)=>track.z},
    ],
    ...(control.key==='focusModel'?{focusModel:'flat'}:{}),
    ...(control.key==='studySource'?{studySource:'off'}:{}),
  }
}

const terrainControl = {...reconstruction}
const flatWhy = 'Backprojection predicts delays and complex phase at every candidate point. The elevation-aware option evaluates the known height of each point before summing. Geocoding moves pixels from the already focused flat image using mid-pass equal range and cannot restore lost focus or separate overlapping returns.'
const flatMath = 'Focusing uses R = √[(x−xₛ)² + (y−yₛ)² + (h−zₛ)²] per pulse. Geocoding finds the equal-range coordinate on the flat reference plane at mid-pass.'
const unchanged = 'The target, transmitted waveform, and complex received echoes stay the same.'
const comparison = lesson('4-4','Terrain-aware focusing vs geocoding',terrain,terrainControl,{
  intro:'A digital elevation model (DEM) gives height at each map location. Compare three products from exactly the same pulse record.',
  watch:'Use the flat image as a reference. Then compare elevation-assisted focusing and geometric resampling after focus.',
  why:flatWhy, math:flatMath, changed:'The predicted delay and phase, or just the map coordinates in the geocoded product.', fixed:unchanged,
  bottom:'Elevation can inform focusing before summation or remap existing pixels afterward. The two operations solve different problems.',
  predict:question('Which product can recover coherence lost to a wrong elevation hypothesis?',['Flat focus','Elevation-aware focus','Pixel relocation alone'],1),
  check:question('What would a DEM let you recover in a region with no illumination?',['The exact original I/Q','A guarantee of target identity','Visibility information, with no missing echoes recovered'],2,'A height map can help locate or predict shadow. It does not supply a measurement where no direct echo was collected.'),
})
const building = lesson('4-5','One building, several bright returns',urban,source,{
  intro:'The same building presents a roof, a wall, and a wall–ground corner to the radar. Each can return energy with its own phase and delay.',
  watch:'Choose a simulated source category. Its dots in the 3D scene and tint in the image link that category to its focused response.',
  why:'The simulated categories are known because the model generated them. A flat reconstruction can place roof returns nearer in range than the wall base. Coherent sidelobes can add other structure.',
  math:'Phase is −4πR/λ. Several distinct scattering locations can originate on one object.',
  changed:'Only which simulator-generated contribution is highlighted.',fixed:unchanged,
  bottom:'Count scattering centers carefully. A cluster of bright responses can come from one structure.',
  predict:question('Can a single building produce several compact responses?',['Yes, from different scattering regions','Only if it moves','Only if noise is high'],0),
  check:question('Which comparison would help explain a bright point displaced toward the radar?',['A louder display','A DEM and a second viewing direction','A different color palette'],1,'Elevation and viewing direction can explain the changed range position. Independent evidence helps distinguish a roof from a separate target.'),
})

export const terrainLessons = [
  lesson('4-1','Foreshortening on a measured slope',{...terrain,terrainHeight:32},height,{
    intro:'Markers with equal ground-plan spacing climb a radar-facing slope. Slant-range spacing changes even when their map spacing is fixed.',
    watch:'Compare the near-face marker spacing in the real Range Profile against the physical slope diagram.',
    why:'Farther points rise toward the radar. Part of the range increase from ground distance is offset by elevation.',
    math:'Each marker is drawn at its actual R. The ground spacing is 33 m, while ΔR is the difference of the two path lengths.',
    changed:'The slope height and the separation of its echo delays.',fixed:'Marker spacing on the horizontal map.',
    bottom:'Foreshortening compresses radar-facing slopes in range.',
    predict:question('As a gentle slope faces the radar more directly, how does the marker spacing in slant range change?',['It contracts','It stays the same','It always doubles'],0),
    check:question('To estimate a slope’s area from a compressed feature, what extra information helps?',['A ground elevation model and known look geometry','More display contrast','Only a larger transmit pulse count'],0,'The DEM and look geometry relate the radar range coordinate to a ground location.'),
  }),
  lesson('4-2','Layover reverses echo order',terrain,height,{
    intro:'Raise the ridge until an elevated marker reaches the receiver before a lower marker that is closer in map coordinates.',
    watch:'Follow each numbered marker from ground order into its measured echo delay.',
    why:'Elevation reduces the slant path to the ridge top. In strong layover, range decreases while ground distance increases.',
    math:'Compare R for two markers and check whether its difference has the same sign as their ground-range difference.',
    changed:'The height of the ridge and the order of measured echoes.',fixed:'The marker positions on the horizontal map.',
    bottom:'Layover occurs when elevated features return before lower points that are nearer in ground order.',
    predict:question('Can the more distant marker in map coordinates return earlier?',['Yes, if its extra height makes the path shorter','Only at a higher carrier frequency','No'],0),
    check:question('Two locations share a range cell because of layover. Which evidence can help separate them?',['New display colors','A second look angle and elevation data','A single resampling of the original pixel'],1,'Another projection and elevation data can disambiguate locations that overlap in one view.'),
  }),
  lesson('4-3','Radar shadow behind a ridge',{...terrain,terrainHeight:140,look:48},look,{
    intro:'A steep ridge can block the direct radar path to its far side. The simulator omits direct-path echoes where the terrain intercepts that ray.',
    watch:'In Radar Geometry the shadow is dark blue. Follow the markers as their paths become blocked or visible.',
    why:'The far side of a ridge may lie below the line from the radar to the crest. A reconstruction can use only the echoes that were acquired.',
    math:'The teaching model marches the straight line from each scatterer toward the platform and tests it against the height field.',
    changed:'Visibility of the far slope and the length of the shadow.',fixed:'The terrain heights and intrinsic reflectivity.',
    bottom:'A radar shadow is missing illumination, so missing echoes cannot be recovered by focusing alone.',
    predict:question('What happens to direct returns from a marker hidden behind the ridge?',['They disappear','They get brighter','They arrive at zero delay'],0),
    check:question('How could you distinguish shadow from a dark water patch?',['Observe from the opposite side and compare to the DEM','Double only the display brightness','Use the same view to enlarge the dark patch'],0,'Geometric shadow moves with look direction and often aligns with an obstruction in a height map.'),
  }),
  comparison,building,
  {...comparison,id:'4-6',title:'Building height and image displacement',baseline:urban,focus:'vehicle',sceneLabel:'One building and vehicle',intro:'Use known roof heights to test where an elevated return is focused.',
    watch:'Compare the flat and elevation-aware products. The roof height supplies a different path at the same map position.',
    bottom:'Known roof elevation can place visible roof returns near their mapped location. One roof height per cell cannot represent roof and wall at once.'},
]

export const terrainAnalysisLessons = [
  {...building,id:'2-6',title:'Interpret a building signature',evidence:true,
    check:question('Several compact returns form along the same structure. What additional evidence distinguishes a roof from vehicles?',['Optical geometry and another look','A finer color palette','The brightness ranking alone'],0,'Known building geometry and a second projection test the elevation explanation.')},
  {...terrainLessons[2],id:'2-7',title:'Diagnose terrain shadow and layover',evidence:true,
    check:question('A low return sits in a region that the DEM predicts was invisible. What is the strongest conclusion?',['The material is water','The pass supplies little direct-return evidence there','The region holds no objects'],1,'Shadow limits observation. Change viewing direction to obtain evidence from that terrain.')},
  {...comparison,id:'2-8',title:'Motion or elevation error?',evidence:true,
    check:question('A displaced return re-aligns using a known height. Which further check tests target motion?',['Compare phase history, motion-aware focus, or a second pass','Remove the DEM only from the label','Use brightness alone'],0,'A coherent phase-history comparison and another pass discriminate hypotheses that a single displaced peak cannot settle.')},
]

export function terrainMarkers(config,objects,time) {
  const sensor = platform(config,time)
  return objects.map((object,index)=>{
    const point = measure(config,object,time)
    return {...point,index,shadow:blockedByTerrain(config,sensor,point),source:sourceNames.reflector}
  })
}
