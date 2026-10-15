import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getAudioMimeTypeFromUrl,
  normalizeAudioUrl,
} from "./audio-utils";

describe("normalizeAudioUrl", () => {
  it("trims surrounding whitespace", () => {
    assert.equal(
      normalizeAudioUrl("  https://example.com/a.wav  "),
      "https://example.com/a.wav"
    );
  });

  it("returns empty string for missing values", () => {
    assert.equal(normalizeAudioUrl(null), "");
    assert.equal(normalizeAudioUrl(undefined), "");
  });
});

describe("getAudioMimeTypeFromUrl", () => {
  it("detects wav after trimming", () => {
    assert.equal(
      getAudioMimeTypeFromUrl(" https://monlam-ai-stt.s3.amazonaws.com/x.wav "),
      "audio/wav"
    );
  });
});
