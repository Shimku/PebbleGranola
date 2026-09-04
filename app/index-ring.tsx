"use client";

import { useEffect, useRef, useState } from "react";
import { RingMark } from "./mark";

type Face = "cream" | "epaper";
type Pose = "hero" | "dock";

const VS = `
attribute vec3 aPos;
attribute vec3 aNrm;
uniform mat4 uMVP;
uniform mat3 uN;
varying vec3 vN;
varying vec3 vP;
void main() {
  vN = uN * aNrm;
  vP = aPos;
  gl_Position = uMVP * vec4(aPos, 1.0);
}
`;

const FS = `
precision mediump float;
varying vec3 vN;
varying vec3 vP;
uniform vec3 uAlbedo;
uniform vec3 uLightA;
uniform vec3 uLightB;
uniform float uMetal;
uniform float uGloss;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(vec3(0.12, 0.28, 1.0));
  vec3 L1 = normalize(uLightA);
  vec3 L2 = normalize(uLightB);
  vec3 H1 = normalize(L1 + V);
  float ndl = max(dot(N, L1), 0.0) + 0.35 * max(dot(N, L2), 0.0);
  float spec = pow(max(dot(N, H1), 0.0), uGloss);
  vec3 env = mix(vec3(0.46, 0.47, 0.5), vec3(0.96, 0.96, 0.94), clamp(N.y * 0.5 + 0.5, 0.0, 1.0));
  vec3 base = mix(uAlbedo, env, uMetal * 0.32);
  vec3 col = base * (0.34 + 0.78 * ndl);
  col += vec3(0.98, 0.98, 0.99) * spec * mix(0.22, 1.05, uMetal);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.2);
  col += vec3(0.9, 0.91, 0.93) * rim * (0.16 + 0.28 * uMetal);
  gl_FragColor = vec4(col, 1.0);
}
`;

type Mesh = {
  count: number;
  pos: WebGLBuffer;
  nrm: WebGLBuffer;
  idx: WebGLBuffer;
};

export function IndexRing({
  face,
  busy,
  pose,
  reducedMotion,
}: {
  face: Face;
  busy: boolean;
  pose: Pose;
  reducedMotion: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceRef = useRef(face);
  const busyRef = useRef(busy);
  const reducedRef = useRef(reducedMotion);
  const poseRef = useRef(pose);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    faceRef.current = face;
    busyRef.current = busy;
    reducedRef.current = reducedMotion;
    poseRef.current = pose;
  }, [face, busy, reducedMotion, pose]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stop = startRing(canvas, {
      getFace: () => faceRef.current,
      getBusy: () => busyRef.current,
      getReduced: () => reducedRef.current,
      getPose: () => poseRef.current,
      onFail: () => setFallback(true),
    });
    return stop;
  }, []);

  if (fallback) {
    return (
      <div className={`ring-fallback is-${pose}`} aria-hidden>
        <RingMark size={pose === "hero" ? 168 : 88} />
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={`ring-canvas is-${pose}`}
      aria-hidden
    />
  );
}

function startRing(
  canvas: HTMLCanvasElement,
  opts: {
    getFace: () => Face;
    getBusy: () => boolean;
    getReduced: () => boolean;
    getPose: () => Pose;
    onFail: () => void;
  },
) {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
    depth: true,
  });
  if (!gl) {
    opts.onFail();
    return () => {};
  }

  const program = compile(gl, VS, FS);
  if (!program) {
    opts.onFail();
    return () => {};
  }

  const aPos = gl.getAttribLocation(program, "aPos");
  const aNrm = gl.getAttribLocation(program, "aNrm");
  const uMVP = gl.getUniformLocation(program, "uMVP");
  const uN = gl.getUniformLocation(program, "uN");
  const uAlbedo = gl.getUniformLocation(program, "uAlbedo");
  const uLightA = gl.getUniformLocation(program, "uLightA");
  const uLightB = gl.getUniformLocation(program, "uLightB");
  const uMetal = gl.getUniformLocation(program, "uMetal");
  const uGloss = gl.getUniformLocation(program, "uGloss");

  const torus = upload(gl, torusGeometry(1, 0.36, 48, 96));
  const disc = upload(gl, discGeometry(0.61, 48, 0.03));
  const core = upload(gl, discGeometry(0.27, 36, 0.05));
  const button = upload(gl, sphereGeometry(0.2, 20, 14, 0, -1.28, 0.12));

  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 0);

  let rotY = 0.55;
  let elapsed = 0;
  let frame = 0;
  let running = true;
  let visible = true;

  const io = new IntersectionObserver(
    ([entry]) => {
      visible = entry?.isIntersecting ?? true;
    },
    { threshold: 0.05 },
  );
  io.observe(canvas);

  const resize = () => {
    const parent = canvas.parentElement;
    const css = parent?.clientWidth || 280;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = Math.max(1, Math.floor(css * dpr));
    if (canvas.width !== size || canvas.height !== size) {
      canvas.width = size;
      canvas.height = size;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement || canvas);
  resize();

  let last = performance.now();

  const draw = (now: number) => {
    if (!running) return;
    frame = window.requestAnimationFrame(draw);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible) return;

    resize();
    elapsed += dt;
    const reduced = opts.getReduced();
    const busy = opts.getBusy();
    const face = opts.getFace();
    const pose = opts.getPose();

    if (!reduced) {
      const speed = busy ? 1.15 : pose === "hero" ? 0.32 : 0.22;
      rotY += dt * speed;
    }

    const baseTilt = pose === "hero" ? 0.62 : 1.08;
    const tiltX = reduced ? baseTilt : baseTilt + Math.sin(elapsed * 0.35) * 0.03;
    const spin = reduced ? 0.7 : rotY;
    const rx = rotateX(tiltX);
    const ry = rotateY(spin);
    const model = multiply(rx, ry);
    const view = translate(0, pose === "hero" ? 0.06 : 0.18, pose === "hero" ? -3.55 : -3.7);
    const proj = perspective(0.5, 1, 0.2, 12);
    const mvp = multiply(proj, multiply(view, model));
    const nrm = normal3(model);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniformMatrix4fv(uMVP, false, mvp);
    gl.uniformMatrix3fv(uN, false, nrm);

    const sweep = elapsed * (busy ? 2.4 : 0.7);
    gl.uniform3f(
      uLightA,
      0.42 + Math.cos(sweep) * 0.35,
      0.82,
      0.55 + Math.sin(sweep) * 0.28,
    );
    gl.uniform3f(uLightB, -0.7, 0.15, 0.45);

    bindMesh(gl, torus, aPos, aNrm);
    gl.uniform3f(uAlbedo, 0.545, 0.557, 0.576);
    gl.uniform1f(uMetal, 0.92);
    gl.uniform1f(uGloss, 52);
    gl.drawElements(gl.TRIANGLES, torus.count, gl.UNSIGNED_SHORT, 0);

    bindMesh(gl, disc, aPos, aNrm);
    if (face === "epaper") {
      gl.uniform3f(uAlbedo, 0.075, 0.075, 0.075);
      gl.uniform1f(uMetal, 0.08);
      gl.uniform1f(uGloss, 18);
    } else {
      gl.uniform3f(uAlbedo, 0.969, 0.969, 0.949);
      gl.uniform1f(uMetal, 0.04);
      gl.uniform1f(uGloss, 24);
    }
    gl.drawElements(gl.TRIANGLES, disc.count, gl.UNSIGNED_SHORT, 0);

    if (face === "cream") {
      bindMesh(gl, core, aPos, aNrm);
      gl.uniform3f(uAlbedo, 0.357, 0.435, 0.0);
      gl.uniform1f(uMetal, 0.12);
      gl.uniform1f(uGloss, 28);
      gl.drawElements(gl.TRIANGLES, core.count, gl.UNSIGNED_SHORT, 0);
    }

    bindMesh(gl, button, aPos, aNrm);
    gl.uniform3f(uAlbedo, 0.98, 0.29, 0.212);
    gl.uniform1f(uMetal, 0.42);
    gl.uniform1f(uGloss, 70);
    gl.drawElements(gl.TRIANGLES, button.count, gl.UNSIGNED_SHORT, 0);
  };

  frame = window.requestAnimationFrame(draw);

  return () => {
    running = false;
    window.cancelAnimationFrame(frame);
    io.disconnect();
    ro.disconnect();
    gl.deleteBuffer(torus.pos);
    gl.deleteBuffer(torus.nrm);
    gl.deleteBuffer(torus.idx);
    gl.deleteBuffer(disc.pos);
    gl.deleteBuffer(disc.nrm);
    gl.deleteBuffer(disc.idx);
    gl.deleteBuffer(core.pos);
    gl.deleteBuffer(core.nrm);
    gl.deleteBuffer(core.idx);
    gl.deleteBuffer(button.pos);
    gl.deleteBuffer(button.nrm);
    gl.deleteBuffer(button.idx);
    gl.deleteProgram(program);
  };
}

function compile(gl: WebGLRenderingContext, vsSrc: string, fsSrc: string) {
  const vs = gl.createShader(gl.VERTEX_SHADER);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!vs || !fs || !program) return null;
  gl.shaderSource(vs, vsSrc);
  gl.shaderSource(fs, fsSrc);
  gl.compileShader(vs);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(vs));
    return null;
  }
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(fs));
    return null;
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  return program;
}

function upload(
  gl: WebGLRenderingContext,
  geo: { positions: Float32Array; normals: Float32Array; indices: Uint16Array },
): Mesh {
  const pos = gl.createBuffer();
  const nrm = gl.createBuffer();
  const idx = gl.createBuffer();
  if (!pos || !nrm || !idx) {
    throw new Error("buffer");
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, pos);
  gl.bufferData(gl.ARRAY_BUFFER, geo.positions, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, nrm);
  gl.bufferData(gl.ARRAY_BUFFER, geo.normals, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idx);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.indices, gl.STATIC_DRAW);
  return { count: geo.indices.length, pos, nrm, idx };
}

function bindMesh(
  gl: WebGLRenderingContext,
  mesh: Mesh,
  aPos: number,
  aNrm: number,
) {
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.pos);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.nrm);
  gl.enableVertexAttribArray(aNrm);
  gl.vertexAttribPointer(aNrm, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.idx);
}

function torusGeometry(R: number, r: number, radial: number, tubular: number) {
  const positions: number[] = [];
  const normals: number[] = [];
  for (let j = 0; j <= radial; j += 1) {
    for (let i = 0; i <= tubular; i += 1) {
      const u = (i / tubular) * Math.PI * 2;
      const v = (j / radial) * Math.PI * 2;
      const cu = Math.cos(u);
      const su = Math.sin(u);
      const cv = Math.cos(v);
      const sv = Math.sin(v);
      positions.push((R + r * cv) * cu, (R + r * cv) * su, r * sv);
      normals.push(cv * cu, cv * su, sv);
    }
  }
  const indices: number[] = [];
  for (let j = 1; j <= radial; j += 1) {
    for (let i = 1; i <= tubular; i += 1) {
      const a = (tubular + 1) * j + i - 1;
      const b = (tubular + 1) * (j - 1) + i - 1;
      const c = (tubular + 1) * (j - 1) + i;
      const d = (tubular + 1) * j + i;
      indices.push(a, b, d, b, c, d);
    }
  }
  return packed(positions, normals, indices);
}

function discGeometry(radius: number, segments: number, z: number) {
  const positions = [0, 0, z];
  const normals = [0, 0, 1];
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    positions.push(Math.cos(a) * radius, Math.sin(a) * radius, z);
    normals.push(0, 0, 1);
  }
  const indices: number[] = [];
  for (let i = 1; i <= segments; i += 1) {
    indices.push(0, i, i + 1);
  }
  return packed(positions, normals, indices);
}

function sphereGeometry(
  radius: number,
  slices: number,
  stacks: number,
  ox: number,
  oy: number,
  oz: number,
) {
  const positions: number[] = [];
  const normals: number[] = [];
  for (let j = 0; j <= stacks; j += 1) {
    const v = (j / stacks) * Math.PI;
    const sv = Math.sin(v);
    const cv = Math.cos(v);
    for (let i = 0; i <= slices; i += 1) {
      const u = (i / slices) * Math.PI * 2;
      const cu = Math.cos(u);
      const su = Math.sin(u);
      const nx = sv * cu;
      const ny = cv;
      const nz = sv * su;
      positions.push(ox + nx * radius, oy + ny * radius, oz + nz * radius);
      normals.push(nx, ny, nz);
    }
  }
  const indices: number[] = [];
  for (let j = 0; j < stacks; j += 1) {
    for (let i = 0; i < slices; i += 1) {
      const a = j * (slices + 1) + i;
      const b = a + slices + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return packed(positions, normals, indices);
}

function packed(positions: number[], normals: number[], indices: number[]) {
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  };
}

function perspective(fovy: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

function translate(x: number, y: number, z: number) {
  const out = identity();
  out[12] = x;
  out[13] = y;
  out[14] = z;
  return out;
}

function rotateX(a: number) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const out = identity();
  out[5] = c;
  out[6] = s;
  out[9] = -s;
  out[10] = c;
  return out;
}

function rotateY(a: number) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const out = identity();
  out[0] = c;
  out[2] = -s;
  out[8] = s;
  out[10] = c;
  return out;
}

function identity() {
  const out = new Float32Array(16);
  out[0] = 1;
  out[5] = 1;
  out[10] = 1;
  out[15] = 1;
  return out;
}

function multiply(a: Float32Array, b: Float32Array) {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col += 1) {
    const b0 = b[col * 4];
    const b1 = b[col * 4 + 1];
    const b2 = b[col * 4 + 2];
    const b3 = b[col * 4 + 3];
    out[col * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    out[col * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    out[col * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    out[col * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  return out;
}

function normal3(m: Float32Array) {
  const out = new Float32Array(9);
  out[0] = m[0];
  out[1] = m[1];
  out[2] = m[2];
  out[3] = m[4];
  out[4] = m[5];
  out[5] = m[6];
  out[6] = m[8];
  out[7] = m[9];
  out[8] = m[10];
  return out;
}
