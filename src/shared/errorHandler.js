export function getErrorMessage(errorLike) {
  if (!errorLike) return "";
  if (errorLike instanceof Error) return errorLike.message || errorLike.toString();
  if (typeof errorLike === "string") return errorLike;
  try {
    return JSON.stringify(errorLike);
  } catch (e) {
    return String(errorLike);
  }
}

export function handleError(err, context = {}) {
  const message = getErrorMessage(err);
  const { silent = false, alertFn, source = "التطبيق", title } = context;

  if (!silent) {
    console.error(`[${source}]`, message, err);
  }

  if (alertFn && !silent) {
    alertFn("error", title || "خطأ غير متوقع", message, { source });
  }
}

export async function retryAsync(fn, maxRetries = 3, baseDelay = 1000) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (e) {
      attempt++;
      if (attempt >= maxRetries) {
        throw e;
      }
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 100;
      console.warn(`[Retry] Attempt ${attempt} failed. Retrying in ${Math.round(delay)}ms... Error:`, e);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
