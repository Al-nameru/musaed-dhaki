function cloneSelectOptions(source, target, emptyText = "لا توجد خيارات") {
  if (!source || !target) return;

  target.innerHTML = "";
  if (source.options.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = emptyText;
    option.disabled = true;
    target.appendChild(option);
    return;
  }

  [...source.options].forEach((sourceOption) => {
    const option = document.createElement("option");
    option.value = sourceOption.value;
    option.textContent = sourceOption.textContent;
    option.disabled = sourceOption.disabled;
    target.appendChild(option);
  });
  target.disabled = source.disabled;
}

function setSelectValueIfPossible(select, value) {
  if (!select) return;
  if ([...select.options].some((option) => option.value === value)) {
    select.value = value;
  }
}

export function updateHomeIndicatorsView(refs, state) {
  cloneSelectOptions(refs.selectProviderCompany, refs.homeSelectProviderCompany, "لا يوجد مزود");
  cloneSelectOptions(refs.selectSpeechModel, refs.homeSelectSpeechModel, "لا توجد نماذج صوت");
  cloneSelectOptions(refs.selectTextModel, refs.homeSelectTextModel, "لا توجد نماذج نص");
  cloneSelectOptions(refs.selectDiacritizeProvider, refs.homeSelectDiacritizeProvider, "يتبع النصوص");
  cloneSelectOptions(refs.selectDiacritizeModel, refs.homeSelectDiacritizeModel, "يتبع نموذج النصوص");
  cloneSelectOptions(refs.selectTtsProvider, refs.homeSelectTtsProvider, "لا توجد خدمات نطق");

  setSelectValueIfPossible(
    refs.homeSelectProviderCompany,
    state.activeProvider || refs.selectProviderCompany?.value || ""
  );
  setSelectValueIfPossible(refs.homeSelectSpeechModel, state.speechModel);
  setSelectValueIfPossible(refs.homeSelectTextModel, state.textModel);
  setSelectValueIfPossible(refs.homeSelectDiacritizeProvider, state.diacritizeProvider || "");
  setSelectValueIfPossible(refs.homeSelectDiacritizeModel, state.diacritizeModel || "");
  setSelectValueIfPossible(refs.homeSelectTtsProvider, refs.selectTtsProvider?.value || "google");
}
