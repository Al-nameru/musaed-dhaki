import { copyCompareAnswer, updateCompareBadge } from "./rendering.js";

let columnCounter = 0;

function fillCompareProviderSelect(select, selectedProvider = "", deps) {
  const providers = deps.getProviders();
  select.innerHTML = "";
  providers.forEach(provider => {
    const option = document.createElement("option");
    option.value = provider;
    option.textContent = provider;
    select.appendChild(option);
  });
  select.value = providers.includes(selectedProvider) ? selectedProvider : providers[0] || "";
}

function fillCompareModelSelect(select, provider, selectedModel = "", deps) {
  const models = deps.getModels(provider);
  select.innerHTML = "";
  models.forEach(model => {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    select.appendChild(option);
  });
  select.value = models.includes(selectedModel) ? selectedModel : models[0] || "";
}

function maskKey(key) {
  if (!key) return "";
  if (key.length <= 10) return key;
  return key.substring(0, 6) + "..." + key.slice(-4);
}

function fillCompareKeySelect(select, provider, selectedKey = "", deps) {
  select.innerHTML = "";
  
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "المفتاح الافتراضي";
  select.appendChild(defaultOption);

  if (deps.getKeys) {
    const keys = deps.getKeys(provider) || [];
    keys.forEach((key, index) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = `مفتاح ${index + 1} (${maskKey(key)})`;
      select.appendChild(option);
    });
    select.value = keys.includes(selectedKey) ? selectedKey : "";
  } else {
    select.value = "";
  }
}

// يحوّل قائمة النماذج إلى صندوق بحث، مع إبقاء الـ select الأصلي مصدراً للقيمة.
function enhanceModelSelectWithSearch(select) {
  if (!select || select._combo) return select._combo;

  const wrap = document.createElement("div");
  wrap.className = "mc-combo";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "mc-combo-input";
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.placeholder = "ابحث عن نموذج…";
  const list = document.createElement("div");
  list.className = "mc-combo-list";
  list.setAttribute("role", "listbox");
  list.hidden = true;

  select.parentNode.insertBefore(wrap, select);
  wrap.appendChild(input);
  wrap.appendChild(list);
  wrap.appendChild(select);
  select.classList.add("mc-combo-native");

  let options = [];
  let activeIndex = -1;

  const currentLabel = () => {
    const opt = options.find((o) => o.value === select.value);
    return opt ? opt.label : (select.value || "");
  };
  const rebuild = () => {
    options = [...select.options].map((o) => ({ value: o.value, label: o.textContent }));
    input.value = currentLabel();
  };
  const filtered = () => {
    const q = input.value.trim().toLowerCase();
    if (!q || q === currentLabel().toLowerCase()) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  };
  const ensureVisible = () => {
    list.querySelector(".mc-combo-option.is-active")?.scrollIntoView({ block: "nearest" });
  };
  const renderList = () => {
    const items = filtered();
    list.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "mc-combo-empty";
      empty.textContent = "لا نموذج مطابق";
      list.appendChild(empty);
      return;
    }
    items.forEach((o, i) => {
      const el = document.createElement("div");
      el.className = "mc-combo-option" +
        (o.value === select.value ? " is-current" : "") +
        (i === activeIndex ? " is-active" : "");
      el.setAttribute("role", "option");
      el.textContent = o.label;
      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        choose(o.value);
      });
      list.appendChild(el);
    });
  };
  const open = () => {
    activeIndex = filtered().findIndex((o) => o.value === select.value);
    renderList();
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  };
  const close = (restore = true) => {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    activeIndex = -1;
    if (restore) input.value = currentLabel();
  };
  function choose(value) {
    if (value !== select.value) {
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    close(false);
    input.value = currentLabel();
  }

  input.addEventListener("focus", () => {
    input.select();
    open();
  });
  input.addEventListener("input", () => {
    activeIndex = -1;
    open();
  });
  input.addEventListener("blur", () => {
    setTimeout(() => close(true), 120);
  });
  input.addEventListener("keydown", (e) => {
    const items = filtered();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (list.hidden) {
        open();
        return;
      }
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      renderList();
      ensureVisible();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      renderList();
      ensureVisible();
    } else if (e.key === "Enter") {
      if (!list.hidden && items[activeIndex]) {
        e.preventDefault();
        choose(items[activeIndex].value);
      }
    } else if (e.key === "Escape") {
      if (!list.hidden) {
        e.preventDefault();
        close(true);
      }
    }
  });

  rebuild();
  select._combo = { rebuild };
  return select._combo;
}

export function createModelCompareColumn(container, config = {}, deps) {
  if (!container) return null;
  const id = ++columnCounter;
  const card = document.createElement("article");
  card.className = "card model-compare-column";
  card.dataset.columnId = id.toString();

  card.innerHTML = `
    <div class="model-compare-column-header">
      <div class="mc-header-row-1">
        <div class="mc-header-selects">
          <span class="mc-provider-badge">
            <span class="mc-provider-dot"></span>
          </span>
          <select class="compare-provider-select" aria-label="الشركة المزودة"></select>
          <select class="compare-key-select" aria-label="مفتاح API"></select>
          <select class="compare-model-select" aria-label="النموذج"></select>
        </div>
        <div class="mc-header-metrics-row1">
          <span class="mc-header-metric mc-meta-latency" hidden></span>
          <span class="mc-header-metric mc-meta-words" hidden></span>
          <span class="mc-header-metric mc-meta-chars" hidden></span>
        </div>
      </div>
      <div class="mc-header-row-2">
        <div class="mc-header-metrics-row2">
          <span class="mc-header-metric mc-meta-tokens" hidden></span>
          <span class="mc-fastest-badge" hidden>⚡ الأسرع</span>
        </div>
        <div class="model-compare-column-tools">
          <button class="mc-icon-btn btn-copy-compare" type="button" title="نسخ الإجابة" aria-label="نسخ الإجابة" disabled>📋 نسخ</button>
          <button class="mc-icon-btn btn-retry-compare" type="button" title="إعادة إرسال هذا النموذج" aria-label="إعادة الإرسال" disabled>↻ تحديث</button>
          <button class="mc-icon-btn btn-hide-compare-column" type="button" title="إخفاء العمود" aria-label="إخفاء العمود">👁 إخفاء</button>
          <button class="mc-icon-btn btn-duplicate-compare-column" type="button" title="استنساخ العمود" aria-label="استنساخ العمود">⧉ تكرار</button>
          <button class="mc-icon-btn btn-remove-compare-column" type="button" title="حذف العمود" aria-label="حذف العمود">× حذف</button>
        </div>
      </div>
    </div>
    <div class="mc-answer-wrap">
      <div class="model-compare-answer is-empty">ستظهر إجابة هذا النموذج هنا…</div>
    </div>
  `;

  const providerSelect = card.querySelector(".compare-provider-select");
  const keySelect = card.querySelector(".compare-key-select");
  const modelSelect = card.querySelector(".compare-model-select");
  fillCompareProviderSelect(providerSelect, config.provider, deps);
  fillCompareKeySelect(keySelect, providerSelect.value, config.key, deps);
  fillCompareModelSelect(modelSelect, providerSelect.value, config.model, deps);
  enhanceModelSelectWithSearch(modelSelect);
  updateCompareBadge(card);

  providerSelect.addEventListener("change", () => {
    fillCompareKeySelect(keySelect, providerSelect.value, "", deps);
    fillCompareModelSelect(modelSelect, providerSelect.value, "", deps);
    modelSelect._combo?.rebuild();
    updateCompareBadge(card);
  });

  card.querySelector(".btn-duplicate-compare-column")?.addEventListener("click", () => {
    createModelCompareColumn(container, { provider: providerSelect.value, key: keySelect.value, model: modelSelect.value }, deps);
  });

  card.querySelector(".btn-hide-compare-column")?.addEventListener("click", () => {
    const visibleCount = container.querySelectorAll(".model-compare-column:not(.is-hidden)").length;
    if (visibleCount <= 1) {
      deps.onStatus("يجب بقاء عمود ظاهر واحد على الأقل.", true);
      return;
    }
    card.classList.add("is-hidden");
    deps.onLayout();
    deps.onStatus("تم إخفاء العمود. يمكنك إظهاره من زر إظهار المخفية.");
  });

  card.querySelector(".btn-remove-compare-column")?.addEventListener("click", () => {
    if (container.children.length <= 1) {
      deps.onStatus("يجب بقاء عمود واحد على الأقل.", true);
      return;
    }
    card.remove();
    deps.onLayout();
    deps.onStatus("تم حذف العمود.");
  });

  card.querySelector(".btn-copy-compare")?.addEventListener("click", (ev) => {
    copyCompareAnswer(card, ev.currentTarget, deps.onCopyError);
  });

  card.querySelector(".btn-retry-compare")?.addEventListener("click", () => {
    const question = deps.getQuestion();
    if (!question) {
      deps.onStatus("اكتب سؤالاً أولاً.", true);
      return;
    }
    deps.runColumn(card, deps.buildQuestion(question));
  });

  container.appendChild(card);
  deps.onLayout();
  return card;
}

export function refreshModelComparisonOptions(container, deps) {
  [...(container?.querySelectorAll(".model-compare-column") || [])].forEach((card) => {
    const providerSelect = card.querySelector(".compare-provider-select");
    const keySelect = card.querySelector(".compare-key-select");
    const modelSelect = card.querySelector(".compare-model-select");
    if (!providerSelect || !keySelect || !modelSelect) return;
    const prevProvider = providerSelect.value;
    const prevKey = keySelect.value;
    const prevModel = modelSelect.value;
    fillCompareProviderSelect(providerSelect, prevProvider, deps);
    fillCompareKeySelect(keySelect, providerSelect.value, prevKey, deps);
    fillCompareModelSelect(modelSelect, providerSelect.value, prevModel, deps);
    modelSelect._combo?.rebuild();
    updateCompareBadge(card);
  });
}
