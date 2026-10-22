import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {JSDOM, ResourceLoader, VirtualConsole} from 'jsdom';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(project, 'dist');
const errors = [], resourceRequests = [], fetchRequests = [], downloads = [];
class RejectResources extends ResourceLoader {
  fetch(url) {
    resourceRequests.push(url);
    return null;
  }
}
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', error => errors.push(error.message));
const dom = new JSDOM(fs.readFileSync(path.join(dist, 'index.html'), 'utf8'), {
  url: 'http://127.0.0.1:4173/',
  runScripts: 'outside-only',
  resources: new RejectResources(),
  virtualConsole,
});
const w = dom.window, doc = w.document;
try {
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.HTMLMediaElement.prototype.play = function () {
    errors.push('A text-only page attempted audio playback.');
    return Promise.resolve();
  };
  w.HTMLMediaElement.prototype.load = function () { errors.push('A text-only page attempted media loading.'); };
  w.HTMLMediaElement.prototype.pause = () => {};
  w.URL.createObjectURL = blob => { downloads.push(blob); return 'blob:reading-progress'; };
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = () => {};
  w.fetch = async url => {
    fetchRequests.push(String(url));
    assert.equal(String(url), 'api/connection', 'Only the local connection endpoint may be requested');
    return {ok: true, json: async () => ({addresses: [{name: 'Wi-Fi', url: 'http://192.168.1.2:4173/'}]})};
  };
  w.addEventListener('error', event => errors.push(event.message));
  const scripts = [...doc.querySelectorAll('script[src]')].map(script => script.getAttribute('src'));
  assert.equal(scripts[0], 'media-mode.js', 'Text-only mode loads before the application');
  for (const script of scripts) {
    assert.match(script, /^[a-z0-9-]+(?:\.min)?\.js$/, 'Scripts are packaged locally');
    w.eval(fs.readFileSync(path.join(dist, script), 'utf8'));
  }
  assert.equal(w.UMI_TEXT_ONLY, true);
  assert.equal(w.BOOK.lines.length, 2640);
  const click = selector => {
    const element = doc.querySelector(selector);
    assert(element, `Missing control: ${selector}`);
    element.click();
  };
  const saved = () => JSON.parse(w.localStorage.getItem('umi-progress-v1'));
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  const noMedia = () => {
    assert.equal(doc.querySelector('audio,video,img,source,#play,#loop-sentence,#speed,.repeat-controls,.word-audio,.word-zoom-play,.lesson-audio,#illustration-progress'), null,
      'The text-only UI must not expose media elements or unavailable playback controls');
    assert.equal(fetchRequests.some(url => /(?:audio|illustrations|\.(?:mp3|wav|webp|png|jpg))(?:[/?]|$)/i.test(url)), false);
  };
  noMedia();
  assert(doc.body.textContent.includes('此版本不含音频和插图'));

  click('#next');
  assert.equal(saved().index, 1);
  click('[data-toggle="segmented"]');
  assert.equal(saved().segmented, true);
  const tokens = [...doc.querySelectorAll('.jp-token ruby')].map(ruby => ruby.firstChild.textContent);
  for (const text of ['二度目', '合格して', 'というわけだ']) assert(tokens.includes(text), `Whole learning expression: ${text}`);
  const sentence = doc.querySelector('.japanese').cloneNode(true);
  sentence.querySelectorAll('rt').forEach(rt => rt.remove());
  assert.equal(sentence.textContent, w.BOOK.lines[1].t.map(id => w.BOOK.words[id].s).join(''), 'Grouping retains exact source text');
  click('[data-toggle="kana"]');
  assert(doc.querySelector('.kana-line').textContent.includes('というわけだ'));
  assert(doc.querySelector('.romaji-line').textContent.length > 0);
  click('#translation-toggle');
  assert.equal(doc.querySelector('#translation').hidden, false);

  const phrase = [...doc.querySelectorAll('.jp-token')].find(button => button.querySelector('ruby')?.firstChild.textContent === 'というわけだ');
  assert(phrase);
  phrase.click();
  assert.equal(doc.querySelector('#word-dialog').open, true);
  assert.equal(doc.querySelector('.word-zoom-text').textContent, 'というわけだ');
  assert.equal(doc.querySelector('.word-zoom-kana').textContent, 'というわけだ');
  assert(doc.querySelector('.word-zoom-meaning').textContent.includes('也就是说'));
  assert(doc.querySelector('.word-parts').textContent.includes('构成'));
  noMedia();
  assert.equal(w.readerBack(), true);
  click('#next');
  assert.equal(saved().index, 2);
  assert.equal(doc.querySelector('.jp-token[aria-label="查看 づとめの"]'), null);
  click('.jp-token[aria-label="查看 市役所づとめ"]');
  assert.equal(doc.querySelector('.word-zoom-kana').textContent, 'しやくしょづとめ');
  assert.match(doc.querySelector('.word-zoom-meaning').textContent, /工作、任职/);
  assert.doesNotMatch(doc.querySelector('.word-zoom-meaning').textContent, /总结|机器参考/);
  noMedia();
  w.readerBack();
  click('.jp-token[aria-label="查看 の"]');
  assert.match(doc.querySelector('.word-zoom-meaning').textContent, /助词/);
  w.readerBack();
  click('#prev');
  click('[data-tab="grammar"]');
  assert(doc.querySelectorAll('.grammar-item').length > 0);
  assert.equal(doc.querySelector('#learning-panel').textContent.includes('听讲解'), false);
  noMedia();

  click('[data-tab="quiz"]');
  assert.equal(doc.querySelectorAll('[data-quiz-answer]').length, 4);
  click('[data-quiz-answer]');
  assert(doc.querySelector('.quiz-feedback').textContent.includes('正确答案'));
  const feedback = doc.querySelector('.quiz-feedback').textContent;
  click('[data-toggle="ruby"]');
  assert.equal(doc.querySelector('.quiz-feedback').textContent, feedback, 'Display toggles preserve quiz answers');
  click('[data-tab="context"]');
  assert(doc.querySelector('.context-line').textContent.length > 0);

  click('#open-kana');
  assert.equal(doc.querySelectorAll('.kana-cell').length, 46);
  assert.equal(doc.querySelector('[data-kana-speak]'), null);
  click('[data-kana-tab="voiced"]');
  assert.equal(doc.querySelectorAll('.kana-cell').length, 25);
  click('[data-kana-tab="contracted"]');
  assert.equal(doc.querySelectorAll('.kana-cell').length, 33);
  assert.equal(doc.querySelector('#kana-dialog').textContent.includes('就能听'), false);
  w.readerBack();

  click('#open-settings');
  assert.equal(doc.querySelector('#settings-dialog').getAttribute('aria-label'), '学习设置');
  assert(doc.querySelector('#settings-dialog').textContent.includes('此版本不含音频和插图'));
  assert.equal(doc.querySelector('#test-voice,#go-role-preview'), null);
  assert.equal(doc.querySelector('#settings-dialog').textContent.includes('已完成'), false);
  assert(doc.querySelector('#export-progress'));
  assert(doc.querySelector('#import-progress'));
  click('#export-progress');
  assert.equal(downloads.length, 1);
  assert(downloads[0].size > 0);
  const backup = w.UMI_WEB.encode(saved(), w.BOOK.lines.length);
  assert.equal(w.UMI_WEB.decode(backup, w.BOOK.lines.length).index, 1);
  click('#settings-dialog [data-web-open]');
  await tick();
  assert.equal(doc.querySelector('#web-addresses a').getAttribute('href'), 'http://192.168.1.2:4173/');
  w.readerBack();

  click('#next');
  assert.equal(saved().index, 2);
  click('#open-settings');
  const input = doc.querySelector('#progress-file');
  Object.defineProperty(input, 'files', {value: [{name: 'progress.json', size: backup.length, text: async () => backup}]});
  input.dispatchEvent(new w.Event('change', {bubbles: true}));
  await tick();
  assert.equal(doc.querySelector('#import-dialog').open, true);
  click('#confirm-import');
  assert.equal(saved().index, 1, 'Import restores reading position');
  assert.equal(saved().segmented, true, 'Import restores display preferences');
  noMedia();
  assert.equal(resourceRequests.some(url => !/\.(?:css|svg)(?:[?#]|$)/.test(url)), false,
    'No network media requests; locally linked styles/favicon are the only allowed resources');
  assert.deepEqual(errors, [], 'No script or media errors');
  console.log('PASS: text-only page loads its actual script order; complete grouping, popup, kana, quiz, settings, navigation, backup/restore and LAN access work without media.');
} finally {
  dom.window.close();
}
