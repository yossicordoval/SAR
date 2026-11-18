import { canAdvance, currentLesson, STEPS, studyConfig } from './study-state.js'

function question(question, action, selected) {
  return `<fieldset class="study-question"><legend>${question.prompt}</legend>${
    question.options.map((choice, i) => `<label><input type="radio" name="${action}" data-study-action="${action}" value="${i}" ${selected === i ? 'checked' : ''}> <span>${choice}</span></label>`).join('')
  }</fieldset>`
}

function controlMarkup(control, value) {
  const { key, label, unit, min, max, step } = control
  return `<label class="slider-label study-slider" for="study-control-${key}"><span id="study-label-${key}">${label}</span><output id="study-value-${key}">${value} ${unit}</output>
    <input type="range" id="study-control-${key}" aria-labelledby="study-label-${key}" data-study-control="${key}" data-unit="${unit}" min="${min}" max="${max}" step="${step}" value="${value}" style="--fill:${(value-min)/(max-min)*100}%">
    <span class="study-range-labels" aria-hidden="true"><span>${min} ${unit}</span><span>${max} ${unit}</span></span></label>`
}

export function renderStudy(card, state) {
  const current = currentLesson(state)
  const { lesson, step, prediction, confirmed, reference } = current
  const { phase } = lesson
  const prefix = `<div class="study-phase"><span>Phase ${phase.id} · ${phase.title}</span><span>${phase.index + 1} / ${phase.count}</span></div>`
  const controls = studyConfig(current)
  const stepMarkup = [
    `<p class="study-intro">${lesson.intro}</p>
     <div class="study-watch"><strong>What should I watch?</strong><p>${lesson.watch}</p></div>
     ${question(lesson.predict, 'predict', prediction)}`,
    `<p class="study-intro">${lesson.task}</p>
     <div class="study-controls">${lesson.controls.map(control => controlMarkup(control,controls[control.key])).join('')}</div>
     <p class="study-lock">Other parameters and the flight position are fixed for this comparison.</p>
     <p id="study-observation" class="study-observation">${current.tested ? 'Change observed. Compare again or continue.' : 'Change a control and observe the result before continuing.'}</p>`,
    `<p class="study-intro">${prediction === lesson.predict.correct ? 'Your prediction matches the result.' : 'Compare the result with your prediction.'}</p>
     <p>${lesson.why}</p>
     <details class="study-math"><summary>Why mathematically?</summary><p>${lesson.math}</p></details>
     <div class="study-bottom"><strong>Bottom line</strong><p>${lesson.bottom}</p></div>`,
    `${question(lesson.check,'confirm',confirmed)}
     <p id="study-feedback" class="study-feedback" role="status" ${confirmed === null ? 'hidden' : ''}>${confirmationText(current)}</p>`,
  ]
  const title = state.complete ? 'Phase 0A preview complete' : lesson.title
  card.innerHTML = `<div class="study-header">${prefix}<h2 id="study-heading" tabindex="-1">${title}</h2>
    ${state.complete ? '' : `<ol class="study-steps" aria-label="Lesson steps">${STEPS.map((name,i) =>
      `<li ${i === step ? 'aria-current="step"' : ''} class="${i < step ? 'visited' : ''}"><span>${i+1}</span> ${name}</li>`).join('')}</ol>`}
    </div>
    <div class="study-body">
      ${state.complete ? '<p>You completed the three experiments on geometry, carrier frequency, and bandwidth. Go back to review a result or repeat the bandwidth experiment.</p>' : `
        ${stepMarkup[step]}
        <div class="study-measurements">
          <table aria-label="Live experiment measurements"><thead><tr><th scope="col">Measurement</th><th scope="col">Baseline</th><th scope="col">Current</th></tr></thead>
            <tbody>${lesson.metrics.map(metric => `<tr><th scope="row">${metric.label}</th><td>—</td><td>—</td></tr>`).join('')}</tbody></table>
          ${lesson.targets ? `<div class="study-targets" aria-label="Reflector trace"><span>Follow trace</span>${lesson.targets.map(target => `<button type="button" data-study-target="${target.id}">${target.label}</button>`).join('')}</div>` : ''}
          <label class="check study-reference"><input type="checkbox" data-study-action="reference" ${reference ? 'checked' : ''}> Show dashed baseline in plot</label>
          <p class="study-scale" title="The geometry and units are internally consistent. Dimensions, frequencies, and scattering are simplified for teaching.">Teaching-scale simulation${lesson.baseline.clutter ? '' : ' · ground clutter and noise off'}</p>
        </div>`}
    </div>
    <nav class="study-nav" aria-label="Lesson navigation">
      <div><button type="button" data-study-action="back" ${!state.index && !step && !state.complete ? 'disabled' : ''}>Back</button>
      ${state.complete ? '' : `<button class="study-primary" type="button" data-study-action="next" ${canAdvance(current) ? '' : 'disabled'}>${step === 3 && state.index === state.lessons.length - 1 ? 'Finish' : 'Next'}</button>`}</div>
      <div class="study-secondary">
        ${state.complete || step === 0 ? '' : '<button type="button" data-study-action="reset">Reset Experiment</button>'}
        <button type="button" data-study-action="repeat">Repeat Experiment</button>
      </div>
    </nav>`
}

function confirmationText({ lesson, confirmed }) {
  if (confirmed === null) return ''
  return (confirmed === lesson.check.correct ? 'Correct. ' : 'Try again. ') + lesson.check.feedback
}

export function updateStudyNavigation(card, current, waiting = false) {
  const next = card.querySelector('[data-study-action="next"]')
  if (next) next.disabled = waiting || !canAdvance(current)
  const observation = card.querySelector('#study-observation')
  if (observation) observation.textContent = waiting ? 'Updating all monitors…' : current.tested
    ? 'Change observed. Compare again or continue.' : 'Change a control and observe the result before continuing.'
  const feedback = card.querySelector('#study-feedback')
  if (feedback) {
    feedback.hidden = current.confirmed === null
    feedback.textContent = confirmationText(current)
  }
}

export function updateStudyMeasurements(card, lesson, frame) {
  if (!frame?.comparison) return
  const format = (metric, config, tracks, pulse) => {
    const primary = lesson.focus || Object.keys(tracks)[0]
    const secondary = lesson.targets?.find(target => target.id !== primary)?.id
    const value = metric.read(config, tracks[primary][pulse], tracks[secondary]?.[pulse])
    return Number.isFinite(value) ? value.toFixed(metric.digits) + ' ' + metric.unit : '—'
  }
  card.querySelectorAll('tbody tr').forEach((row,i) => {
    const metric = lesson.metrics[i]
    row.cells[1].textContent = format(metric, lesson.baseline, frame.comparison.tracks, frame.comparison.pulse)
    row.cells[2].textContent = format(metric, frame.config, frame.tracks, frame.pulse)
  })
}
