import * as THREE from '../vendor/three.module.js';

function seeded(seed = 15637) {
  let value = seed;
  return () => ((value = (value * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const random = seeded();
const material = (color, roughness = .92) => new THREE.MeshStandardMaterial({ color, roughness });
const smoothstep = (a, b, value) => {
  const t = THREE.MathUtils.clamp((value - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function ellipsoid(parent, color, position, scale, roughness = .92) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), material(color, roughness));
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  parent.add(mesh);
  return mesh;
}

function beardZone(x, y) {
  const a = Math.abs(x);
  if (y < -1.06 || y > .08 || a > .94) return false;
  const cheekline = -.23 - .19 * (1 - a / .90) + .035 * Math.sin(x * 16);
  const cheek = y < cheekline && a > .37 && y > -.77;
  const jaw = y < -.50 + .035 * Math.sin(x * 13) && a < .91 * Math.sqrt(Math.max(.04, 1 - ((y + .08) / 1.12) ** 2));
  const sideburn = y > -.34 && y < .06 && a > .72;
  const moustacheTop = -.16 - .035 * Math.cos(x * 12);
  const moustacheBottom = -.31 - .04 * Math.sin(a * 9);
  const moustache = y < moustacheTop && y > moustacheBottom && a > .07 && a < .46;
  return cheek || jaw || sideburn || moustache;
}

function createFaceMesh(data) {
  const positions = new Float32Array(data.vertices.length * 3);
  const uvs = new Float32Array(data.vertices.length * 2);
  const colors = new Float32Array(data.vertices.length * 4);
  const edges = new Map();
  for (const triangle of data.triangles) {
    for (let corner = 0; corner < 3; corner++) {
      const a = triangle[corner], b = triangle[(corner + 1) % 3];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  const boundary = [...edges].filter(([, count]) => count === 1).map(([key]) => key.split(':').map(Number));
  const distanceToBoundary = (x, y) => {
    let nearest = Infinity;
    for (const [ia, ib] of boundary) {
      const a = data.vertices[ia], b = data.vertices[ib];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const t = THREE.MathUtils.clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      nearest = Math.min(nearest, Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy));
    }
    return nearest;
  };
  data.vertices.forEach((vertex, i) => {
    const [x, y] = vertex;
    const distance = distanceToBoundary(x, y);
    const side = smoothstep(.44, .72, Math.abs(x));
    const blend = side * (1 - smoothstep(0, .19, distance));
    const ellipse = Math.max(0, 1 - (x / .98) ** 2 - ((y - .16) / 1.33) ** 2);
    const skullZ = -.25 + .74 * Math.sqrt(ellipse);
    vertex[2] = THREE.MathUtils.lerp(vertex[2], skullZ + .012, blend);
    positions.set(vertex.slice(0, 3), i * 3);
    uvs.set(vertex.slice(3, 5), i * 2);
    colors.set([1, 1, 1, 1 - side * (1 - smoothstep(0, .16, distance))], i * 4);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  geometry.setIndex(data.triangles.flat());
  geometry.computeVertexNormals();
  const faceMaterial = new THREE.MeshBasicMaterial({ color: '#c38668', side: THREE.DoubleSide, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(geometry, faceMaterial);
  mesh.userData.zone = 'face';
  return { mesh, faceMaterial };
}

function buildSurfaceSampler(data) {
  const vertices = data.vertices;
  const triangles = data.triangles.map(ids => {
    const a = vertices[ids[0]], b = vertices[ids[1]], c = vertices[ids[2]];
    return {
      a, b, c,
      minX: Math.min(a[0], b[0], c[0]), maxX: Math.max(a[0], b[0], c[0]),
      minY: Math.min(a[1], b[1], c[1]), maxY: Math.max(a[1], b[1], c[1]),
    };
  });
  return (x, y) => {
    for (const t of triangles) {
      if (x < t.minX || x > t.maxX || y < t.minY || y > t.maxY) continue;
      const denominator = (t.b[1] - t.c[1]) * (t.a[0] - t.c[0]) + (t.c[0] - t.b[0]) * (t.a[1] - t.c[1]);
      if (Math.abs(denominator) < 1e-9) continue;
      const wa = ((t.b[1] - t.c[1]) * (x - t.c[0]) + (t.c[0] - t.b[0]) * (y - t.c[1])) / denominator;
      const wb = ((t.c[1] - t.a[1]) * (x - t.c[0]) + (t.a[0] - t.c[0]) * (y - t.c[1])) / denominator;
      const wc = 1 - wa - wb;
      if (wa >= -.001 && wb >= -.001 && wc >= -.001) return wa * t.a[2] + wb * t.b[2] + wc * t.c[2];
    }
    return null;
  };
}

function hairColor(isScalp) {
  const n = random();
  const shade = isScalp ? .028 + n * .065 : .014 + n * .023;
  return [shade * 1.22, shade * .91, shade * .78];
}

function ribbonSet(parent, strands, isScalp) {
  const positions = new Float32Array(strands.length * 8 * 3);
  const colors = new Float32Array(strands.length * 8 * 3);
  const indices = new Uint32Array(strands.length * 18);
  for (let i = 0; i < strands.length; i++) {
    const shade = hairColor(isScalp);
    for (let j = 0; j < 8; j++) colors.set(shade, (i * 8 + j) * 3);
    for (let segment = 0; segment < 3; segment++) {
      const from = i * 8 + segment * 2;
      const k = i * 18 + segment * 6;
      indices.set([from, from + 1, from + 2, from + 1, from + 3, from + 2], k);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  parent.add(mesh);

  function refresh(changed = null) {
    const indicesToDraw = changed || strands.map((_, index) => index);
    for (const i of indicesToDraw) {
      const strand = strands[i];
      const level = strand.length;
      for (let step = 0; step <= 3; step++) {
        const t = step / 3;
        const travel = strand.worldLength * level * t;
        const bend = Math.sin(strand.phase + t * (isScalp ? 8 : 6)) * strand.curl * t;
        const x = strand.x + travel * strand.sweep + bend;
        const y = isScalp
          ? strand.y + travel * (strand.fringe ? .08 - .62 * t : .50 - .48 * t) + Math.sin(t * 6 + strand.phase) * .021 * t
          : strand.y - travel * .78;
        const z = strand.z + .012 + travel * (isScalp ? .48 : .52) + Math.sin(t * 4.4 + strand.phase) * .011 * level;
        const width = strand.width * (1 - .84 * t) * (level > 0 ? 1 : 0);
        const left = (i * 8 + step * 2) * 3;
        positions.set([x - width, y, z], left);
        positions.set([x + width, y, z], left + 3);
      }
    }
    geometry.attributes.position.needsUpdate = true;
  }
  refresh();
  return { refresh };
}

function scalpTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#221b1a';
  ctx.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 11000; i++) {
    const x = random() * 1024, y = random() * 1024;
    ctx.strokeStyle = random() > .5 ? 'rgba(109,88,74,.17)' : 'rgba(7,6,7,.20)';
    ctx.lineWidth = .4 + random() * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 8, y - 5, x + 15 + random() * 20, y - 3 - random() * 16);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function scalpMask() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(canvas.width, canvas.height);
  function restore() {
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const u = x / canvas.width;
        const front = Math.max(0, Math.cos((u - .25) * Math.PI * 2));
        const fringe = 10 * Math.sin(u * 44) + 6 * Math.sin(u * 91 + .7);
        const edge = 306 - 27 * front + fringe;
        const opacity = 1 - smoothstep(edge - 38, edge + 19, y);
        const offset = (y * canvas.width + x) * 4;
        image.data[offset] = image.data[offset + 1] = image.data[offset + 2] = Math.round(255 * opacity);
        image.data[offset + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }
  restore();
  const texture = new THREE.CanvasTexture(canvas);
  function trim(x, y) {
    const unitX = x / .97;
    const unitY = THREE.MathUtils.clamp((y - 1.12) / .64, -1, 1);
    const unitZ = Math.sqrt(Math.max(0, 1 - unitX * unitX - unitY * unitY));
    const phi = (Math.atan2(unitZ, -unitX) + Math.PI * 2) % (Math.PI * 2);
    const u = phi / (Math.PI * 2);
    const v = Math.acos(unitY) / Math.PI;
    const px = u * canvas.width, py = v * canvas.height;
    const gradient = ctx.createRadialGradient(px, py, 8, px, py, 56);
    gradient.addColorStop(0, '#383838');
    gradient.addColorStop(.68, '#484848');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(px, py, 56, 48, 0, 0, Math.PI * 2);
    ctx.fill();
    texture.needsUpdate = true;
  }
  return { texture, trim, restore: () => { restore(); texture.needsUpdate = true; } };
}

function photographedHair(group, image) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext('2d');
  const redraw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
  };
  redraw();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const geometry = new THREE.PlaneGeometry(2.5, 1.23, 40, 24);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i);
    positions.setZ(i, .80 - .25 * (x / 1.25) ** 2 - .06 * (y / .615) ** 2);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true,
    depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 1.255;
  mesh.renderOrder = 4;
  group.add(mesh);
  function trim(x, y) {
    const px = ((x + 1.25) / 2.5) * canvas.width;
    const py = ((1.87 - y) / 1.23) * canvas.height;
    const gradient = ctx.createRadialGradient(px, py, 8, px, py, 78);
    gradient.addColorStop(0, 'rgba(0,0,0,.75)');
    gradient.addColorStop(.58, 'rgba(0,0,0,.68)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(px, py, 78, 94, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    const buzz = ctx.createRadialGradient(px, py, 4, px, py, 74);
    buzz.addColorStop(0, 'rgba(39,27,24,.39)');
    buzz.addColorStop(.62, 'rgba(39,27,24,.32)');
    buzz.addColorStop(1, 'rgba(39,27,24,0)');
    ctx.fillStyle = buzz;
    ctx.beginPath();
    ctx.ellipse(px, py, 74, 90, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#281c19';
    for (let i = 0; i < 850; i++) {
      const dx = (random() * 2 - 1) * 75;
      const dy = (random() * 2 - 1) * 90;
      const distance = (dx / 75) ** 2 + (dy / 90) ** 2;
      if (distance > 1) continue;
      ctx.globalAlpha = (.27 + random() * .53) * (1 - smoothstep(.55, 1, distance));
      ctx.fillRect(px + dx, py + dy, 1 + random() * 1.4, 1.4 + random() * 2);
    }
    ctx.globalAlpha = 1;
    texture.needsUpdate = true;
  }
  return { mesh, trim, reset() { redraw(); texture.needsUpdate = true; } };
}

function photographedScalp(group, image) {
  const texture = new THREE.Texture(image);
  texture.needsUpdate = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const geometry = new THREE.PlaneGeometry(2.5, 1.23, 40, 24);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i);
    positions.setZ(i, .775 - .25 * (x / 1.25) ** 2 - .06 * (y / .615) ** 2);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  mesh.position.y = 1.255;
  mesh.renderOrder = 3;
  group.add(mesh);
  return mesh;
}

function skinTexture(portrait) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(canvas.width, canvas.height);
  const patchCanvas = document.createElement('canvas');
  patchCanvas.width = patchCanvas.height = 512;
  const patchCtx = patchCanvas.getContext('2d');
  const portraitWidth = portrait.naturalWidth || portrait.width;
  const portraitHeight = portrait.naturalHeight || portrait.height;
  const cheekPatch = (startX) => {
    patchCtx.clearRect(0, 0, 512, 512);
    patchCtx.drawImage(portrait, startX * portraitWidth, .07 * portraitHeight,
      .19 * portraitWidth, .73 * portraitHeight, 0, 0, 512, 512);
    return patchCtx.getImageData(0, 0, 512, 512).data;
  };
  const leftCheek = cheekPatch(.08);
  const rightCheek = cheekPatch(.73);
  const grain = seeded(49281);
  for (let y = 0; y < canvas.height; y++) {
    const v = y / canvas.height;
    for (let x = 0; x < canvas.width; x++) {
      const u = x / canvas.width;
      // Sphere UVs place its front at u=.25. A gentle side-to-side lighting
      // variation follows the portrait instead of exposing a flat orange shell.
      const side = Math.sin((u - .25) * Math.PI * 2);
      const front = Math.max(0, Math.cos((u - .25) * Math.PI * 2));
      const shade = -20 * side + 8 * front + 5 * Math.cos((v - .5) * Math.PI);
      const mottling = 2.7 * Math.sin(u * 75 + v * 21) * Math.sin(v * 63 - u * 17);
      const noise = (grain() - .5) * 6 + mottling;
      const offset = (y * canvas.width + x) * 4;
      const patch = u < .25 ? leftCheek : rightCheek;
      const patchX = Math.min(511, Math.floor((u < .25 ? u / .25 : (u - .25) / .25) * 511));
      const patchOffset = (y * 512 + patchX) * 4;
      const photoBlend = u < .5 ? .84 * (1 - smoothstep(.64, .8, v)) : 0;
      image.data[offset] = THREE.MathUtils.lerp(181 + shade + noise, patch[patchOffset], photoBlend);
      image.data[offset + 1] = THREE.MathUtils.lerp(125 + shade * .84 + noise * .8, patch[patchOffset + 1], photoBlend);
      image.data[offset + 2] = THREE.MathUtils.lerp(99 + shade * .67 + noise * .7, patch[patchOffset + 2], photoBlend);
      image.data[offset + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createAvatar(scene, faceData) {
  const group = new THREE.Group();
  group.position.y = -.02;
  scene.add(group);

  // A textured face surface carries Aakash's particular eyes, brows, nose,
  // mouth and skin; the rear skull and ears fill the geometry while turning.
  ellipsoid(group, '#e9deca', [0, -1.85, -.16], [1.32, .45, .69]);
  ellipsoid(group, '#294331', [0, -2.26, .03], [1.38, .40, .74]);
  const skin = new THREE.MeshBasicMaterial({ color: '#b57d63', toneMapped: false });
  ellipsoid(group, '#8d5e49', [0, -1.23, -.20], [.34, .49, .31]).material = skin;
  ellipsoid(group, '#8d5e49', [0, .16, -.25], [.98, 1.33, .74]).material = skin;
  for (const side of [-1, 1]) {
    ellipsoid(group, '#94634e', [side * .96, .10, -.27], [.068, .16, .07]).material = skin;
  }

  const fittedFace = { ...faceData, vertices: faceData.vertices.map(vertex => vertex.slice()) };
  const { mesh: faceMesh, faceMaterial } = createFaceMesh(fittedFace);
  group.add(faceMesh);
  const cap = ellipsoid(group, '#201a18', [0, 1.12, -.27], [.97, .64, .80]);
  const capPositions = cap.geometry.attributes.position;
  for (let i = 0; i < capPositions.count; i++) {
    const x = capPositions.getX(i), y = capPositions.getY(i), z = capPositions.getZ(i);
    const waviness = .022 * Math.sin(x * 21 + z * 9) * Math.sin(y * 14 - z * 8) + .018 * Math.sin(x * 37 + y * 18);
    capPositions.setXYZ(i, x * (1 + waviness), y * (1 + waviness), z * (1 + waviness));
  }
  capPositions.needsUpdate = true;
  cap.geometry.computeVertexNormals();
  const capMask = typeof document !== 'undefined' ? scalpMask() : null;
  let frontHair = null;
  let frontScalp = null;
  if (typeof document !== 'undefined') {
    cap.material = new THREE.MeshBasicMaterial({ color: '#ffffff', map: scalpTexture(),
      alphaMap: capMask.texture, transparent: true, depthWrite: false, toneMapped: false });
  }
  const ready = typeof document === 'undefined' ? Promise.resolve() : Promise.all([
    new Promise((resolve, reject) => {
      new THREE.TextureLoader().load('/assets/aakash-face-bald.jpg?v=1', texture => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        faceMaterial.map = texture;
        faceMaterial.color.set('#ffffff');
        faceMaterial.needsUpdate = true;
        skin.map = skinTexture(texture.image);
        skin.color.set('#ffffff');
        skin.needsUpdate = true;
        resolve();
      }, undefined, reject);
    }),
    new Promise((resolve, reject) => {
      new THREE.TextureLoader().load('/assets/aakash-hair-texture.jpg?v=1', texture => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        cap.material.map = texture;
        cap.material.needsUpdate = true;
        resolve();
      }, undefined, reject);
    }),
    new Promise((resolve, reject) => {
      new THREE.TextureLoader().load('/assets/aakash-hair-overlay.png?v=3', texture => {
        frontHair = photographedHair(group, texture.image);
        resolve();
      }, undefined, reject);
    }),
    new Promise((resolve, reject) => {
      new THREE.TextureLoader().load('/assets/aakash-bald-scalp-overlay.png?v=2', texture => {
        frontScalp = photographedScalp(group, texture.image);
        resolve();
      }, undefined, reject);
    }),
  ]);

  const faceAt = buildSurfaceSampler(fittedFace);
  const beard = [];
  for (let y = -1.02; y <= .07; y += .025) {
    for (let x = -.94; x <= .94; x += .025) {
      for (let n = 0; n < 2; n++) {
        const px = x + (random() - .5) * .027;
        const py = y + (random() - .5) * .027;
        if (!beardZone(px, py)) continue;
        // Sparse, irregular boundaries read as follicles rather than a hard mask.
        const nearTop = !beardZone(px, py + .04);
        const nearSide = !beardZone(px + Math.sign(px || 1) * .04, py);
        if ((nearTop || nearSide) && random() < .62) continue;
        const z = faceAt(px, py);
        if (z === null) continue;
        const chinLength = py < -.55 ? .055 : .025;
        beard.push({ x: px, y: py, z, length: 1, worldLength: chinLength + random() * .085, width: .002 + random() * .003, sweep: (random() - .5) * 1.15, curl: .006 + random() * .015, phase: random() * 6.28 });
      }
    }
  }
  const beardRibbons = ribbonSet(group, beard, false);

  const scalp = [];
  for (let i = 0; i < 16500; i++) {
    const x = (random() * 2 - 1) * 1.0;
    const y = .88 + random() * .88;
    const q = 1 - (x / .98) ** 2 - ((y - 1.12) / .64) ** 2;
    if (q < .04) continue;
    const fringe = y < 1.17 && Math.abs(x) < .72;
    scalp.push({ x, y, z: -.27 + .80 * Math.sqrt(q), length: 1,
      worldLength: (fringe ? .14 : .18) + random() * .27,
      width: .0008 + random() * .0018,
      sweep: (x < -.18 ? -.24 : .24) + (random() - .5) * 1.2,
      curl: .015 + random() * .045, phase: random() * 6.28, fringe });
  }
  const scalpRibbons = ribbonSet(group, scalp, true);

  const hairPick = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  hairPick.scale.set(1.02, .68, .85);
  hairPick.position.set(0, 1.12, -.24);
  hairPick.userData.zone = 'scalp';
  group.add(hairPick);

  const cuts = [];
  let targetRotation = 0;
  function modifyAt(items, x, y, radius, tool) {
    const changed = [];
    for (let index = 0; index < items.length; index++) {
      const strand = items[index];
      if (Math.hypot(strand.x - x, strand.y - y) > radius) continue;
      const old = strand.length;
      if (tool === 'trimmer') strand.length = Math.min(old, .16);
      else if (tool === 'blade' && old <= .17) strand.length = 0;
      if (old !== strand.length) changed.push(index);
    }
    return changed;
  }
  function shaveFace(x, y, tool) {
    if (!beardZone(x, y)) return 0;
    const changed = modifyAt(beard, x, y, tool === 'trimmer' ? .19 : .15, tool);
    if (changed.length) beardRibbons.refresh(changed);
    return changed.length;
  }
  function trimScalp(x, y) {
    const changed = modifyAt(scalp, x, y, .19, 'trimmer');
    if (changed.length) {
      scalpRibbons.refresh(changed);
      capMask?.trim(x, y);
      frontHair?.trim(x, y);
    }
    return changed.length;
  }
  function progress() {
    const earned = beard.reduce((total, strand) => total + (strand.length === 0 ? 1 : strand.length <= .17 ? .62 : 0), 0);
    return Math.round(100 * earned / beard.length);
  }
  function nearbyBareSkin(x, y) {
    return beard.some(strand => strand.length === 0 && Math.hypot(strand.x - x, strand.y - y) < .12);
  }
  function addCut(x, y) {
    if (!beardZone(x, y)) return false;
    const z = faceAt(x, y);
    if (z === null) return false;
    const bandage = new THREE.Group();
    bandage.position.set(x, y, z + .055);
    bandage.rotation.z = -.3;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(.15, .052, .012), material('#e9b999'));
    bandage.add(strip);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(.044, .049, .015), material('#fff0d9'));
    pad.position.z = .01;
    bandage.add(pad);
    group.add(bandage);
    cuts.push(bandage);
    return true;
  }
  function reset() {
    beard.forEach(s => { s.length = 1; });
    scalp.forEach(s => { s.length = 1; });
    beardRibbons.refresh();
    scalpRibbons.refresh();
    capMask?.restore();
    frontHair?.reset();
    cuts.forEach(c => group.remove(c));
    cuts.length = 0;
    targetRotation = 0;
  }
  return {
    group, pickables: [hairPick, faceMesh], ready, shaveFace, trimScalp, progress,
    nearbyBareSkin, addCut, reset,
    update() {
      group.rotation.y += (targetRotation - group.rotation.y) * .12;
      const photoOpacity = 1 - smoothstep(.24, .60, Math.abs(group.rotation.y));
      if (frontHair) frontHair.mesh.material.opacity = photoOpacity;
      if (frontScalp) frontScalp.material.opacity = photoOpacity;
    },
    setRotation(value) { targetRotation = THREE.MathUtils.clamp(value, -.34, .34); },
    getRotation() { return targetRotation; },
    get cutCount() { return cuts.length; },
  };
}
