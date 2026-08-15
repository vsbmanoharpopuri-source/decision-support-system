/* ═══════════════════════════════════════════════════════════════
   DECIDR — script.js
   Decision Support Application Logic
═══════════════════════════════════════════════════════════════ */

'use strict';

// ── Build marker (Phase 4B regeneration) ──────────────────────
// If you're debugging a "missing feature" issue, check this first:
// open the browser console and confirm this exact string appears.
// If it doesn't, the browser is running a stale/cached script.js —
// not the file described in PHASE4B_IMPLEMENTATION.md.
const BUILD_VERSION = 'phase4b-1786764577';
console.log('%c[DECIDR] Phase 4B loaded — build ' + BUILD_VERSION, 'color:#f0a500;font-weight:bold;font-size:13px');
document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('build-version');
  if (el) el.textContent = 'Build: Phase 4B (' + BUILD_VERSION + ')';
});

console.log('%c[Decidr] script.js — PHASE 4B build (options edit/delete, criteria CRUD, scores CRUD)', 'color:#f0a500;font-weight:bold');

// ── State ──────────────────────────────────────────────────────
const state = {
  decisionId: null, // Phase 4A: id of the current user's Decision row in Supabase
  options:  [],   // [{ id, name, color }]
  criteria: [],   // [{ id, name, weight }]
  scores:   {},   // { optionId_criterionId: score }
  results:  null, // computed results
};

// Option/criteria colours
const PALETTE = [
  '#f0a500', '#4f88ff', '#3fcf8e', '#ff5757',
  '#a855f7', '#f97316', '#06b6d4', '#ec4899',
  '#84cc16', '#ef4444',
];
let paletteIdx = 0;
const nextColor = () => PALETTE[paletteIdx++ % PALETTE.length];

// Phase 4B: tracks which option/criterion pill (if any) is currently
// in inline-edit mode. Only one item can be edited at a time.
let editingOptionId = null;
let editingCriterionId = null;

// ── Page Routing ───────────────────────────────────────────────
function showDashboard() {
  document.getElementById('landing-page').classList.remove('active');
  document.getElementById('dashboard-page').classList.add('active');
  switchTab('setup');
}
function showLanding() {
  document.getElementById('dashboard-page').classList.remove('active');
  document.getElementById('landing-page').classList.add('active');
}

// ── Tab Switching ──────────────────────────────────────────────
function switchTab(tab) {
  // Tabs
  document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  // Panels
  document.querySelectorAll('.dash-tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`panel-${tab}`).classList.add('active');
  // Progress bar
  const pct = { setup: 33, matrix: 66, results: 100 }[tab] || 0;
  document.getElementById('progress-bar').style.width = pct + '%';

  if (tab === 'matrix') renderMatrix();
}

// ── Options ────────────────────────────────────────────────────
async function addOption() {
  const input = document.getElementById('option-input');
  const name = input.value.trim();
  if (!name) { showToast('Please enter an option name.', 'error'); return; }
  if (name.length < 1) { showToast('Name too short.', 'error'); return; }
  if (state.options.find(o => o.name.toLowerCase() === name.toLowerCase())) {
    showToast('That option already exists.', 'error'); return;
  }
  if (!state.decisionId) {
    showToast('Still loading your data — please try again in a moment.', 'error');
    return;
  }

  const addBtn = document.getElementById('add-option-btn');
  if (addBtn) addBtn.disabled = true;

  try {
    const saved = await createOption(state.decisionId, name, nextColor());
    state.options.push({ id: saved.id, name: saved.name, color: saved.color });
    input.value = '';
    input.focus();
    renderOptions();
    updateSetupHint();
    showToast(`Added "${name}"`, 'success');
  } catch (err) {
    console.error('[Options] Failed to save option:', err);
    showToast('Could not save that option. Please try again.', 'error');
  } finally {
    if (addBtn) addBtn.disabled = false;
  }
}

// Delete is now a real, irreversible database operation (Phase 4B),
// so — unlike the old local-only version — this asks for confirmation
// first, consistent with resetAll()'s existing confirm() pattern.
async function removeOption(id) {
  if (!confirm('Delete this option? This cannot be undone.')) return;
  try {
    await deleteOption(id);
    state.options = state.options.filter(o => o.id !== id);
    // Related scores are deleted automatically in the database via
    // ON DELETE CASCADE; clean the local mirror too so the UI matches.
    Object.keys(state.scores).forEach(k => {
      if (k.startsWith(id + '_')) delete state.scores[k];
    });
    if (editingOptionId === id) editingOptionId = null;
    renderOptions();
    updateSetupHint();
    showToast('Option deleted', 'success');
  } catch (err) {
    console.error('[Options] Failed to delete option:', err);
    showToast('Could not delete that option. Please try again.', 'error');
  }
}

function startEditOption(id) {
  editingOptionId = id;
  renderOptions();
}

function cancelEditOption() {
  editingOptionId = null;
  renderOptions();
}

async function saveEditOption(id) {
  const input = document.getElementById(`edit-option-input-${id}`);
  if (!input) return;
  const name = input.value.trim();
  if (!name) { showToast('Name cannot be empty.', 'error'); return; }
  if (state.options.some(o => o.id !== id && o.name.toLowerCase() === name.toLowerCase())) {
    showToast('That option already exists.', 'error'); return;
  }
  try {
    const updated = await updateOption(id, name);
    const opt = state.options.find(o => o.id === id);
    if (opt) opt.name = updated.name;
    editingOptionId = null;
    renderOptions();
    showToast(`Renamed to "${updated.name}"`, 'success');
  } catch (err) {
    console.error('[Options] Failed to update option:', err);
    showToast('Could not save changes. Please try again.', 'error');
  }
}

function renderOptions() {
  const list = document.getElementById('options-list');
  const empty = document.getElementById('options-empty');
  const count = document.getElementById('options-count');
  count.textContent = state.options.length;

  // Clear non-empty items
  Array.from(list.querySelectorAll('.item-pill')).forEach(el => el.remove());

  if (state.options.length === 0) {
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  state.options.forEach(opt => {
    const li = document.createElement('li');
    li.className = 'item-pill';

    if (editingOptionId === opt.id) {
      li.innerHTML = `
        <span class="item-pill-color" style="background:${opt.color}"></span>
        <input type="text" id="edit-option-input-${opt.id}" class="input-field" style="padding:4px 8px;font-size:.85rem"
          value="${escHtml(opt.name)}" maxlength="60"
          onkeydown="if(event.key==='Enter') saveEditOption('${opt.id}'); if(event.key==='Escape') cancelEditOption();" />
        <button class="item-pill-delete" title="Save" onclick="saveEditOption('${opt.id}')">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 3" stroke="var(--green)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="item-pill-delete" title="Cancel" onclick="cancelEditOption()">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>`;
      list.appendChild(li);
      return;
    }

    li.innerHTML = `
      <span class="item-pill-color" style="background:${opt.color}"></span>
      <span class="item-pill-name">${escHtml(opt.name)}</span>
      <button class="item-pill-delete" title="Edit" onclick="startEditOption('${opt.id}')">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9.5 1.5l3 3L4 13H1v-3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
      </button>
      <button class="item-pill-delete" title="Remove" onclick="removeOption('${opt.id}')">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>`;
    list.appendChild(li);
  });
}

// ── Criteria ───────────────────────────────────────────────────
async function addCriterion() {
  const nameInput   = document.getElementById('criterion-input');
  const weightInput = document.getElementById('weight-input');
  const name   = nameInput.value.trim();
  const weight = parseInt(weightInput.value, 10);
  if (!name) { showToast('Please enter a criterion name.', 'error'); return; }
  if (state.criteria.find(c => c.name.toLowerCase() === name.toLowerCase())) {
    showToast('That criterion already exists.', 'error'); return;
  }
  if (!state.decisionId) {
    showToast('Still loading your data — please try again in a moment.', 'error');
    return;
  }

  try {
    const saved = await createCriterion(state.decisionId, name, weight);
    state.criteria.push({ id: saved.id, name: saved.name, weight: saved.weight });
    nameInput.value = '';
    weightInput.value = 5;
    document.getElementById('weight-display').textContent = 5;
    nameInput.focus();
    renderCriteria();
    updateSetupHint();
    showToast(`Added "${name}" (weight: ${weight})`, 'success');
  } catch (err) {
    console.error('[Criteria] Failed to save criterion:', err);
    showToast('Could not save that criterion. Please try again.', 'error');
  }
}

async function removeCriterion(id) {
  if (!confirm('Delete this criterion? This cannot be undone.')) return;
  try {
    await deleteCriterion(id);
    state.criteria = state.criteria.filter(c => c.id !== id);
    Object.keys(state.scores).forEach(k => {
      if (k.endsWith('_' + id)) delete state.scores[k];
    });
    if (editingCriterionId === id) editingCriterionId = null;
    renderCriteria();
    updateSetupHint();
    showToast('Criterion deleted', 'success');
  } catch (err) {
    console.error('[Criteria] Failed to delete criterion:', err);
    showToast('Could not delete that criterion. Please try again.', 'error');
  }
}

function startEditCriterion(id) {
  editingCriterionId = id;
  renderCriteria();
}

function cancelEditCriterion() {
  editingCriterionId = null;
  renderCriteria();
}

async function saveEditCriterion(id) {
  const nameInput = document.getElementById(`edit-criterion-input-${id}`);
  const weightInput = document.getElementById(`edit-criterion-weight-${id}`);
  if (!nameInput || !weightInput) return;
  const name = nameInput.value.trim();
  let weight = parseInt(weightInput.value, 10);
  if (!name) { showToast('Name cannot be empty.', 'error'); return; }
  if (isNaN(weight)) weight = 5;
  weight = Math.min(10, Math.max(1, weight));
  if (state.criteria.some(c => c.id !== id && c.name.toLowerCase() === name.toLowerCase())) {
    showToast('That criterion already exists.', 'error'); return;
  }
  try {
    const updated = await updateCriterion(id, name, weight);
    const crit = state.criteria.find(c => c.id === id);
    if (crit) { crit.name = updated.name; crit.weight = updated.weight; }
    editingCriterionId = null;
    renderCriteria();
    showToast(`Updated "${updated.name}" (weight: ${updated.weight})`, 'success');
  } catch (err) {
    console.error('[Criteria] Failed to update criterion:', err);
    showToast('Could not save changes. Please try again.', 'error');
  }
}

function renderCriteria() {
  const list  = document.getElementById('criteria-list');
  const empty = document.getElementById('criteria-empty');
  const count = document.getElementById('criteria-count');
  count.textContent = state.criteria.length;

  Array.from(list.querySelectorAll('.item-pill')).forEach(el => el.remove());

  if (state.criteria.length === 0) {
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  state.criteria.forEach(crit => {
    const li = document.createElement('li');
    li.className = 'item-pill';

    if (editingCriterionId === crit.id) {
      li.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1l1.5 4h4l-3.3 2.4 1.3 4L7 9l-3.5 2.4 1.3-4L1.5 5h4z" fill="var(--accent)"/>
        </svg>
        <input type="text" id="edit-criterion-input-${crit.id}" class="input-field" style="padding:4px 8px;font-size:.85rem;width:120px"
          value="${escHtml(crit.name)}" maxlength="60"
          onkeydown="if(event.key==='Escape') cancelEditCriterion();" />
        <input type="number" id="edit-criterion-weight-${crit.id}" class="input-field" style="padding:4px 8px;font-size:.85rem;width:56px"
          value="${crit.weight}" min="1" max="10"
          onkeydown="if(event.key==='Enter') saveEditCriterion('${crit.id}'); if(event.key==='Escape') cancelEditCriterion();" />
        <button class="item-pill-delete" title="Save" onclick="saveEditCriterion('${crit.id}')">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 3" stroke="var(--green)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="item-pill-delete" title="Cancel" onclick="cancelEditCriterion()">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>`;
      list.appendChild(li);
      return;
    }

    li.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 1l1.5 4h4l-3.3 2.4 1.3 4L7 9l-3.5 2.4 1.3-4L1.5 5h4z" fill="var(--accent)"/>
      </svg>
      <span class="item-pill-name">${escHtml(crit.name)}</span>
      <span class="item-pill-weight">×${crit.weight}</span>
      <button class="item-pill-delete" title="Edit" onclick="startEditCriterion('${crit.id}')">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9.5 1.5l3 3L4 13H1v-3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
      </button>
      <button class="item-pill-delete" title="Remove" onclick="removeCriterion('${crit.id}')">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>`;
    list.appendChild(li);
  });
}

// ── App Data Loading (Phase 4A) ──────────────────────────────────
// Called from auth.js once a session is confirmed (initial load,
// after login, or after signup with an immediate session). Loads the
// user's existing decision if they have one, otherwise creates a
// fresh one — then loads that decision's options. Criteria/scores
// stay local-only for now; that's Phase 4B+ scope.

// Returns the user's existing decision, or creates one if they don't
// have one yet. Pulled out as its own named function (rather than
// left inline inside loadAppData) so it's independently callable and
// independently verifiable.
async function createDecisionIfNeeded() {
  let decision = await fetchUserDecision();
  if (!decision) {
    decision = await createDecision('My Decision');
  }
  return decision;
}

async function loadAppData() {
  try {
    const decision = await createDecisionIfNeeded();
    state.decisionId = decision.id;

    const options = await fetchOptions(decision.id);
    state.options = options.map(o => ({ id: o.id, name: o.name, color: o.color }));
    paletteIdx = state.options.length;

    const criteria = await fetchCriteria(decision.id);
    state.criteria = criteria.map(c => ({ id: c.id, name: c.name, weight: c.weight }));

    const optionIds = state.options.map(o => o.id);
    const scores = await fetchScores(optionIds);
    state.scores = {};
    scores.forEach(s => {
      state.scores[`${s.option_id}_${s.criterion_id}`] = s.score;
    });

    renderOptions();
    renderCriteria();
    updateSetupHint();
  } catch (err) {
    console.error('[App Data] Failed to load decision/options/criteria/scores:', err);
    showToast('Could not load your saved data. Please refresh the page.', 'error');
  }
}

// ── Setup Hint & Gating ────────────────────────────────────────
function updateSetupHint() {
  const btn  = document.getElementById('goto-matrix-btn');
  const hint = document.getElementById('setup-hint');
  const opts = state.options.length;
  const crits = state.criteria.length;
  const ready = opts >= 2 && crits >= 1;
  btn.disabled = !ready;

  if (opts < 2 && crits < 1) {
    hint.innerHTML = 'Add at least <strong>2 options</strong> and <strong>1 criterion</strong> to continue.';
  } else if (opts < 2) {
    hint.innerHTML = `Add ${2 - opts} more <strong>option${opts === 0 ? 's' : ''}</strong> to continue.`;
  } else if (crits < 1) {
    hint.innerHTML = 'Add at least <strong>1 criterion</strong> to continue.';
  } else {
    hint.innerHTML = `✓ Ready! ${opts} options · ${crits} criteria`;
    hint.style.color = 'var(--green)';
    return;
  }
  hint.style.color = '';
}

// ── Score Matrix ───────────────────────────────────────────────
function renderMatrix() {
  const thead = document.getElementById('score-thead');
  const tbody = document.getElementById('score-tbody');

  if (state.options.length === 0 || state.criteria.length === 0) {
    thead.innerHTML = '';
    tbody.innerHTML = `<tr><td colspan="99" style="padding:40px;text-align:center;color:var(--text-3)">
      Complete Setup first — add options and criteria.</td></tr>`;
    return;
  }

  // Header row
  let headHtml = '<tr><th>Option</th>';
  state.criteria.forEach(c => {
    headHtml += `<th class="th-criterion">
      ${escHtml(c.name)}<span class="th-weight-badge">×${c.weight}</span>
    </th>`;
  });
  headHtml += '</tr>';
  thead.innerHTML = headHtml;

  // Body rows
  tbody.innerHTML = '';
  state.options.forEach(opt => {
    const tr = document.createElement('tr');
    let rowHtml = `
      <td>
        <div class="option-label-cell">
          <span class="option-dot" style="background:${opt.color}"></span>
          ${escHtml(opt.name)}
        </div>
      </td>`;

    state.criteria.forEach(crit => {
      const key = `${opt.id}_${crit.id}`;
      const val = state.scores[key] || '';
      rowHtml += `
        <td>
          <div class="score-cell">
            <input
              type="number"
              class="score-input"
              min="1" max="10"
              value="${val}"
              placeholder="—"
              data-key="${key}"
              oninput="onScoreInput(this)"
              onblur="onScoreBlur(this)"
              onkeydown="navigateCell(event, this)"
            />
            <div class="score-mini-bar">
              <div class="score-mini-fill" id="mini-${key}" style="width:${val ? (val/10*100) : 0}%"></div>
            </div>
          </div>
        </td>`;
    });

    tr.innerHTML = rowHtml;
    tbody.appendChild(tr);
  });
}

function onScoreInput(input) {
  let v = parseInt(input.value, 10);
  // Clamp
  if (!isNaN(v)) {
    if (v < 1) v = 1;
    if (v > 10) v = 10;
    input.value = v;
    state.scores[input.dataset.key] = v;
  } else {
    delete state.scores[input.dataset.key];
  }
  // Update mini bar
  const mini = document.getElementById(`mini-${input.dataset.key}`);
  if (mini) mini.style.width = (isNaN(v) ? 0 : v / 10 * 100) + '%';
}

async function onScoreBlur(input) {
  let v = parseInt(input.value, 10);
  const [optionId, criterionId] = input.dataset.key.split('_');

  if (!isNaN(v)) {
    v = Math.min(10, Math.max(1, v));
    input.value = v;
    state.scores[input.dataset.key] = v;
    try {
      await upsertScore(optionId, criterionId, v);
    } catch (err) {
      console.error('[Scores] Failed to save score:', err);
      showToast('Could not save that score. Please try again.', 'error');
    }
  } else if (input.value.trim() === '') {
    // Cell was cleared — remove any previously saved score for this pair.
    delete state.scores[input.dataset.key];
    try {
      await deleteScore(optionId, criterionId);
    } catch (err) {
      console.error('[Scores] Failed to clear score:', err);
      showToast('Could not clear that score. Please try again.', 'error');
    }
  }
}

// Tab navigation in the matrix
function navigateCell(e, input) {
  if (e.key === 'Tab') return; // default behaviour
  if (e.key === 'ArrowRight' || e.key === 'Enter') {
    e.preventDefault();
    const inputs = Array.from(document.querySelectorAll('.score-input'));
    const idx = inputs.indexOf(input);
    if (idx < inputs.length - 1) inputs[idx + 1].focus();
  }
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    const inputs = Array.from(document.querySelectorAll('.score-input'));
    const idx = inputs.indexOf(input);
    if (idx > 0) inputs[idx - 1].focus();
  }
}

// ── Calculate ──────────────────────────────────────────────────
function calculate() {
  // Validate: every cell filled
  const missing = [];
  state.options.forEach(opt => {
    state.criteria.forEach(crit => {
      const key = `${opt.id}_${crit.id}`;
      if (!state.scores[key]) missing.push(`${opt.name} × ${crit.name}`);
    });
  });

  if (missing.length > 0) {
    showToast(`Fill all scores first (${missing.length} missing).`, 'error');
    // Highlight empty cells
    document.querySelectorAll('.score-input').forEach(inp => {
      const v = inp.value.trim();
      if (!v || isNaN(parseInt(v))) {
        inp.style.borderColor = 'var(--red)';
        inp.style.boxShadow = '0 0 0 3px rgba(255,87,87,.2)';
        setTimeout(() => {
          inp.style.borderColor = '';
          inp.style.boxShadow = '';
        }, 2500);
      }
    });
    return;
  }

  // Total weight
  const totalWeight = state.criteria.reduce((s, c) => s + c.weight, 0);

  // Compute weighted scores
  const computed = state.options.map(opt => {
    let total = 0;
    const breakdown = {};
    state.criteria.forEach(crit => {
      const rawScore = state.scores[`${opt.id}_${crit.id}`] || 0;
      const contribution = (crit.weight / totalWeight) * rawScore * 10; // normalise to 100
      total += contribution;
      breakdown[crit.id] = { rawScore, contribution };
    });
    return { ...opt, total: Math.round(total * 10) / 10, breakdown };
  });

  // Sort descending
  computed.sort((a, b) => b.total - a.total);
  state.results = computed;

  switchTab('results');
  renderResults();
}

// ── Results ────────────────────────────────────────────────────
function renderResults() {
  if (!state.results) return;
  const results = state.results;

  document.getElementById('results-placeholder').style.display = 'none';
  document.getElementById('results-content').style.display = 'block';

  const winner = results[0];

  // Winner banner
  document.getElementById('winner-name').textContent  = winner.name;
  document.getElementById('winner-score').textContent = `${winner.total} / 100 points`;
  spawnConfetti();

  // Chart
  const maxScore = results[0].total;
  const chartContainer = document.getElementById('results-chart');
  chartContainer.innerHTML = '';
  results.forEach((r, i) => {
    const pct = maxScore > 0 ? (r.total / 100 * 100) : 0;
    const fillClass = i === 0 ? 'winner-fill' : i === 1 ? 'runner-fill' : 'other-fill';
    const row = document.createElement('div');
    row.className = 'chart-row';
    row.innerHTML = `
      <div class="chart-label">
        <span class="option-dot" style="background:${r.color}"></span>
        ${escHtml(r.name)}
      </div>
      <div class="chart-track">
        <div class="chart-fill ${fillClass}" style="width:0%" data-target="${pct}">
          ${r.total}
        </div>
      </div>`;
    chartContainer.appendChild(row);
  });

  // Animate bars after paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      chartContainer.querySelectorAll('.chart-fill').forEach(el => {
        el.style.width = el.dataset.target + '%';
      });
    });
  });

  // Rankings
  const rankingContainer = document.getElementById('rankings-table');
  rankingContainer.innerHTML = '';
  results.forEach((r, i) => {
    const pct = maxScore > 0 ? (r.total / maxScore * 100) : 0;
    const row = document.createElement('div');
    row.className = `rank-row${i === 0 ? ' rank-1' : ''}`;
    row.style.animationDelay = `${i * 60}ms`;
    row.innerHTML = `
      <div class="rank-num">${i + 1}</div>
      <span class="option-dot" style="background:${r.color}"></span>
      <div class="rank-name">${escHtml(r.name)}</div>
      <div class="rank-bar-mini">
        <div class="rank-bar-fill" style="width:${pct}%"></div>
      </div>
      <div class="rank-score">${r.total}</div>`;
    rankingContainer.appendChild(row);
  });

  // Breakdown per criterion
  const breakdownGrid = document.getElementById('breakdown-grid');
  breakdownGrid.innerHTML = '';
  const totalWeight = state.criteria.reduce((s, c) => s + c.weight, 0);

  state.criteria.forEach((crit, ci) => {
    const card = document.createElement('div');
    card.className = 'breakdown-card';
    card.style.animationDelay = `${ci * 50}ms`;
    let itemsHtml = '';
    // Sort by rawScore desc
    const sorted = [...results].sort((a, b) => b.breakdown[crit.id].rawScore - a.breakdown[crit.id].rawScore);
    sorted.forEach(r => {
      const raw = r.breakdown[crit.id].rawScore;
      itemsHtml += `
        <div class="breakdown-item">
          <span class="breakdown-item-name" title="${escHtml(r.name)}">${escHtml(r.name)}</span>
          <div class="breakdown-track">
            <div class="breakdown-fill" style="width:${raw * 10}%"></div>
          </div>
          <span class="breakdown-item-score">${raw}</span>
        </div>`;
    });
    card.innerHTML = `
      <div class="breakdown-crit">
        <span>${escHtml(crit.name)}</span>
        <span class="breakdown-crit-weight">×${crit.weight}</span>
      </div>
      <div class="breakdown-items">${itemsHtml}</div>`;
    breakdownGrid.appendChild(card);
  });
}

// ── Confetti ───────────────────────────────────────────────────
function spawnConfetti() {
  const container = document.getElementById('confetti-container');
  container.innerHTML = '';
  const colours = ['#f0a500', '#f7d07a', '#4f88ff', '#3fcf8e', '#ff5757', '#a855f7'];
  for (let i = 0; i < 40; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.cssText = `
      left: ${Math.random() * 100}%;
      top: ${Math.random() * -10}%;
      background: ${colours[Math.floor(Math.random() * colours.length)]};
      width: ${4 + Math.random() * 8}px;
      height: ${4 + Math.random() * 8}px;
      border-radius: ${Math.random() > .5 ? '50%' : '2px'};
      animation-duration: ${1.2 + Math.random() * 1.8}s;
      animation-delay: ${Math.random() * .6}s;
    `;
    container.appendChild(piece);
  }
}

// ── Reset ──────────────────────────────────────────────────────
function resetAll() {
  if (!confirm('Reset everything and start a new decision?')) return;
  state.options  = [];
  state.criteria = [];
  state.scores   = {};
  state.results  = null;
  paletteIdx = 0;

  renderOptions();
  renderCriteria();
  updateSetupHint();

  // Reset results panel
  document.getElementById('results-placeholder').style.display = 'flex';
  document.getElementById('results-content').style.display = 'none';

  switchTab('setup');
  showToast('Decision cleared — fresh start!', 'success');
}

// ── Toast ──────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast show${type ? ' ' + type : ''}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2800);
}

// ── Helpers ────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ───────────────────────────────────────────────────────
(function init() {
  updateSetupHint();

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Nav shrink on scroll (landing page)
  window.addEventListener('scroll', () => {
    const nav = document.querySelector('.nav');
    if (!nav) return;
    nav.style.borderBottomColor = window.scrollY > 40 ? 'var(--border-2)' : 'var(--border)';
  });
})();
