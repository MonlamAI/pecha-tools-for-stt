// [Reason] Centralize audio MIME detection, safe play, and diagnostics for reliable playback.

export const AUDIO_LOG_PREFIX = "[AudioPlayer]";

const AUDIO_MIME_BY_EXTENSION: Record<string, string> = {
  wav: "audio/wav",
  wave: "audio/wav",
  mp3: "audio/mpeg",
  mpeg: "audio/mpeg",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  webm: "audio/webm",
  flac: "audio/flac",
};

/** Derive MIME type from URL path extension; returns undefined when unknown. */
export function getAudioMimeTypeFromUrl(
  url: string | null | undefined
): string | undefined {
  if (!url) return undefined;

  const path = url.split("?")[0]?.split("#")[0] ?? "";
  const extension = path.split(".").pop()?.toLowerCase();
  if (!extension) return undefined;

  return AUDIO_MIME_BY_EXTENSION[extension];
}

/** Map MediaError codes to user-facing messages. */
export function getAudioErrorMessage(error: MediaError | null): string {
  if (!error) {
    return "An unknown audio error occurred.";
  }

  switch (error.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return "Audio loading was aborted.";
    case MediaError.MEDIA_ERR_NETWORK:
      return "Network error while loading audio. Check your connection.";
    case MediaError.MEDIA_ERR_DECODE:
      return "Audio could not be decoded. The file may be corrupted or unsupported.";
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return "Audio format is not supported by this browser.";
    default:
      return "Failed to load or play audio.";
  }
}

export function logAudioDiagnostic(
  event: string,
  details: Record<string, unknown> = {}
): void {
  console.log(AUDIO_LOG_PREFIX, event, {
    timestamp: new Date().toISOString(),
    ...details,
  });
}

type SafePlayOptions = {
  showToastOnFailure?: boolean;
  onFailure?: (message: string) => void;
};

type AudioSourceSelection =
  | "currentSrc"
  | "src"
  | "sourceElement"
  | "none"
  | "fallback";

type AudioSourceResolution = {
  currentSrc: string;
  src: string;
  sourceElementSrc: string;
  resolvedUrl: string;
  selectedFrom: AudioSourceSelection;
};

// [Reason] Support both <audio src> and <audio><source></audio> when validating playback.
function resolveAudioSource(audio: HTMLAudioElement): AudioSourceResolution {
  const currentSrc = audio.currentSrc ?? "";
  const src = audio.src ?? "";
  const sourceElementSrc = audio.querySelector("source")?.src ?? "";

  if (currentSrc) {
    return {
      currentSrc,
      src,
      sourceElementSrc,
      resolvedUrl: currentSrc,
      selectedFrom: "currentSrc",
    };
  }

  if (src) {
    return {
      currentSrc,
      src,
      sourceElementSrc,
      resolvedUrl: src,
      selectedFrom: "src",
    };
  }

  if (sourceElementSrc) {
    return {
      currentSrc,
      src,
      sourceElementSrc,
      resolvedUrl: sourceElementSrc,
      selectedFrom: "sourceElement",
    };
  }

  return {
    currentSrc,
    src,
    sourceElementSrc,
    resolvedUrl: "",
    selectedFrom: "none",
  };
}

function logSourceResolution(
  context: string,
  resolution: AudioSourceResolution,
  extra: Record<string, unknown> = {}
): void {
  logAudioDiagnostic("source-resolution", {
    context,
    currentSrc: resolution.currentSrc || "(empty)",
    src: resolution.src || "(empty)",
    sourceElementSrc: resolution.sourceElementSrc || "(empty)",
    selectedFrom: resolution.selectedFrom,
    resolvedUrl: resolution.resolvedUrl || "(empty)",
    ...extra,
  });
}

function audioFallbackUrl(resolution: AudioSourceResolution): string {
  return (
    resolution.resolvedUrl ||
    resolution.currentSrc ||
    resolution.src ||
    resolution.sourceElementSrc ||
    "(unknown)"
  );
}

async function attemptAudioPlay(
  audio: HTMLAudioElement,
  context: string,
  resolution: AudioSourceResolution,
  usedFallback: boolean,
  options: SafePlayOptions
): Promise<boolean> {
  const { showToastOnFailure = true, onFailure } = options;

  try {
    await audio.play();
    logAudioDiagnostic("play-resolved", {
      context,
      currentSrc: resolution.currentSrc || "(empty)",
      src: resolution.src || "(empty)",
      sourceElementSrc: resolution.sourceElementSrc || "(empty)",
      selectedFrom: usedFallback ? "fallback" : resolution.selectedFrom,
      usedFallback,
      url: audio.currentSrc || audioFallbackUrl(resolution),
      readyState: audio.readyState,
    });
    return true;
  } catch (error) {
    const isAutoplayPolicy =
      error instanceof DOMException && error.name === "NotAllowedError";
    const allSourcesEmpty =
      !resolution.currentSrc &&
      !resolution.src &&
      !resolution.sourceElementSrc;

    console.error(AUDIO_LOG_PREFIX, "play rejected", {
      context,
      currentSrc: resolution.currentSrc || "(empty)",
      src: resolution.src || "(empty)",
      sourceElementSrc: resolution.sourceElementSrc || "(empty)",
      selectedFrom: usedFallback ? "fallback" : resolution.selectedFrom,
      usedFallback,
      url: audio.currentSrc || audioFallbackUrl(resolution),
      readyState: audio.readyState,
      networkState: audio.networkState,
      error,
      isAutoplayPolicy,
    });

    if (showToastOnFailure && !isAutoplayPolicy) {
      onFailure?.(
        allSourcesEmpty
          ? "No audio URL is available."
          : "Unable to play audio. Try again or use the built-in player controls."
      );
    }

    return false;
  }
}

/** Wrap audio.play() with promise handling and structured logging. */
export async function safeAudioPlay(
  audio: HTMLAudioElement | null | undefined,
  context: string,
  options: SafePlayOptions = {}
): Promise<boolean> {
  const { showToastOnFailure = true, onFailure } = options;

  if (!audio) {
    const message = "Audio player is not ready.";
    console.error(AUDIO_LOG_PREFIX, "play failed: no audio element", { context });
    if (showToastOnFailure) onFailure?.(message);
    return false;
  }

  const resolution = resolveAudioSource(audio);
  logSourceResolution(context, resolution);

  if (resolution.resolvedUrl) {
    return attemptAudioPlay(audio, context, resolution, false, options);
  }

  // [Reason] Last-resort path when URL detection is wrong but the element can still play.
  logAudioDiagnostic("play-fallback", {
    context,
    currentSrc: resolution.currentSrc || "(empty)",
    src: resolution.src || "(empty)",
    sourceElementSrc: resolution.sourceElementSrc || "(empty)",
    selectedFrom: "none",
    usedFallback: true,
    message: "No URL resolved from validation; attempting direct audio.play()",
  });

  return attemptAudioPlay(audio, context, resolution, true, options);
}
