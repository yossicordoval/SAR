import assert from 'node:assert/strict'
import test from 'node:test'
import { curriculum } from '../src/curriculum.js'
import { blockedByBuilding, urbanBuildings } from '../src/environments.js'
import { createAcquisition, DEFAULTS } from '../src/physics.js'
import { alongTrackWidth, createFocuser, imageMetrics } from '../src/processing.js'
import { orbitalConfig, orbitalDefaults, orbitalDelay, orbitalObservation } from '../src/space-model.js'
import { spaceCurriculum } from '../src/space-lessons.js'
import { launchStage } from '../src/space.js'
import { bandwidthStage, conceptSeek, storyboard } from '../src/storyboards.js'
import { createStudy, currentLesson, transition } from '../src/study-state.js'
import { visualizationStep } from '../src/study-visual.js'

test('the full bandwidth storyboard and abbreviated review keep the physical order', () => {
  const full = storyboard('bandwidth')
  assert.equal(full.length,10)
  assert.equal(full[0][0],'One chirped pulse')
  assert.equal(full[9][0],'Connect to the Range Profile')
  assert.deepEqual(storyboard('bandwidth-review').map((_,i)=>bandwidthStage('bandwidth-review',i)),[2,3,4,7,8,9])
  for (let stage=0;stage<10;stage++) assert.equal(visualizationStep(conceptSeek(stage,10,.58),10),stage)
  assert.equal(visualizationStep(conceptSeek(-1,10),10),0)
  assert.equal(visualizationStep(conceptSeek(20,10),10),9)
})

test('a centered coherent aperture grows while the reflector width shrinks', () => {
  const baseline = curriculum[2].lessons.find(lesson=>lesson.id==='3').baseline
  const state = createAcquisition(baseline)
  const focus = createFocuser(state)
  let previous = { aperture:-1,azimuthWidth:Infinity }
  for (const pulses of [1,5,20,50,state.count]) {
    const first = Math.floor((state.count-pulses)/2)
    const last = first+pulses-1
    const metrics = imageMetrics(state,focus(last,false,first),first,last,'point-a')
    assert.equal(metrics.pulses,pulses)
    assert.ok(metrics.aperture > previous.aperture)
    assert.ok(metrics.azimuthWidth < previous.azimuthWidth)
    previous = metrics
  }
  assert.ok(Number.isNaN(alongTrackWidth(new Float32Array([1,1,1]),3,1,0)))
})

test('urban density extends one deterministic scene and opaque roofs cast geometric shadow', () => {
  assert.ok(urbanBuildings('sparse').length < urbanBuildings('medium').length)
  assert.ok(urbanBuildings('medium').length < urbanBuildings('dense').length)
  const blocks = [{x:0,y:0,hx:4,hy:4,height:19}]
  assert.ok(blockedByBuilding({x:0,y:-50,z:30},{x:0,y:20,z:0},blocks))
  assert.ok(!blockedByBuilding({x:0,y:-50,z:30},{x:0,y:0,z:19},blocks))
  const sparse = createAcquisition({...DEFAULTS,scenario:'urban',urbanDensity:'sparse',prf:2})
  const dense = createAcquisition({...DEFAULTS,scenario:'urban',urbanDensity:'dense',prf:2})
  assert.notDeepEqual(dense.i,sparse.i)
})

test('orbital settings keep legal ranges and report rays that miss Earth', () => {
  const config = orbitalConfig(orbitalDefaults,{altitude:10000,look:68,band:'unknown',prf:400,urbanDensity:'dense'})
  assert.equal(config.altitude,850)
  assert.equal(config.band,'C')
  assert.equal(config.urbanDensity,'dense')
  const invalid = orbitalObservation(config)
  assert.equal(invalid.look,null)
  assert.equal(orbitalDelay(invalid,0,config),null)
  const nadir = orbitalConfig(config,{look:0,speedScale:1})
  const o = orbitalObservation(nadir)
  assert.equal(o.look.range,850_000)
  assert.ok(o.speed > 7000 && o.speed < 8000)
  assert.ok(orbitalDelay(o,0,nadir) < orbitalDelay(o,5,nadir))
})

test('space launch is bounded and orbital study progress survives lesson jumps', () => {
  assert.equal(launchStage(0),0)
  assert.equal(launchStage(1),9)
  let study = createStudy(spaceCurriculum)
  assert.equal(currentLesson(study).lesson.id,'S0')
  study = transition(study,{type:'select',value:'S1'})
  study = transition(study,{type:'predict',value:1})
  const other = transition(study,{type:'select',value:'S10'})
  assert.equal(currentLesson(other).lesson.id,'S10')
  assert.equal(currentLesson(transition(other,{type:'select',value:'S1'})).prediction,1)
})

test('motion-aware focusing increases peak strength for the matching moving reflector', () => {
  const { baseline } = curriculum[4].lessons.find(lesson=>lesson.id==='3-6')
  const state = createAcquisition(baseline)
  const peak = focus => Math.max(...focus(state.count-1,false))
  assert.ok(peak(createFocuser(state,{vy:baseline.targetSpeed})) > 1.5 * peak(createFocuser(state)))
})
