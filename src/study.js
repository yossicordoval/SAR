import { icon } from './ui.js'

const choices = ['Only the vehicle echo', 'Vehicle, ground, and receiver noise', 'A finished radar image']

export function renderStudy(card, choice, running) {
  card.innerHTML = '<h2>'+icon('study')+' Lesson 1</h2><h3>What reaches the receiver?</h3>' +
    '<p>A pulse illuminates the survey vehicle and the ground. Predict what the receiver measures when the echoes arrive.</p>' +
    '<div class="answers">'+choices.map((label, i) =>
      '<button data-answer="'+i+'" aria-pressed="'+(choice === i)+'">'+label+'</button>').join('')+'</div>' +
    (choice === null ? '' : '<div class="study-answer"><strong>'+(choice === 1 ? 'Correct.' : 'The receiver measures a sum.')+'</strong> The strongest local echo may come from the vehicle. Ground echoes and noise fill other range cells. Turn on Contributions to compare them.</div>') +
    (choice === null ? '' : '<button class="replay" id="study-replay">'+icon(running ? 'pause' : 'play')+' '+(running ? 'Pause demonstration' : 'Replay demonstration')+'</button>')
}
