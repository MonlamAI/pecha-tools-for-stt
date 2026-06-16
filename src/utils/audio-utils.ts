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

  if (!audio.src) {
    const message = "No audio URL is available.";
    console.error(AUDIO_LOG_PREFIX, "play failed: missing src", { context });
    if (showToastOnFailure) onFailure?.(message);
    return false;
  }

  try {
    await audio.play();
    logAudioDiagnostic("play-resolved", {
      context,
      url: audio.src,
      readyState: audio.readyState,
    });
    return true;
  } catch (error) {
    const isAutoplayPolicy =
      error instanceof DOMException && error.name === "NotAllowedError";

    console.error(AUDIO_LOG_PREFIX, "play rejected", {
      context,
      url: audio.src,
      readyState: audio.readyState,
      networkState: audio.networkState,
      error,
      isAutoplayPolicy,
    });

    if (showToastOnFailure && !isAutoplayPolicy) {
      onFailure?.(
        "Unable to play audio. Try again or use the built-in player controls."
      );
    }

    return false;
  }
}
