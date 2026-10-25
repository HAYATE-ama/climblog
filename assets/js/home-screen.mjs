// A quiet home: one original pixel scene and one short line of dialogue.
export function renderHomeMarkup(){
 return `<section class="quietHome" aria-label="コハクの山小屋"><button type="button" class="companionScene" data-talk-companion aria-label="コハクに話しかける。タップすると手を振ります" aria-describedby="companionSpeech"><canvas id="pixelRoom" width="320" height="192" aria-hidden="true"></canvas></button><div class="quietSpeech"><span class="companionName">コハク</span><p id="companionSpeech" aria-live="polite">おかえり。君のペースで、ゆっくりいこう。</p></div></section>`;
}
