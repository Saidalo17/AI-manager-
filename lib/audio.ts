/**
 * Чистка PCM (16-bit mono) от артефактов Gemini TTS.
 *
 * Модель добавляет в начало и конец записи короткие всплески шума. Они всегда отделены от речи
 * цифровой тишиной (точные нули), а в самой речи, даже в паузах, нулей не бывает.
 * Поэтому: короткий (≤ 300 мс) отрезок звука, отделённый от остального звука цифровой
 * тишиной ≥ 20 мс, — это артефакт. Снимаем такие отрезки по одному с обоих концов.
 * Затем плавное нарастание/затухание и немного тишины в конце, чтобы плеер не щёлкал.
 * Если осталось меньше половины записи — возвращаем исходную (только с фейдами).
 */
export function cleanPcm(pcm: Buffer, rate: number): Buffer {
  const total = Math.floor(pcm.length / 2);
  const win = Math.round(rate / 100); // окно 10 мс
  const nw = Math.floor(total / win);
  const silent: boolean[] = [];
  for (let w = 0; w < nw; w++) {
    let t = 0;
    for (let i = w * win; i < (w + 1) * win; i++) t += pcm.readInt16LE(i * 2) ** 2;
    silent.push(Math.sqrt(t / win) < 50);
  }
  const MAX_BURST = 30; // ≤ 300 мс
  const MIN_GAP = 2; // ≥ 20 мс цифровой тишины

  let lo = 0;
  let hi = nw;

  // хвост: [звук][тишина ≥20мс][короткий всплеск][тишина?] -> снимаем всплеск
  for (;;) {
    let e = hi;
    while (e > lo && silent[e - 1]) e--; // конец последнего звука
    let s0 = e;
    while (s0 > lo && !silent[s0 - 1]) s0--; // начало последнего звука
    let g = s0;
    while (g > lo && silent[g - 1]) g--; // тишина перед ним
    const hasSoundBefore = g > lo;
    if (e > lo && hasSoundBefore && s0 - g >= MIN_GAP && e - s0 <= MAX_BURST) hi = g;
    else break;
  }

  // начало: [короткий всплеск][тишина ≥20мс][звук] -> снимаем всплеск
  for (;;) {
    let s0 = lo;
    while (s0 < hi && silent[s0]) s0++;
    let e = s0;
    while (e < hi && !silent[e]) e++;
    let g = e;
    while (g < hi && silent[g]) g++;
    const hasSoundAfter = g < hi;
    if (s0 < hi && hasSoundAfter && g - e >= MIN_GAP && e - s0 <= MAX_BURST) lo = g;
    else break;
  }

  let out = Buffer.from(pcm.subarray(lo * win * 2, hi * win * 2));
  if (out.length < pcm.length * 0.5) out = Buffer.from(pcm); // подстраховка: не режем речь

  const n = out.length / 2;
  const fade = Math.min(Math.round(rate * 0.02), Math.floor(n / 2)); // 20 мс
  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    out.writeInt16LE(Math.round(out.readInt16LE(i * 2) * g), i * 2);
    const j = n - 1 - i;
    out.writeInt16LE(Math.round(out.readInt16LE(j * 2) * g), j * 2);
  }
  return Buffer.concat([out, Buffer.alloc(Math.round(rate * 0.12) * 2)]); // +120 мс тишины
}
