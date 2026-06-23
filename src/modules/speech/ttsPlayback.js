import { detectSpeechLanguage } from "./ttsHelpers.js";

export function speakWithSystemVoice(text, options = {}, deps) {
  if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") {
    throw new Error("النطق المحلي غير مدعوم في هذه البيئة.");
  }

  deps.stopActiveAudio();
  window.speechSynthesis.cancel();
  deps.setActiveAudioSrc("");

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = deps.getSelectedVoice()?.lang || detectSpeechLanguage(text);
  utterance.rate = deps.getRate();
  utterance.pitch = deps.getPitch();
  utterance.volume = deps.getVolume();

  const selectedVoice = deps.getSelectedVoice();
  if (selectedVoice) utterance.voice = selectedVoice;

  utterance.onstart = () => {
    if (options.announceFallback) {
      deps.announceFallback();
    }
    deps.updateButtonsState("playing");
  };
  utterance.onend = () => {
    deps.updateButtonsState("stopped");
    if (deps.onWordHighlightClean) deps.onWordHighlightClean();
  };
  utterance.onerror = () => {
    deps.updateButtonsState("stopped");
    if (deps.onWordHighlightClean) deps.onWordHighlightClean();
  };
  utterance.onpause = () => deps.updateButtonsState("paused");
  utterance.onresume = () => deps.updateButtonsState("playing");

  utterance.onboundary = (event) => {
    if (event.name === "word" && deps.onWordHighlight) {
      const charLength = event.charLength || (text.slice(event.charIndex).match(/^\S+/) || [""])[0].length;
      deps.onWordHighlight(event.charIndex, charLength);
    }
  };

  window.speechSynthesis.speak(utterance);
}

export async function speakWithCloudProvider(text, provider, requestId, deps) {
  deps.stopActiveAudio();
  if (window.speechSynthesis) window.speechSynthesis.cancel();

  const b64Audio = await deps.invoke("ai_speak_text", { text, provider });
  if (!deps.isCurrentRequest(requestId)) return;

  const audioSrc = "data:audio/mp3;base64," + b64Audio;
  const audio = new Audio(audioSrc);
  deps.setActiveAudioSrc(audioSrc);
  deps.setActiveAudio(audio);
  audio.volume = deps.getVolume();
  audio.playbackRate = deps.getRate();

  let words = [];
  const totalLength = text.length;
  if (totalLength > 0 && deps.onWordHighlight) {
    const regex = /\S+/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      words.push({
        start: match.index,
        end: regex.lastIndex,
        length: match[0].length
      });
    }
  }

  const onTimeUpdate = () => {
    if (!audio || audio.duration === 0 || !audio.duration || words.length === 0) return;
    const progress = audio.currentTime / audio.duration;
    const targetCharIndex = Math.min(Math.floor(progress * totalLength), totalLength - 1);
    const activeWord = words.find(w => targetCharIndex >= w.start && targetCharIndex <= w.end) || words[words.length - 1];
    if (activeWord && deps.onWordHighlight) {
      deps.onWordHighlight(activeWord.start, activeWord.length);
    }
  };

  audio.addEventListener("timeupdate", onTimeUpdate);

  audio.addEventListener("play", () => {
    deps.updateButtonsState("playing");
  });
  audio.addEventListener("pause", () => {
    if (audio && !audio.ended && audio.currentTime > 0) {
      deps.updateButtonsState("paused");
    }
  });
  audio.addEventListener("ended", () => {
    deps.updateButtonsState("stopped");
    if (deps.onWordHighlightClean) deps.onWordHighlightClean();
  });
  audio.addEventListener("error", () => {
    deps.updateButtonsState("stopped");
    if (deps.onWordHighlightClean) deps.onWordHighlightClean();
  });

  if (!deps.isCurrentRequest(requestId)) return;
  await audio.play();
}
