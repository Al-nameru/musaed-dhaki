function syncControls(panel, contentContainer) {
  try {
    const srcControls = panel.querySelectorAll("input,select,textarea");
    const cloneControls = contentContainer.querySelectorAll("input,select,textarea");
    const count = Math.min(srcControls.length, cloneControls.length);

    for (let i = 0; i < count; i++) {
      const source = srcControls[i];
      const cloneControl = cloneControls[i];

      try { cloneControl.removeAttribute("id"); } catch (e) {}
      try { cloneControl.removeAttribute("name"); } catch (e) {}

      try {
        if (cloneControl.type === "checkbox" || cloneControl.type === "radio") {
          cloneControl.checked = source.checked;
        } else {
          cloneControl.value = source.value;
        }
      } catch (e) {}

      let lock = false;
      const syncToSource = () => {
        if (lock) return;
        lock = true;
        try {
          if (cloneControl.type === "checkbox" || cloneControl.type === "radio") {
            source.checked = cloneControl.checked;
          } else {
            source.value = cloneControl.value;
          }
          source.dispatchEvent(new Event("change", { bubbles: true }));
        } catch (e) {}
        lock = false;
      };
      const syncToClone = () => {
        if (lock) return;
        lock = true;
        try {
          if (cloneControl.type === "checkbox" || cloneControl.type === "radio") {
            cloneControl.checked = source.checked;
          } else {
            cloneControl.value = source.value;
          }
        } catch (e) {}
        lock = false;
      };

      try {
        cloneControl.addEventListener("input", syncToSource);
        cloneControl.addEventListener("change", syncToSource);
      } catch (e) {}
      try {
        source.addEventListener("input", syncToClone);
        source.addEventListener("change", syncToClone);
      } catch (e) {}
    }
  } catch (e) {}
}

function syncButtons(panel, contentContainer) {
  try {
    contentContainer.querySelectorAll("button").forEach((button, index) => {
      try {
        const sourceButton = panel.querySelectorAll("button")[index];
        button.removeAttribute("id");
        button.removeAttribute("name");
        if (sourceButton) {
          button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            sourceButton.click();
          });
        }
      } catch (e) {}
    });
  } catch (e) {}
}

function syncAnchors(panel, clone) {
  try {
    clone.querySelectorAll("a").forEach((anchor, index) => {
      try {
        const sourceAnchor = panel.querySelectorAll("a")[index];
        if (sourceAnchor) {
          anchor.removeAttribute("href");
          anchor.style.cursor = "pointer";
          anchor.addEventListener("click", (event) => {
            event.preventDefault();
            sourceAnchor.click();
          });
        } else {
          anchor.removeAttribute("href");
          anchor.style.pointerEvents = "none";
        }
      } catch (e) {}
    });
  } catch (e) {}
}

function cleanDataAttributes(clone) {
  try {
    clone.querySelectorAll("*").forEach((node) => {
      try {
        Array.from(node.attributes || []).forEach((attr) => {
          if (attr.name && attr.name.startsWith("data-")) {
            node.removeAttribute(attr.name);
          }
        });
      } catch (e) {}
    });
  } catch (e) {}
}

function cloneSettingsPanel(id, panel, tocList, generalContainer) {
  const clone = panel.cloneNode(true);
  clone.removeAttribute("id");
  clone.id = `settings-general-${id}`;
  clone.classList.remove("settings-panel", "active");
  clone.classList.add("settings-overview-section-card");
  clone.style.display = "block";
  clone.style.boxShadow = "none";
  clone.style.border = "1px solid rgba(255,255,255,0.08)";
  clone.style.padding = "16px";
  clone.style.background = "rgba(255,255,255,0.03)";
  clone.style.cursor = "default";

  const header = clone.querySelector("h3");
  let titleText = "";
  if (header) {
    titleText = header.textContent;
    const title = document.createElement("div");
    title.textContent = titleText;
    title.className = "settings-overview-section-title";
    title.style.fontSize = "14px";
    title.style.fontWeight = "700";
    title.style.marginBottom = "10px";
    header.replaceWith(title);
  }

  if (tocList && titleText) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = `#${clone.id}`;
    link.textContent = titleText;
    link.className = "settings-overview-toc-link";
    item.appendChild(link);
    tocList.appendChild(item);
  }

  const sectionHeader = document.createElement("div");
  sectionHeader.className = "settings-overview-section-header";
  sectionHeader.style.display = "flex";
  sectionHeader.style.justifyContent = "space-between";
  sectionHeader.style.alignItems = "flex-start";
  sectionHeader.style.gap = "10px";
  sectionHeader.style.flexWrap = "wrap";

  const titleElement = clone.querySelector(".settings-overview-section-title");
  if (titleElement) {
    sectionHeader.appendChild(titleElement);
  }

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "8px";
  actions.style.flexWrap = "wrap";

  const jumpBtn = document.createElement("button");
  jumpBtn.textContent = "فتح القسم";
  jumpBtn.setAttribute("aria-label", "فتح القسم التفصيلي");
  jumpBtn.className = "toggle-section-btn settings-overview-jump-btn";
  jumpBtn.style.padding = "6px 10px";
  jumpBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const subnavItem = document.querySelector(`.settings-subnav-item[data-settings-panel="${id}"]`);
    if (subnavItem) {
      subnavItem.click();
      setTimeout(() => {
        const original = document.getElementById(id);
        if (original) original.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 60);
    } else {
      const original = document.getElementById(id);
      if (original) original.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
  actions.appendChild(jumpBtn);

  const collapseBtn = document.createElement("button");
  collapseBtn.textContent = "طي التفاصيل";
  collapseBtn.setAttribute("aria-expanded", "true");
  collapseBtn.className = "toggle-section-btn settings-overview-collapse-btn";
  collapseBtn.style.padding = "6px 10px";
  actions.appendChild(collapseBtn);

  sectionHeader.appendChild(actions);

  const contentContainer = document.createElement("div");
  contentContainer.className = "settings-overview-section-body";
  contentContainer.style.display = "block";

  while (clone.firstChild) {
    contentContainer.appendChild(clone.firstChild);
  }

  collapseBtn.addEventListener("click", () => {
    const isHidden = contentContainer.style.display === "none";
    contentContainer.style.display = isHidden ? "block" : "none";
    collapseBtn.textContent = isHidden ? "طي التفاصيل" : "عرض التفاصيل";
    collapseBtn.setAttribute("aria-expanded", String(!isHidden));
    clone.classList.toggle("section-collapsed", !isHidden);
  });

  clone.appendChild(sectionHeader);
  clone.appendChild(contentContainer);

  syncControls(panel, contentContainer);

  contentContainer.querySelectorAll("label[for]").forEach((label) => {
    try { label.removeAttribute("for"); } catch (e) {}
  });

  syncButtons(panel, contentContainer);
  syncAnchors(panel, clone);
  cleanDataAttributes(clone);

  generalContainer.appendChild(clone);
}

export function createGeneralSettingsOverview() {
  let populated = false;

  const reset = () => {
    populated = false;
  };

  const populate = () => {
    if (populated) return;

    const generalContainer = document.getElementById("settings-general-contents");
    if (!generalContainer) return;
    populated = true;
    generalContainer.replaceChildren();

    const generalPanel = document.getElementById("settings-general");
    if (generalPanel) {
      generalPanel.querySelector(".settings-overview-toc")?.remove();
      const tocWrapper = document.createElement("div");
      tocWrapper.className = "settings-overview-toc";
      tocWrapper.innerHTML = `
        <div class="settings-overview-toc-header">
          <div class="settings-overview-toc-title">🧭 فهرس الإعدادات العامة</div>
          <p class="settings-overview-toc-desc">انتقل بسرعة إلى القسم الذي تريد تعديله، أو استخدم الأقسام القابلة للطي لعرض المحتوى بتكثيف.</p>
        </div>
        <ul class="settings-overview-toc-list"></ul>
      `;
      generalPanel.insertBefore(tocWrapper, generalContainer);
    }

    const tocList = document.querySelector(".settings-overview-toc-list");
    const panelIds = [
      "settings-hotkeys",
      "settings-tts",
      "settings-local",
      "settings-free-stt",
      "settings-processing",
      "settings-prompts"
    ];

    panelIds.forEach((id) => {
      const panel = document.getElementById(id);
      if (!panel) return;
      cloneSettingsPanel(id, panel, tocList, generalContainer);
    });
  };

  return {
    populate,
    reset
  };
}
