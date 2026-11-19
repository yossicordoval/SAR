import assert from 'node:assert/strict'
import test from 'node:test'
import { curriculum } from '../src/curriculum.js'
import { C, compressedProfile, createAcquisition, measure, platform, pulseCount, pulseTime, sceneObjects } from '../src/physics.js'
import { answerFeedback, canAdvance, controlBaseline, createStudy, currentLesson, lessonStatus, studyConfig, transition } from '../src/study-state.js'

import { comparisonAxes, historyFraction, rangeFraction } from '../src/study-axes.js'
import { visualizationStep } from '../src/study-visual.js'

const send = (state, type, value, key) => transition(state, { type, key, value })
const begin = state => send(send(state, 'predict', 0), 'next')
const lesson = index => curriculum[0].lessons[index]

function finishLesson(state) {
  const { lesson: definition } = currentLesson(state)
  let next = send(send(state,'predict',definition.predict.correct),'next')
  const control = definition.controls[0]
  const changed = controlBaseline(definition,control) === control.max ? control.min : control.max
  next = send(next, 'edit', changed, control.key)
  next = send(next, 'observed')
  next = send(send(next, 'next'), 'next')
  next = send(next, 'confirm', definition.check.correct)
  return send(next, 'next')
}

test('the lesson gates progression on prediction, observed edits and a correct check', () => {
  const initial = createStudy(curriculum)
  assert.equal(send(initial, 'next'), initial)
  assert.equal(send(initial, 'edit', 670, 'altitude'), initial)
  let state = begin(initial)
  assert.equal(currentLesson(state).step, 1)
  assert.equal(send(state, 'edit', 70, 'frequency'), state)
  assert.equal(send(state, 'edit', NaN, 'altitude'), state)
  state = send(state, 'edit', 800, 'altitude')
  assert.equal(studyConfig(currentLesson(state)).altitude, 680)
  assert.equal(studyConfig(currentLesson(state)).frequency, lesson(0).baseline.frequency)
  assert.equal(canAdvance(currentLesson(state)), false)
  state = send(state, 'observed')
  assert.equal(canAdvance(currentLesson(state)), true)
  state = send(send(state, 'next'), 'next')
  assert.equal(currentLesson(state).step, 3)
  state = send(state, 'confirm', 0)
  assert.equal(send(state, 'next'), state)
  state = send(send(state, 'confirm', 1), 'next')
  assert.equal(currentLesson(state).lesson.id, '0A-2')
})

test('Back restores prior work, Reset restores the experiment baseline, Repeat restarts prediction', () => {
  const state = finishLesson(createStudy(curriculum))
  const back = send(state, 'back')
  assert.equal(currentLesson(back).confirmed, lesson(0).check.correct)
  assert.equal(studyConfig(currentLesson(back)).altitude, 680)
  const reset = send(back, 'reset')
  assert.equal(currentLesson(reset).step, 1)
  assert.equal(currentLesson(reset).tested, false)
  assert.equal(studyConfig(currentLesson(reset)).altitude, lesson(0).baseline.altitude)
  const repeat = send(reset, 'repeat')
  assert.equal(currentLesson(repeat).step, 0)
  assert.equal(currentLesson(repeat).prediction, null)
})

test('all original parameter, monitor and process lessons are reachable and remain reviewable', () => {
  const original = curriculum.slice(0,3)
  const state = createStudy(original)
  assert.deepEqual(original.map(phase => phase.lessons.length), [12,8,5])
  const complete = state.lessons.reduce(next => finishLesson(next),state)
  assert.equal(complete.complete, true)
  assert.equal(complete.lessons.length, 25)
  assert.equal(currentLesson(complete).lesson.id, '5')
  assert.equal(send(complete, 'back').complete, false)
  assert.equal(currentLesson(send(complete, 'repeat')).step, 0)
})

test('geometry changes the real echo delay and carrier scales Doppler without changing range', () => {
  const geometry = lesson(0)
  const read = (config, time) => measure(config, sceneObjects(config)[0], time)
  const low = read(geometry.baseline, geometry.time)
  const high = read({ ...geometry.baseline, altitude: 680 }, geometry.time)
  assert.ok(high.range > low.range && high.delay > low.delay)
  assert.equal(high.delay, 2 * high.range / C)
  const carrier = lesson(1)
  const slow = read(carrier.baseline, carrier.time)
  const fast = read({ ...carrier.baseline, frequency: 70 }, carrier.time)
  assert.equal(slow.range, fast.range)
  assert.ok(Math.abs(fast.doppler / slow.doppler - 70 / 42) < 1e-12)
})

test('the bandwidth lesson resolves two physical echoes through the matched filter', () => {
  const definition = lesson(2)
  const peaks = bandwidth => {
    const state = createAcquisition({ ...definition.baseline, bandwidth })
    const pulse = Math.round((state.count - 1) / 2)
    const a = state.tracks['point-a'][pulse].range
    const b = state.tracks['point-b'][pulse].range
    const profile = compressedProfile(state, pulse)
    return Array.from(profile).filter((value, index) => {
      const range = state.minRange + index * state.dr
      return range >= a-1 && range <= b+1 && value > profile[index-1] && value > profile[index+1]
    }).length
  }
  assert.equal(peaks(24), 1)
  assert.equal(peaks(72), 2)
})


test('range and Doppler coordinates are anchored across experiment edits', () => {
  const definition = lesson(0)
  const axes = comparisonAxes(definition)
  const read = config => measure(config, sceneObjects(config)[0], definition.time).range
  const baseline = read(definition.baseline)
  const fixed = rangeFraction(baseline, axes)
  let state = begin(createStudy(curriculum))
  for (const altitude of [400, 530, 680]) {
    state = send(state, 'edit', altitude, 'altitude')
    assert.deepEqual(comparisonAxes(currentLesson(state).lesson), axes)
    assert.equal(rangeFraction(baseline, axes), fixed)
    const current = rangeFraction(read(studyConfig(currentLesson(state))), axes)
    assert.ok(current > 0 && current < 1)
    assert.equal(Math.sign(current-fixed), Math.sign(altitude-530))
  }
  const carrier = lesson(1)
  const config = { ...carrier.baseline, frequency: 70 }
  const target = sceneObjects(config)[0]
  assert.ok(Math.abs(measure(config,target,0).doppler) < comparisonAxes(carrier).doppler)
  assert.equal(historyFraction(4,9), historyFraction(12,25))
})

test('increasing PRF samples more positions without increasing covered aperture', () => {
  const { baseline } = lesson(3)
  const fast = { ...baseline, prf: 48 }
  const slow = { ...baseline, prf: 4 }
  const end = config => platform(config,pulseTime(config,pulseCount(config)-1)).x
  const spacing = config => platform(config,pulseTime(config,1)).x-platform(config,0).x
  assert.equal(end(fast), end(slow))
  assert.ok(pulseCount(fast) > pulseCount(slow))
  assert.ok(Math.abs(spacing(slow)/spacing(fast)-12) < 1e-10)
})

test('rotating a moving target across the sight line changes the sign of its radial contribution', () => {
  const { baseline, time } = lesson(9)
  const read = heading => {
    const config = { ...baseline, heading }
    return measure(config, sceneObjects(config)[0],time).doppler
  }
  assert.ok(Math.abs(read(0)) < 1e-12)
  assert.ok(read(90) < 0 && read(270) > 0)
  assert.ok(Math.abs(read(90)+read(270)) < 1e-12)
})

test('raw matrix flight-time edits select a real pulse without changing acquisition configuration', () => {
  const raw = curriculum[1].lessons.find(item => item.visual === 'matrix')
  let state = begin(createStudy([{ id: 'raw', lessons: [raw] }]))
  state = send(state,'edit',126.1,'pulseIndex')
  const current = currentLesson(state)
  assert.equal(current.edits.pulseIndex,126)
  assert.deepEqual(studyConfig(current),raw.baseline)
  const index = current.edits.pulseIndex
  assert.equal(pulseTime(raw.baseline,index),5.25)
  assert.equal(currentLesson(send(state,'reset')).edits.pulseIndex,undefined)
})

test('concept progress resolves to one chapter and replay starts from the first', () => {
  assert.equal(visualizationStep(1,5),4)
  assert.equal(visualizationStep(0.6,5),3)
  assert.equal(visualizationStep(0,5),0)
})


test('any phase is reachable and lesson selection preserves answers and partial experiments', () => {
  const start = begin(createStudy(curriculum))
  const edited = send(send(start,'edit',670,'altitude'),'observed')
  let state = send(edited,'select','2-4')
  assert.equal(currentLesson(state).lesson.id,'2-4')
  state = send(state,'predict',1)
  assert.equal(lessonStatus(state,currentLesson(state).lesson),'In progress')
  state = send(state,'select','0A-1')
  assert.deepEqual(currentLesson(state),currentLesson(edited))
  assert.equal(send(state,'select','missing'),state)
  state = finishLesson(createStudy(curriculum))
  assert.equal(lessonStatus(state,state.lessons[0]),'Completed')
})

test('I/Q and image-analysis checks reteach a wrong inference and gate completion', () => {
  for (const id of ['0B-4','2-4']) {
    let state = begin(send(createStudy(curriculum),'select',id))
    const { lesson } = currentLesson(state)
    const control = lesson.controls[0]
    state = send(send(state,'edit',control.max,control.key),'observed')
    state = send(send(state,'next'),'next')
    state = send(state,'confirm',(lesson.check.correct+1)%lesson.check.options.length)
    assert.equal(answerFeedback(lesson.check,currentLesson(state).confirmed),'try-again')
    assert.equal(send(state,'next'),state)
    state = send(state,'confirm',lesson.check.correct)
    assert.equal(answerFeedback(lesson.check,currentLesson(state).confirmed),'correct')
    assert.ok(canAdvance(currentLesson(state)))
  }
})

test('all added ground lessons complete with their own controls and answer keys', () => {
  const state = createStudy(curriculum.slice(3))
  const complete = state.lessons.reduce(next => finishLesson(next),state)
  assert.equal(complete.index,state.lessons.length-1)
  assert.equal(complete.complete,true)
})
