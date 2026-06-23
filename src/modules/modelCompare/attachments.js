let compareAttachments = [];

function isTextAttachment(file) {
  const name = file.name.toLowerCase();
  return (
    file.type.startsWith("text/") ||
    /\.(txt|md|csv|json|xml|html|css|js|ts|log|yaml|yml)$/i.test(name)
  );
}

function readFileAsText(file) {
  return new Promise((resolve) => {
    if (!isTextAttachment(file) || file.size > 300000) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => resolve("");
    reader.readAsText(file);
  });
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function renderCompareAttachments() {
  const container = document.getElementById("compare-attachments");
  if (!container) return;
  container.hidden = compareAttachments.length === 0;
  container.innerHTML = "";

  compareAttachments.forEach((attachment) => {
    const chip = document.createElement("span");
    chip.className = "mc-attachment-chip";

    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = attachment.kind === "image" ? "🖼️" : "📎";

    const name = document.createElement("span");
    name.className = "mc-attachment-name";
    name.title = attachment.name;
    name.textContent = attachment.name;

    const size = document.createElement("small");
    size.textContent = formatFileSize(attachment.size);

    const remove = document.createElement("button");
    remove.className = "mc-attachment-remove";
    remove.type = "button";
    remove.title = "حذف المرفق";
    remove.setAttribute("aria-label", "حذف المرفق");
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      compareAttachments = compareAttachments.filter(item => item.id !== attachment.id);
      renderCompareAttachments();
    });

    chip.append(icon, name, size, remove);
    container.appendChild(chip);
  });
}

export async function addCompareAttachments(files, forcedKind = "", onAdded = () => {}) {
  const incoming = [...files];
  if (!incoming.length) return;

  for (const file of incoming) {
    const kind = forcedKind || (file.type.startsWith("image/") ? "image" : "file");
    const text = kind === "image" ? "" : await readFileAsText(file);
    compareAttachments.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      kind,
      text
    });
  }
  renderCompareAttachments();
  onAdded(incoming.length);
}

export function buildCompareQuestionWithAttachments(question) {
  if (!compareAttachments.length) return question;

  const textAttachments = compareAttachments.filter(item => item.text.trim());
  const nonTextAttachments = compareAttachments.filter(item => !item.text.trim());
  const parts = [question];

  if (textAttachments.length) {
    parts.push(
      "محتوى المرفقات النصية:",
      textAttachments.map(item => `--- ${item.name} ---\n${item.text.slice(0, 12000)}`).join("\n\n")
    );
  }

  if (nonTextAttachments.length) {
    parts.push(
      "مرفقات غير نصية مضافة للمقارنة (أسماء فقط في هذا المسار النصي):",
      nonTextAttachments.map(item => `- ${item.name} (${item.type}, ${formatFileSize(item.size)})`).join("\n")
    );
  }

  return parts.join("\n\n");
}

export function setupCompareAttachmentControls({ onAdded } = {}) {
  const imageInput = document.getElementById("input-compare-images");
  const fileInput = document.getElementById("input-compare-files");
  const questionCard = document.querySelector(".model-compare-question-card");
  const notifyAdded = (count) => onAdded?.(count);

  document.getElementById("btn-add-compare-image")?.addEventListener("click", () => imageInput?.click());
  document.getElementById("btn-add-compare-file")?.addEventListener("click", () => fileInput?.click());
  imageInput?.addEventListener("change", async (event) => {
    await addCompareAttachments(event.target.files || [], "image", notifyAdded);
    event.target.value = "";
  });
  fileInput?.addEventListener("change", async (event) => {
    await addCompareAttachments(event.target.files || [], "", notifyAdded);
    event.target.value = "";
  });

  if (questionCard) {
    ["dragenter", "dragover"].forEach((eventName) => {
      questionCard.addEventListener(eventName, (event) => {
        event.preventDefault();
        questionCard.classList.add("is-drag-over");
      });
    });
    ["dragleave", "drop"].forEach((eventName) => {
      questionCard.addEventListener(eventName, () => {
        questionCard.classList.remove("is-drag-over");
      });
    });
    questionCard.addEventListener("drop", async (event) => {
      event.preventDefault();
      await addCompareAttachments(event.dataTransfer?.files || [], "", notifyAdded);
    });
  }
}
