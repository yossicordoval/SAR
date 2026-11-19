import { sourceNames } from './terrain.js'
import { explainTerms, parameterInfo } from './learning-info.js'
import { visualMarkup } from './study-visual.js'
import { answerFeedback, canAdvance, controlBaseline, currentLesson, lessonStatus, STEPS } from './study-state.js'

function question(question, action, selected) {
  return `<fieldset class="study-question"><legend>${question.prompt}</legend>${
    question.options.map((choice, i) => `<label><input type="radio" name="${action}" data-study-action="${action}" value="${i}" ${selected === i ? 'checked' : ''}> <span>${choice}</span></label>`).join('')
  }</fieldset>`
}

function controlMarkup(control, value) {
  const { key, label, unit, min, max, step, labels } = control
  const suffix = unit ? ' ' + unit : ''
  if (labels) return `<label class="study-choice">${label}<select id="study-control-${key}" data-study-control="${key}">${labels.map((text,i) =>
    `<option value="${i}" ${i === value ? 'selected' : ''}>${text}</option>`).join('')}</select></label>`
  return `<label class="slider-label study-slider" for="study-control-${key}"><span id="study-label-${key}">${label}</span><output id="study-value-${key}">${value}${suffix}</output>
    <input type="range" id="study-control-${key}" aria-labelledby="study-label-${key}" data-study-control="${key}" data-unit="${unit}" min="${min}" max="${max}" step="${step}" value="${value}" style="--fill:${(value-min)/(max-min)*100}%">
    <span class="study-range-labels" aria-hidden="true"><span>${min}${suffix}</span><span>${max}${suffix}</span></span></label>`
}

export function renderStudy(card, state) {
  const current = currentLesson(state)
  const { lesson, step, prediction, confirmed, reference } = current
  const { phase } = lesson
  const prefix = `<div class="study-phase"><button type="button" data-study-action="choose" aria-haspopup="dialog">Phase ${phase.id} · ${phase.title} ▾</button><span>${phase.index + 1} / ${phase.count}</span></div>`
  const seen = new Set()
  const explain = text => explainTerms(text,seen)
  const predictionResult = answerFeedback(lesson.predict, prediction)
  const chooser = `<dialog class="lesson-picker" aria-label="Choose Lesson"><header><h2>Choose Lesson</h2><form method="dialog"><button>Close</button></form></header>
    ${[...new Set(state.lessons.map(item => item.phase.id))].map(id => {
      const items = state.lessons.filter(item => item.phase.id === id)
      return `<details ${id === phase.id ? 'open' : ''}><summary>Phase ${id} · ${items[0].phase.title}</summary><ul>${items.map(item => {
        const status = lessonStatus(state,item)
        const active = item.id === lesson.id
        return `<li><button type="button" data-lesson-id="${item.id}" ${active ? 'aria-current="true"' : ''}><span aria-hidden="true">${active ? '●' : status === 'Completed' ? '✓' : '○'}</span><span>${item.title}<small>${status}</small></span></button></li>`
      }).join('')}</ul></details>`
    }).join('')}</dialog>`
  const stepMarkup = [
    () => `<p class="study-intro">${explain(lesson.intro)}</p>
     <div class="study-watch"><strong>What should I watch?</strong><p>${explain(lesson.watch)}</p></div>
     ${question(lesson.predict, 'predict', prediction)}`,
    () => `<p class="study-intro">${explain(lesson.task)}</p>
     <div class="study-controls">${lesson.controls.map(control => `<div class="control-info-row">${controlMarkup(control,current.edits[control.key] ?? controlBaseline(lesson, control))}${control.view ? '' : parameterInfo(control.key,control.label)}</div>`).join('')}</div>
     <p class="study-lock">${lesson.controls.some(control => control.view) ? 'The monitors share the same acquired pulse and scene.' : 'Other parameters and the flight position are fixed for this comparison.'}</p>
     <p id="study-observation" class="study-observation">${current.tested ? 'Change observed. Compare again or continue.' : 'Change a control and observe the result before continuing.'}</p>`,
    () => `<p class="study-answer" data-result="${predictionResult}" role="status">${predictionResult === 'correct' ? '✓ Your prediction matches the result.' : 'Not quite. Compare your prediction with the explanation below.'}</p>
     <p>${explain(lesson.why)}</p>
     ${lesson.changed ? `<div class="study-changes"><p><strong>What physically changed?</strong> ${lesson.changed}</p><p><strong>What did NOT change?</strong> ${lesson.fixed}</p></div>` : ''}
     <details class="study-math"><summary>Why mathematically?</summary><p>${explain(lesson.math)}</p></details>
     <div class="study-bottom"><strong>Bottom line</strong><p>${explain(lesson.bottom)}</p></div>`,
    () => `${question(lesson.check,'confirm',confirmed)}
     <p id="study-feedback" class="study-feedback" data-result="${answerFeedback(lesson.check, confirmed)}" role="status" ${confirmed === null ? 'hidden' : ''}>${confirmationText(current)}</p>`,
  ]
  const title = state.complete ? 'SAR Study Mode summary' : lesson.title
  const completed = state.complete ? state.lessons.filter(item => lessonStatus(state,item) === 'Completed').length : 0
  card.innerHTML = `<div class="study-header">${prefix}<h2 id="study-heading" tabindex="-1">${title}</h2>
    ${state.complete ? '' : `<ol class="study-steps" aria-label="Lesson steps">${STEPS.map((name,i) =>
      `<li ${i === step ? 'aria-current="step"' : ''} class="${i < step ? 'visited' : ''}"><span>${i+1}</span> ${name}</li>`).join('')}</ol>`}
    </div>
    <div class="study-body">
      ${state.complete ? `<p>${completed} of ${state.lessons.length} lessons completed. Use Choose Lesson to review or resume an experiment.</p>` : `
        ${stepMarkup[step]()}
        ${step <= 1 && lesson.visual ? visualMarkup(lesson.visual) : ''}
        ${lesson.stage==='focused' && (!lesson.evidence || step>=2) && ['urban','terrain','materials','water'].includes(lesson.baseline.scenario) && !lesson.controls.some(c=>c.key==='studySource')
          ? `<label class="study-choice">Show simulated source type
              <select data-source-overlay><option value="off">Off</option>${Object.entries(sourceNames).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select>
            </label>` : ''}
        ${['urban','terrain','materials','water'].includes(lesson.baseline.scenario) ? '<p class="study-scale">Source colors show educational ground truth from the simulator. Assigning a source in real SAR requires independent evidence.</p>' : ''}
        <div class="study-measurements">
          <table aria-label="Live experiment measurements"><thead><tr><th scope="col">Measurement</th><th scope="col">Baseline</th><th scope="col">Current</th></tr></thead>
            <tbody>${lesson.metrics.map(metric => `<tr><th scope="row">${metric.label}</th><td>—</td><td>—</td></tr>`).join('')}</tbody></table>
          ${lesson.metricGuide ? `<p class="study-scale">${lesson.metricGuide}</p>` : ''}
          ${lesson.targets ? `<div class="study-targets" aria-label="Reflector trace"><span>Follow trace</span>${lesson.targets.map(target => `<button type="button" data-study-target="${target.id}">${target.label}</button>`).join('')}</div>` : ''}
          <label class="check study-reference"><input type="checkbox" data-study-action="reference" ${reference ? 'checked' : ''}> Show dashed baseline in plot</label>
          <p class="study-scale" title="The geometry and units are internally consistent. Dimensions, frequencies, and scattering are simplified for teaching.">Teaching-scale simulation${lesson.baseline.clutter || lesson.baseline.noise || lesson.controls.some(control => ['clutter','noise','sceneMix'].includes(control.key)) ? '' : ' · ground clutter and noise off'}</p>
        </div>`}
    </div>
    <nav class="study-nav" aria-label="Lesson navigation">
      <div><button type="button" data-study-action="back" ${!state.index && !step && !state.complete ? 'disabled' : ''}>Back</button>
      ${state.complete ? '' : `<button class="study-primary" type="button" data-study-action="next" ${canAdvance(current) ? '' : 'disabled'}>${step === 3 && state.index === state.lessons.length - 1 ? 'Finish' : 'Next'}</button>`}</div>
      <div class="study-secondary">
        ${state.complete || step === 0 ? '' : '<button type="button" data-study-action="reset">Reset Experiment</button>'}
        <button type="button" data-study-action="repeat">Repeat Experiment</button>
      </div>
        <button type="button" data-study-action="choose" aria-haspopup="dialog">Choose Lesson</button>
    </nav>${chooser}`
}

function confirmationText({ lesson, confirmed }) {
  if (confirmed === null) return ''
  return (confirmed === lesson.check.correct ? '✓ Correct. ' : 'Not quite. ') + lesson.check.feedback
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
    feedback.dataset.result = answerFeedback(current.lesson.check,current.confirmed)
  }
}

export function updateStudyMeasurements(card, lesson, frame) {
  if (!frame?.comparison) return
  const format = (metric, config, tracks, pulse, evidence) => {
    const primary = tracks[lesson.focus] ? lesson.focus : Object.keys(tracks)[0]
    const secondary = lesson.targets?.find(target => target.id !== primary)?.id
    const value = metric.read(config, tracks[primary][pulse], tracks[secondary]?.[pulse], evidence)
    return Number.isFinite(value) ? value.toFixed(metric.digits) + (metric.unit ? ' ' + metric.unit : '') : '—'
  }
  card.querySelectorAll('tbody tr').forEach((row,i) => {
    const metric = lesson.metrics[i]
    row.cells[1].textContent = format(metric, lesson.baseline, frame.comparison.tracks, frame.comparison.pulse, frame.comparison.imageMetrics)
    row.cells[2].textContent = format(metric, frame.config, frame.tracks, frame.pulse, frame.imageMetrics)
  })
}
