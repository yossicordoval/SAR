import assert from 'node:assert/strict'
import test from 'node:test'
import { curriculum } from '../src/curriculum.js'
import { C, compressedProfile, createAcquisition, measure, sceneObjects } from '../src/physics.js'
import { canAdvance, createStudy, currentLesson, studyConfig, transition } from '../src/study-state.js'

const send = (state, type, value, key) => transition(state, { type, key, value })
const begin = state => send(send(state, 'predict', 0), 'next')
const lesson = index => curriculum[0].lessons[index]

function finishLesson(state) {
  let next = begin(state)
  const { lesson: definition } = currentLesson(next)
  const control = definition.controls[0]
  next = send(next, 'edit', control.max, control.key)
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

test('the preview ends after the third lesson and remains reviewable', () => {
  const complete = [0,1,2].reduce(state => finishLesson(state),createStudy(curriculum))
  assert.equal(complete.complete, true)
  assert.equal(complete.lessons.length, 3)
  assert.equal(currentLesson(complete).lesson.id, '0A-3')
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
