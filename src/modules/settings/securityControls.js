import { invoke } from "../../shared/tauriClient.js";
import { addAppAlert } from "../alerts/api.js";
import { stateStore } from "../../shared/stateStore.js";
import { StorageKeys } from "../../shared/storageKeys.js";
import { elementPicker } from "../../shared/elementPicker.js";

export function setupSecurityControls() {
  const btnTriggerFile = document.getElementById("btn-trigger-backup-file");
  const inputFile = document.getElementById("input-backup-file-select");
  const lblFileName = document.getElementById("lbl-backup-file-name");

  const inputExportPassword = document.getElementById("input-backup-export-password");
  const btnExport = document.getElementById("btn-export-backup");

  const inputImportPassword = document.getElementById("input-backup-import-password");
  const btnImport = document.getElementById("btn-import-backup");

  const btnActivatePicker = document.getElementById("btn-activate-picker");

  const inputTargetSelector = document.getElementById("input-target-insertion-selector");
  const btnPickTarget = document.getElementById("btn-pick-insertion-target");
  const btnResetTarget = document.getElementById("btn-reset-insertion-target");

  if (inputTargetSelector) {
    inputTargetSelector.value = stateStore.getItem(StorageKeys.TARGET_INSERTION_SELECTOR) || "";
  }

  btnPickTarget?.addEventListener("click", () => {
    elementPicker.start((selector) => {
      stateStore.setItem(StorageKeys.TARGET_INSERTION_SELECTOR, selector);
      if (inputTargetSelector) inputTargetSelector.value = selector;
      addAppAlert("success", "تم تعيين وجهة الإدراج", `سيتم إدراج النص تلقائياً في: ${selector}`, {
        source: "الترجمة والإدراج"
      });
    });
  });

  btnResetTarget?.addEventListener("click", () => {
    stateStore.removeItem(StorageKeys.TARGET_INSERTION_SELECTOR);
    if (inputTargetSelector) inputTargetSelector.value = "";
    addAppAlert("info", "إعادة تعيين الوجهة", "تمت استعادة حقل الإدخال الافتراضي بنجاح.", {
      source: "الترجمة والإدراج"
    });
  });

  let selectedFile = null;

  btnActivatePicker?.addEventListener("click", () => {
    elementPicker.start();
  });

  btnTriggerFile?.addEventListener("click", () => {
    inputFile?.click();
  });

  inputFile?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      selectedFile = file;
      if (lblFileName) {
        lblFileName.textContent = `📄 الملف المحدد: ${file.name}`;
        lblFileName.style.display = "block";
      }
    }
  });

  btnExport?.addEventListener("click", async () => {
    const password = inputExportPassword?.value || "";
    if (!password) {
      alert("يرجى إدخال كلمة مرور لتشفير النسخة الاحتياطية.");
      return;
    }

    try {
      const settings = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith("bm_")) {
          settings[key] = localStorage.getItem(key);
        }
      }

      const secureKeys = {};
      const providers = ["Gemini", "Groq", "OpenAI", "Anthropic", "DeepSeek", "Mistral", "OpenRouter", "xAI"];
      providers.forEach(p => {
        const k = stateStore.getApiKey(p);
        if (k) secureKeys[p] = k;
      });

      const payload = JSON.stringify({ settings, secureKeys });

      const encryptedBase64 = await invoke("export_settings_backup", { payload, password });

      const blob = new Blob([encryptedBase64], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `smart_assistant_backup_${new Date().toISOString().slice(0, 10)}.enc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (inputExportPassword) inputExportPassword.value = "";

      addAppAlert("success", "تم تصدير النسخة الاحتياطية", "تم حفظ إعداداتك ومفاتيحك بشكل مشفر في ملف بنجاح.", {
        source: "الحماية والأمن"
      });
    } catch (e) {
      alert(`فشل التصدير: ${e}`);
    }
  });

  btnImport?.addEventListener("click", async () => {
    const password = inputImportPassword?.value || "";
    if (!selectedFile) {
      alert("يرجى اختيار ملف النسخة الاحتياطية (.enc) أولاً.");
      return;
    }
    if (!password) {
      alert("يرجى إدخال كلمة المرور لفك تشفير الملف.");
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const encryptedData = e.target.result;
        try {
          const decryptedPayload = await invoke("import_settings_backup", { encryptedData, password });
          const parsed = JSON.parse(decryptedPayload);

          const allowedKeys = Object.values(StorageKeys);
          if (parsed.settings) {
            Object.keys(parsed.settings).forEach(key => {
              if (allowedKeys.includes(key)) {
                stateStore.setItem(key, parsed.settings[key]);
              } else {
                console.warn(`Ignored invalid settings key during backup import: ${key}`);
              }
            });
          }

          const allowedProviders = [
            "Gemini",
            "Groq",
            "OpenAI",
            "Anthropic",
            "DeepSeek",
            "Mistral",
            "OpenRouter",
            "xAI"
          ];
          if (parsed.secureKeys) {
            for (const provider of Object.keys(parsed.secureKeys)) {
              if (allowedProviders.includes(provider)) {
                await stateStore.saveApiKey(provider, parsed.secureKeys[provider]);
              } else {
                console.warn(`Ignored invalid API key provider during backup import: ${provider}`);
              }
            }
          }

          if (inputImportPassword) inputImportPassword.value = "";
          if (lblFileName) {
            lblFileName.style.display = "none";
            lblFileName.textContent = "";
          }
          selectedFile = null;
          if (inputFile) inputFile.value = "";

          addAppAlert("success", "تم استيراد النسخة الاحتياطية", "تمت استعادة جميع إعداداتك ومفاتيحك بنجاح. سيتم إعادة تحميل الصفحة لتطبيق التغييرات.", {
            source: "الحماية والأمن"
          });

          setTimeout(() => {
            window.location.reload();
          }, 2000);

        } catch (err) {
          alert(`فشل الاستيراد: ${err}`);
        }
      };
      reader.readAsText(selectedFile);
    } catch (e) {
      alert(`فشل قراءة الملف: ${e}`);
    }
  });
}
