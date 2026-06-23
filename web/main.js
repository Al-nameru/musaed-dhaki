/* ===== STATE ===== */
const state = {
  activeTab: 'home',
  activeSettingsSection: 'general',
  isRecording: false,
  recordTimer: null,
  recordSeconds: 0,
  ttsUtterance: null,
  ttsPlaying: false,
  alerts: [],
  stats: JSON.parse(localStorage.getItem('sa_stats') || '{"total":0,"input":0,"output":0,"words":0,"requests":0,"cost":0,"byProvider":{},"byModel":{},"operations":[]}'),
  keys: JSON.parse(localStorage.getItem('sa_keys') || '[]'),
  settings: JSON.parse(localStorage.getItem('sa_settings') || '{}'),
};

/* ===== TAB NAVIGATION ===== */
function initTabs() {
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      activateTab(tab);
    });
  });
}

function activateTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));
  if (tab === 'stats') renderStats();
  if (tab === 'alerts') renderAlerts();
}

/* ===== SETTINGS NAVIGATION ===== */
function initSettingsNav() {
  document.querySelectorAll('.settings-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      document.querySelectorAll('.settings-nav-item').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.settings-section').forEach(s => s.classList.toggle('active', s.id === `section-${section}`));
    });
  });
}

/* ===== RECORDING ===== */
function initRecording() {
  const btn = document.getElementById('record-btn');
  const timer = document.getElementById('record-timer');
  let mediaRecorder = null;
  let chunks = [];

  btn.addEventListener('click', async () => {
    if (!state.isRecording) {
      await startRecording();
    } else {
      stopRecording();
    }
  });

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      chunks = [];
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        simulateTranscription(blob);
      };
      mediaRecorder.start();
      state.isRecording = true;
      btn.className = 'record-btn recording';
      btn.querySelector('.record-label').textContent = 'اضغط للإيقاف';
      btn.querySelector('.record-icon').textContent = '⏹️';
      setGlobalStatus('recording', 'جارٍ التسجيل...');
      state.recordSeconds = 0;
      state.recordTimer = setInterval(() => {
        state.recordSeconds++;
        const m = String(Math.floor(state.recordSeconds / 60)).padStart(2, '0');
        const s = String(state.recordSeconds % 60).padStart(2, '0');
        timer.textContent = `${m}:${s}`;
      }, 1000);
    } catch (err) {
      addAlert('error', `فشل الوصول إلى الميكروفون: ${err.message}`);
      showToast('لا يمكن الوصول إلى الميكروفون', 'error');
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    clearInterval(state.recordTimer);
    state.isRecording = false;
    btn.className = 'record-btn idle';
    btn.querySelector('.record-label').textContent = 'اضغط للتسجيل';
    btn.querySelector('.record-icon').textContent = '🎙️';
    setGlobalStatus('processing', 'جارٍ التحويل...');
  }

  function simulateTranscription(blob) {
    setTimeout(() => {
      const samples = [
        'مرحباً، هذا نص تجريبي من تسجيل صوتي. يمكنك تسجيل صوتك وسيتم تحويله إلى نص.',
        'السلام عليكم ورحمة الله وبركاته. يسعدني استخدام هذا التطبيق الرائع.',
        'التقنية الحديثة تتيح لنا تحويل الكلام إلى نص بدقة عالية وسرعة فائقة.',
      ];
      const text = samples[Math.floor(Math.random() * samples.length)];
      document.getElementById('result-text').value = text;
      setGlobalStatus('success', 'اكتمل التحويل');
      showToast('تم تحويل الصوت إلى نص', 'success');
      addAlert('info', 'تم تحويل التسجيل الصوتي إلى نص بنجاح');
      updateStats('STT', 'Groq', text.split(' ').length, 50, 100);
    }, 1500);
  }
}

/* ===== OUTPUT MODE ===== */
function initOutputMode() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

/* ===== COPY & CLEAR ===== */
function initTextActions() {
  document.getElementById('btn-copy').addEventListener('click', () => {
    const text = document.getElementById('result-text').value;
    if (!text.trim()) return;
    navigator.clipboard.writeText(text).then(() => showToast('تم النسخ', 'success'));
  });

  document.getElementById('btn-clear-text').addEventListener('click', () => {
    document.getElementById('result-text').value = '';
  });

  document.getElementById('btn-process-text').addEventListener('click', () => {
    const text = document.getElementById('result-text').value.trim();
    if (!text) return showToast('لا يوجد نص للمعالجة', 'error');
    processText(text);
  });
}

function processText(text) {
  const grammar = document.getElementById('opt-grammar').checked;
  const diacritize = document.getElementById('opt-diacritize').checked;
  setGlobalStatus('processing', 'جارٍ المعالجة...');
  setTimeout(() => {
    let result = text;
    if (grammar) result = result.replace(/\s+/g, ' ').trim();
    document.getElementById('result-text').value = result;
    setGlobalStatus('success', 'اكتملت المعالجة');
    showToast('تمت معالجة النص', 'success');
    updateStats('Text', 'Groq', result.split(' ').length, 200, 150);
  }, 1000);
}

/* ===== TTS ===== */
function initTTS() {
  const rateInput = document.getElementById('tts-rate');
  const pitchInput = document.getElementById('tts-pitch');
  rateInput.addEventListener('input', () => { document.getElementById('tts-rate-val').textContent = parseFloat(rateInput.value).toFixed(1); });
  pitchInput.addEventListener('input', () => { document.getElementById('tts-pitch-val').textContent = parseFloat(pitchInput.value).toFixed(1); });

  const defaultRateInput = document.getElementById('tts-default-rate');
  const defaultVolInput = document.getElementById('tts-default-volume');
  if (defaultRateInput) defaultRateInput.addEventListener('input', () => { document.getElementById('default-rate-val').textContent = parseFloat(defaultRateInput.value).toFixed(1); });
  if (defaultVolInput) defaultVolInput.addEventListener('input', () => { document.getElementById('default-volume-val').textContent = defaultVolInput.value; });

  document.getElementById('tts-toggle').addEventListener('click', () => {
    const ctrl = document.getElementById('tts-controls');
    const btn = document.getElementById('tts-toggle');
    const hidden = ctrl.style.display === 'none';
    ctrl.style.display = hidden ? 'block' : 'none';
    btn.textContent = hidden ? 'إخفاء ↑' : 'إظهار ↓';
  });

  document.getElementById('btn-speak').addEventListener('click', () => {
    const text = document.getElementById('result-text').value.trim();
    if (!text) return showToast('لا يوجد نص للقراءة', 'error');
    speak(text);
  });
}

function speak(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ar-SA';
    utter.rate = parseFloat(document.getElementById('tts-rate').value);
    utter.pitch = parseFloat(document.getElementById('tts-pitch').value);
    window.speechSynthesis.speak(utter);
    showToast('جارٍ القراءة...', 'info');
  } else {
    showToast('المتصفح لا يدعم خاصية القراءة', 'error');
  }
}

/* ===== API KEYS ===== */
function initKeys() {
  document.getElementById('toggle-key-visibility').addEventListener('click', () => {
    const input = document.getElementById('active-api-key');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('btn-verify-key').addEventListener('click', () => {
    const key = document.getElementById('active-api-key').value.trim();
    const provider = document.getElementById('active-provider-select').value;
    if (!key) return showToast('أدخل مفتاح API أولاً', 'error');
    verifyKey(key, provider, 'active-key-status');
  });

  document.getElementById('btn-batch-verify').addEventListener('click', () => {
    const raw = document.getElementById('batch-keys-input').value.trim();
    if (!raw) return showToast('أدخل مفاتيح للتحقق', 'error');
    const keys = raw.split(/[\n,\s]+/).filter(k => k.length > 8);
    if (!keys.length) return showToast('لم يتم العثور على مفاتيح صالحة', 'error');
    batchVerify(keys);
  });

  document.getElementById('btn-save-prompts')?.addEventListener('click', () => {
    const prompts = {
      grammar: document.getElementById('prompt-grammar').value,
      diacritize: document.getElementById('prompt-diacritize').value,
      translate: document.getElementById('prompt-translate').value,
      summarize: document.getElementById('prompt-summarize').value,
    };
    localStorage.setItem('sa_prompts', JSON.stringify(prompts));
    showToast('تم حفظ الموجّهات', 'success');
  });
}

function verifyKey(key, provider, badgeId) {
  const badge = document.getElementById(badgeId);
  if (badge) { badge.textContent = 'جارٍ التحقق...'; badge.className = 'badge badge-info'; }
  setTimeout(() => {
    const valid = key.length > 15 && (
      (provider === 'groq' && key.startsWith('gsk_')) ||
      (provider === 'openai' && key.startsWith('sk-')) ||
      (provider === 'gemini' && key.startsWith('AIza')) ||
      (provider === 'anthropic' && key.startsWith('sk-ant-')) ||
      key.length > 20
    );
    if (badge) {
      badge.textContent = valid ? 'مُتحقق ✓' : 'غير صالح ✗';
      badge.className = valid ? 'badge badge-success' : 'badge badge-danger';
    }
    showToast(valid ? 'المفتاح صالح' : 'المفتاح غير صالح', valid ? 'success' : 'error');
    addAlert(valid ? 'success' : 'error', `التحقق من مفتاح ${provider}: ${valid ? 'ناجح' : 'فشل'}`);
    if (valid) saveKey(key, provider);
  }, 1200);
}

function saveKey(key, provider) {
  const existing = state.keys.findIndex(k => k.key === key);
  if (existing === -1) state.keys.push({ key, provider, status: 'valid', addedAt: new Date().toISOString() });
  localStorage.setItem('sa_keys', JSON.stringify(state.keys));
}

function batchVerify(keys) {
  const wrapper = document.getElementById('keys-table-wrapper');
  const tbody = document.getElementById('keys-table-body');
  wrapper.style.display = 'block';
  tbody.innerHTML = keys.map(k => {
    const provider = detectProvider(k);
    return `<tr>
      <td class="key-snippet">${k.slice(0, 8)}...${k.slice(-4)}</td>
      <td>${provider}</td>
      <td><span class="badge badge-info" id="batch-status-${k.slice(-6)}">جارٍ التحقق...</span></td>
      <td>-</td>
      <td><button class="btn btn-ghost btn-sm" onclick="copyToClipboard('${k}')">نسخ</button></td>
    </tr>`;
  }).join('');

  keys.forEach((key, i) => {
    setTimeout(() => {
      const provider = detectProvider(key);
      const valid = key.length > 15;
      const badge = document.getElementById(`batch-status-${key.slice(-6)}`);
      if (badge) { badge.textContent = valid ? 'صالح ✓' : 'غير صالح ✗'; badge.className = valid ? 'badge badge-success' : 'badge badge-danger'; }
    }, 800 + i * 300);
  });
}

function detectProvider(key) {
  if (key.startsWith('gsk_')) return 'Groq';
  if (key.startsWith('sk-ant-')) return 'Anthropic';
  if (key.startsWith('AIza')) return 'Gemini';
  if (key.startsWith('sk-')) return 'OpenAI';
  if (key.startsWith('xai-')) return 'xAI';
  return 'غير محدد';
}

/* ===== MODEL COMPARE ===== */
function initCompare() {
  const question = document.getElementById('compare-question');
  question.addEventListener('input', () => {
    document.getElementById('compare-char-count').textContent = question.value.length;
  });

  document.getElementById('btn-run-compare').addEventListener('click', runCompare);
  document.getElementById('btn-clear-compare').addEventListener('click', () => {
    document.getElementById('compare-results').innerHTML = '';
  });

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;
      const results = document.getElementById('compare-results');
      results.classList.toggle('table-view', view === 'table');
    });
  });
}

function runCompare() {
  const question = document.getElementById('compare-question').value.trim();
  if (!question) return showToast('أدخل سؤالاً أولاً', 'error');

  const selected = [...document.querySelectorAll('#models-grid input:checked')].map(i => i.value);
  if (!selected.length) return showToast('اختر نموذجاً واحداً على الأقل', 'error');

  const resultsDiv = document.getElementById('compare-results');
  const statusDiv = document.getElementById('compare-status');
  resultsDiv.innerHTML = '';
  statusDiv.style.display = 'flex';
  document.getElementById('compare-status-text').textContent = `جارٍ المقارنة بين ${selected.length} نموذج...`;

  const cards = {};
  selected.forEach(modelId => {
    const [provider, model] = modelId.split(':');
    const card = createCompareCard(provider, model);
    resultsDiv.appendChild(card);
    cards[modelId] = card;
  });

  let done = 0;
  selected.forEach((modelId, i) => {
    const [provider, model] = modelId.split(':');
    const delay = 600 + i * 400 + Math.random() * 800;
    setTimeout(() => {
      const body = cards[modelId].querySelector('.compare-result-body');
      const latencyEl = cards[modelId].querySelector('.compare-latency');
      const latency = (delay / 1000).toFixed(2);
      const response = generateSampleResponse(question, model);
      body.classList.remove('loading');
      body.textContent = response;
      latencyEl.textContent = `${latency}s`;
      cards[modelId].querySelector('.compare-words').textContent = `${response.split(' ').length} كلمة`;
      done++;
      updateStats('Compare', provider, response.split(' ').length, 200, response.split(' ').length * 1.5);
      if (done === selected.length) {
        statusDiv.style.display = 'none';
        showToast('اكتملت المقارنة', 'success');
      }
    }, delay);
  });
}

function createCompareCard(provider, model) {
  const card = document.createElement('div');
  card.className = 'compare-result-card';
  card.innerHTML = `
    <div class="compare-result-header">
      <div class="compare-model-name">${provider}: ${model.split('-').slice(0,3).join('-')}</div>
      <div class="compare-meta">
        <span class="compare-latency">...</span>
        <span class="compare-words">...</span>
      </div>
    </div>
    <div class="compare-result-body loading">جارٍ توليد الرد...</div>
  `;
  return card;
}

function generateSampleResponse(question, model) {
  const responses = [
    `هذا رد تجريبي من نموذج ${model} على سؤالك: "${question.slice(0,50)}..."\n\nيمكن للنموذج تحليل السؤال وتقديم إجابة شاملة ومفصلة. في البيئة الفعلية، سيتصل التطبيق بمفتاح API الخاص بك للحصول على رد حقيقي من النموذج.`,
    `استجابة ${model}: بناءً على سؤالك، يمكنني القول أن هذا موضوع مهم يستحق البحث والدراسة. النماذج المختلفة تتمتع بقدرات متنوعة في التحليل والاستنتاج.\n\nأنصح بمقارنة عدة نماذج للحصول على أفضل النتائج.`,
    `من منظور ${model}: هذا سؤال رائع! التقنيات الحديثة في معالجة اللغة الطبيعية تطورت بشكل ملحوظ. كل نموذج له نقاط قوة خاصة به في مجالات مختلفة كالإبداع والتحليل والترجمة.`,
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

/* ===== ALERTS ===== */
function addAlert(type, message) {
  const alert = { type, message, time: new Date(), id: Date.now() };
  state.alerts.unshift(alert);
  updateAlertBadge();
  if (state.activeTab === 'alerts') renderAlerts();
}

function updateAlertBadge() {
  const errors = state.alerts.filter(a => a.type === 'error').length;
  const badge = document.getElementById('alerts-badge');
  badge.style.display = errors > 0 ? 'inline' : 'none';
  badge.textContent = errors;
}

function renderAlerts() {
  const errors = state.alerts.filter(a => a.type === 'error').length;
  const warnings = state.alerts.filter(a => a.type === 'warning').length;
  const infos = state.alerts.filter(a => ['info', 'success'].includes(a.type)).length;
  document.getElementById('count-errors').textContent = errors;
  document.getElementById('count-warnings').textContent = warnings;
  document.getElementById('count-info').textContent = infos;

  const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
  renderAlertList(activeFilter);
}

function renderAlertList(filter) {
  const list = document.getElementById('alerts-list');
  const filtered = filter === 'all' ? state.alerts : state.alerts.filter(a => a.type === filter || (filter === 'info' && a.type === 'success'));
  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state"><span class="empty-icon">🔔</span><p>لا توجد تنبيهات</p></div>`;
    return;
  }
  const icons = { error: '❌', warning: '⚠️', info: 'ℹ️', success: '✅' };
  list.innerHTML = filtered.map(a => `
    <div class="alert-item ${a.type === 'success' ? 'info' : a.type}">
      <span class="alert-icon">${icons[a.type] || 'ℹ️'}</span>
      <div class="alert-content">
        <div class="alert-message">${a.message}</div>
        <span class="alert-time">${a.time.toLocaleTimeString('ar')}</span>
      </div>
    </div>
  `).join('');
}

function initAlerts() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderAlertList(btn.dataset.filter);
    });
  });
  document.getElementById('btn-clear-alerts').addEventListener('click', () => {
    state.alerts = [];
    updateAlertBadge();
    renderAlerts();
  });
}

/* ===== STATS ===== */
function updateStats(operation, provider, words, inputTokens, outputTokens) {
  const cost = (inputTokens * 0.000001 + outputTokens * 0.000002);
  state.stats.total += inputTokens + outputTokens;
  state.stats.input += inputTokens;
  state.stats.output += outputTokens;
  state.stats.words += words;
  state.stats.requests += 1;
  state.stats.cost += cost;
  if (!state.stats.byProvider[provider]) state.stats.byProvider[provider] = { requests: 0, tokens: 0, cost: 0 };
  state.stats.byProvider[provider].requests++;
  state.stats.byProvider[provider].tokens += inputTokens + outputTokens;
  state.stats.byProvider[provider].cost += cost;
  state.stats.operations.unshift({ operation, provider, words, tokens: inputTokens + outputTokens, time: new Date().toISOString() });
  if (state.stats.operations.length > 100) state.stats.operations.pop();
  localStorage.setItem('sa_stats', JSON.stringify(state.stats));
}

function renderStats() {
  document.getElementById('stat-total-tokens').textContent = state.stats.total.toLocaleString('ar');
  document.getElementById('stat-input-tokens').textContent = state.stats.input.toLocaleString('ar');
  document.getElementById('stat-output-tokens').textContent = state.stats.output.toLocaleString('ar');
  document.getElementById('stat-total-words').textContent = state.stats.words.toLocaleString('ar');
  document.getElementById('stat-total-requests').textContent = state.stats.requests.toLocaleString('ar');
  document.getElementById('stat-total-cost').textContent = `$${state.stats.cost.toFixed(4)}`;

  const providerBody = document.getElementById('stats-provider-body');
  const providers = Object.entries(state.stats.byProvider);
  providerBody.innerHTML = providers.length ? providers.map(([p, d]) =>
    `<tr><td>${p}</td><td>${d.requests}</td><td>${d.tokens.toLocaleString('ar')}</td><td>$${d.cost.toFixed(4)}</td></tr>`
  ).join('') : '<tr><td colspan="4" class="empty-row">لا توجد بيانات</td></tr>';

  const opsLog = document.getElementById('operations-log');
  opsLog.innerHTML = state.stats.operations.length ? state.stats.operations.slice(0, 20).map(op =>
    `<div class="operation-item">
      <span class="operation-time">${new Date(op.time).toLocaleTimeString('ar')}</span>
      <span class="operation-info">${op.operation} — ${op.provider}</span>
      <span class="operation-tokens">${op.tokens} رمز</span>
    </div>`
  ).join('') : `<div class="empty-state"><span class="empty-icon">📊</span><p>لا توجد عمليات</p></div>`;
}

document.getElementById('btn-reset-stats').addEventListener('click', () => {
  state.stats = { total: 0, input: 0, output: 0, words: 0, requests: 0, cost: 0, byProvider: {}, byModel: {}, operations: [] };
  localStorage.setItem('sa_stats', JSON.stringify(state.stats));
  renderStats();
  showToast('تمت إعادة تعيين الإحصائيات', 'info');
});

/* ===== SECURITY SETTINGS ===== */
function initSecurity() {
  document.getElementById('btn-export-settings')?.addEventListener('click', () => {
    const data = { keys: state.keys, settings: state.settings, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'smart-assistant-backup.json'; a.click();
    URL.revokeObjectURL(url);
    showToast('تم تصدير الإعدادات', 'success');
  });

  document.getElementById('btn-import-settings')?.addEventListener('click', () => {
    document.getElementById('import-file').click();
  });

  document.getElementById('import-file')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.keys) { state.keys = data.keys; localStorage.setItem('sa_keys', JSON.stringify(state.keys)); }
        showToast('تم استيراد الإعدادات', 'success');
      } catch { showToast('ملف غير صالح', 'error'); }
    };
    reader.readAsText(file);
  });

  document.getElementById('btn-clear-all')?.addEventListener('click', () => {
    if (confirm('هل أنت متأكد من مسح جميع البيانات؟')) {
      localStorage.clear();
      showToast('تم مسح جميع البيانات', 'info');
    }
  });
}

/* ===== QUICK TOOLS DIALOG ===== */
function initQuickTools() {
  document.getElementById('quick-tools-close').addEventListener('click', () => {
    document.getElementById('quick-tools-backdrop').style.display = 'none';
  });

  document.getElementById('quick-tools-backdrop').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
  });

  document.querySelectorAll('.quick-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const text = document.getElementById('quick-tools-input').value.trim();
      if (!text && action !== 'speak') return showToast('أدخل نصاً أولاً', 'error');
      runQuickAction(action, text);
    });
  });

  document.getElementById('quick-copy').addEventListener('click', () => {
    const text = document.getElementById('quick-result-text').value;
    navigator.clipboard.writeText(text).then(() => showToast('تم النسخ', 'success'));
  });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'Q') {
      const backdrop = document.getElementById('quick-tools-backdrop');
      backdrop.style.display = backdrop.style.display === 'none' ? 'flex' : 'none';
    }
  });
}

function runQuickAction(action, text) {
  const resultGroup = document.getElementById('quick-result-group');
  const resultText = document.getElementById('quick-result-text');
  resultGroup.style.display = 'block';
  resultText.value = 'جارٍ المعالجة...';

  if (action === 'speak') { speak(text || document.getElementById('result-text').value); return; }

  const labels = { grammar: 'تصحيح قواعدي', diacritize: 'تشكيل', translate: 'ترجمة', summarize: 'تلخيص' };
  setTimeout(() => {
    const results = {
      grammar: text.replace(/\s+/g, ' ').trim() + ' (تم التصحيح)',
      diacritize: text + ' (تم التشكيل)',
      translate: `Translation of: "${text.slice(0, 40)}..."`,
      summarize: `ملخص: ${text.split(' ').slice(0, 10).join(' ')}...`,
    };
    resultText.value = results[action] || text;
    showToast(`اكتمل: ${labels[action]}`, 'success');
  }, 1000);
}

/* ===== TOAST ===== */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(10px)'; toast.style.transition = '0.3s'; setTimeout(() => toast.remove(), 300); }, 3000);
}

/* ===== GLOBAL STATUS ===== */
function setGlobalStatus(state_type, message) {
  const dot = document.querySelector('.status-dot');
  const text = document.querySelector('.status-text');
  dot.className = `status-dot ${state_type}`;
  text.textContent = message;
  if (state_type === 'success') setTimeout(() => { dot.className = 'status-dot idle'; text.textContent = 'جاهز'; }, 3000);
}

/* ===== UTILITIES ===== */
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => showToast('تم النسخ', 'success'));
}

/* ===== INIT ===== */
function init() {
  initTabs();
  initSettingsNav();
  initRecording();
  initOutputMode();
  initTextActions();
  initTTS();
  initKeys();
  initCompare();
  initAlerts();
  initSecurity();
  initQuickTools();
  addAlert('info', 'تم تشغيل التطبيق بنجاح');
}

document.addEventListener('DOMContentLoaded', init);
