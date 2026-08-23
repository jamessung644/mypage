/*
 * Spherical eye projection adapted from jeremy-prt/bloub.
 * Copyright (c) 2026 Jérémy Perret — MIT License; see THIRD_PARTY_NOTICES.md.
 */
(function exposeBloubGaze(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BloubGaze = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createBloubGaze() {
  const TAU = Math.PI * 2;
  const BASE_GAZE = Object.freeze({ yaw: 6, pitch: -14, roll: 0 });
  const EYE_SPLIT = 19.5;
  const YAW_MAX = 16;
  const PITCH_UPPER = 13;
  const PITCH_LOWER = -27;
  const LOOK_MORPH = .24;
  const EYE_PATH = 'M-20 -8A20 20 0 0 1 0 -28L0 -28A20 20 0 0 1 20 -8L20 8A20 20 0 0 1 0 28L0 28A20 20 0 0 1 -20 8Z';
  const EYE_TILTS = [-10, 10];

  const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
  const lerp = (from, to, amount) => from + (to - from) * amount;
  const degrees = (value) => value * Math.PI / 180;
  const round = (value) => Math.round(value * 100) / 100;
  const easeOutQuint = (value) => 1 - (1 - value) ** 5;

  function spin(first, second, angle) {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return [
      [
        first[0] * cosine + second[0] * sine,
        first[1] * cosine + second[1] * sine,
        first[2] * cosine + second[2] * sine,
      ],
      [
        second[0] * cosine - first[0] * sine,
        second[1] * cosine - first[1] * sine,
        second[2] * cosine - first[2] * sine,
      ],
    ];
  }

  function lookTarget(normalizedX, normalizedY) {
    const x = clamp(normalizedX, -1, 1);
    const y = clamp(normalizedY, -1, 1);
    return {
      yaw: BASE_GAZE.yaw + x * YAW_MAX,
      pitch: y < 0
        ? lerp(BASE_GAZE.pitch, PITCH_UPPER, -y)
        : lerp(BASE_GAZE.pitch, PITCH_LOWER, y),
      roll: BASE_GAZE.roll,
    };
  }

  function eyePoses(gaze, scale = 100, split = EYE_SPLIT) {
    let forward = [0, 0, 1];
    let right = [1, 0, 0];
    let down = [0, 1, 0];

    [forward, right] = spin(forward, right, degrees(gaze.yaw));
    [down, forward] = spin(down, forward, degrees(gaze.pitch));
    [right, down] = spin(right, down, degrees(gaze.roll));

    return [-1, 1].map((side) => {
      const [eyeForward, eyeRight] = spin(forward, right, degrees(split * side));
      return {
        x: eyeForward[0] * scale,
        y: eyeForward[1] * scale,
        a: eyeRight[0],
        b: eyeRight[1],
        c: down[0],
        d: down[1],
        depth: eyeForward[2],
      };
    });
  }

  function blinkScale(lid) {
    return .06 + .94 * clamp(lid);
  }

  function eyeFrames(gaze, lid = 1) {
    const verticalScale = blinkScale(lid);
    return eyePoses(gaze).map((eye, index) => {
      const tilt = degrees(EYE_TILTS[index]);
      const cosine = Math.cos(tilt);
      const sine = Math.sin(tilt);
      const a = eye.a * cosine + eye.c * sine;
      const b = (eye.b * cosine + eye.d * sine) * verticalScale;
      const c = -eye.a * sine + eye.c * cosine;
      const d = (-eye.b * sine + eye.d * cosine) * verticalScale;
      const matrix = [a, b, c, d, eye.x, eye.y];
      return {
        path: EYE_PATH,
        matrix,
        transform: `matrix(${matrix.map(round).join(' ')})`,
        opacity: clamp(eye.depth / .12),
      };
    });
  }

  function easeGaze(from, to, seconds) {
    const amount = easeOutQuint(clamp(seconds / LOOK_MORPH));
    return {
      yaw: lerp(from.yaw, to.yaw, amount),
      pitch: lerp(from.pitch, to.pitch, amount),
      roll: lerp(from.roll, to.roll, amount),
    };
  }

  function loopNoise(time, period, seed = 0) {
    const phase = time / period * TAU;
    return .55 * Math.sin(phase + seed)
      + .3 * Math.sin(2 * phase + seed * 1.7 + 1.1)
      + .15 * Math.sin(3 * phase + seed * 2.3 + 2.4);
  }

  function createRng(seed) {
    let value = seed >>> 0;
    return () => {
      value = (value + 0x6d2b79f5) >>> 0;
      let mixed = Math.imul(value ^ value >>> 15, 1 | value);
      mixed = mixed + Math.imul(mixed ^ mixed >>> 7, 61 | mixed) ^ mixed;
      return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
    };
  }

  const blinkRng = createRng(0x5eed);
  const blinks = [];
  for (let time = 1.4; time < 900;) {
    blinks.push(time);
    time += 1.9 + blinkRng() * 2.7;
    if (blinkRng() < .18) {
      blinks.push(time);
      time += .24;
    }
  }

  function blinkLid(time) {
    for (const start of blinks) {
      if (time < start) break;
      const progress = (time - start) / .18;
      if (progress >= 0 && progress <= 1) {
        return progress < .45 ? 1 - progress / .45 : (progress - .45) / .55;
      }
    }
    return 1;
  }

  function liveliness(time) {
    return {
      dYaw: loopNoise(time, 11.3, .4) * 5.5 + loopNoise(time, 3.7, 2.1) * 1.6,
      dPitch: loopNoise(time, 9.1, 1.3) * 4.2 + loopNoise(time, 4.3, .7) * 1.3,
      dRoll: loopNoise(time, 13.7, 3.2) * 2.2,
      lid: blinkLid(time),
    };
  }

  return {
    BASE_GAZE,
    lookTarget,
    eyePoses,
    eyeFrames,
    easeGaze,
    liveliness,
  };
});
