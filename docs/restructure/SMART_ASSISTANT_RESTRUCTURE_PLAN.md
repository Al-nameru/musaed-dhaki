# خطة إعادة هيكلة Smart Assistant

> هذا هو مصدر الحقيقة التنفيذي لإعادة هيكلة Smart Assistant.
> الدليل العام من GK موجود في `docs/governance/GK_REBUILD_GUIDE.md`.

## الهدف

إعادة هيكلة التطبيق من مشروع Tauri عملي متضخم إلى **Modular Monolith** منظم وفق:

- Clean Architecture داخل كل موديول.
- Hexagonal Architecture عبر ports/adapters.
- GK Governance Kit كحارس جودة وحدود.
- مسار تدريجي يسمح لاحقًا بفصل بعض الموديولات إلى خدمات مستقلة.

الهدف ليس إعادة كتابة التطبيق من الصفر، بل تحديثه بطريقة آمنة تحافظ على السلوك الحالي وتمنع تراجع الجودة.

---

## القرار المعماري

المسار المعتمد:

**R1 - Refactor in place** مع لمسات **Strangler** عند المناطق الخطرة.

الأسباب:

- التطبيق الحالي يعمل وفيه ميزات مكتملة.
- الخطر الأكبر ليس التقنية، بل تضخم الملفات واختلاط المسؤوليات.
- التكامل مع نظام التشغيل حساس: clipboard، keyboard simulation، global shortcuts، window focus.
- إعادة الكتابة الكاملة ستزيد الخطر بدون ضمان مكاسب فورية.

نستخدم Strangler عندما نحتاج استخراج جزء جديد خلف واجهة مستقرة، مثل `ai` أو `selection`.

---

## المبادئ غير القابلة للتفاوض

1. لا تغيير سلوكي بدون اختبار أو تحقق يدوي موثق.
2. لا نقل ضخم للكود في خطوة واحدة.
3. كل موديول يتحدث مع غيره عبر `api` فقط.
4. Rust commands تكون طبقة رقيقة، لا تحتوي منطقًا عميقًا.
5. واجهات المزودين تكون خلف ports لا داخل use cases.
6. لا أسرار داخل الكود أو ملفات المشروع.
7. بعد كل مرحلة: `cargo check` و `node --check` على الأقل.
8. بعد تفعيل GK: لا يعتبر العمل منتهيًا إلا إذا مر `gk check`.

---

## الهيكل المستهدف - Rust

```text
src-tauri/src/
  main.rs
  lib.rs

  app/
    commands/
      ai_commands.rs
      speech_commands.rs
      shortcut_commands.rs
      selection_commands.rs
      usage_stats_commands.rs
      system_commands.rs
    dto/
      ai_dto.rs
      speech_dto.rs
      usage_stats_dto.rs

  modules/
    ai/
      api/
        mod.rs
      domain/
        mod.rs
        entities.rs
        errors.rs
        ports.rs
      application/
        mod.rs
        process_text.rs
        verify_key.rs
        compare_models.rs
      infrastructure/
        mod.rs
        providers/
          openai.rs
          gemini.rs
          anthropic.rs
          groq.rs
          openrouter.rs
          mistral.rs
          deepseek.rs
          xai.rs

    speech/
      api/
      domain/
      application/
      infrastructure/
        transcription/
        tts/

    selection/
      api/
      domain/
      application/
      infrastructure/

    shortcuts/
      api/
      domain/
      application/
      infrastructure/

    usage_stats/
      api/
      domain/
      application/
      infrastructure/

    system_io/
      api/
      domain/
      application/
      infrastructure/
        clipboard.rs
        keyboard.rs
        window_focus.rs
```

ملاحظة: في البداية يمكن إنشاء هذا الهيكل تدريجيًا، وليس كله دفعة واحدة.

---

## الهيكل المستهدف - Frontend

```text
src/
  index.html
  overlay.html
  styles.css

  app/
    bootstrap.js
    main.js

  shared/
    tauriClient.js
    storage.js
    dom.js
    errors.js
    events.js

  modules/
    ai/
      api.js
      state.js
      ui.js
      prompts.js
      compare.js

    speech/
      recorder.js
      transcription.js
      tts.js

    selection/
      floatingMenu.js
      quickActions.js
      overlayBridge.js

    shortcuts/
      api.js
      recorder.js
      ui.js

    settings/
      state.js
      ui.js

    stats/
      api.js
      ui.js

    alerts/
      store.js
      ui.js
```

الهدف الأول في الواجهة هو تقليل تضخم `src/main.js` وفصل السلوك إلى وحدات مستقلة.

---

## حدود الموديولات

### ai

يمتلك:

- التحقق من مفاتيح API.
- معالجة النصوص.
- مقارنة النماذج.
- اختيار المزود.
- عقود providers.

لا يمتلك:

- تسجيل الصوت.
- لصق النص في النظام.
- واجهة الإعدادات.

### speech

يمتلك:

- التسجيل الصوتي.
- تفريغ الصوت.
- TTS.
- خيارات اللغة والصوت.

يعتمد على `ai/api` للتفريغ السحابي عند الحاجة.

### selection

يمتلك:

- كشف النص المحدد.
- النافذة العائمة.
- quick actions.

لا يعالج النص مباشرة، بل يطلب ذلك من `ai/api`.

### shortcuts

يمتلك:

- تسجيل الاختصارات العامة.
- تحرير الاختصارات.
- سلوك toggle/hold/disabled.

لا يعرف تفاصيل التفريغ أو التشكيل.

### usage_stats

يمتلك:

- تسجيل استهلاك التوكينز.
- قراءة/كتابة الإحصائيات.
- تصفير الإحصائيات.

لا يعرف تفاصيل الواجهة أو المزود إلا كبيانات.

### system_io

يمتلك:

- clipboard.
- keyboard typing/paste.
- window focus.
- Windows-specific APIs.

هذا موديول adapter-heavy، ويجب إبقاؤه خلف ports واضحة.

---

## خطة التنفيذ المرحلية

### المرحلة 0 - تفعيل الحوكمة والمخزون

الأهداف:

- تفعيل GK على المشروع.
- تحديد tier مناسب، مبدئيًا T2.
- إنشاء baseline للوضع الحالي.
- توثيق أن المشروع legacy قابل للإصلاح لا rewrite.

المهام:

1. تشغيل `gk init --tier T2` داخل المشروع.
2. تفعيل hooks إن لزم: `git config core.hooksPath scripts/hooks`.
3. تشغيل `gk doctor`.
4. تشغيل `gk selftest`.
5. تشغيل `gk baseline`.
6. تشغيل `gk check`.
7. إنشاء `docs/adr/ADR-001-restructure-strategy.md`.

معيار الإنجاز:

- `.governance` موجودة.
- baseline محفوظ.
- نتائج GK معروفة وموثقة، حتى لو فيها تحذيرات.

---

### المرحلة 1 - تثبيت السلوك الحالي

الأهداف:

- حماية الميزات الحالية قبل النقل.
- إضافة اختبارات أو checks بسيطة حول المنطق القابل للفصل.

المهام:

1. توثيق السيناريوهات الحرجة:
   - تسجيل من داخل التطبيق.
   - تسجيل عبر اختصار فوق تطبيق خارجي.
   - تحديد نص خارجي وظهور overlay.
   - معالجة نص: ترجمة/تشكيل/تدقيق/تلخيص.
   - TTS.
   - إحصائيات التوكينز.
2. إضافة اختبارات Rust للوحدات النقية التي يمكن فصلها دون OS.
3. إضافة checks JavaScript للملفات بعد التقسيم.
4. كتابة `HANDOFF.md` مختصر لحالة المشروع.

معيار الإنجاز:

- لدينا قائمة تحقق parity واضحة.
- `cargo check` يمر.
- `node --check src/main.js` يمر.

---

### المرحلة 2 - استخراج usage_stats

سبب البدء به:

- مخاطره منخفضة.
- حدوده واضحة.
- لا يعتمد على Windows APIs.

المهام:

1. إنشاء `modules/usage_stats`.
2. نقل `TokenStats`, `UsageLogEntry`, `read_stats`, `write_stats`, `log_token_usage`.
3. إنشاء API واضح:
   - `record_usage`
   - `get_stats`
   - `reset_stats`
4. جعل أوامر Tauri تستدعي `usage_stats/api`.

معيار الإنجاز:

- لا يوجد منطق إحصائيات في `lib.rs`.
- السلوك الحالي للإحصائيات لم يتغير.

---

### المرحلة 3 - استخراج ai

الأهداف:

- تحويل `ai_engine.rs` إلى موديول AI نظيف.
- فصل use cases عن providers.

المهام:

1. إنشاء `modules/ai/domain`.
2. تعريف:
   - `AiProvider`
   - `AiTextRequest`
   - `AiTextResponse`
   - `TranscriptionRequest`
   - `KeyVerificationResult`
3. نقل مزودي OpenAI/Gemini/Groq/Anthropic/OpenRouter/xAI/DeepSeek/Mistral إلى adapters.
4. إنشاء use cases:
   - `verify_key`
   - `process_text`
   - `transcribe_audio`
5. إبقاء compatibility layer مؤقتة إذا لزم حتى لا تنكسر أوامر Tauri.

معيار الإنجاز:

- إضافة مزود جديد لا تتطلب تعديل use case أساسي.
- `ai_commands` فقط يحول DTO ويستدعي API.

---

### المرحلة 4 - استخراج system_io

الأهداف:

- عزل التعامل مع نظام التشغيل.
- تخفيف `lib.rs`.

المهام:

1. نقل clipboard logic إلى `system_io/infrastructure/clipboard.rs`.
2. نقل keyboard/paste إلى `system_io/infrastructure/keyboard.rs`.
3. نقل window focus إلى `system_io/infrastructure/window_focus.rs`.
4. تعريف ports:
   - `ClipboardPort`
   - `KeyboardPort`
   - `WindowFocusPort`

معيار الإنجاز:

- `write_to_system` يصبح command رقيق.
- Windows-specific code لم يعد مختلطًا مع منطق التطبيق.

---

### المرحلة 5 - استخراج selection

الأهداف:

- عزل مراقبة التحديد والنافذة العائمة.

المهام:

1. إنشاء `modules/selection`.
2. نقل:
   - `SelectionMonitorState`
   - `start_selection_monitor`
   - `overlay_placement`
   - `show_overlay_window`
   - `hide_selection_overlay`
   - `run_overlay_action`
3. تعريف API:
   - `enable_selection_monitor`
   - `hide_overlay`
   - `run_overlay_action`

معيار الإنجاز:

- منطق overlay والتحديد لا يعيش في `lib.rs`.
- اختبار `overlay_placement` كدالة نقية.

حالة التنفيذ:

- تم إنشاء `src-tauri/src/modules/selection/mod.rs`.
- تم نقل:
  - `SelectionMonitorState`
  - `copy_selected_text`
  - `set_selection_monitor_enabled`
  - `capture_external_target`
  - `hide_selection_overlay`
  - `run_overlay_action`
  - `overlay_placement`
  - `show_overlay_window`
  - `start_selection_monitor`
  - إنشاء نافذة overlay وإعدادها كنافذة non-activating على Windows
- أصبح `src-tauri/src/lib.rs` يربط أوامر selection عبر `modules::selection`.
- انخفض حجم `src-tauri/src/lib.rs` إلى حوالي 273 سطرًا، ولم يعد ضمن تحذيرات GK.
- التحقق:
  - `cargo check`: OK. احتاج تشغيلًا خارج sandbox لأن Cargo داخل sandbox اصطدم بقفل/صلاحيات Windows داخل `src-tauri/target`.
  - `node --check src/main.js`: OK.
  - `gk check`: 0 errors، 3 warnings، 6 info، ratchet OK.

---

### المرحلة 6 - استخراج shortcuts

الأهداف:

- عزل إدارة الاختصارات العامة.

المهام:

1. إنشاء `modules/shortcuts`.
2. نقل `ShortcutState`.
3. نقل `register_custom_shortcut` و `unregister_custom_shortcut`.
4. إنشاء mapping مستقل للمفاتيح.

معيار الإنجاز:

- لا توجد تفاصيل shortcut mapping داخل `lib.rs`.
- تعطيل وتسجيل الاختصارات لا يتأثران.

حالة التنفيذ:

- تم إنشاء `src-tauri/src/modules/shortcuts/mod.rs`.
- تم نقل:
  - `ShortcutState`
  - `register_custom_shortcut`
  - `unregister_custom_shortcut`
  - mapping أسماء المفاتيح إلى `Code`
- أصبح `src-tauri/src/lib.rs` يستخدم:
  - `shortcuts::register_custom_shortcut`
  - `shortcuts::unregister_custom_shortcut`
  - `ShortcutState::new()`
- انخفض حجم `src-tauri/src/lib.rs` إلى حوالي 682 سطرًا.
- التحقق:
  - `node --check src/main.js`: OK.
  - `gk check`: 0 errors، 4 warnings، 6 info، ratchet OK.
  - `cargo check`: تعطل داخل sandbox بسبب `Access is denied` عند الكتابة في `src-tauri/target`. إعادة التشغيل بصلاحية أعلى لم تُنفذ لأن الجلسة وصلت حد الاستخدام؛ يجب إعادتها لاحقًا.

---

### المرحلة 7 - تفكيك Frontend main.js

الأهداف:

- تحويل `src/main.js` من ملف ضخم إلى bootstrap + modules.
- الحفاظ على DOM الحالي في البداية.

المهام:

1. إنشاء `src/shared/tauriClient.js`.
2. نقل alert logic إلى `modules/alerts`.
3. نقل stats logic إلى `modules/stats`.
4. نقل shortcut UI logic إلى `modules/shortcuts`.
5. نقل TTS/recording إلى `modules/speech`.
6. نقل compare models إلى `modules/ai/compare.js`.
7. إبقاء `app/bootstrap.js` مسؤولًا عن التهيئة فقط.

معيار الإنجاز:

- `main.js` يتحول إلى ملف صغير أو compatibility bootstrap.
- كل module له مسؤولية واضحة.
- لا توجد imports عابرة بين الموديولات إلا عبر `api.js`.

حالة التنفيذ:

- تم بدء تفكيك الواجهة دون تحويل كبير أو تغيير DOM.
- `src/shared/tauriClient.js` يحتوي Tauri bridge:
  - `isTauri`
  - `invoke`
  - `listen`
- `src/modules/alerts/store.js` يحتوي:
  - تخزين سجل التنبيهات.
  - عرض لوحة التنبيهات.
  - فلاتر التنبيهات.
  - التقاط أخطاء `window.error` و `unhandledrejection`.
- تم حذف مستمعات زر تصفير التنبيهات والفلاتر المكررة من `src/main.js` بعد نقلها إلى `initAlertsPanel(...)`.
- `src/modules/stats/tokenStats.js` يحتوي:
  - تحميل إحصائيات التوكينز من Tauri.
  - عرض ملخص الاستهلاك.
  - عرض جداول المزودين والنماذج والسجل.
  - ربط زر تصفير الإحصائيات.
- أصبح `src/main.js` يستورد `loadTokenStats` و `setupTokenStatsReset` بدل امتلاك تفاصيل لوحة الإحصائيات.
- `src/modules/shortcuts/editor.js` يحتوي:
  - افتراضات الاختصارات.
  - تخزين وقراءة الاختصارات.
  - تسجيل وإلغاء تسجيل الاختصارات في Tauri.
  - تحديث عرض الاختصارات.
  - واجهة تسجيل اختصار جديد من الإعدادات.
  - استعادة الاختصار الافتراضي.
  - كشف تعارض مفتاح Space مع الاختصارات.
- بقي `src/main.js` مسؤولًا عن سلوك الاختصار وقت التشغيل عند وصول حدث `global-shortcut-triggered`.
- `src/modules/apiKeys/batchKeys.js` يحتوي:
  - تحليل مفاتيح API جماعيًا.
  - عرض نتائج الفحص.
  - فحص المفتاح عبر Tauri.
  - تفعيل مفتاح صالح من جدول النتائج.
  - تخزين المفاتيح الصالحة للفحص اللاحق.
  - إدارة المفاتيح التالفة: عرض، تصدير، إعادة فحص، تفريغ.
- أصبح `src/main.js` يمرر الاعتمادات إلى `setupBatchKeyVerification(...)` بدل امتلاك تفاصيل واجهة الفحص الجماعي.
- `src/modules/modelCompare/rendering.js` يحتوي:
  - عارض Markdown آمن ومحدود لإجابات النماذج.
  - حالات تحميل/نجاح/خطأ لبطاقات الإجابة.
  - نسخ إجابة المقارنة.
  - تلوين شارة المزود.
  - إحصاءات زمن الاستجابة وعدد الكلمات.
- بقي `src/main.js` مسؤولًا مؤقتًا عن تدفق المقارنة، الأعمدة، المرفقات، واستدعاء API.
- `src/modules/modelCompare/attachments.js` يحتوي:
  - حالة مرفقات المقارنة.
  - قراءة المرفقات النصية.
  - عرض شرائح المرفقات وحذفها.
  - ربط أزرار إضافة صورة/ملف.
  - دعم السحب والإفلات على بطاقة السؤال.
  - بناء نص السؤال النهائي مع محتوى المرفقات.
- `src/modules/modelCompare/layout.js` يحتوي:
  - إعداد عرض البطاقات/الجدول.
  - إعداد عدد الأعمدة.
  - قائمة الأعمدة المخفية.
  - إظهار عمود مخفي.
  - إغلاق قائمة الأعمدة المخفية عند النقر خارجها.
  - تطبيق تخطيط شبكة المقارنة.
- `src/modules/modelCompare/columns.js` يحتوي:
  - تعبئة قوائم المزودين والنماذج لأعمدة المقارنة.
  - صندوق بحث النماذج فوق `select` الأصلي.
  - إنشاء بطاقة عمود المقارنة.
  - أزرار النسخ، الإعادة، الإخفاء، الاستنساخ، والحذف.
  - تحديث خيارات الأعمدة عند تغيّر المفاتيح أو النماذج المحفوظة.
- أصبح `src/main.js` يمرر اعتمادات الأعمدة بشكل صريح: المزودون، النماذج، الحالة، التخطيط، السؤال الحالي، مشغّل الإعادة، وبناء السؤال مع المرفقات.
- `src/modules/modelCompare/flow.js` يحتوي:
  - تشغيل عمود مقارنة واحد عبر Tauri.
  - تشغيل المقارنة على جميع الأعمدة.
  - حالة زر التشغيل أثناء التنفيذ.
  - تمييز أسرع إجابة ناجحة.
  - مسح إجابات المقارنة.
- أصبح `src/main.js` يمرر اعتمادات تدفق المقارنة بشكل صريح: `invoke`، اختيار مفتاح المزود، تنسيق الخطأ، السؤال الحالي، وبناء السؤال مع المرفقات.
- `src/modules/ai/providerModels.js` يحتوي:
  - النماذج النصية الاحتياطية للمزودين.
  - قراءة وحفظ مفاتيح المزودين.
  - قراءة وتحديث نماذج المزودين المحفوظة.
  - اختيار مزودي ونماذج المقارنة.
  - اختيار مفتاح المزود النشط عند عدم وجود مفتاح محفوظ.
- `src/modules/ai/textProcessing.js` يحتوي:
  - التدقيق التلقائي بعد التفريغ.
  - التشكيل التلقائي بعد التفريغ.
  - استخدام نفس المسار بعد التفريغ السحابي وبعد Google Web Speech.
- أصبح `src/main.js` يستخدم نفس مصدر المزودين والنماذج في المقارنة والتشكيل.
- `src/modules/modelCompare/setup.js` يحتوي:
  - جلب عناصر DOM الخاصة بتبويب المقارنة.
  - إنشاء الأعمدة الابتدائية.
  - ربط أزرار التشغيل، الإضافة، والمسح.
  - ربط تخطيط المقارنة والمرفقات.
  - عداد حروف السؤال.
  - قفل/فتح حجم صندوق السؤال وطيّه.
  - تشغيل المقارنة عند Enter بدون Shift.
- `src/modules/speech/audioCues.js` يحتوي:
  - نغمة بدء التسجيل.
  - نغمة إيقاف التسجيل.
- `src/modules/speech/ttsHelpers.js` يحتوي:
  - اختيار مزود TTS الحالي.
  - اختيار صوت TTS الحالي.
  - كشف لغة النص للنطق المحلي.
  - مهلة النطق السحابي.
  - عرض حالة أزرار النطق.
- `src/modules/speech/ttsVoices.js` يحتوي:
  - تعبئة قوائم أصوات النظام.
  - استعادة الصوت المحفوظ.
- `src/modules/speech/ttsControls.js` يحتوي:
  - ربط مزود TTS.
  - ربط سرعة ونبرة وحجم النطق.
  - مزامنة عناصر الصفحة الرئيسية والإعدادات.
  - حفظ واسترجاع تفضيلات TTS.
  - ربط اختيار الصوت.
- `src/modules/speech/ttsPlayback.js` يحتوي:
  - تشغيل النطق المحلي عبر SpeechSynthesis.
  - تشغيل النطق السحابي عبر ملف صوتي مولّد.
  - تحديث حالة أزرار النطق أثناء التشغيل/الإيقاف/الإيقاف المؤقت.
- `src/modules/text/resultText.js` يحتوي:
  - تطبيع عنصر النص الناتج.
  - قراءة وكتابة نص النتيجة.
  - حل وضع الإلحاق.
  - تطبيق النص الناتج مع احترام الإلحاق.
- `src/modules/navigation/sidebarOrder.js` يحتوي:
  - استرجاع ترتيب تبويبات الشريط الجانبي.
  - حفظ ترتيب التبويبات.
  - إعادة الترتيب بالسحب والإفلات.
- `src/modules/shortcuts/runtime.js` يحتوي:
  - التعامل مع حدث `global-shortcut-triggered`.
  - أنماط اختصار التفريغ: hold، long_press_start، double، toggle.
  - أنماط أدوات النص: double، long_press، single.
  - منع تكرار حدث الضغط المتكرر لنفس الاختصار.
- `src/modules/selection/quickActions.js` يحتوي:
  - إعدادات إجراءات النص السريعة.
  - فتح وإغلاق نافذة الإجراء السريع.
  - تنفيذ grammar/diacritize/translate/summarize.
  - نسخ وإدراج نتيجة الإجراء.
  - نطق نص الإجراء السريع.
  - حالة الانشغال ورسائل الحالة داخل النافذة.
- `src/modules/selection/floatingToolbar.js` يحتوي:
  - تموضع شريط التحديد العائم.
  - مراقبة التحديد المحلي داخل الصفحة.
  - إظهار/إخفاء الشريط والتخفي التلقائي.
  - جسر `overlay-action` القادم من Tauri.
  - ربط أزرار القائمة العائمة بنافذة الإجراءات السريعة.
  - تحديث مراقب التحديد في الخلفية.
- بقي `src/main.js` مسؤولًا مؤقتًا عن أغلفة حالة المقارنة، اختيار مفتاح المزود، تسجيل الصوت، وGoogle Web Speech.
- `src/main.js` انخفض إلى حوالي 2349 سطرًا.
- التحقق:
  - `cargo check`: OK. احتاج تشغيلًا خارج sandbox لأن Cargo داخل sandbox اصطدم بقفل/صلاحيات Windows داخل `src-tauri/target`.
  - `node --check src/main.js`: OK.
  - `node --check src/modules/alerts/store.js`: OK.
  - `node --check src/modules/stats/tokenStats.js`: OK.
  - `node --check src/modules/shortcuts/editor.js`: OK.
  - `node --check src/modules/apiKeys/batchKeys.js`: OK.
  - `node --check src/modules/modelCompare/rendering.js`: OK.
  - `node --check src/modules/modelCompare/attachments.js`: OK.
  - `node --check src/modules/modelCompare/layout.js`: OK.
  - `node --check src/modules/modelCompare/columns.js`: OK.
  - `node --check src/modules/modelCompare/flow.js`: OK.
  - `node --check src/modules/modelCompare/setup.js`: OK.
  - `node --check src/modules/ai/providerModels.js`: OK.
  - `node --check src/modules/ai/textProcessing.js`: OK.
  - `node --check src/modules/speech/audioCues.js`: OK.
  - `node --check src/modules/speech/ttsHelpers.js`: OK.
  - `node --check src/modules/speech/ttsVoices.js`: OK.
  - `node --check src/modules/speech/ttsControls.js`: OK.
  - `node --check src/modules/speech/ttsPlayback.js`: OK.
  - `node --check src/modules/text/resultText.js`: OK.
  - `node --check src/modules/navigation/sidebarOrder.js`: OK.
  - `node --check src/modules/shortcuts/runtime.js`: OK.
  - `node --check src/modules/selection/quickActions.js`: OK.
  - `node --check src/modules/selection/floatingToolbar.js`: OK.
  - `node --check src/shared/tauriClient.js`: OK.
  - `gk check`: 0 errors، 3 warnings، 6 info، ratchet OK.

---

### المرحلة 8 - تفعيل boundary gate

الأهداف:

- جعل GK يحرس حدود الموديولات.

المهام:

1. ضبط `.governance/config.json` على `scanDirs`:
   - `src`
   - `src-tauri/src`
2. ضبط `moduleRoot` إن احتجنا دعم `modules`.
3. تشغيل `gk check`.
4. إصلاح أي cross-module import يخترق `api`.

معيار الإنجاز:

- لا توجد مخالفات boundary.
- أي اعتماد بين الموديولات يمر عبر public API.

---

### المرحلة 9 - رفع المستوى إلى T3 لاحقًا

لا نبدأ بها الآن.

تتم بعد استقرار التقسيم الأساسي.

المهام المستقبلية:

- coverage floor.
- ADRs كاملة.
- `DEFINITION_OF_DONE.md`.
- CI gate.
- security baseline.

---

## ترتيب الأولويات المقترح

1. GK + baseline.
2. usage_stats.
3. ai.
4. system_io.
5. selection.
6. shortcuts.
7. frontend modules.
8. boundary gate.
9. T3 readiness.

---

## مخاطر يجب الانتباه لها

- نقل كود Windows دفعة واحدة قد يكسر التركيز أو اللصق.
- فصل `main.js` بدون خطة قد يكسر event listeners.
- مزودو AI متشابهون ظاهريًا لكن اختلافات الاستجابات مهمة.
- مفاتيح API محفوظة حاليًا في `localStorage`، وهذا يحتاج قرارًا أمنيًا لاحقًا.
- GK قد يكشف مشاكل كثيرة في البداية؛ baseline موجود حتى لا نغرق في إصلاح كل شيء مرة واحدة.

---

## أول خطوة تنفيذية مقترحة

الخطوة الأولى بعد اعتماد هذه الخطة:

1. تفعيل GK داخل المشروع.
2. إنشاء baseline.
3. إنشاء ADR-001.
4. عدم نقل أي كود قبل أن نعرف أرضية الجودة الحالية.

بعدها نبدأ بأصغر موديول آمن: `usage_stats`.

---

## حالة التنفيذ

### 2026-06-18 - Phase 0 بدأت

تم:

- تفعيل GK على tier `T2`.
- إنشاء `.governance/config.json`.
- إنشاء `CHARTER.md`, `AGENT_KICKOFF.md`, `docs/governance/GK_REBUILD_GUIDE.md`, `HANDOFF.md`.
- إنشاء `docs/adr/ADR-001-restructure-strategy.md`.
- ضبط legacy ceiling مؤقت:
  - `hardCeiling: 5200`
  - `softCeiling: 500`
- حفظ baseline:
  - `0 errors`
  - `5 warnings`
  - `6 info`
- التحقق:
  - `gk selftest`: 66/66 green.
  - `gk check`: ratchet OK.
  - `cargo check`: OK.
  - `node --check src/main.js`: OK.

ملاحظة:

- تعذر تفعيل `git config core.hooksPath scripts/hooks` داخل sandbox لأن `.git/config` غير قابل للكتابة.
- الخطوة التالية: استخراج `usage_stats`.

### 2026-06-18 - Phase 2 / usage_stats

تم:

- إنشاء `src-tauri/src/modules/mod.rs`.
- إنشاء `src-tauri/src/modules/usage_stats/mod.rs`.
- نقل:
  - `UsageLogEntry`
  - `ProviderUsage`
  - `ModelUsage`
  - `TokenStats`
  - قراءة/كتابة `token_usage.json`
  - تسجيل الاستهلاك
  - تصفير الإحصائيات
- إبقاء أوامر Tauri العامة كما هي:
  - `get_token_usage_stats`
  - `reset_token_usage_stats`
- تقليل حجم `src-tauri/src/lib.rs` من 856 إلى 747 سطرًا تقريبًا.

التحقق:

- `cargo check`: OK.
- `node --check src/main.js`: OK.
- `gk check`: 0 errors، 5 warnings، 6 info، ratchet OK.

الخطوة التالية:

- بدء Phase 3 بتحضير استخراج `ai`، مع تثبيت أنواع الطلب/الاستجابة والتوجيهات المشتركة قبل نقل providers.

### 2026-06-18 - Phase 3 / AI prompts prep

تم:

- إنشاء `src-tauri/src/modules/ai/mod.rs`.
- إنشاء `src-tauri/src/modules/ai/prompts.rs`.
- توحيد التوجيهات الافتراضية لإجراءات النص:
  - `translate`
  - `diacritize`
  - `grammar`
  - `summarize`
  - fallback rewrite
- استبدال ثلاث كتل مكررة من `match action` في `src-tauri/src/ai_engine.rs` باستدعاء:
  - `text_action_instruction(action, custom_prompt.as_deref())`
- تقليل حجم `src-tauri/src/ai_engine.rs` من 992 إلى 972 سطرًا تقريبًا.

التحقق:

- `cargo check`: OK.
- `node --check src/main.js`: OK.
- `gk check`: 0 errors، 5 warnings، 6 info، ratchet OK.

ملاحظة:

- `cargo test` تعذر بسبب أخطاء صلاحيات Windows في Cargo target/incremental cache، وليس بسبب فشل assertion.

الخطوة التالية:

- تعريف أنواع حدود AI: request/response/provider traits، ثم نقل المزودين تدريجيًا بدون تغيير واجهة Tauri.

### 2026-06-18 - Phase 3 / provider detection prep

تم:

- إنشاء `src-tauri/src/modules/ai/provider_detection.rs`.
- نقل منطق كشف مزود النص من `src-tauri/src/lib.rs` إلى موديول AI.
- أصبح أمر `ai_process_text` يستدعي:
  - `detect_text_provider(&api_key, &model)`
- بقيت أسماء المزودين كما هي:
  - `Gemini`
  - `Anthropic`
  - `Groq`
  - `OpenRouter`
  - `xAI`
  - `DeepSeek`
  - `Mistral`
  - `OpenAI`
  - `Unknown`
- تقليل حجم `src-tauri/src/lib.rs` من 747 إلى 727 سطرًا تقريبًا.

التحقق:

- `cargo check`: OK.
- `node --check src/main.js`: OK.
- `gk check`: 0 errors، 5 warnings، 6 info، ratchet OK.

الخطوة التالية:

- تعريف أنواع حدود AI: request/response/provider traits، ثم البدء بنقل مزود واحد أو عائلة واحدة من providers.

### 2026-06-18 - Phase 3 / endpoint routing prep

تم:

- نقل اختيار endpoint الخاص بـ OpenAI-compatible chat completions من `src-tauri/src/ai_engine.rs` إلى:
  - `src-tauri/src/modules/ai/provider_detection.rs`
- إضافة:
  - `chat_completions_endpoint(api_key, model)`
- أصبح `process_text` يستدعي الدالة الجديدة بدل امتلاك قواعد URL داخله.
- بقي الخطأ العربي الحالي كما هو عند عدم معرفة المزود:
  - `مزود غير معروف للمفتاح المدخل`
- تقليل حجم `src-tauri/src/ai_engine.rs` من 972 إلى 956 سطرًا تقريبًا.

التحقق:

- `cargo check`: OK. احتاج تشغيلًا خارج sandbox لأن Cargo داخل sandbox اصطدم بقفل/صلاحيات Windows داخل `src-tauri/target`.
- `node --check src/main.js`: OK.
- `gk check`: 0 errors، 5 warnings، 6 info، ratchet OK.

الخطوة التالية:

- تعريف أنواع حدود AI: request/response/provider traits، أو البدء بنقل عائلة OpenAI-compatible providers خلف adapter واحد.

### 2026-06-18 - Phase 3 / OpenAI-compatible provider extraction

تم:

- إنشاء `src-tauri/src/modules/ai/openai_compatible.rs`.
- نقل دالة معالجة النصوص للمزودين المتوافقين مع OpenAI من `src-tauri/src/ai_engine.rs`.
- يشمل هذا المسار:
  - OpenAI
  - Groq
  - OpenRouter
  - xAI
  - DeepSeek
  - Mistral
- بقيت صيغة JSON كما هي:
  - `messages`
  - `temperature: 0.3`
- بقيت رسائل الخطأ العربية كما هي.
- أصبح `src-tauri/src/ai_engine.rs` يستدعي:
  - `openai_compatible::process_text(...)`
- تقليل حجم `src-tauri/src/ai_engine.rs` من 956 إلى 899 سطرًا تقريبًا.

التحقق:

- `cargo check`: OK.
- `node --check src/main.js`: OK.
- `gk check`: 0 errors، 5 warnings، 6 info، ratchet OK.

الخطوة التالية:

- استخراج Anthropic text processing، أو تعريف types/traits قبل نقل مزودين إضافيين.

### 2026-06-18 - Phase 3 / Anthropic provider extraction

تم:

- إنشاء `src-tauri/src/modules/ai/anthropic.rs`.
- نقل دالة معالجة النصوص الخاصة بـ Anthropic من `src-tauri/src/ai_engine.rs`.
- بقيت صيغة الطلب كما هي:
  - `messages`
  - `max_tokens: 1024`
  - header `x-api-key`
  - header `anthropic-version: 2023-06-01`
- بقي استخراج التوكينز كما هو:
  - `usage.input_tokens`
  - `usage.output_tokens`
- بقيت رسائل الخطأ العربية كما هي.
- أصبح `src-tauri/src/ai_engine.rs` يستدعي:
  - `anthropic::process_text(...)`
- تقليل حجم `src-tauri/src/ai_engine.rs` من 899 إلى 840 سطرًا تقريبًا.

التحقق:

- `cargo check`: OK. احتاج تشغيلًا خارج sandbox لأن Cargo داخل sandbox اصطدم بقفل/صلاحيات Windows داخل `src-tauri/target`.
- `node --check src/main.js`: OK.
- `gk check`: 0 errors، 5 warnings، 6 info، ratchet OK.

الخطوة التالية:

- استخراج Gemini text processing، أو تعريف types/traits قبل نقل مزودين إضافيين.

### 2026-06-18 - Phase 3 / Gemini text provider extraction

تم:

- إنشاء `src-tauri/src/modules/ai/gemini.rs`.
- نقل معالجة النصوص الخاصة بـ Gemini من `src-tauri/src/ai_engine.rs`.
- بقي مسار Gemini الخاص بتفريغ الصوت في `src-tauri/src/ai_engine.rs` مؤقتًا.
- بقيت صيغة الطلب كما هي:
  - `generateContent`
  - `contents.parts.text`
- بقي استخراج التوكينز كما هو:
  - `usageMetadata.promptTokenCount`
  - `usageMetadata.candidatesTokenCount`
- بقيت رسائل الخطأ العربية كما هي.
- أصبح `src-tauri/src/ai_engine.rs` يستدعي:
  - `gemini::process_text(...)`
- تقليل حجم `src-tauri/src/ai_engine.rs` من 840 إلى 796 سطرًا تقريبًا.

التحقق:

- `cargo check`: OK. احتاج تشغيلًا خارج sandbox لأن Cargo داخل sandbox اصطدم بقفل/صلاحيات Windows داخل `src-tauri/target`.
- `node --check src/main.js`: OK.
- `gk check`: 0 errors، 5 warnings، 6 info، ratchet OK.

الخطوة التالية:

- إما استخراج مسارات تفريغ الصوت، أو تعريف types/traits لحدود AI قبل نقل المزيد من المزودين.

### 2026-06-18 - Phase 3 / transcription extraction

تم:

- إنشاء `src-tauri/src/modules/ai/transcription.rs`.
- نقل دالة تفريغ الصوت من `src-tauri/src/ai_engine.rs`.
- يشمل النقل:
  - Groq/OpenAI multipart audio transcription.
  - Gemini inline audio transcription.
- بقيت صيغة multipart كما هي:
  - `file: audio.webm`
  - `model`
  - `language` عند عدم كونه فارغًا أو `auto`
- بقيت صيغة Gemini كما هي:
  - `inlineData`
  - `mimeType: audio/webm`
  - prompt العربي الخاص بالتفريغ.
- بقي تقدير التوكينز لمسار Groq/OpenAI كما هو.
- أصبح `src-tauri/src/ai_engine.rs` يستدعي:
  - `transcription::transcribe_audio(...)`
- تقليل حجم `src-tauri/src/ai_engine.rs` من 796 إلى 681 سطرًا تقريبًا.

التحقق:

- `cargo check`: OK. احتاج تشغيلًا خارج sandbox لأن Cargo داخل sandbox اصطدم بقفل/صلاحيات Windows داخل `src-tauri/target`.
- `node --check src/main.js`: OK.
- `gk check`: 0 errors، 5 warnings، 6 info، ratchet OK.

الخطوة التالية:

- تعريف types/traits لحدود AI، ثم تحديد هل يتم فصل key verification أو TTS في المرحلة التالية.

### 2026-06-18 - Phase 3 / key verification extraction

تم:

- إنشاء `src-tauri/src/modules/ai/key_verification.rs`.
- نقل:
  - `KeyVerificationResult`
  - `verify_api_key`
  - منطق فحص مفاتيح Groq/Gemini/Anthropic/OpenRouter/xAI/OpenAI/DeepSeek/Mistral
  - فحص Mistral/OpenAI الاحتياطي
- تحديث أمر Tauri:
  - `verify_api_key`
  - ليستخدم `modules::ai::key_verification`.
- بقيت أسماء المزودين ورسائل الخطأ كما هي.
- أصبح `src-tauri/src/ai_engine.rs` حوالي 259 سطرًا، وخرج من تحذير GK الخاص بسقف 500 سطر.

التحقق:

- `cargo check`: OK. احتاج تشغيلًا خارج sandbox لأن Cargo داخل sandbox اصطدم بقفل/صلاحيات Windows داخل `src-tauri/target`.
- `node --check src/main.js`: OK.
- `gk check`: 0 errors، 4 warnings، 6 info، ratchet OK.

الأثر:

- انخفضت تحذيرات GK من 5 إلى 4.
- لم يعد `src-tauri/src/ai_engine.rs` ضمن الملفات المتضخمة حسب GK.

الخطوة التالية:

- استهداف `src-tauri/src/lib.rs` أو فصل TTS إلى موديول Speech/TTS.

### 2026-06-18 - Speech / TTS extraction

تم:

- إنشاء `src-tauri/src/modules/speech/mod.rs`.
- إنشاء `src-tauri/src/modules/speech/tts.rs`.
- نقل منطق نطق النصوص من `src-tauri/src/ai_engine.rs` إلى موديول Speech:
  - كشف اللغة.
  - تهريب SSML.
  - تقسيم النص إلى مقاطع.
  - Microsoft Edge TTS.
  - Google Translate TTS.
- إبقاء `ai_engine::synthesize_speech(...)` كغلاف توافق صغير حتى لا يتغير أمر Tauri الحالي.
- أصبح `src-tauri/src/ai_engine.rs` حوالي 45 سطرًا.

التحقق:

- `cargo check`: OK.
- `node --check src/main.js`: OK.
- `gk check`: 0 errors، 4 warnings، 6 info، ratchet OK.

الخطوة التالية:

- استهداف `src-tauri/src/lib.rs`، خصوصًا shortcuts أو selection/overlay.

### 2026-06-18 - Frontend settings/navigation cleanup slices

تم:

- متابعة تفكيك `src/main.js` بشرائح صغيرة قابلة للتحقق.
- إنشاء وحدات Frontend جديدة:
  - `src/modules/text/outputRouting.js`
  - `src/modules/speech/recordButton.js`
  - `src/modules/ai/autoProcessingControls.js`
  - `src/modules/ai/promptSettings.js`
  - `src/modules/speech/freeSttControls.js`
  - `src/modules/settings/textOutputControls.js`
  - `src/modules/shortcuts/behaviorControls.js`
  - `src/modules/shortcuts/spaceHold.js`
  - `src/modules/settings/providerModelControls.js`
  - `src/modules/settings/homeIndicators.js`
  - `src/modules/speech/homeSpeechActions.js`
  - `src/modules/navigation/appShellControls.js`
  - `src/modules/navigation/activeTabRefresh.js`
  - `src/modules/settings/startupPreferences.js`
- نقل منطق إعدادات الإخراج، محرك STT المجاني، prompt settings، auto processing، سلوك الاختصارات، ضغط Space المطوّل، مزامنة قوائم home/settings، مؤشرات الصفحة الرئيسية، أزرار النص والنطق، تحديث التبويب النشط، وطيّ الشريط الجانبي خارج `src/main.js`.
- نقل تحميل تفضيلات التشغيل الأولية خارج `src/main.js`.
- أصبح `src/main.js` حوالي 1913 سطرًا.

التحقق:

- `cargo check`: آخر نجاح كان قبل هذه الدفعة التي غيّرت JavaScript فقط. إعادة الفحص النهائية داخل sandbox اصطدمت بصلاحيات Windows داخل `src-tauri/target`، ومحاولة التشغيل خارج sandbox رُفضت بسبب حد الاستخدام الحالي.
- `node --check src/main.js`: OK.
- `node --check` للوحدات الجديدة: OK.
- `gk check`: 0 errors، 3 warnings، 6 info، ratchet OK.

الخطوة التالية:

- فصل تدفق التسجيل وWeb Speech من `src/main.js` على مراحل صغيرة:
  - `startRecording` / `stopRecording` / `processAudioTranscription`.
  - `toggleFreeSpeechRecognition` / `finalizeWebSpeechSession`.

### 2026-06-19 - Frontend speech/API/settings extraction

تم:

- متابعة تفكيك `src/main.js` بشرائح Frontend قابلة للتحقق.
- إنشاء وحدات جديدة:
  - `src/modules/speech/cloudTranscription.js`
  - `src/modules/speech/cloudRecordingSession.js`
  - `src/modules/speech/webSpeechSession.js`
  - `src/modules/speech/webSpeechFinalize.js`
  - `src/modules/apiKeys/verificationController.js`
  - `src/modules/settings/modelSelectors.js`
  - `src/modules/ai/diacritizeControls.js`
  - `src/modules/settings/generalOverview.js`
  - `src/modules/navigation/tabs.js`
  - `src/modules/speech/ttsRuntime.js`
  - `src/modules/modelCompare/controller.js`
  - `src/modules/speech/webSpeechController.js`
  - `src/modules/speech/sttShortcutBridge.js`
  - `src/modules/settings/startupWiring.js`
- نقل معالجة تفريغ التسجيل السحابي خارج `src/main.js`.
- نقل حالة جلسة التسجيل السحابي، `MediaRecorder`، مقاطع الصوت، ومنطق البدء/الإيقاف إلى وحدة مستقلة.
- نقل تدفق Google Web Speech، وإنهاء الجلسة، والتعامل مع إخراج النص إلى وحدات Speech مستقلة.
- نقل منطق فحص مفاتيح API وحالة واجهة المفتاح إلى Controller مستقل.
- نقل تعبئة قوائم نماذج الصوت/النص للمزود إلى وحدة إعدادات.
- نقل إعدادات التشكيل، قائمة نماذج التشكيل، وجدولة تشكيل النص الحالي إلى وحدة AI مستقلة.
- نقل بناء نظرة الإعدادات العامة ونسخ/مزامنة عناصرها إلى وحدة إعدادات مستقلة.
- نقل تفعيل التبويبات، حارس النقر بعد إعادة ترتيب الشريط الجانبي، وSettings subnav إلى وحدة Navigation مستقلة.
- نقل Runtime الخاص بالنطق: اختيار المزود/الصوت، تشغيل السحابة والمحلي، fallback، تعبئة الأصوات، وحالة أزرار TTS إلى وحدة Speech مستقلة.
- نقل طبقة الربط الخاصة بمقارنة النماذج: الأعمدة، التدفق، التخطيط، الحالة، والمرفقات إلى Controller مستقل.
- نقل wiring الخاص بـ Web Speech إلى Controller مستقل.
- نقل جسر بدء/إيقاف STT من الاختصارات إلى وحدة Speech مستقلة.
- نقل wiring الخاص بتحميل تفضيلات التشغيل وتهيئة TTS/shortcuts/auto-processing/output/free-STT إلى وحدة إعدادات مستقلة.
- حذف أغلفة توافق غير مستخدمة بعد التأكد من عدم وجود مراجع محلية لها.
- أصبح `src/main.js` حوالي 964 سطرًا.

التحقق:

- `node --check src/main.js`: OK.
- `node --check` للوحدات الجديدة: OK.
- `gk check`: 0 errors، 3 warnings، 6 info، ratchet OK.
- `cargo check` لم يُعد تشغيله لهذه الدفعة لأنها تغييرات JavaScript فقط، والبيئة الحالية read-only، وقد اصطدمت أوامر Cargo سابقًا بصلاحيات Windows داخل `src-tauri/target`.

الخطوة التالية:

- متابعة تقليل `src/main.js` من خلال:
  - فصل تبويبات التنقل وSettings subnav.
  - فصل أغلفة TTS المتبقية.
  - تقليل adapters الخاصة بالمقارنة.
  - بعد ذلك البدء بتقسيم `src/styles.css` و`src/index.html` لتقليل تحذيرات GK المتبقية.

### 2026-06-19 - Frontend DOM/CSS/HTML split

تم:

- نقل تجميع مراجع DOM إلى:
  - `src/modules/settings/domRefs.js`
- نقل ربط مستمعات DOM الأولية إلى:
  - `src/modules/settings/initialDomListeners.js`
- نقل ربط أدوات النص المحدد والـ quick actions إلى:
  - `src/modules/selection/toolsController.js`
- نقل ربط تحديث التبويب النشط إلى:
  - `src/modules/navigation/activeTabRefreshController.js`
- نقل حالة التقاط نافذة/هدف اللصق الخارجي إلى:
  - `src/modules/text/externalTargetCapture.js`
- نقل adapter قراءة/كتابة/إلحاق نص النتيجة إلى:
  - `src/modules/text/resultTextController.js`
- إضافة انتظار جاهزية DOM وأجزاء HTML الخارجية عبر:
  - `src/modules/navigation/appReady.js`
  - `src/partialsLoader.js`
- تحويل `src/index.html` إلى shell صغير، ونقل محتوى التبويبات والأدوات السريعة إلى:
  - `src/partials/tab-home.html`
  - `src/partials/tab-keys.html`
  - `src/partials/tab-compare.html`
  - `src/partials/tab-settings.html`
  - `src/partials/tab-alerts.html`
  - `src/partials/tab-stats.html`
  - `src/partials/quick-tools.html`
- تحويل `src/styles.css` إلى ملف imports فقط، ونقل الأنماط إلى:
  - `src/styles/base.css`
  - `src/styles/model-compare.css`
  - `src/styles/model-compare/question.css`
  - `src/styles/model-compare/columns.css`
  - `src/styles/model-compare/combo.css`
  - `src/styles/home.css`
  - `src/styles/settings.css`
  - `src/styles/alerts.css`
  - `src/styles/keys-shortcuts-tools.css`
  - `src/styles/batch-stats-sidebar.css`
- متابعة تفكيك `src/main.js` إلى طبقة composition داخل `src/app`:
  - `src/app/domRuntime.js`
  - `src/app/startupRuntime.js`
  - `src/app/frontendRuntime.js`
  - `src/app/activeTabRuntime.js`
  - `src/app/modelComparisonRuntime.js`
- نقل مراجع DOM الخاصة بمفاتيح API إلى:
  - `src/modules/apiKeys/domRefs.js`
- نقل مراجع DOM الخاصة بأدوات التحديد إلى:
  - `src/modules/selection/domRefs.js`
- نقل مراجع DOM وحالة runtime الخاصة بالنطق إلى:
  - `src/modules/speech/ttsDomRefs.js`
  - `src/modules/speech/ttsAppController.js`
- نقل composition الخاص بالتسجيل/Web Speech/التفريغ السحابي إلى:
  - `src/modules/speech/recordingController.js`
- انخفضت تحذيرات GK من 3 إلى 0.
- أصبح `src/main.js` حوالي 452 سطرًا، ولم يعد فوق soft ceiling.

التحقق:

- `node --check src/main.js`: OK.
- `node --check` لجميع ملفات JavaScript داخل `src`: OK.
- فحص تركيب partials: 7 partials، 138 IDs، ولا توجد IDs مكررة.
- `gk check`: 0 errors، 0 warnings، 6 info، ratchet OK.
- `cargo check` لم يُعد تشغيله لأن هذه الدفعة JS/HTML/CSS فقط، وتشغيل Cargo داخل sandbox سبق أن اصطدم بصلاحيات Windows داخل `src-tauri/target`.

الخطوة التالية:

- تنفيذ smoke test يدوي/متصفح للتأكد من سلامة:
  - تحميل partials.
  - التنقل بين التبويبات.
  - واجهة التسجيل.
  - واجهة مفاتيح API.
  - مقارنة النماذج.
  - إعدادات التشغيل.
  - أدوات النص السريعة.
  - TTS.
