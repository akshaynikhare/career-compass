(async function () {
  'use strict';

  var engine;
  var currentQuestion;
  var currentAnswer;

  var firstResult = null;
  try { firstResult = JSON.parse(localStorage.getItem('cat_result')); } catch (e) {}

  if (!firstResult || !firstResult.top10 || !firstResult.top10.length) {
    document.getElementById('no-result').classList.remove('hidden');
    return;
  }

  var profTags, ddQuestions;
  try {
    var results = await Promise.all([
      fetch('data/profession_tags.json').then(function (r) { if (!r.ok) throw new Error('profession_tags'); return r.json(); }),
      fetch('data/deep_dive_questions.json').then(function (r) { if (!r.ok) throw new Error('deep_dive_questions'); return r.json(); })
    ]);
    profTags    = results[0];
    ddQuestions = results[1];
  } catch (err) {
    showError('Failed to load data. Please refresh the page. (' + err.message + ')');
    return;
  }

  engine = DeepDiveEngine.init(firstResult.top10, profTags, ddQuestions.questions);

  document.getElementById('progress-wrapper').classList.remove('hidden');
  document.getElementById('question-card').classList.remove('hidden');
  document.getElementById('nav-buttons').classList.remove('hidden');
  document.getElementById('loading-state').classList.add('hidden');
  document.getElementById('question-content').classList.remove('hidden');

  renderNextQuestion();

  document.getElementById('btn-next').addEventListener('click', function () {
    if (currentAnswer === null) {
      showError('Please select an option to continue.');
      return;
    }

    engine.answer(currentQuestion.id, currentAnswer);

    if (engine.isStopped()) {
      finishTest();
    } else {
      renderNextQuestion();
    }
  });

  function renderNextQuestion() {
    currentQuestion = engine.nextQuestion();

    if (!currentQuestion || engine.isStopped()) {
      finishTest();
      return;
    }

    currentAnswer = null;

    var prog = engine.progress();
    var pct = Math.round((prog.asked / prog.max) * 100);
    document.getElementById('progress-text').textContent = 'Finding your best match… Q' + (prog.asked + 1);
    document.getElementById('progress-pct').textContent = pct + '%';
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('candidates-count').textContent = prog.remainingCount;

    document.getElementById('question-number').textContent = 'Q' + (prog.asked + 1);
    document.getElementById('question-text').textContent = currentQuestion.text;

    var optionsList = document.getElementById('options-list');
    optionsList.innerHTML = '';
    currentQuestion.options.forEach(function (opt, i) {
      var item = document.createElement('div');
      item.className = 'option-item';

      var input = document.createElement('input');
      input.type = 'radio';
      input.name = 'dd_q';
      input.id = 'dd_opt_' + i;
      input.value = i;

      var label = document.createElement('label');
      label.htmlFor = input.id;
      label.textContent = opt.label;

      input.addEventListener('change', function () {
        currentAnswer = i;
        document.getElementById('btn-next').disabled = false;
        clearError();
      });

      item.appendChild(input);
      item.appendChild(label);
      optionsList.appendChild(item);
    });

    document.getElementById('btn-next').disabled = true;
    document.getElementById('btn-next').textContent = 'Next →';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function finishTest() {
    var result = engine.getResult();

    result.studentInfo = firstResult && firstResult.studentInfo ? firstResult.studentInfo : null;

    localStorage.setItem('cat_deepdive_result', JSON.stringify(result));
    window.location.href = 'result2.html';
  }

  function showError(msg) {
    var el = document.getElementById('error-msg');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function clearError() {
    var el = document.getElementById('error-msg');
    el.textContent = '';
    el.classList.add('hidden');
  }

})();
