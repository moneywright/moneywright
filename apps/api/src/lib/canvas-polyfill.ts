/**
 * Canvas polyfills for pdfjs-dist in Bun runtime
 *
 * pdfjs-dist (used by pdf-parse) requires DOMMatrix, ImageData, and Path2D
 * which don't exist in Node.js/Bun environments. These minimal stubs prevent
 * the "DOMMatrix is not defined" error when building standalone binaries.
 *
 * IMPORTANT: This file must have NO imports to ensure polyfills are applied
 * before any other code runs. ES module imports are hoisted, so any import
 * statement would execute before the polyfill code.
 *
 * Note: These are minimal stubs for text extraction only. If you need actual
 * canvas rendering, you'd need @napi-rs/canvas or similar.
 */

// Minimal DOMMatrix implementation
class DOMMatrixPolyfill {
  a = 1
  b = 0
  c = 0
  d = 1
  e = 0
  f = 0
  m11 = 1
  m12 = 0
  m13 = 0
  m14 = 0
  m21 = 0
  m22 = 1
  m23 = 0
  m24 = 0
  m31 = 0
  m32 = 0
  m33 = 1
  m34 = 0
  m41 = 0
  m42 = 0
  m43 = 0
  m44 = 1
  is2D = true
  isIdentity = true

  constructor(init?: string | number[]) {
    if (Array.isArray(init) && init.length === 6) {
      this.a = init[0]!
      this.b = init[1]!
      this.c = init[2]!
      this.d = init[3]!
      this.e = init[4]!
      this.f = init[5]!
      this.m11 = this.a
      this.m12 = this.b
      this.m21 = this.c
      this.m22 = this.d
      this.m41 = this.e
      this.m42 = this.f
    }
  }

  multiply() {
    return new DOMMatrixPolyfill()
  }
  translate() {
    return new DOMMatrixPolyfill()
  }
  scale() {
    return new DOMMatrixPolyfill()
  }
  rotate() {
    return new DOMMatrixPolyfill()
  }
  inverse() {
    return new DOMMatrixPolyfill()
  }
  transformPoint(point: { x: number; y: number }) {
    return { x: point.x, y: point.y, z: 0, w: 1 }
  }
  toFloat32Array() {
    return new Float32Array([
      this.m11,
      this.m12,
      this.m13,
      this.m14,
      this.m21,
      this.m22,
      this.m23,
      this.m24,
      this.m31,
      this.m32,
      this.m33,
      this.m34,
      this.m41,
      this.m42,
      this.m43,
      this.m44,
    ])
  }
  toFloat64Array() {
    return new Float64Array([
      this.m11,
      this.m12,
      this.m13,
      this.m14,
      this.m21,
      this.m22,
      this.m23,
      this.m24,
      this.m31,
      this.m32,
      this.m33,
      this.m34,
      this.m41,
      this.m42,
      this.m43,
      this.m44,
    ])
  }
}

// Minimal ImageData implementation
class ImageDataPolyfill {
  readonly width: number
  readonly height: number
  readonly data: Uint8ClampedArray
  readonly colorSpace: string = 'srgb'

  constructor(sw: number, sh: number)
  constructor(data: Uint8ClampedArray, sw: number, sh?: number)
  constructor(dataOrWidth: Uint8ClampedArray | number, swOrHeight: number, sh?: number) {
    if (dataOrWidth instanceof Uint8ClampedArray) {
      this.data = dataOrWidth
      this.width = swOrHeight
      this.height = sh ?? dataOrWidth.length / (4 * swOrHeight)
    } else {
      this.width = dataOrWidth
      this.height = swOrHeight
      this.data = new Uint8ClampedArray(this.width * this.height * 4)
    }
  }
}

// Minimal Path2D implementation
class Path2DPolyfill {
  private commands: string[] = []

  constructor(path?: Path2DPolyfill | string) {
    if (typeof path === 'string') {
      this.commands.push(path)
    }
  }

  addPath() {}
  closePath() {
    this.commands.push('Z')
  }
  moveTo(x: number, y: number) {
    this.commands.push(`M${x},${y}`)
  }
  lineTo(x: number, y: number) {
    this.commands.push(`L${x},${y}`)
  }
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) {
    this.commands.push(`C${cp1x},${cp1y},${cp2x},${cp2y},${x},${y}`)
  }
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {
    this.commands.push(`Q${cpx},${cpy},${x},${y}`)
  }
  arc() {}
  arcTo() {}
  ellipse() {}
  rect(x: number, y: number, w: number, h: number) {
    this.commands.push(`M${x},${y}h${w}v${h}h${-w}Z`)
  }
  roundRect() {}
}

// Apply polyfills to globalThis IMMEDIATELY
if (typeof globalThis.DOMMatrix === 'undefined') {
  // @ts-expect-error - Polyfilling global
  globalThis.DOMMatrix = DOMMatrixPolyfill
}

if (typeof globalThis.ImageData === 'undefined') {
  // @ts-expect-error - Polyfilling global
  globalThis.ImageData = ImageDataPolyfill
}

if (typeof globalThis.Path2D === 'undefined') {
  // @ts-expect-error - Polyfilling global
  globalThis.Path2D = Path2DPolyfill
}

export {}
