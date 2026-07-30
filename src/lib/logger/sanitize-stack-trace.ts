const INTERNAL_FRAME_PATTERNS: RegExp[] = [
  /node_modules\//,
  /next\/dist\//,
  /next-server\//,
  /compiled\/next-server\//,
  /router-server\.js/,
  /base-server\.js/,
  /start-server\.js/,
  /trace\.js/,
  /react\//,
];

const APP_FRAME_PATTERNS: RegExp[] = [
  // Plain paths
  /(^|\s)at\s+src\//,
  /(^|\s)at\s+prisma\//,
  /\/src\//,
  /\/prisma\//,
  // RSC-style webpack internal URLs: webpack-internal:///(rsc)/./src/...
  /webpack-internal:\/\/\/.*\/\.\/src\//,
  /webpack-internal:\/\/\/.*\/\.\/prisma\//,
];

function isWebpackInternalFrame(line: string): boolean {
  return line.includes("webpack-internal://");
}

// [Reason] Reduce Next.js/framework stack noise while preserving project-local frames for debugging
export function sanitizeStackTrace(stack: string | undefined): string | undefined {
  if (!stack) {
    return undefined;
  }

  const lines = stack.split("\n");
  if (lines.length <= 2) {
    return stack;
  }

  const header = lines[0];
  const frames = lines.slice(1);

  const keptFrames = frames.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("at ")) {
      return false;
    }

    // [Reason] Always keep project-local frames, including webpack-internal RSC frames
    if (APP_FRAME_PATTERNS.some((re) => re.test(trimmed))) {
      return true;
    }

    // [Reason] Drop known framework/internal frames
    if (INTERNAL_FRAME_PATTERNS.some((re) => re.test(trimmed))) {
      return false;
    }

    // [Reason] Drop remaining webpack-internal frames unless they point into src/prisma (handled above)
    if (isWebpackInternalFrame(trimmed)) {
      return false;
    }

    return false;
  });

  // [Reason] Fall back to original stack when filtering removes everything
  if (keptFrames.length === 0) {
    return stack;
  }

  return [header, ...keptFrames].join("\n");
}

