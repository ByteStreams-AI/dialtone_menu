/**
 * The catering page (dialtone#1553, #1559).
 *
 * A REAL PAGE, not a modal. On a phone an eight-screen modal IS a full-screen
 * page — you pay the cost of one and lose what a URL buys: a link an operator
 * puts in an Instagram bio or prints on a flyer, and something search can rank.
 *
 * ITS NO-JS FALLBACK IS THE PLAIN FORM, deliberately. Every question is
 * server-rendered; the script below only shows one at a time. If it never runs,
 * all of them are visible and the form still submits — which is exactly the
 * straightforward version this design started as, obtained for free rather than
 * built twice. No round trip per question either, so a weak signal at a venue
 * cannot strand someone mid-flow.
 *
 * STRUCTURE VARIES BY EVENT TYPE; THE BRAND DOES NOT. Copy, pacing and the
 * field set all branch. Font and colour never do — those are the tenant's, and
 * a wedding branch that swapped in an elegant serif would be our aesthetic
 * overriding a food truck's deliberately bold one, visibly transforming the
 * page after the first tap.
 */
import { OCCASIONS, QUESTIONS, questionsFor } from './catering-questions.js';
import { escapeHtml, hexToRgba, readableInkOn } from './shared.js';

const id = (eventType, key) => `q-${eventType}-${key}`.replace(/[^a-zA-Z0-9_-]/g, '-');

function renderField(field, eventType) {
  const name = escapeHtml(field.name);
  const common = `name="${name}" id="${escapeHtml(id(eventType, field.name))}"`;
  if (field.type === 'choice') {
    return `<div class="choices" role="group">${field.choices
      .map(
        (c) =>
          `<button type="button" class="chip" data-choice="${name}" data-value="${escapeHtml(c.value)}">${escapeHtml(c.label)}</button>`
      )
      .join('')}<input type="hidden" ${common}></div>`;
  }
  if (field.type === 'textarea') {
    return `<textarea ${common} rows="3" ${field.required ? 'required' : ''}></textarea>`;
  }
  const attrs = [
    `type="${escapeHtml(field.type)}"`,
    field.inputmode ? `inputmode="${escapeHtml(field.inputmode)}"` : '',
    field.autocomplete ? `autocomplete="${escapeHtml(field.autocomplete)}"` : '',
    field.min !== undefined ? `min="${Number(field.min)}"` : '',
    field.max !== undefined ? `max="${Number(field.max)}"` : '',
    field.required ? 'required' : ''
  ]
    .filter(Boolean)
    .join(' ');
  return `<input ${common} ${attrs}>`;
}

function renderScreen(screen, eventType, index) {
  const label = screen.fields.length > 1;
  return `<fieldset class="screen" data-screen="${index}" data-key="${escapeHtml(screen.key)}">
    <legend class="prompt">${escapeHtml(screen.prompt)}</legend>
    ${screen.helper ? `<p class="helper">${escapeHtml(screen.helper)}</p>` : ''}
    ${screen.fields
      .map(
        (f) => `<div class="field">
          ${label ? `<label for="${escapeHtml(id(eventType, f.name))}">${escapeHtml(f.label)}</label>` : ''}
          ${renderField(f, eventType)}
        </div>`
      )
      .join('')}
    <p class="err" hidden></p>
  </fieldset>`;
}

function renderBranch(eventType) {
  const screens = questionsFor(eventType);
  return `<div class="branch" data-branch="${escapeHtml(eventType)}" hidden>
    ${screens.map((s, i) => renderScreen(s, eventType, i)).join('')}
  </div>`;
}

export function renderCateringBody(ctx) {
  const {
    wordmark, logoUrl, primaryColor, secondaryColor, fontFamily, fontHref,
    menuUrl, pageTitle, canonicalUrl, restaurantId, timezone, turnstileSiteKey
  } = ctx;

  const ink = readableInkOn(primaryColor);
  const wash = hexToRgba(primaryColor, 0.08);

  return `<!-- catering -->
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Catering · ${escapeHtml(pageTitle || wordmark)}</title>
<meta name="description" content="Tell ${escapeHtml(wordmark)} about your event.">
${canonicalUrl ? `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">` : ''}
${fontHref ? `<link rel="stylesheet" href="${escapeHtml(fontHref)}">` : ''}
${turnstileSiteKey ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : ''}
<style>
  :root { --brand: ${escapeHtml(primaryColor)}; --brand-ink: ${escapeHtml(ink)}; --accent: ${escapeHtml(secondaryColor)}; --wash: ${escapeHtml(wash)}; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: ${fontFamily}; color: #1c1917; background: #fafaf9; }
  main { max-width: 34rem; margin: 0 auto; padding: 1.5rem 1.25rem 4rem; }
  header { display: flex; align-items: center; gap: .75rem; margin-bottom: 1.5rem; }
  header img { height: 40px; width: auto; }
  header .name { font-weight: 700; font-size: 1.05rem; }
  h1 { font-size: 1.5rem; margin: 0 0 .35rem; }
  .lede { color: #57534e; margin: 0 0 1.75rem; }
  .prompt { font-size: 1.2rem; font-weight: 650; padding: 0; }
  .helper { color: #57534e; font-size: .9rem; margin: .35rem 0 0; }
  fieldset { border: 0; margin: 0; padding: 0; }
  .field { margin-top: .9rem; }
  label { display: block; font-size: .85rem; color: #57534e; margin-bottom: .25rem; }
  input, textarea { width: 100%; padding: .7rem .8rem; font: inherit; border: 1px solid #d6d3d1; border-radius: .6rem; background: #fff; }
  input:focus, textarea:focus { outline: 2px solid var(--brand); outline-offset: 1px; }
  .choices { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .9rem; }
  .chip { font: inherit; padding: .6rem 1rem; border: 1px solid #d6d3d1; border-radius: 999px; background: #fff; cursor: pointer; }
  .chip[aria-pressed="true"] { background: var(--brand); color: var(--brand-ink); border-color: var(--brand); }
  .actions { display: flex; align-items: center; gap: .75rem; margin-top: 1.5rem; }
  .btn { font: inherit; font-weight: 600; padding: .7rem 1.4rem; border-radius: .6rem; border: 1px solid var(--brand); background: var(--brand); color: var(--brand-ink); cursor: pointer; }
  .btn.secondary { background: transparent; color: #44403c; border-color: #d6d3d1; }
  .progress { color: #78716c; font-size: .85rem; }
  .err { color: #b91c1c; font-size: .9rem; margin: .6rem 0 0; }
  .summary li { display: flex; justify-content: space-between; gap: 1rem; padding: .6rem 0; border-bottom: 1px solid #e7e5e4; }
  .summary { list-style: none; padding: 0; margin: 0 0 1.25rem; }
  .summary button { font: inherit; background: none; border: 0; color: var(--brand); cursor: pointer; padding: 0; }
  .done { background: var(--wash); border-radius: .75rem; padding: 1.5rem; }
  .back-link { display: inline-block; margin-top: 2rem; color: #57534e; }
  /* Every screen is visible until the script says otherwise — so a failed
     script degrades to the plain form rather than a blank page. */
  .js .branch .screen { display: none; }
  .js .branch .screen.active { display: block; }
</style>
<main>
  <header>
    ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="">` : ''}
    <span class="name">${escapeHtml(wordmark)}</span>
  </header>

  <h1>Catering &amp; events</h1>
  <p class="lede">Tell us what you're planning and we'll come back to you.</p>

  <form id="catering-form" method="post" action="/api/catering" novalidate>
    <input type="hidden" name="restaurant_id" value="${escapeHtml(restaurantId || '')}">
    <input type="hidden" name="timezone" value="${escapeHtml(timezone || '')}">

    <fieldset class="screen occasion active" data-screen="occasion">
      <legend class="prompt">What's the occasion?</legend>
      <div class="choices" role="group">
        ${OCCASIONS.map(
          (o) =>
            `<button type="button" class="chip" data-occasion="${escapeHtml(o.value)}">${escapeHtml(o.label)}</button>`
        ).join('')}
      </div>
      <input type="hidden" name="event_type" id="event_type" required>
      <p class="err" hidden></p>
    </fieldset>

    ${Object.keys(QUESTIONS).map(renderBranch).join('')}

    <div id="summary-wrap" hidden>
      <p class="prompt">Does this look right?</p>
      <ul class="summary" id="summary"></ul>
    </div>

    ${turnstileSiteKey ? `<div class="cf-turnstile" data-sitekey="${escapeHtml(turnstileSiteKey)}"></div>` : ''}

    <div class="actions">
      <button type="button" class="btn secondary" id="back" hidden>Back</button>
      <button type="submit" class="btn" id="next">Send Request</button>
      <span class="progress" id="progress"></span>
    </div>
    <p class="err" id="form-err" hidden></p>
  </form>

  <div class="done" id="done" hidden>
    <p class="prompt">Thanks — we've got it.</p>
    <p>We'll be in touch about your event. Nothing has been charged.</p>
  </div>

  <a class="back-link" href="${escapeHtml(menuUrl || '/menu')}">&larr; Back to the menu</a>
</main>
<script>${cateringScript()}</script>`;
}

/**
 * The stepped flow. Progressive enhancement only — it adds `js` to <html>, so
 * everything above renders as a plain form until this runs.
 */
function cateringScript() {
  return `
(function () {
  document.documentElement.classList.add('js');
  var form = document.getElementById('catering-form');
  var next = document.getElementById('next');
  var back = document.getElementById('back');
  var progress = document.getElementById('progress');
  var formErr = document.getElementById('form-err');
  var summaryWrap = document.getElementById('summary-wrap');
  var summary = document.getElementById('summary');
  var DRAFT = 'dt-catering-' + location.pathname;

  var occasionScreen = form.querySelector('.occasion');
  var eventType = null;
  var screens = [];
  var step = 0;

  function branch(type) { return form.querySelector('[data-branch="' + type + '"]'); }

  function setOccasion(type) {
    eventType = type;
    form.querySelector('#event_type').value = type;
    Array.prototype.forEach.call(form.querySelectorAll('.branch'), function (b) {
      b.hidden = b.getAttribute('data-branch') !== type;
    });
    Array.prototype.forEach.call(occasionScreen.querySelectorAll('[data-occasion]'), function (c) {
      c.setAttribute('aria-pressed', String(c.getAttribute('data-occasion') === type));
    });
    screens = Array.prototype.slice.call(branch(type).querySelectorAll('.screen'));
  }

  // A screen per THOUGHT, so the total counts the occasion, the questions and
  // the summary — the number people are told is the number they will see.
  function total() { return 1 + screens.length + 1; }

  function show(i) {
    step = Math.max(0, Math.min(i, total() - 1));
    var onSummary = step === total() - 1;
    occasionScreen.classList.toggle('active', step === 0);
    occasionScreen.style.display = step === 0 ? '' : 'none';
    screens.forEach(function (s, n) { s.classList.toggle('active', step === n + 1); });
    summaryWrap.hidden = !onSummary;
    if (onSummary) renderSummary();
    back.hidden = step === 0;
    // Hiding its own length is the one thing people dislike about stepped
    // forms, and "3 of 8" costs nothing.
    progress.textContent = eventType ? (step + 1) + ' of ' + total() : '';
    next.textContent = onSummary ? 'Send Request' : 'Next';
    var active = form.querySelector('.screen.active input:not([type=hidden]), .screen.active textarea');
    if (active) active.focus();
  }

  function fieldsOf(screen) {
    return Array.prototype.slice.call(screen.querySelectorAll('input, textarea'));
  }

  function valueOf(screen) {
    return fieldsOf(screen).map(function (f) { return f.value.trim(); }).filter(Boolean).join(' · ');
  }

  function validate(screen) {
    var err = screen.querySelector('.err');
    var missing = fieldsOf(screen).filter(function (f) { return f.required && !f.value.trim(); });
    // At least one contact method — one answers a lead, and demanding two
    // doubles the failure chance where people are most likely to quit.
    if (!missing.length && screen.getAttribute('data-key') === 'contact') {
      var phone = screen.querySelector('[name=contact_phone]');
      var email = screen.querySelector('[name=contact_email]');
      if (!phone.value.trim() && !email.value.trim()) {
        err.textContent = 'A phone number or an email — either is fine.';
        err.hidden = false;
        return false;
      }
    }
    if (missing.length) {
      err.textContent = 'This one we do need.';
      err.hidden = false;
      missing[0].focus();
      return false;
    }
    err.hidden = true;
    return true;
  }

  function renderSummary() {
    summary.innerHTML = '';
    screens.forEach(function (s, n) {
      var v = valueOf(s);
      if (!v) return;
      var li = document.createElement('li');
      var label = document.createElement('span');
      label.textContent = s.querySelector('.prompt').textContent.replace(/\\?$/, '');
      var right = document.createElement('span');
      var val = document.createElement('span');
      val.textContent = v + ' ';
      var edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = 'Edit';
      // Editable, not a review screen: "I said 40, it's 45" is where a linear
      // form loses people, and a back-button hunt is the reason.
      edit.addEventListener('click', function () { show(n + 1); });
      right.appendChild(val); right.appendChild(edit);
      li.appendChild(label); li.appendChild(right);
      summary.appendChild(li);
    });
  }

  function saveDraft() {
    try {
      var data = {};
      Array.prototype.forEach.call(form.querySelectorAll('input, textarea'), function (f) {
        if (f.name && f.value) data[f.name + '@' + (f.closest('.branch') ? f.closest('.branch').getAttribute('data-branch') : '')] = f.value;
      });
      sessionStorage.setItem(DRAFT, JSON.stringify({ t: eventType, d: data }));
    } catch (e) { /* private mode, quota — a draft is a convenience */ }
  }

  function restoreDraft() {
    try {
      var raw = sessionStorage.getItem(DRAFT);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (!saved || !saved.t) return;
      setOccasion(saved.t);
      Array.prototype.forEach.call(form.querySelectorAll('input, textarea'), function (f) {
        var key = f.name + '@' + (f.closest('.branch') ? f.closest('.branch').getAttribute('data-branch') : '');
        if (saved.d[key]) f.value = saved.d[key];
      });
      Array.prototype.forEach.call(form.querySelectorAll('.chip[data-choice]'), function (c) {
        var hidden = c.parentNode.querySelector('input');
        if (hidden && hidden.value === c.getAttribute('data-value')) c.setAttribute('aria-pressed', 'true');
      });
    } catch (e) { /* ignore */ }
  }

  // Tapping a chip and having it move feels like the flow is keeping up.
  // Auto-advancing out of a TEXT field cannot work — there is no reliable
  // "done" — so those take Enter or Next.
  Array.prototype.forEach.call(occasionScreen.querySelectorAll('[data-occasion]'), function (chip) {
    chip.addEventListener('click', function () {
      setOccasion(chip.getAttribute('data-occasion'));
      saveDraft();
      show(1);
    });
  });

  form.addEventListener('click', function (e) {
    var chip = e.target.closest ? e.target.closest('.chip[data-choice]') : null;
    if (!chip) return;
    var group = chip.parentNode;
    Array.prototype.forEach.call(group.querySelectorAll('.chip'), function (c) { c.setAttribute('aria-pressed', 'false'); });
    chip.setAttribute('aria-pressed', 'true');
    group.querySelector('input').value = chip.getAttribute('data-value');
    saveDraft();
    show(step + 1);
  });

  form.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    if (e.target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    next.click();
  });

  back.addEventListener('click', function () { show(step - 1); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    formErr.hidden = true;
    if (!eventType) {
      var oe = occasionScreen.querySelector('.err');
      oe.textContent = 'Pick one to get started.';
      oe.hidden = false;
      return;
    }
    if (step > 0 && step <= screens.length) {
      if (!validate(screens[step - 1])) return;
      saveDraft();
      show(step + 1);
      return;
    }
    if (step !== total() - 1) { show(step + 1); return; }
    for (var i = 0; i < screens.length; i++) { if (!validate(screens[i])) { show(i + 1); return; } }
    submit();
  });

  // The event happens at the RESTAURANT, not where the person filling this in
  // happens to be sitting — a planner in another timezone would otherwise send
  // a time nobody meant.
  function toRestaurantIso(local, tz) {
    if (!local) return null;
    var asUtc = new Date(local + ':00Z');
    if (isNaN(asUtc.getTime())) return null;
    if (!tz) return asUtc.toISOString();
    try {
      var shown = new Date(asUtc.toLocaleString('en-US', { timeZone: tz }));
      return new Date(asUtc.getTime() + (asUtc.getTime() - shown.getTime())).toISOString();
    } catch (e) { return asUtc.toISOString(); }
  }

  function submit() {
    next.disabled = true;
    next.textContent = 'Sending…';
    var body = { restaurant_id: form.querySelector('[name=restaurant_id]').value, event_type: eventType, extras: {} };
    var tz = form.querySelector('[name=timezone]').value;
    screens.forEach(function (s) {
      fieldsOf(s).forEach(function (f) {
        var v = f.value.trim();
        if (!v) return;
        if (f.name.indexOf('extras.') === 0) { body.extras[f.name.slice(7)] = v; return; }
        if (f.name === 'event_at') { body.event_at = toRestaurantIso(v, tz); return; }
        if (f.name === 'headcount') { body.headcount = parseInt(v, 10); return; }
        body[f.name] = v;
      });
    });
    var tokenEl = form.querySelector('[name="cf-turnstile-response"]');
    if (tokenEl && tokenEl.value) body.turnstile_token = tokenEl.value;

    fetch('/api/catering', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; });
    }).then(function (res) {
      if (!res.ok) throw new Error(res.j && res.j.status ? res.j.status : 'failed');
      try { sessionStorage.removeItem(DRAFT); } catch (e) {}
      form.hidden = true;
      document.getElementById('done').hidden = false;
      window.scrollTo(0, 0);
    }).catch(function (err) {
      next.disabled = false;
      next.textContent = 'Send Request';
      formErr.textContent =
        String(err.message) === 'rate_limited' ? "That's a few requests in a row — try again in a little while."
        : String(err.message) === 'challenge_failed' ? "We couldn't verify that. Reload and try once more."
        : String(err.message) === 'catering_disabled' ? "We're not taking catering enquiries right now."
        : "That didn't send. Try again, or call us.";
      formErr.hidden = false;
    });
  }

  restoreDraft();
  show(0);
})();
`;
}

export const catering = { id: 'guided', label: 'Guided', render: renderCateringBody };
