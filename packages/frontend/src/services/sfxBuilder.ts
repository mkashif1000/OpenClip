/**
 * Whoosh-style SFX synth + per-cut placement track.
 *
 * Generates a short noise-burst whoosh via OfflineAudioContext (lowpass-swept
 * pink-ish noise with a fast attack and an exponential decay), then pastes a
 * copy of it just before each B-roll cut into a silent stereo PCM track that
 * matches the rendered audio's length. The ffmpeg audio extractor mixes this
 * track in alongside source + music — no asset bundling needed.
 */

const WHOOSH_DURATION_SEC = 0.35;

let cachedWhoosh: { sampleRate: number; data: Float32Array } | null = null;

/**
 * Render a single whoosh: noise through a downward-swept lowpass with a
 * fast-attack / exponential-decay envelope. Returns interleaved stereo
 * float samples at the requested sample rate.
 */
async function renderWhoosh(sampleRate: number): Promise<Float32Array> {
  if (cachedWhoosh && cachedWhoosh.sampleRate === sampleRate) return cachedWhoosh.data;

  const frames = Math.floor(WHOOSH_DURATION_SEC * sampleRate);
  const ctx = new OfflineAudioContext(2, frames, sampleRate);

  // Mono noise buffer — cheaper than stereo and we duplicate it across channels
  // at the gain node so both ears get identical hits.
  const noiseBuf = ctx.createBuffer(1, frames, sampleRate);
  const noiseCh = noiseBuf.getChannelData(0);
  for (let i = 0; i < frames; i++) noiseCh[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;

  // Downward-swept lowpass gives the "whoosh" feel — bright opening,
  // sub-y tail.
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.9;
  lp.frequency.setValueAtTime(4500, 0);
  lp.frequency.exponentialRampToValueAtTime(180, WHOOSH_DURATION_SEC);

  // Volume envelope: ~25ms linear attack, then exponential decay.
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, 0);
  gain.gain.linearRampToValueAtTime(0.6, 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, WHOOSH_DURATION_SEC);

  // Mono → stereo (UpMixer): default channel-count handling on AudioContext
  // duplicates the mono source across both channels of the destination.
  noise.connect(lp).connect(gain).connect(ctx.destination);
  noise.start();

  const rendered = await ctx.startRendering();
  const len = rendered.length;
  const out = new Float32Array(len * 2);
  const l = rendered.numberOfChannels > 0 ? rendered.getChannelData(0) : null;
  const r = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : l;
  if (!l || !r) return new Float32Array(0);
  for (let i = 0; i < len; i++) {
    out[i * 2] = l[i];
    out[i * 2 + 1] = r[i];
  }
  cachedWhoosh = { sampleRate, data: out };
  return out;
}

/**
 * Build a silent stereo f32le PCM track of `outputDurationSec` and paste the
 * whoosh at each B-roll boundary. Returns the raw bytes ready for ffmpeg as a
 * `-f f32le -ar SR -ac 2` input. Pass output-time boundary seconds (e.g. the
 * encoder's `startFrame / fps`), not source-time — the audio track this gets
 * mixed into is always on the output timeline.
 */
export async function buildBrollSfxTrack(
  boundariesOutSec: number[],
  outputDurationSec: number,
  sampleRate = 44100,
): Promise<Uint8Array | null> {
  if (!boundariesOutSec.length || outputDurationSec <= 0) return null;

  let whoosh: Float32Array;
  try {
    whoosh = await renderWhoosh(sampleRate);
  } catch {
    return null; // OfflineAudioContext unavailable / failed — skip SFX gracefully
  }
  if (!whoosh.length) return null;

  const totalFrames = Math.ceil(outputDurationSec * sampleRate);
  const track = new Float32Array(totalFrames * 2);
  // Lead the cut by 80ms so the whoosh's loudest moment lands ~on the cut.
  const leadSec = 0.08;

  for (const tSec of boundariesOutSec) {
    const startFrame = Math.max(0, Math.floor((tSec - leadSec) * sampleRate));
    const startSample = startFrame * 2;
    const copyLen = Math.min(whoosh.length, track.length - startSample);
    if (copyLen <= 0) continue;
    // Additive blend so overlapping whooshes (back-to-back cuts) don't replace
    // each other.
    for (let i = 0; i < copyLen; i++) track[startSample + i] += whoosh[i];
  }

  // Float32 view → byte view for the ffmpeg input.
  return new Uint8Array(track.buffer, track.byteOffset, track.byteLength);
}
