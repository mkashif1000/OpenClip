// Run from the repository root: node --test packages/frontend/tests/unit/auto-split.cjs
// Deterministic policy and pipeline tests; detector/decoder are isolated, not an accuracy benchmark.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const services = path.resolve(__dirname, '../../src/services');

function loadTs(name, dependencies = {}, globals = {}) {
  const filename = path.join(services, name);
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, Uint8ClampedArray, Uint8Array, Int32Array, console: { ...console, warn() {} }, ...globals,
    require(id) {
      assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency: ${id}`);
      return dependencies[id];
    },
  }, { filename });
  return exports;
}

const policy = loadTs('autoSplitPolicy.ts');
const screenPolicy = loadTs('screenSharePolicy.ts', { './autoSplitPolicy': policy });
const detection = (x, score = 0.96, side = 85) => ({
  boundingBox: { originX: x, originY: 115, width: side, height: side },
  categories: [{ score }],
});
const two = () => [detection(125), detection(540)];
const pair = () => policy.selectAutoSplitFaces(two(), 768, 432);

test('strict two-face selection rejects uncertain, tiny, duplicate, partial and third faces', () => {
  assert.ok(pair());
  for (const detections of [[], [detection(125)], [detection(125), detection(540, .84)],
    [detection(125), detection(540, .96, 20)], [detection(125), detection(130)],
    [detection(-5), detection(540)], [...two(), detection(350, .41, 12)],
    [detection(125), { boundingBox: detection(540).boundingBox }],
    [detection(125), detection(540, NaN)]]) {
    assert.equal(policy.selectAutoSplitFaces(detections, 768, 432), null);
  }
});

test('both crops stay bounded, match pane aspect and exclude the other face', () => {
  const faces = pair();
  const crops = policy.buildAutoSplitCrops(faces, 1920, 1080, 720, 1280);
  assert.ok(crops);
  crops.forEach((crop, i) => {
    assert.ok(crop.x >= 0 && crop.y >= 0 && crop.x + crop.w <= 1 && crop.y + crop.h <= 1);
    assert.ok(Math.abs(crop.w * 1920 / (crop.h * 1080) - 720 / 640) < 1e-10);
    assert.equal(policy.autoSplitRectsOverlap(crop, faces[1 - i]), false);
    assert.ok(policy.autoSplitRectsOverlap(crop, faces[i]));
  });
  assert.equal(policy.buildAutoSplitCrops(faces, 1920, 1080, 1280, 720), null);
});

test('presence never interpolates and short runs are removed with inward boundary guards', () => {
  assert.equal(policy.getAutoSplitRunWindow(0, 1, 30, 0), null);
  assert.equal(policy.getAutoSplitRunWindow(0, 13, 30, 400000), null);
  assert.equal(policy.getAutoSplitRunWindow(0, 30, 30, 0), null);
  const span = policy.getAutoSplitRunWindow(10, 40, 30, 966667);
  assert.equal(span.start, 12);
  assert.equal(span.end, 38);
});

test('cuts, geometry jumps, stale frames and edited time jumps break continuity', () => {
  assert.equal(policy.isAutoSplitPairContinuous(pair(), pair()), true);
  const shifted = pair().map(face => ({ ...face, x: face.x + .1 }));
  assert.equal(policy.isAutoSplitPairContinuous(pair(), shifted), false);
  assert.equal(policy.isAutoSplitSourceFrameFresh(1, 1000000), true);
  assert.equal(policy.isAutoSplitSourceFrameFresh(1.2, 1000000), false);
  assert.equal(policy.isAutoSplitSourceFrameFresh(1, 1033333), false);
  assert.equal(policy.isAutoSplitSourceContinuous(1, 1 + 1 / 30, 1000000, 1033333, 30), true);
  assert.equal(policy.isAutoSplitSourceContinuous(1, 2, 1000000, 2000000, 30), false);
  assert.equal(policy.isAutoSplitHardCut(new Uint8Array(16), new Uint8Array(16)), false);
  assert.equal(policy.isAutoSplitHardCut(new Uint8Array(16), new Uint8Array(16).fill(255)), true);
});

async function analyze({ count = 60, times, facesAt = () => two(), cutAt = Infinity,
  failAt = Infinity, timestampAt, abortAt = Infinity, dropLast = false,
  autoSplitFaces = true, autoSplitScreenShare = false, screenAt = () => null } = {}) {
  const frameSrcTimes = times ?? Float64Array.from({ length: count }, (_, i) => i / 30);
  let current = -1;
  const controller = new AbortController();
  const progress = [];
  const { buildAutoSplitFrames } = loadTs('autoSplitAnalyzer.ts', {
    './autoSplitPolicy': policy,
    './screenSharePolicy': { ...screenPolicy, analyzeScreenShareFrame: () => screenAt(current) },
    './screenShareDetector': { detectScreenShareFaces: (_d, _s, _w, _h, _c, faces) => faces },
    './faceTracker': { getFaceDetector: async () => ({ detect: () => ({ detections: facesAt(current) }) }) },
    './mp4Decoder': { decodeClipFrames: async job => {
      assert.equal(job.frameTimes.total, frameSrcTimes.length);
      for (let i = 0; i < frameSrcTimes.length - Number(dropLast); i++) {
        current = i;
        assert.equal(job.frameTimes.at(i), frameSrcTimes[i]);
        if (i === failAt) throw new Error('Decode failed midway');
        if (i === abortAt) controller.abort();
        job.onFrame({ timestamp: timestampAt ? timestampAt(i) : Math.round(frameSrcTimes[i] * 1e6),
          displayWidth: 1920, displayHeight: 1080 }, i);
      }
      return frameSrcTimes.length - Number(dropLast);
    } },
  }, { document: { createElement: () => ({ width: 0, height: 0, getContext: () => ({
    drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(32 * 18 * 4).fill(current >= cutAt ? 255 : 0) }),
  }) }) } });
  const frames = await buildAutoSplitFrames({ file: {}, frameSrcTimes, fps: 30,
    outputWidth: 720, outputHeight: 1280, autoSplitFaces, autoSplitScreenShare,
    signal: controller.signal, onProgress: n => progress.push(n) });
  return { frames, progress };
}

test('exact-frame analyzer splits sustained shots, never single-face or one-frame flashes', async () => {
  const { frames, progress } = await analyze();
  assert.deepEqual(Array.from(frames, (frame, i) => frame ? i : null).filter(i => i !== null),
    Array.from({ length: 56 }, (_, i) => i + 2));
  assert.equal(frames[20].sourceTimestampUs, Math.round(20 / 30 * 1e6));
  assert.equal(progress.at(-1), 60);
  const single = await analyze({ facesAt: () => [detection(125)] });
  const flash = await analyze({ facesAt: i => i === 30 ? two() : [detection(125)] });
  assert.ok(single.frames.every(frame => frame === null));
  assert.ok(flash.frames.every(frame => frame === null));
});

test('a single unverified normal frame is never bridged or carried forward', async () => {
  const { frames } = await analyze({ facesAt: i => i === 30 ? [detection(125)] : two() });
  assert.ok(frames[27] && frames[33]);
  for (let i = 28; i <= 32; i++) assert.equal(frames[i], null, `normal-frame guard at ${i}`);
});

test('scene cuts and silence cuts get separate guarded split runs', async () => {
  const scene = await analyze({ cutAt: 30 });
  const times = Float64Array.from({ length: 60 }, (_, i) => i / 30 + (i >= 30 ? 4 : 0));
  const edited = await analyze({ times });
  for (const { frames } of [scene, edited]) {
    assert.ok(frames[27] && frames[32]);
    for (let i = 28; i <= 31; i++) assert.equal(frames[i], null);
  }
  assert.equal(edited.frames[32].sourceTimestampUs, Math.round(times[32] * 1e6));
});

test('decoder failure/incomplete passes fail closed and cancellation propagates', async () => {
  assert.ok((await analyze({ failAt: 40 })).frames.every(frame => frame === null));
  assert.ok((await analyze({ dropLast: true })).frames.every(frame => frame === null));
  assert.ok((await analyze({ timestampAt: () => 0 })).frames.every(frame => frame === null));
  await assert.rejects(analyze({ abortAt: 35 }), { name: 'AbortError' });
});

function renderer() {
  const images = [], subtitles = [], fills = [];
  const geometry = { SPLIT_LAYOUTS: new Set(), getSplitRegions: () => [],
    getBoxRect: (w, h) => ({ x: 0, y: 0, w, h, radius: 0 }), roundRect() {} };
  const { renderFrame } = loadTs('canvasRenderer.ts', {
    '@viral-clipper/shared/rendering/subtitleConfig': { subtitleStyleFromConfig: style => ({ ...style }) },
    '@viral-clipper/shared/rendering/titleConfig': { titleStyleFromConfig: style => style },
    '@viral-clipper/shared/rendering/overlays': {
      drawTitleOverlay() {}, drawLogoOverlay() {},
      drawSubtitleOverlay: (_ctx, _entries, _time, _start, style) => subtitles.push(style),
    },
    '@viral-clipper/shared/rendering/geometry': geometry,
  });
  const ctx = new Proxy({ drawImage: (...args) => images.push(args), fillRect: (...args) => fills.push(args) }, {
    get: (target, key) => target[key] ?? (() => {}),
  });
  const styleConfig = { export: { auto_split_faces: true, auto_split_center_captions: true },
    subtitle: { margin_v: 120, enabled: true }, title: {} };
  const source = { timestamp: 1000000, displayWidth: 1920, displayHeight: 1080 };
  const candidate = { sourceTimestampUs: 1000000,
    crops: policy.buildAutoSplitCrops(pair(), 1920, 1080, 720, 1280) };
  const base = { video: source, canvas: { getContext: () => ctx },
    currentTimeSec: 1, clipStartSec: 0, clip: { title: '', entries: [{}] },
    styleConfig, width: 720, height: 1280, layoutType: 'standard', autoSplitFrame: candidate };
  return { draw: changes => renderFrame({ ...base, ...changes }), images, subtitles, fills, base, candidate };
}

test('rendering uses different aspect-correct crops and centers only actual split captions', () => {
  const r = renderer();
  r.draw();
  assert.equal(r.images.length, 2);
  assert.equal(r.images[0].length, 9);
  assert.deepEqual(r.images[0].slice(5), [0, 0, 720, 640]);
  assert.deepEqual(r.images[1].slice(5), [0, 640, 720, 640]);
  assert.notEqual(r.images[0][1], r.images[1][1]);
  assert.equal(r.subtitles[0].visualCenterY, 640);
  assert.equal(r.subtitles[0].positionX, 50);
  assert.equal(r.subtitles[0].textAlign, 'center');
  assert.equal(r.base.styleConfig.subtitle.visualCenterY, undefined);
  r.draw({ autoSplitFrame: null });
  assert.equal(r.images.length, 3);
  assert.equal(r.subtitles[1].visualCenterY, undefined);
  assert.equal(r.subtitles[1].margin_v, 120);
});

test('timestamp mismatch, unverified seeking, bad crops and disabled parent all stay unsplit', () => {
  const cases = [r => ({ video: { ...r.base.video, timestamp: 1000001 } }),
    r => ({ video: { ...r.base.video, videoWidth: 1920, videoHeight: 1080 } }),
    r => ({ video: { displayWidth: 1920, displayHeight: 1080 } }),
    r => ({ autoSplitFrame: { ...r.candidate, crops: [{ x: -1, y: 0, w: 1, h: 1 }, r.candidate.crops[1]] } }),
    r => ({ autoSplitFrame: { ...r.candidate, crops: [r.candidate.crops[0], r.candidate.crops[0]] } }),
    r => ({ styleConfig: { ...r.base.styleConfig, export: { auto_split_faces: false, auto_split_center_captions: true } } }),
    () => ({ width: 1280, height: 720 }), () => ({ layoutType: 'boxed' })];
  for (const change of cases) {
    const r = renderer(); r.draw(change(r));
    assert.equal(r.images.length, 1);
    assert.equal(r.subtitles[0].visualCenterY, undefined);
  }
});

test('caption preference is independent, preserves disabled captions and never mutates stored style', () => {
  for (const enabled of [true, false]) {
    const r = renderer();
    const styleConfig = { ...r.base.styleConfig, subtitle: { enabled, margin_v: 77 },
      export: { auto_split_faces: true, auto_split_center_captions: false } };
    r.draw({ styleConfig });
    assert.equal(r.images.length, 2);
    assert.equal(r.subtitles[0].visualCenterY, undefined);
    assert.equal(r.subtitles[0].enabled, enabled);
    assert.deepEqual(styleConfig.subtitle, { enabled, margin_v: 77 });
  }
});

function screenPixels({ document = true, webcam = true, mirrorX = false, mirrorY = false } = {}) {
  const width = 768, height = 432;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const put = (x, y, rgb) => {
    x = mirrorX ? width - x - 1 : x; y = mirrorY ? height - y - 1 : y;
    pixels.set([...rgb, 255], (y * width + x) * 4);
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) put(x, y, [0, 0, 0]);
  if (webcam) for (let y = 270; y < 414; y++) for (let x = 24; x < 280; x++) {
    const variation = (x * 7 + y * 11) % 70;
    put(x, y, [110 + variation, 35 + variation, 45 + variation]);
  }
  if (document) {
    for (let y = 130; y < 250; y++) for (let x = 330; x < 555; x++) put(x, y, [245, 245, 245]);
    for (let y = 143; y < 239; y += 9) for (let x = 342; x < 541; x += 9) {
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) put(x + dx, y + dy, [20, 20, 20]);
    }
  }
  const x = 105, y = 301, w = 59, h = 61;
  const face = { boundingBox: { originX: mirrorX ? width - x - w : x,
    originY: mirrorY ? height - y - h : y, width: w, height: h }, categories: [{ score: .97 }] };
  return { pixels, width, height, sourceWidth: width, sourceHeight: height,
    outputWidth: 720, outputHeight: 1280, detections: [face] };
}

test('screen-share requires both rectangular inset proof and external text proof', () => {
  const image = screenPixels();
  const result = screenPolicy.analyzeScreenShareFrame(image);
  assert.ok(result, 'verified textured inset plus document should be accepted');
  assert.equal(result.splitRatio, .6);
  assert.ok(Math.abs(result.webcam.x - 24 / 768) < .005);
  assert.ok(result.crops[0].x > .4 && result.crops[0].w < .35, 'isolated document is enlarged');
  assert.equal(screenPolicy.analyzeScreenShareFrame(screenPixels({ document: false })), null);
  assert.equal(screenPolicy.analyzeScreenShareFrame(screenPixels({ webcam: false })), null);
  assert.equal(screenPolicy.analyzeScreenShareFrame({ ...image, detections: [...image.detections, detection(400)] }), null);
  assert.equal(screenPolicy.analyzeScreenShareFrame({ ...image, pixels: new Uint8ClampedArray(4) }), null);
  assert.equal(screenPolicy.analyzeScreenShareFrame({ ...image, detections: [{ ...image.detections[0], categories: [{ score: .84 }] }] }), null);
});

test('verified inset geometry supports all four corners', () => {
  for (const mirrorX of [false, true]) for (const mirrorY of [false, true]) {
    const result = screenPolicy.analyzeScreenShareFrame(screenPixels({ mirrorX, mirrorY }));
    assert.ok(result, `corner x=${mirrorX} y=${mirrorY}`);
    assert.equal(result.webcam.x > .5, mirrorX);
    assert.equal(result.webcam.y < .5, mirrorY);
  }
});

test('screen-share-only analysis and mode switches have independently guarded runs', async () => {
  const candidate = screenPolicy.analyzeScreenShareFrame(screenPixels());
  assert.ok(candidate);
  const only = await analyze({ autoSplitFaces: false, autoSplitScreenShare: true,
    screenAt: () => candidate, facesAt: () => [] });
  assert.equal(only.frames[15].kind, 'screen-share');
  assert.equal(only.frames[15].splitRatio, .6);
  const disabled = await analyze({ autoSplitFaces: false, screenAt: () => candidate });
  assert.ok(disabled.frames.every(frame => frame === null));
  const changed = await analyze({ autoSplitScreenShare: true, screenAt: i => i < 30 ? candidate : null });
  for (let i = 28; i < 32; i++) assert.equal(changed.frames[i], null);
  assert.equal(changed.frames[27].kind, 'screen-share');
  assert.equal(changed.frames[32].kind, undefined);
  const miss = await analyze({ autoSplitFaces: false, autoSplitScreenShare: true,
    screenAt: i => i === 30 ? null : candidate });
  for (let i = 28; i < 33; i++) assert.equal(miss.frames[i], null);
});

test('screen-share renderer accepts the tight document and centers captions on its actual 60/40 seam', () => {
  const r = renderer();
  const candidate = { ...screenPolicy.analyzeScreenShareFrame(screenPixels()), kind: 'screen-share', sourceTimestampUs: 1000000 };
  r.draw({ autoSplitFrame: candidate, styleConfig: { ...r.base.styleConfig,
    export: { auto_split_screen_share: true, auto_split_faces: false, auto_split_center_captions: true } } });
  assert.equal(r.images.length, 2);
  const [screen, speaker] = r.images;
  assert.ok(screen[6] > 0, 'content has letterboxing rather than being cropped to fill');
  assert.ok(Math.abs(screen[3] / screen[4] - screen[7] / screen[8]) < 1e-10);
  assert.deepEqual(speaker.slice(5), [0, 768, 720, 512]);
  assert.equal(r.subtitles[0].visualCenterY, 768);
});

test('screen-share full-screen fallback masks original inset and preserves screen aspect', () => {
  const r = renderer();
  const screen = screenPolicy.analyzeScreenShareFrame(screenPixels());
  const candidate = { ...screen, crops: [{ x: 0, y: 0, w: 1, h: 1 }, screen.crops[1]],
    kind: 'screen-share', sourceTimestampUs: 1000000 };
  r.draw({ autoSplitFrame: candidate, styleConfig: { ...r.base.styleConfig,
    export: { auto_split_screen_share: true, auto_split_center_captions: false } } });
  assert.equal(r.images.length, 2);
  assert.equal(r.fills.length, 2, 'black canvas and mask only');
  assert.ok(r.fills[1][1] + r.fills[1][3] <= 768, 'webcam mask never crosses the seam');
  assert.equal(r.subtitles[0].visualCenterY, undefined);
});

test('wrong mode, invalid inset/ratio, disabled screen switch and stale timestamps fail closed', () => {
  const screen = screenPolicy.analyzeScreenShareFrame(screenPixels());
  const base = { ...screen, kind: 'screen-share', sourceTimestampUs: 1000000 };
  for (const candidate of [{ ...base, kind: 'unknown' }, { ...base, splitRatio: .5 },
    { ...base, webcam: { x: 0, y: 0, w: 1, h: 1 } },
    { ...base, crops: [screen.webcam, screen.crops[1]] },
    { ...base, sourceTimestampUs: 1000001 }]) {
    const r = renderer();
    r.draw({ autoSplitFrame: candidate, styleConfig: { ...r.base.styleConfig,
      export: { auto_split_screen_share: true, auto_split_faces: true, auto_split_center_captions: true } } });
    assert.equal(r.images.length, 1);
    assert.equal(r.subtitles[0].visualCenterY, undefined);
  }
  const r = renderer(); r.draw({ autoSplitFrame: base });
  assert.equal(r.images.length, 1, 'two-face preference does not enable screen-share');
});

test('corner detector maps coordinates, deduplicates only same-face reports and preserves inputs', () => {
  const { detectScreenShareFaces } = loadTs('screenShareDetector.ts');
  const full = [{ boundingBox: { originX: 100, originY: 280, width: 50, height: 60 }, categories: [{ score: .86 }] }];
  const original = JSON.stringify(full);
  const quad = (x, y, w, h, score) => ({ boundingBox: { originX: x, originY: y, width: w, height: h }, categories: [{ score }] });
  const reports = [[], [quad(150, 60, 80, 90, .7)], [quad(200, 128, 100, 120, .96)],
    [quad(0, 0, 50, 50, .99)]];
  let i = 0;
  const scratch = { width: 768, height: 432, getContext: () => ({ setTransform() {}, clearRect() {}, drawImage() {} }) };
  const faces = detectScreenShareFaces({ detect: () => ({ detections: reports[i++] }) }, {}, 768, 432, scratch, full);
  assert.equal(i, 4);
  assert.equal(faces.length, 2, 'one same-face duplicate merged, another ambiguous face retained');
  assert.equal(faces[0].boundingBox.originY, 280);
  assert.equal(faces[0].categories[0].score, .96);
  assert.equal(faces[1].boundingBox.originX, 459);
  assert.equal(JSON.stringify(full), original);
});
