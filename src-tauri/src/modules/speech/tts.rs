fn detect_language(text: &str) -> &'static str {
    let has_arabic = text.chars().any(|c| ('\u{0600}'..='\u{06FF}').contains(&c));
    if has_arabic {
        return "ar";
    }

    let has_german = text
        .chars()
        .any(|c| ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'].contains(&c));
    if has_german {
        return "de";
    }

    let has_french = text.chars().any(|c| {
        [
            'é', 'è', 'à', 'ù', 'ç', 'â', 'ê', 'î', 'ô', 'û', 'ë', 'ï', 'É', 'È', 'À', 'Ù', 'Ç',
            'Â', 'Ê', 'Î', 'Ô', 'Û',
        ]
        .contains(&c)
    });
    if has_french {
        return "fr";
    }

    let has_spanish = text
        .chars()
        .any(|c| ['á', 'í', 'ó', 'ú', 'ñ', 'Á', 'Í', 'Ó', 'Ú', 'Ñ', '¡', '¿'].contains(&c));
    if has_spanish {
        return "es";
    }

    let text_lower = text.to_lowercase();
    let words: Vec<&str> = text_lower.split_whitespace().collect();

    let german_words = [
        "ich", "ist", "und", "das", "der", "die", "den", "ein", "eine", "mit", "von", "zu", "es",
        "sie", "nicht",
    ];
    let french_words = [
        "le", "la", "les", "et", "est", "un", "une", "dans", "pour", "qui", "que", "pas", "plus",
        "elle", "nous",
    ];
    let spanish_words = [
        "el", "la", "los", "las", "y", "es", "un", "una", "en", "para", "que", "no", "con", "por",
        "su",
    ];

    let mut de_score = 0;
    let mut fr_score = 0;
    let mut es_score = 0;

    for w in words {
        if german_words.contains(&w) {
            de_score += 1;
        }
        if french_words.contains(&w) {
            fr_score += 1;
        }
        if spanish_words.contains(&w) {
            es_score += 1;
        }
    }

    if de_score > fr_score && de_score > es_score {
        "de"
    } else if fr_score > de_score && fr_score > es_score {
        "fr"
    } else if es_score > de_score && es_score > fr_score {
        "es"
    } else {
        "en"
    }
}

fn escape_ssml_text(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn split_text_for_tts(text: &str, max_chars: usize) -> Vec<String> {
    let mut chunks = Vec::new();
    let mut current = String::new();

    for sentence in text.split_inclusive(['.', '!', '?', '؟', '؛', '\n']) {
        let sentence = sentence.trim();
        if sentence.is_empty() {
            continue;
        }

        if current.chars().count() + sentence.chars().count() < max_chars {
            if !current.is_empty() {
                current.push(' ');
            }
            current.push_str(sentence);
            continue;
        }

        if !current.is_empty() {
            chunks.push(current.trim().to_string());
            current.clear();
        }

        if sentence.chars().count() <= max_chars {
            current.push_str(sentence);
            continue;
        }

        let mut part = String::new();
        for word in sentence.split_whitespace() {
            if part.chars().count() + word.chars().count() + 1 > max_chars && !part.is_empty() {
                chunks.push(part.trim().to_string());
                part.clear();
            }
            if !part.is_empty() {
                part.push(' ');
            }
            part.push_str(word);
        }
        if !part.is_empty() {
            chunks.push(part.trim().to_string());
        }
    }

    if !current.trim().is_empty() {
        chunks.push(current.trim().to_string());
    }

    chunks
}

// نطق النصوص وجلب دفق الصوت (Google Translate TTS / Microsoft Edge TTS)
pub async fn synthesize_speech(text: &str, provider: &str) -> Result<Vec<u8>, String> {
    if provider.to_lowercase() == "edge" {
        let raw_text = text.to_string();
        let ssml_text = escape_ssml_text(text);
        let audio_bytes =
            tauri::async_runtime::spawn_blocking(move || -> Result<Vec<u8>, String> {
                let lang = detect_language(&raw_text);
                let preferred_voices: &[&str] = match lang {
                    "ar" => &[
                        "ar-EG-SalmaNeural",
                        "ar-EG-ShakirNeural",
                        "ar-SA-ZariyahNeural",
                        "ar-SA-HamedNeural",
                    ],
                    "de" => &["de-DE-KatjaNeural", "de-DE-ConradNeural"],
                    "fr" => &["fr-FR-DeniseNeural", "fr-FR-HenriNeural"],
                    "es" => &["es-ES-ElviraNeural", "es-ES-AlvaroNeural"],
                    _ => &["en-US-AriaNeural", "en-US-GuyNeural", "en-US-JennyNeural"],
                };
                let target_locale = match lang {
                    "ar" => "ar-EG",
                    "de" => "de-DE",
                    "fr" => "fr-FR",
                    "es" => "es-ES",
                    _ => "en-US",
                };

                let voices = msedge_tts::voice::get_voices_list()
                    .map_err(|e| format!("فشل جلب قائمة أصوات Microsoft Edge TTS: {}", e))?;
                let target_locale_prefix = target_locale.split('-').next().unwrap_or(target_locale);
                let voice = voices
                    .iter()
                    .find(|v| {
                        preferred_voices.iter().any(|voice_name| {
                            let voice_name_lower = voice_name.to_lowercase();
                            v.short_name
                                .as_deref()
                                .map(|s| s.eq_ignore_ascii_case(voice_name))
                                .unwrap_or(false)
                                || v.name.to_lowercase().contains(&voice_name_lower)
                                || v.friendly_name
                                    .as_deref()
                                    .map(|s| s.to_lowercase().contains(&voice_name_lower))
                                    .unwrap_or(false)
                        })
                    })
                    .or_else(|| {
                        voices
                            .iter()
                            .find(|v| v.locale.as_deref() == Some(target_locale))
                    })
                    .or_else(|| {
                        voices.iter().find(|v| {
                            v.locale
                                .as_deref()
                                .map(|locale| locale.starts_with(target_locale_prefix))
                                .unwrap_or(false)
                        })
                    })
                    .cloned()
                    .ok_or_else(|| {
                        format!(
                            "لم يتم العثور على صوت Microsoft مناسب للغة {}.",
                            target_locale
                        )
                    })?;

                let mut config = msedge_tts::tts::SpeechConfig::from(&voice);
                config.voice_name = voice.short_name.clone().unwrap_or(config.voice_name);
                config.audio_format = "audio-24khz-48kbitrate-mono-mp3".to_string();

                let mut tts = msedge_tts::tts::client::connect()
                    .map_err(|e| format!("فشل الاتصال بخدمة Microsoft Edge TTS: {}", e))?;
                let audio = tts
                    .synthesize(&ssml_text, &config)
                    .map_err(|e| format!("فشل توليد الصوت عبر Microsoft Edge TTS: {}", e))?;

                if audio.audio_bytes.is_empty() {
                    return Err("خدمة Microsoft Edge TTS أرجعت ملف صوت فارغ.".to_string());
                }

                Ok(audio.audio_bytes)
            })
            .await
            .map_err(|e| format!("Thread pool spawn error: {}", e))??;

        return Ok(audio_bytes);
    }

    let client = reqwest::Client::new();
    let lang = detect_language(text);
    let chunks = split_text_for_tts(text, 180);
    if chunks.is_empty() {
        return Err("لا يوجد نص صالح للنطق.".to_string());
    }

    let mut audio = Vec::new();
    for chunk in chunks {
        let encoded_text: String = url::form_urlencoded::byte_serialize(chunk.as_bytes()).collect();
        let url = format!(
            "https://translate.google.com/translate_tts?ie=UTF-8&tl={}&client=tw-ob&q={}",
            lang, encoded_text
        );

        let response = client
            .get(&url)
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
            .send()
            .await
            .map_err(|e| format!("فشل الاتصال بخدمة نطق جوجل: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("فشل جلب الصوت من جوجل ({}).", response.status()));
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|e| format!("فشل قراءة بايتات الصوت: {}", e))?;

        audio.extend_from_slice(&bytes);
    }

    Ok(audio)
}
