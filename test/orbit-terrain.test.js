import assert from 'node:assert/strict'
import test from 'node:test'
import { curriculum } from '../src/curriculum.js'
import { createStudy, currentLesson, transition } from '../src/study-state.js'
import { PROGRESS_KEY, readProgress, restoreStudy, snapshotStudy, writeProgress } from '../src/learning-progress.js'
import { AREA, C, createAcquisition, measure, platform, sceneObjects, sourceAcquisition } from '../src/physics.js'
import { createFocuser } from '../src/processing.js'
import { blockedByTerrain, elevation, geocodeFlatImage } from '../src/terrain.js'
import { terrainMarkers } from '../src/terrain-lessons.js'
import { orbitalDefaults, orbitalObservation } from '../src/space-model.js'
import { createOrbitalAcquisition, focusOrbital, nadirPair, orbitalMeasurement, orbitalPlatform, rangeTiming, sphericalPoint } from '../src/orbital-acquisition.js'
import { curvatureStages } from '../src/orbital-story.js'
import { spaceCurriculum } from '../src/space-lessons.js'

test('versioned progress stores partial work and rejects unavailable storage or unknown versions', () => {
  const data=new Map()
  const storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)}
  let state=createStudy(curriculum)
  for (const action of [{type:'predict',value:0},{type:'next'},{type:'edit',key:'altitude',value:650},{type:'observed'}]) {
    state=transition(state,action)
  }
  assert.equal(writeProgress(storage,{ground:snapshotStudy(state),resumeMode:'study'}),true)
  assert.equal(writeProgress(storage,{orbital:{introSeen:true}}),true)
  const saved=readProgress(storage)
  assert.equal(saved.orbital.introSeen,true)
  assert.deepEqual(currentLesson(restoreStudy(curriculum,saved.ground)),currentLesson(state))
  data.set(PROGRESS_KEY,'{"version":99}')
  assert.deepEqual(readProgress(storage),{})
  data.set(PROGRESS_KEY,'corrupt')
  assert.deepEqual(readProgress(storage),{})
  assert.deepEqual(readProgress({getItem(){throw Error('offline')}}),{})
})

test('every orbit lesson has a distinct transfer question and curvature precedes horizon experiment', () => {
  const lessons=spaceCurriculum[0].lessons
  assert.deepEqual(lessons.slice(0,4).map(lesson=>lesson.id),['S0','S1','S2','S3'])
  for (const lesson of lessons) {
    assert.notEqual(lesson.predict.prompt,lesson.check.prompt)
    assert.ok(lesson.check.options[lesson.check.correct])
    assert.ok(lesson.math && lesson.changed && lesson.bottom)
  }
  assert.match(curvatureStages[5],/normal/)
  assert.match(curvatureStages[8],/tangent/)
})

test('symmetric nadir returns share delay and side-looking incidence uses a distinct normal', () => {
  const config={...orbitalDefaults}
  const [left,right]=nadirPair(config)
  assert.equal(left.range,right.range)
  assert.equal(left.delay,right.delay)
  const o=orbitalObservation(config)
  assert.ok(o.look.incidence>config.look)
  assert.ok(Math.abs(o.look.incidence*Math.PI/180-(Math.PI/6+o.look.central))<1e-12)
  assert.ok(orbitalObservation({...config,look:o.horizon-.001}).look)
  assert.equal(orbitalObservation({...config,look:o.horizon+.001}).look,null)
  assert.equal(createOrbitalAcquisition({...config,look:o.horizon+.001}),null)
})

test('orbital raw I/Q and compressed profiles use millisecond absolute paths and real pulse spacing', () => {
  const config={...orbitalDefaults,prf:1600}
  const data=createOrbitalAcquisition(config)
  assert.ok(data.count>=140)
  assert.ok(Math.abs(data.times[1]-data.times[0]-1/config.prf)<1e-12)
  assert.ok(data.rawI.some(i=>i!==0) && data.rawQ.some(q=>q!==0))
  const middle=(data.count-1)/2
  const point=data.tracks[1][middle]
  assert.ok(point.range>550e3 && point.range<750e3 && point.delay>0.003)
  const index=middle*data.bins+Math.round((point.range-data.minRange)/data.dr)
  assert.ok(Math.hypot(data.rangeI[index],data.rangeQ[index])>1)
  const p=sphericalPoint(data.targets[1].x,data.targets[1].y,data.center)
  const at=t=>orbitalMeasurement(orbitalPlatform(config,data.observation,t),p,t,data.observation.wavelength)
  const time=.011, offset=.0001
  const derivative=(at(time+offset).range-at(time-offset).range)/(2*offset)
  assert.ok(Math.abs(at(time).doppler+2*derivative/data.observation.wavelength)<.01)
})

test('focused orbital response peaks near the reference point and is repeatable', () => {
  const data=createOrbitalAcquisition(orbitalDefaults)
  const focused=focusOrbital(data)
  const center=focused.values.indexOf(Math.max(...focused.values))
  const x=(center%focused.width+.5)/focused.width*280-140
  const y=(Math.floor(center/focused.width)+.5)/focused.height*210-105
  assert.ok(Math.hypot(x-5,y-5)<7)
  assert.deepEqual(focused.values,focusOrbital(data).values)
  const raised=createOrbitalAcquisition({...orbitalDefaults,terrain:'urban'})
  assert.notDeepEqual(focusOrbital(raised).values,focusOrbital(raised,true).values)
})

test('absolute echoes may span several PRI but ambiguity depends on adjacent receive-window overlap', () => {
  const narrow={...orbitalDefaults,look:48,beam:1,prf:3000}
  const tight=rangeTiming(narrow,orbitalObservation(narrow))
  assert.ok(tight.firstWindow>1)
  assert.equal(tight.overlap,false)
  const broad={...narrow,beam:14,prf:5100}
  const collision=rangeTiming(broad,orbitalObservation(broad))
  assert.ok(collision.overlap)
  assert.ok(collision.returns[0].far>=collision.returns[1].near)
  assert.equal(collision.unambiguousRange,C/(2*broad.prf))
})

const terrain=curriculum.at(-1).lessons[0].baseline
test('DEM range produces foreshortening and reverses the marker order at greater relief', () => {
  const markers=height=>{
    const config={...terrain,terrainHeight:height}
    return terrainMarkers(config,sceneObjects(config),4)
  }
  const flat=markers(0), hills=markers(32), high=markers(125)
  assert.ok(flat[1].range-flat[0].range>hills[1].range-hills[0].range)
  assert.ok(high[1].y>high[0].y && high[1].range<high[0].range)
  const p=hills[1], sensor=platform(terrain,4)
  assert.equal(p.z-.2,elevation(terrain,p.x,p.y))
  assert.equal(p.range,Math.hypot(sensor.x-p.x,sensor.y-p.y,sensor.z-p.z))
})

test('terrain shadow suppresses the blocked marker rather than replacing it with a synthetic return', () => {
  const config={...terrain,look:48,terrainHeight:140,clutter:false,prf:4}
  const sensor=platform(config,4)
  const objects=sceneObjects(config)
  const far=objects.at(-1), near=objects[0]
  assert.equal(blockedByTerrain(config,sensor,far),true)
  assert.equal(blockedByTerrain(config,sensor,near),false)
  const data=createAcquisition(config)
  const pulse=(data.count-1)/2
  assert.ok(sourceAcquisition(data,near.id,pulse,pulse).rangeI.some(sample=>sample!==0))
  assert.ok(sourceAcquisition(data,far.id,pulse,pulse).rangeI.every(sample=>sample===0))
  assert.equal(blockedByTerrain({...config,terrain:'flat'},sensor,{...far,z:0}),false)
})

test('flat focus, height-aware focus and geocoding are distinct products of identical measured bytes', () => {
  const config={...terrain,terrainHeight:92}
  const state=createAcquisition(config)
  const midpoint=(state.count-1)/2, before=state.i.slice()
  const flat=createFocuser(state)(midpoint,false)
  const dem=createFocuser(state,{elevationAware:true})(midpoint,false)
  const geocoded=geocodeFlatImage(flat,state,config,platform(config,4),AREA)
  assert.deepEqual(state.i,before)
  assert.notDeepEqual(dem,flat)
  assert.notDeepEqual(geocoded,dem)
  assert.ok(Math.max(...dem)>Math.max(...flat))
})

test('urban source categories produce separate simulated echo records', () => {
  const base=curriculum.at(-1).lessons[4].baseline
  const state=createAcquisition({...base,prf:4})
  const types=new Set(state.scatterers.map(s=>s.source))
  for(const category of ['roof','wall','corner','terrain','vehicle']) assert.ok(types.has(category))
  const mid=(state.count-1)/2
  const roof=sourceAcquisition(state,'roof',mid,mid)
  const wall=sourceAcquisition(state,'wall',mid,mid)
  assert.ok(roof.rangeI.some(i=>i!==0) && wall.rangeI.some(i=>i!==0))
  assert.notDeepEqual(roof.rangeI,wall.rangeI)
})
