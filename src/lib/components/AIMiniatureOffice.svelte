<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

  type OfficeAgent = {
    id: string;
    name: string;
    role: string;
    summary: string;
    state: string;
    statusLabel: string;
    taskTitle: string;
    model: string;
    runId: string | null;
  };

  type RobotRig = {
    root: THREE.Group;
    head: THREE.Group;
    leftArm: THREE.Group;
    rightArm: THREE.Group;
    faceEyes: THREE.Mesh[];
    legs: THREE.Group[];
    feet: THREE.Group[];
    roamPath: readonly { x: number; z: number }[];
    roamCurve: THREE.CatmullRomCurve3;
    routeProgress: number;
    routeDirection: 1 | -1;
    pauseUntil: number;
    gaitPhase: number;
    deliveryPhase: 'idle' | 'outbound' | 'handoff' | 'returning' | 'delivered';
    deliveryCurve: THREE.CatmullRomCurve3 | null;
    deliveryProgress: number;
    deliveryPauseUntil: number;
    deliveryRunId: string | null;
    deliveryFolder: THREE.Group;
    chair: THREE.Group;
    statusLight: THREE.Mesh;
    statusRing: THREE.Mesh;
    screen: THREE.Mesh;
    label: THREE.Sprite;
    labelTexture: THREE.CanvasTexture;
    hitArea: THREE.Mesh;
    baseX: number;
    deskZ: number;
    agent: OfficeAgent;
    phase: number;
  };

  let {
    agents = [],
    motionEnabled = true,
    onAgentSelect = () => {}
  }: {
    agents: OfficeAgent[];
    motionEnabled: boolean;
    onAgentSelect: (agentId: string) => void;
  } = $props();

  let container: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let webglUnavailable = $state(false);
  let sceneReady = $state(false);
  let hoveredAgentId = $state<string | null>(null);
  let controller: { syncAgents: (next: OfficeAgent[]) => void; dispose: () => void } | null = null;

  // Each loop begins at that agent's desk exit and stays in open aisles, clear of desk footprints.
  // Each agent gets a broad, one-way itinerary to a different office destination.
  // Curves start at the workstation exit and travel across the studio instead of circling a desk.
  const agentPositions = [
    {
      x: -4.45, z: 1.25, color: 0xe11d2e, tool: 'content',
      roam: [
        { x: -4.45, z: 2.30 }, { x: -5.15, z: 2.85 }, { x: -6.2, z: 3.08 },
        { x: -6.82, z: 2.45 }, { x: -7.02, z: 1.35 }, { x: -7.12, z: .1 },
        { x: -7.12, z: -1.22 }, { x: -6.95, z: -2.42 }, { x: -6.9, z: -2.92 }
      ]
    },
    {
      x: -1.55, z: -0.65, color: 0x83b6b0, tool: 'research',
      roam: [
        { x: -1.55, z: .40 }, { x: -2.72, z: .82 }, { x: -3.0, z: 1.75 },
        { x: -3.0, z: 2.72 }, { x: -2.82, z: 3.58 }, { x: -2.1, z: 4.25 },
        { x: -1.98, z: 4.85 }, { x: -2.85, z: 5.18 }, { x: -4.18, z: 5.2 }
      ]
    },
    {
      x: 1.6, z: 1.15, color: 0xe7b94e, tool: 'workflow',
      // This path stays outside the Team Sync table's safety radius.
      roam: [
        { x: 1.6, z: 2.20 }, { x: 1.68, z: 3.12 }, { x: 2.25, z: 3.55 },
        { x: 3.05, z: 4.05 }, { x: 3.72, z: 4.72 }, { x: 4.85, z: 5.12 },
        { x: 6.0, z: 5.0 }, { x: 6.82, z: 4.18 }, { x: 6.92, z: 3.12 },
        { x: 6.75, z: 2.28 }
      ]
    },
    {
      x: 4.35, z: -0.65, color: 0x9eb991, tool: 'strategy',
      roam: [
        { x: 4.35, z: .40 }, { x: 5.48, z: .48 }, { x: 6.24, z: .05 },
        { x: 7.0, z: -.68 }, { x: 7.34, z: -1.72 }, { x: 7.38, z: -2.72 },
        { x: 7.2, z: -3.52 }, { x: 7.08, z: -4.02 }
      ]
    }
  ] as const;

  function material(color: THREE.ColorRepresentation, roughness = 0.72, metalness = 0) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
  }

  function box(
    parent: THREE.Object3D,
    size: [number, number, number],
    color: THREE.ColorRepresentation,
    position: [number, number, number],
    options: { roughness?: number; metalness?: number; castShadow?: boolean; receiveShadow?: boolean } = {}
  ) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...size),
      material(color, options.roughness ?? 0.72, options.metalness ?? 0)
    );
    mesh.position.set(...position);
    mesh.castShadow = options.castShadow ?? true;
    mesh.receiveShadow = options.receiveShadow ?? true;
    parent.add(mesh);
    return mesh;
  }

  function sphere(
    parent: THREE.Object3D,
    radius: number,
    color: THREE.ColorRepresentation,
    position: [number, number, number],
    scale: [number, number, number] = [1, 1, 1],
    options: { roughness?: number; metalness?: number; emissive?: THREE.ColorRepresentation; emissiveIntensity?: number } = {}
  ) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 20, 14),
      new THREE.MeshStandardMaterial({
        color,
        roughness: options.roughness ?? 0.4,
        metalness: options.metalness ?? 0,
        emissive: options.emissive ?? 0x000000,
        emissiveIntensity: options.emissiveIntensity ?? 0
      })
    );
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function cylinder(
    parent: THREE.Object3D,
    radiusTop: number,
    radiusBottom: number,
    height: number,
    color: THREE.ColorRepresentation,
    position: [number, number, number],
    radialSegments = 12
  ) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments),
      material(color)
    );
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function makeScreenTexture(kind: string) {
    const art = document.createElement('canvas');
    art.width = 512;
    art.height = 320;
    const ctx = art.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(art);
    ctx.fillStyle = '#252832';
    ctx.fillRect(0, 0, art.width, art.height);
    ctx.fillStyle = '#e11d2e';
    ctx.fillRect(23, 20, 145, 8);
    ctx.fillStyle = '#777c89';
    for (let i = 0; i < 5; i += 1) {
      ctx.fillRect(24, 49 + i * 18, 95 + ((i * 27) % 120), 4);
    }
    if (kind === 'research') {
      for (let i = 0; i < 7; i += 1) {
        ctx.fillStyle = i % 2 ? '#f2c84b' : '#88b8aa';
        ctx.fillRect(276 + i * 25, 234 - [32, 76, 48, 108, 82, 137, 104][i], 14, [32, 76, 48, 108, 82, 137, 104][i]);
      }
      ctx.strokeStyle = '#9acac0';
      ctx.strokeRect(264, 42, 204, 202);
    } else if (kind === 'workflow') {
      const nodes = [[72, 82], [292, 82], [72, 201], [292, 201]];
      ctx.strokeStyle = '#e7bd4e';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(132, 105); ctx.lineTo(292, 105);
      ctx.moveTo(110, 120); ctx.lineTo(110, 200);
      ctx.moveTo(310, 120); ctx.lineTo(310, 200);
      ctx.stroke();
      nodes.forEach(([x, y], i) => {
        ctx.fillStyle = ['#f6e8d2', '#f2c84b', '#d3e4d0', '#f2c6c1'][i];
        ctx.fillRect(x, y, 70, 34);
      });
    } else if (kind === 'strategy') {
      ctx.fillStyle = '#f4db8b';
      ctx.fillRect(270, 40, 190, 68);
      ctx.fillStyle = '#d7e5d1';
      ctx.fillRect(270, 130, 190, 68);
      ctx.fillStyle = '#f3cfca';
      ctx.fillRect(270, 220, 190, 58);
      ctx.fillStyle = '#41372d';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('PLAN', 290, 76);
      ctx.fillText('BUILD', 290, 166);
      ctx.fillText('REVIEW', 290, 255);
    } else {
      ctx.fillStyle = '#f5d1ca';
      ctx.fillRect(270, 42, 185, 124);
      ctx.fillStyle = '#f2c84b';
      ctx.fillRect(290, 64, 60, 80);
      ctx.fillStyle = '#b5d0b3';
      ctx.fillRect(365, 83, 68, 61);
      ctx.strokeStyle = '#fbf4e8';
      ctx.lineWidth = 8;
      ctx.strokeRect(25, 231, 420, 53);
    }
    const texture = new THREE.CanvasTexture(art);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  function makeOfficeSignTexture() {
    const art = document.createElement('canvas');
    art.width = 1200;
    art.height = 150;
    const ctx = art.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(art);
    ctx.fillStyle = '#fff8ed';
    ctx.beginPath();
    ctx.roundRect(2, 2, 1196, 146, 24);
    ctx.fill();
    ctx.strokeStyle = '#dfc8a9';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = '#e11d2e';
    ctx.beginPath();
    ctx.roundRect(22, 23, 105, 105, 28);
    ctx.fill();
    ctx.fillStyle = '#fff8ed';
    ctx.font = 'bold 73px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('V', 74, 101);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#302923';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('VIXORA', 154, 78);
    ctx.fillStyle = '#be2633';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('AI STUDIO', 157, 112);
    ctx.fillStyle = '#927d65';
    ctx.font = '20px sans-serif';
    ctx.fillText('SMALL BOTS  ·  BIG IDEAS', 490, 88);
    ctx.fillStyle = '#d5bf9f';
    ctx.fillRect(461, 34, 3, 80);
    ctx.fillStyle = '#f1ca58';
    ctx.beginPath();
    ctx.arc(1136, 43, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#72a48b';
    ctx.beginPath();
    ctx.arc(1164, 43, 10, 0, Math.PI * 2);
    ctx.fill();
    const texture = new THREE.CanvasTexture(art);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  function makeNameplateTexture(agent: OfficeAgent) {
    const art = document.createElement('canvas');
    art.width = 640;
    art.height = 180;
    const ctx = art.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(art);
    ctx.fillStyle = '#fffaf0';
    ctx.beginPath();
    ctx.roundRect(2, 2, 636, 176, 18);
    ctx.fill();
    ctx.strokeStyle = '#dec9ad';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#e11d2e';
    ctx.fillRect(22, 22, 7, 136);
    ctx.fillStyle = '#b57a2e';
    ctx.font = 'bold 19px sans-serif';
    ctx.fillText(agent.role.toUpperCase(), 48, 40);
    ctx.fillStyle = '#302923';
    ctx.font = 'bold 31px sans-serif';
    ctx.fillText(agent.name, 48, 82);
    ctx.fillStyle = '#867766';
    ctx.font = '19px sans-serif';
    const task = agent.taskTitle.length > 39 ? agent.taskTitle.slice(0, 36) + '…' : agent.taskTitle;
    ctx.fillText(task, 48, 114);
    const statusColor = agent.state === 'working' ? '#28865c' : agent.state === 'attention' ? '#cf2636' : agent.state === 'done' ? '#a77718' : '#8a8071';
    ctx.fillStyle = statusColor;
    ctx.beginPath();
    ctx.arc(54, 145, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(agent.statusLabel, 68, 151);
    const texture = new THREE.CanvasTexture(art);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  function addPlant(scene: THREE.Scene, x: number, z: number, scale = 1) {
    const pot = cylinder(scene, .22 * scale, .29 * scale, .42 * scale, 0xd0a27b, [x, .24 * scale, z]);
    pot.castShadow = true;
    cylinder(scene, .29 * scale, .29 * scale, .045 * scale, 0x7b563a, [x, .45 * scale, z]);
    for (let i = 0; i < 7; i += 1) {
      const angle = i * (Math.PI * 2 / 7);
      const leaf = sphere(
        scene, .2 * scale, i % 2 ? 0x78a47d : 0x9cbc8c,
        [x + Math.cos(angle) * .2 * scale, .77 * scale + (i % 3) * .08 * scale, z + Math.sin(angle) * .2 * scale],
        [.48 * scale, 1.3 * scale, .36 * scale]
      );
      leaf.rotation.z = Math.cos(angle) * .45;
      leaf.rotation.x = Math.sin(angle) * .35;
    }
    sphere(scene, .18 * scale, 0x97b98d, [x, 1.04 * scale, z], [.72 * scale, 1.35 * scale, .7 * scale]);
  }

  function addFurniture(scene: THREE.Scene) {
    // Open studio floor: broad, almost edge-to-edge, with no chunky display-box rim.
    box(scene, [18.8, .12, 12.9], 0xe5d4bd, [0, -.12, .05]);
    box(scene, [18.65, .055, 12.75], 0xf4e9d9, [0, -.035, .05]);

    // Warm back wall and tall window panels.
    box(scene, [14, 3.6, .2], 0xf8eddb, [0, 1.8, -4.78]);
    for (let i = 0; i < 6; i += 1) {
      const x = -5.65 + i * 2.25;
      const glass = box(scene, [1.92, 1.72, .045], 0xd8e9e4, [x, 2.02, -4.655], { roughness: .23, metalness: .05 });
      const glassMat = glass.material as THREE.MeshStandardMaterial;
      glassMat.transparent = true;
      glassMat.opacity = .86;
      box(scene, [1.94, .055, .065], 0xffffff, [x, 1.16, -4.61]);
      box(scene, [1.94, .055, .065], 0xffffff, [x, 2.9, -4.61]);
      box(scene, [.055, 1.78, .065], 0xffffff, [x - .97, 2.02, -4.61]);
      box(scene, [.055, 1.78, .065], 0xffffff, [x + .97, 2.02, -4.61]);
      // Tiny buildings outside the windows create miniature-world depth.
      for (let b = 0; b < 3; b += 1) {
        const bx = x - .6 + b * .42;
        const h = .22 + ((i * 3 + b * 2) % 7) * .065;
        box(scene, [.25, h, .09], [0xb7c6c4, 0xc9b4a0, 0xd8c9ac][b], [bx, .85 + h / 2, -4.58], { castShadow: false });
      }
    }

    // A permanent, readable VIXORA studio sign and small wall details above the pinboard.
    box(scene, [5.45, .66, .17], 0xb99a79, [0, 3.22, -4.56]);
    box(scene, [5.33, .56, .11], 0xfff8ed, [0, 3.22, -4.45]);
    const officeSignTexture = makeOfficeSignTexture();
    const officeSign = new THREE.Mesh(
      new THREE.PlaneGeometry(5.15, .48),
      new THREE.MeshBasicMaterial({ map: officeSignTexture, side: THREE.DoubleSide })
    );
    officeSign.position.set(0, 3.22, -4.385);
    scene.add(officeSign);

    // Wall clock with physical rim and hands.
    const clock = new THREE.Mesh(new THREE.TorusGeometry(.24, .045, 8, 24), material(0xc6a37f));
    clock.position.set(-3.75, 3.22, -4.49);
    scene.add(clock);
    sphere(scene, .2, 0xfff8ed, [-3.75, 3.22, -4.5], [1, 1, .15]);
    box(scene, [.025, .14, .025], 0x8c755b, [-3.75, 3.25, -4.465]);
    box(scene, [.11, .025, .025], 0xe11d2e, [-3.70, 3.19, -4.464]);

    // Framed brand print and warm hanging lamp on the other side of the wall.
    box(scene, [.76, .64, .13], 0xb99a79, [3.9, 3.22, -4.56]);
    box(scene, [.64, .52, .06], 0xfff8ed, [3.9, 3.22, -4.47]);
    box(scene, [.12, .3, .035], 0xe11d2e, [3.76, 3.23, -4.43]);
    box(scene, [.12, .2, .035], 0xf1ca58, [3.91, 3.18, -4.43]);
    box(scene, [.12, .36, .035], 0x8fb29a, [4.06, 3.25, -4.43]);

    // Pinboard and tiny notes.
    box(scene, [3.7, 1.32, .15], 0xc0a181, [0, 2.28, -4.59]);
    box(scene, [3.5, 1.17, .05], 0xfff5e6, [0, 2.28, -4.49]);
    box(scene, [.8, .55, .045], 0xf1c8c2, [-.98, 2.47, -4.445]);
    box(scene, [.8, .55, .045], 0xf6dfa0, [0, 2.48, -4.445]);
    box(scene, [.8, .55, .045], 0xd4e5cc, [.98, 2.47, -4.445]);
    for (let i = 0; i < 5; i += 1) box(scene, [.52 - i * .035, .025, .012], 0xcab8a1, [-.98, 2.33 - i * .075, -4.414], { castShadow: false });
    for (let i = 0; i < 4; i += 1) box(scene, [.52 - i * .045, .025, .012], 0xcab8a1, [0, 2.33 - i * .075, -4.414], { castShadow: false });
    for (let i = 0; i < 3; i += 1) box(scene, [.52 - i * .05, .025, .012], 0xb3c9ab, [.98, 2.33 - i * .075, -4.414], { castShadow: false });

    // Sofa and a tiny coffee table make it an actual office, not a command bridge.
    box(scene, [1.72, .55, .64], 0xd5b297, [-5.28, .31, -2.05]);
    box(scene, [1.8, .5, .22], 0xe1c4a8, [-5.28, .58, -2.36]);
    box(scene, [.55, .2, .42], 0xf3e4cf, [-5.68, .61, -2.11]);
    box(scene, [.55, .2, .42], 0xd7a4a0, [-5.05, .61, -2.11]);
    for (const x of [-5.85, -4.78]) cylinder(scene, .045, .055, .22, 0x8d6d51, [x, .11, -2.02], 8);
    cylinder(scene, .36, .4, .12, 0xd7b994, [-4.25, .47, -2.0], 20);
    cylinder(scene, .055, .055, .34, 0x977a5d, [-4.25, .24, -2.0]);
    // Coffee cups and trays on the table.
    cylinder(scene, .11, .13, .15, 0xfff6e8, [-4.34, .61, -2.0], 16);
    cylinder(scene, .083, .083, .012, 0x6d4833, [-4.34, .69, -2.0], 16);
    // Wall shelf and server cabinet.
    box(scene, [1.85, .1, .42], 0xc6a27f, [5.25, 2.15, -4.28]);
    for (let i = 0; i < 5; i += 1) box(scene, [.23, .32 + (i % 2) * .07, .24], [0xe5d3bb, 0xc4d8c8, 0xf1d68f][i % 3], [4.62 + i * .3, 2.36, -4.25]);
    box(scene, [1.12, 1.85, .6], 0x504b48, [6.0, .94, -2.1]);
    box(scene, [1.02, 1.7, .08], 0x24262e, [6.0, .96, -1.78]);
    for (let i = 0; i < 7; i += 1) {
      box(scene, [.78, .015, .012], 0x847e77, [6.0, .37 + i * .19, -1.725], { castShadow: false });
      for (let j = 0; j < 5; j += 1) sphere(scene, .018, j % 2 ? 0xf1c84b : 0x7ec7a5, [5.72 + j * .14, .41 + i * .19, -1.71], [1, 1, .35], { emissive: j % 2 ? 0xf1c84b : 0x7ec7a5, emissiveIntensity: .3 });
    }

    addPlant(scene, -6.1, -3.8, 1.05);
    addPlant(scene, -5.9, 2.7, .9);
    addPlant(scene, 5.7, -3.5, .82);
    addPlant(scene, 5.9, 3.5, .86);

    // Rugs and floor strips help the top-down/isometric composition read as a room.
    const rug = new THREE.Mesh(new THREE.BoxGeometry(3.1, .025, 2.0), material(0xe9d8c3));
    rug.position.set(-3.5, .045, 1.2);
    rug.receiveShadow = true;
    scene.add(rug);
    for (let i = 0; i < 7; i += 1) {
      box(scene, [13.1, .018, .018], i % 2 ? 0xe5d5c0 : 0xdfcbb1, [0, .035, -3.9 + i * 1.12], { castShadow: false });
    }

    // Shared team-sync island: a physical round table and small screen for report handoffs.
    cylinder(scene, .82, .88, .13, 0xb78f6c, [0, .7, 4.18], 32);
    cylinder(scene, .78, .8, .055, 0xfff2df, [0, .79, 4.18], 32);
    cylinder(scene, .14, .2, .62, 0xa88a6a, [0, .38, 4.18], 16);
    cylinder(scene, .39, .42, .09, 0xc1a181, [0, .1, 4.18], 24);
    // Tiny shared monitor and a red/gold beacon make the handoff spot easy to read.
    box(scene, [.8, .58, .075], 0x57534d, [0, 1.12, 4.42], { roughness: .42, metalness: .08 });
    const syncTexture = makeScreenTexture('strategy');
    const syncScreen = new THREE.Mesh(new THREE.PlaneGeometry(.7, .45), new THREE.MeshBasicMaterial({ map: syncTexture, side: THREE.DoubleSide }));
    syncScreen.position.set(0, 1.13, 4.462);
    scene.add(syncScreen);
    box(scene, [.26, .035, .2], 0xc9ad8c, [-.32, .84, 4.04]);
    box(scene, [.23, .025, .17], 0xf5d79a, [-.32, .87, 4.04]);
    cylinder(scene, .045, .045, .035, 0xe11d2e, [.28, .85, 4.03], 16);
    cylinder(scene, .028, .028, .02, 0xf1ca58, [.28, .88, 4.03], 16);
  }

  function makeRobot(scene: THREE.Scene, agent: OfficeAgent, idx: number, x: number, deskZ: number, tool: string, roamPath: readonly { x: number; z: number }[]): RobotRig {
    const root = new THREE.Group();
    // Robot works on the near side of the desk, facing the monitor.
    root.position.set(x, 0, deskZ + 1.05);
    root.rotation.y = Math.PI;
    scene.add(root);

    const bodyColor = idx === 1 ? 0xe6f0ed : idx === 2 ? 0xf5e4c4 : idx === 3 ? 0xe1eadb : 0xf6e6db;
    const accent = agent.state === 'attention' ? 0xe11d2e : [0xe11d2e, 0x7caaa3, 0xe0b54f, 0x86a47d][idx] ?? 0xe11d2e;
    const body = sphere(root, .29, bodyColor, [0, .79, 0], [.88, 1.1, .72]);
    body.material = material(bodyColor, .35);
    sphere(root, .12, 0xd3c1ab, [0, 1.08, 0], [1, .62, .78]);

    const legs: THREE.Group[] = [];
    const feet: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * .14, .52, .08);
      root.add(leg);
      const upperLeg = sphere(leg, .12, 0xd6c5b0, [0, -.12, 0], [.8, 1.45, .78]);
      upperLeg.rotation.x = -.4;
      // Separate ankles let the soles stay flat and planted while the knees swing.
      const foot = new THREE.Group();
      foot.position.set(side * .01, -.44, .17);
      leg.add(foot);
      sphere(foot, .14, 0xf9f3e8, [0, 0, 0], [1.05, .58, 1.4]);
      sphere(foot, .045, 0xbba58a, [0, -.01, .09], [1, .55, .7]);
      feet.push(foot);
      legs.push(leg);
    }

    const armMaterial = material(0xf7eee2, .33);
    const accentMaterial = material(accent, .36);
    const arms: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * .25, .88, .08);
      root.add(arm);
      const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(.075, .22, 4, 8), armMaterial);
      upperArm.position.set(0, -.13, .02);
      upperArm.rotation.x = -.55;
      upperArm.rotation.z = side * .18;
      upperArm.castShadow = true;
      arm.add(upperArm);
      sphere(arm, .092, bodyColor, [0, -.25, .10], [.96, 1, .96]);
      const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(.055, .16, 4, 8), armMaterial);
      forearm.position.set(0, -.28, .19);
      forearm.rotation.x = -1.05;
      forearm.rotation.z = side * -.16;
      forearm.castShadow = true;
      arm.add(forearm);
      sphere(arm, .075, 0xfff8ed, [0, -.34, .28], [1, .8, 1.1]);
      sphere(arm, .035, accent, [side * .01, -.34, .34], [.8, .8, .8]);
      arms.push(arm);
    }

    const head = new THREE.Group();
    head.position.set(0, 1.42, .015);
    root.add(head);
    sphere(head, .39, bodyColor, [0, 0, 0], [1.08, 1, .94], { roughness: .29 });
    // Side ear caps and small hinge details make the head read as a solid toy.
    for (const side of [-1, 1]) {
      sphere(head, .105, 0xc8b29a, [side * .405, -.02, 0], [ .63, .95, .8 ]);
      sphere(head, .064, accent, [side * .443, -.02, .035], [.5, .65, .65], { emissive: accent, emissiveIntensity: .1 });
    }
    cylinder(head, .027, .037, .16, 0xb49b7e, [0, .42, -.015], 10);
    sphere(head, .064, accent, [0, .51, -.015], [1, 1, 1], { emissive: accent, emissiveIntensity: .35 });
    // Face panel sits on the curved front, with a real rim, eyes, blush and smile.
    sphere(head, .27, 0x2b2d37, [0, -.005, .326], [1.13, .72, .28], { roughness: .24, metalness: .08 });
    sphere(head, .255, 0x171920, [0, -.005, .346], [1.12, .7, .18], { roughness: .3 });
    const eyeColor = agent.state === 'attention' ? 0xff8a8a : idx === 1 ? 0xb2e4dc : 0xffd94f;
    const eyes: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
      eyes.push(sphere(head, .052, eyeColor, [side * .105, .035, .397], [.78, 1.15, .48], { emissive: eyeColor, emissiveIntensity: .7 }));
      sphere(head, .055, 0xeea2a1, [side * .192, -.065, .372], [.9, .65, .35]);
    }
    const smileCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-.055, -.075, .405),
      new THREE.Vector3(0, -.095, .413),
      new THREE.Vector3(.055, -.075, .405)
    ]);
    const smile = new THREE.Mesh(new THREE.TubeGeometry(smileCurve, 8, .009, 5, false), material(0xffd1c7));
    head.add(smile);
    if (idx === 0) {
      // A tiny beret for the creative agent.
      const beret = new THREE.Mesh(new THREE.SphereGeometry(.18, 16, 10), material(0xe11d2e));
      beret.scale.set(1.45, .42, 1.15);
      beret.position.set(-.05, .32, .01);
      beret.rotation.z = -.18;
      head.add(beret);
      sphere(head, .035, 0xf4cc53, [.13, .37, .07], [1, .7, 1]);
    } else if (idx === 1) {
      // A miniature researcher lens on the temple.
      const lens = new THREE.Mesh(new THREE.TorusGeometry(.095, .018, 8, 20), material(0x85b9bd, .25, .25));
      lens.position.set(.28, .22, .21);
      lens.rotation.y = -.2;
      head.add(lens);
      cylinder(head, .015, .025, .16, 0x9abec1, [.34, .12, .22], 8).rotation.x = -.5;
    } else if (idx === 2) {
      // A tiny yellow headband marks the workflow planner.
      const band = new THREE.Mesh(new THREE.TorusGeometry(.30, .035, 8, 24, Math.PI), material(0xf1c84b));
      band.position.set(0, .035, .02);
      band.rotation.x = -.04;
      head.add(band);
    } else {
      sphere(head, .08, 0xf1c84b, [.18, .29, .13], [.75, .38, .75]);
    }

    // A real, extruded desk with a monitor, keys and agent-specific tools.
    const stationX = x;
    const deskGroup = new THREE.Group();
    deskGroup.position.set(stationX, 0, deskZ);
    scene.add(deskGroup);
    box(deskGroup, [2.05, .12, 1.0], 0xb98d69, [0, .72, 0]);
    box(deskGroup, [2.1, .075, 1.02], 0xf7ebd9, [0, .79, 0]);
    box(deskGroup, [.07, .65, .08], 0xa98868, [-.78, .4, -.28]);
    box(deskGroup, [.07, .65, .08], 0xa98868, [.78, .4, -.28]);
    box(deskGroup, [.07, .65, .08], 0xa98868, [-.78, .4, .29]);
    box(deskGroup, [.07, .65, .08], 0xa98868, [.78, .4, .29]);

    // Monitor casing has real thickness, a glowing screen plane and stand.
    box(deskGroup, [.86, .58, .085], 0x5b554e, [0, 1.15, -.16], { roughness: .42, metalness: .08 });
    const screenTexture = makeScreenTexture(tool);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(.75, .46),
      new THREE.MeshBasicMaterial({ map: screenTexture, side: THREE.DoubleSide })
    );
    screen.position.set(0, 1.16, -.112);
    deskGroup.add(screen);

    // Small 3D status beacon: red = attention, green = working, gold = completed/queued.
    const statusColor = agent.state === 'attention'
      ? 0xe11d2e
      : agent.state === 'working'
        ? 0x37a978
        : agent.state === 'done'
          ? 0xe6bb47
          : 0xc5ad8c;
    const statusLight = sphere(
      deskGroup, .065, statusColor, [.82, .9, -.3], [1, 1, 1],
      { roughness: .22, metalness: .05, emissive: statusColor, emissiveIntensity: agent.state === 'idle' ? .08 : .45 }
    );
    const statusRing = new THREE.Mesh(
      new THREE.TorusGeometry(.09, .012, 7, 18),
      material(statusColor, .35, .1)
    );
    statusRing.position.set(.82, .9, -.3);
    statusRing.rotation.x = Math.PI / 2;
    deskGroup.add(statusRing);
    box(deskGroup, [.09, .2, .11], 0xa99984, [0, .94, -.16]);
    box(deskGroup, [.42, .045, .24], 0xc3af94, [0, .84, -.08]);
    // Keyboard and a mouse are separate physical pieces.
    box(deskGroup, [.53, .035, .19], 0x373941, [0, .835, .26]);
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 10; col += 1) {
        box(deskGroup, [.035, .012, .027], (row + col) % 6 === 0 ? 0xe8c452 : 0xeee5d9, [-.23 + col * .05, .86, .2 + row * .044], { castShadow: false });
      }
    }
    sphere(deskGroup, .06, 0xdcc9b2, [.38, .85, .24], [.8, .45, 1.15]);

    // A small desk lamp, with a warm bulb that is actual geometry.
    cylinder(deskGroup, .13, .15, .05, 0xc8b394, [-.7, .84, -.18], 16);
    cylinder(deskGroup, .035, .035, .34, 0xb39a7b, [-.7, 1.0, -.18], 10).rotation.z = -.16;
    const lampShade = new THREE.Mesh(new THREE.ConeGeometry(.16, .2, 16, 1, true), material(0xf3d994, .48));
    lampShade.position.set(-.74, 1.16, -.18);
    lampShade.rotation.z = Math.PI;
    deskGroup.add(lampShade);
    sphere(deskGroup, .038, 0xffdf7d, [-.74, 1.08, -.18], [1, 1, 1], { emissive: 0xffc44c, emissiveIntensity: .75 });

    if (tool === 'content') {
      // Palette, tiny drawing tablet and pencil.
      box(deskGroup, [.42, .025, .3], 0xf5d3cb, [.68, .83, .11]);
      box(deskGroup, [.33, .02, .21], 0xdbe7cf, [.68, .85, .11]);
      for (let i = 0; i < 4; i += 1) sphere(deskGroup, .045, [0xe11d2e, 0xf3c74b, 0x7fae92, 0xd69cbd][i], [.56 + i * .085, .89, .12], [.8, .6, .8]);
      cylinder(deskGroup, .025, .025, .38, 0xe11d2e, [.86, .89, .21], 8).rotation.z = -.55;
    } else if (tool === 'research') {
      // Books, a magnifier and a data chart.
      box(deskGroup, [.4, .075, .29], 0x9dbfb2, [-.68, .85, .12]);
      box(deskGroup, [.4, .07, .29], 0xf3dfab, [-.68, .92, .12]);
      const lens = new THREE.Mesh(new THREE.TorusGeometry(.13, .025, 8, 20), material(0x81acb6, .24, .2));
      lens.position.set(.69, .96, .15);
      lens.rotation.x = -.15;
      deskGroup.add(lens);
      cylinder(deskGroup, .025, .035, .28, 0x957653, [.78, .84, .28], 8).rotation.z = -.56;
      for (let i = 0; i < 5; i += 1) box(deskGroup, [.055, .1 + (i % 3) * .035, .065], [0xd7a5a0, 0xf0ce68, 0x94b7a4][i % 3], [-.87 + i * .09, .86 + (i % 3) * .035, -.31], { castShadow: false });
    } else if (tool === 'workflow') {
      // A miniature workflow made from connected nodes.
      const nodes: [number, number, number][] = [[-.68, .89, .08], [-.38, .89, .08], [-.68, .89, .31], [-.38, .89, .31]];
      nodes.forEach((position, index) => box(deskGroup, [.18, .06, .13], [0xf4e6d3, 0xf1cb63, 0xd2e5ce, 0xf0c9c6][index], position));
      box(deskGroup, [.26, .018, .025], 0xbba17b, [-.53, .88, .14]);
      box(deskGroup, [.025, .018, .24], 0xbba17b, [-.62, .88, .2]);
      box(deskGroup, [.025, .018, .24], 0xbba17b, [-.42, .88, .2]);
    } else {
      // Strategy cards and a tiny paper chart.
      box(deskGroup, [.46, .025, .31], 0xf3d5d0, [-.68, .84, .1]);
      box(deskGroup, [.46, .025, .31], 0xf5df9f, [-.68, .87, .1]);
      box(deskGroup, [.46, .025, .31], 0xd5e4cc, [-.68, .9, .1]);
      for (let i = 0; i < 5; i += 1) box(deskGroup, [.035, .015, .08 + i * .02], [0xd59e96, 0xf0c750, 0x91b4a0][i % 3], [.43 + i * .075, .86, .19], { castShadow: false });
      cylinder(deskGroup, .022, .022, .3, 0xc49c68, [.88, .87, .23], 8).rotation.z = -.45;
    }

    // Grouped rolling chair: hidden while the agent strolls, visible when seated at its desk.
    const chair = new THREE.Group();
    chair.position.set(x, 0, deskZ + 1.28);
    scene.add(chair);
    cylinder(chair, .21, .24, .1, 0xb9a084, [0, .43, 0], 16);
    box(chair, [.09, .3, .09], 0x9e8467, [0, .25, 0]);
    box(chair, [.55, .13, .19], 0xc9ad8c, [0, .53, .1]);
    box(chair, [.54, .48, .12], 0xe2c9ac, [0, .79, .27]);

    // Nameplate is a canvas texture on a physical card at the desk's front edge.
    const labelTexture = makeNameplateTexture(agent);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthWrite: false }));
    label.scale.set(1.76, .5, 1);
    label.position.set(x, .45, deskZ + .56);
    scene.add(label);

    // Small result folder carried only while an agent is delivering a completed run.
    const deliveryFolder = new THREE.Group();
    deliveryFolder.position.set(.31, .72, .26);
    root.add(deliveryFolder);
    box(deliveryFolder, [.25, .045, .19], 0xf1d594, [0, 0, 0]);
    box(deliveryFolder, [.23, .018, .17], 0xfff6df, [0, .032, 0]);
    box(deliveryFolder, [.065, .014, .17], 0xe11d2e, [-.065, .045, 0]);
    box(deliveryFolder, [.105, .018, .024], 0xc2a176, [.055, .045, -.045]);
    deliveryFolder.visible = false;

    const hitArea = new THREE.Mesh(
      new THREE.BoxGeometry(2.45, 2.35, 2.6),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
    );
    hitArea.position.set(x, 1.05, deskZ - .02);
    hitArea.userData.agentId = agent.id;
    hitArea.userData.pickable = true;
    scene.add(hitArea);

    const roamCurve = new THREE.CatmullRomCurve3(roamPath.map((point) => new THREE.Vector3(point.x, 0, point.z)), false, 'centripetal', .5);
    return {
      root, head, leftArm: arms[0], rightArm: arms[1], legs, feet, roamPath, roamCurve,
      routeProgress: 0,
      routeDirection: 1,
      pauseUntil: 0,
      gaitPhase: idx * .9,
      deliveryPhase: agent.state === 'done' ? 'delivered' : 'idle',
      deliveryCurve: null,
      deliveryProgress: 0,
      deliveryPauseUntil: 0,
      deliveryRunId: agent.state === 'done' ? agent.runId : null,
      deliveryFolder,
      chair, statusLight, statusRing, faceEyes: eyes, screen, label, labelTexture, hitArea, baseX: x, deskZ, agent, phase: idx * 1.7
    };
  }

  function addRoamingBuddy(scene: THREE.Scene) {
    const root = new THREE.Group();
    root.position.set(-5.25, 0, 3.15);
    root.scale.setScalar(.58);
    scene.add(root);
    const shell = material(0xf3e8d8, .32);
    const red = material(0xe11d2e, .36);
    const dark = material(0x292b33, .25);
    const eye = new THREE.MeshStandardMaterial({ color: 0xf5cb45, emissive: 0xf5cb45, emissiveIntensity: .85, roughness: .28 });
    const head = new THREE.Group();
    head.position.y = 1.1;
    root.add(head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(.35, 20, 14), shell);
    skull.scale.set(1.1, .92, .94);
    skull.castShadow = true;
    head.add(skull);
    const face = new THREE.Mesh(new THREE.SphereGeometry(.24, 18, 12), dark);
    face.scale.set(1.1, .65, .24);
    face.position.set(0, -.015, .29);
    head.add(face);
    for (const side of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(.048, 12, 8), eye);
      e.position.set(side * .1, .035, .365);
      head.add(e);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(.08, 12, 8), shell);
      ear.position.set(side * .365, -.015, 0);
      ear.scale.set(.5, .9, .7);
      head.add(ear);
    }
    const body = new THREE.Mesh(new THREE.SphereGeometry(.22, 16, 10), shell);
    body.scale.set(.9, 1.1, .75);
    body.position.y = .68;
    body.castShadow = true;
    root.add(body);
    sphere(root, .065, 0xe11d2e, [0, .69, .18], [1, 1, .5], { emissive: 0xe11d2e, emissiveIntensity: .25 });
    const legs: THREE.Group[] = [];
    const feet: THREE.Group[] = [];
    const arms: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * .12, .41, .03);
      root.add(leg);
      cylinder(leg, .06, .07, .35, 0xd4c0a8, [0, -.16, 0], 10);
      const foot = new THREE.Group();
      foot.position.set(0, -.36, .08);
      leg.add(foot);
      sphere(foot, .085, 0xf8efe2, [0, 0, 0], [1, .6, 1.25]);
      feet.push(foot);
      legs.push(leg);
      const arm = new THREE.Group();
      arm.position.set(side * .19, .8, .02);
      root.add(arm);
      cylinder(arm, .055, .065, .23, 0xe0cfb9, [0, -.1, .06], 10);
      sphere(arm, .075, 0xf8efe2, [0, -.22, .12], [1, .75, 1]);
      arms.push(arm);
    }
    // Parcel on the courier's back, with a little red delivery seal.
    box(root, [.25, .27, .18], 0xc9ab87, [-.2, .66, -.17]);
    box(root, [.13, .12, .015], 0xe11d2e, [-.2, .68, -.27]);
    (root as THREE.Group & { userData: { legs: THREE.Group[]; feet: THREE.Group[]; arms: THREE.Group[]; head: THREE.Group } }).userData.legs = legs;
    root.userData.legs = legs;
    root.userData.feet = feet;
    root.userData.arms = arms;
    root.userData.head = head;
    return root;
  }

  function buildScene(currentAgents: OfficeAgent[]) {
    const scene = new THREE.Scene();
    // Transparent canvas lets the office breathe into the dashboard instead of sitting in a colored rectangle.
    scene.background = null;
    scene.fog = new THREE.Fog(0xf2e8d9, 22, 42);

    const hemi = new THREE.HemisphereLight(0xfff6e7, 0xa89071, 2.15);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d7, 3.2);
    sun.position.set(-5, 12, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    sun.shadow.camera.left = -10;
    sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -10;
    sun.shadow.bias = -.00025;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 1.1);
    fill.position.set(8, 7, -4);
    scene.add(fill);

    addFurniture(scene);
    const rigs: RobotRig[] = [];
    const ordered = agentPositions.map((pos, idx) => ({ pos, idx, agent: currentAgents.find((a) => a.id === ['content-studio', 'research-agent', 'workflow-planner', 'strategy-planner'][idx]) ?? currentAgents[idx] })).filter((entry) => entry.agent);
    ordered.forEach(({ pos, idx, agent }) => {
      const rig = makeRobot(scene, agent, idx, pos.x, pos.z, pos.tool, pos.roam);
      rigs.push(rig);
    });
    const roamer = addRoamingBuddy(scene);

    // Shared report sits on the Team Sync island only while a teammate is handing over results.
    const handoffReport = new THREE.Group();
    handoffReport.position.set(.22, .85, 4.13);
    box(handoffReport, [.34, .045, .24], 0xf2d99e, [0, 0, 0]);
    box(handoffReport, [.31, .018, .21], 0xfff6e3, [0, .032, 0]);
    box(handoffReport, [.065, .014, .21], 0xe11d2e, [-.095, .045, 0]);
    box(handoffReport, [.1, .018, .026], 0xc3a47e, [.075, .045, -.055]);
    const reportSeal = sphere(handoffReport, .035, 0xe11d2e, [.11, .055, .07], [1, .6, .3], { emissive: 0xe11d2e, emissiveIntensity: .45 });
    scene.add(handoffReport);
    handoffReport.visible = false;

    const camera = new THREE.OrthographicCamera(-8, 8, 5.5, -5.5, .1, 70);
    camera.position.set(10.5, 12.4, 14.5);
    camera.lookAt(0, .65, -.05);
    camera.updateProjectionMatrix();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const controls = new OrbitControls(camera, canvas);
    controls.target.set(0, .6, 0);
    controls.enableDamping = true;
    controls.dampingFactor = .06;
    controls.enablePan = false;
    controls.minZoom = .7;
    controls.maxZoom = 1.45;
    controls.minPolarAngle = .55;
    controls.maxPolarAngle = 1.16;
    controls.update();

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setClearColor(0xf2e8d9, 0);

    const timer = new THREE.Clock();
    const stationTargets = rigs.map((rig) => rig.hitArea);
    const syncAgents = (next: OfficeAgent[]) => {
      rigs.forEach((rig) => {
        const nextAgent = next.find((a) => a.id === rig.agent.id);
        if (!nextAgent) return;
        const previousAgent = rig.agent;
        const changed = nextAgent.name !== previousAgent.name
          || nextAgent.taskTitle !== previousAgent.taskTitle
          || nextAgent.statusLabel !== previousAgent.statusLabel
          || nextAgent.state !== previousAgent.state
          || nextAgent.runId !== previousAgent.runId;

        // When a real run completes, send its robot to the shared team-sync table once.
        if (
          nextAgent.id !== 'strategy-planner'
          && nextAgent.state === 'done'
          && nextAgent.runId
          && (previousAgent.state !== 'done' || previousAgent.runId !== nextAgent.runId)
        ) {
          const start = rig.root.position.clone();
          start.y = 0;
          // Go around either side of the round table, then approach it from the open aisle.
          const sideX = start.x < 0 ? -1.55 : 1.55;
          rig.deliveryCurve = new THREE.CatmullRomCurve3([
            start,
            new THREE.Vector3(sideX, 0, start.z),
            new THREE.Vector3(sideX, 0, 2.5),
            new THREE.Vector3(.05, 0, 2.5),
            new THREE.Vector3(.05, 0, 2.68)
          ], false, 'centripetal', .25);
          rig.deliveryProgress = 0;
          rig.deliveryPauseUntil = 0;
          rig.deliveryPhase = 'outbound';
          rig.deliveryRunId = nextAgent.runId;
          rig.deliveryFolder.visible = true;
        } else if (nextAgent.state === 'working' || nextAgent.state === 'attention') {
          rig.deliveryPhase = 'idle';
          rig.deliveryCurve = null;
          rig.deliveryProgress = 0;
          rig.deliveryPauseUntil = 0;
          rig.deliveryFolder.visible = false;
        }
        rig.agent = nextAgent;
        if (changed) {
          const texture = makeNameplateTexture(nextAgent);
          const oldTexture = rig.labelTexture;
          const spriteMat = rig.label.material as THREE.SpriteMaterial;
          spriteMat.map = texture;
          spriteMat.needsUpdate = true;
          rig.labelTexture = texture;
          oldTexture.dispose();
          const eyeColor = nextAgent.state === 'attention' ? 0xff8a8a : rig.agent.id === 'research-agent' ? 0xb2e4dc : 0xffd94f;
          rig.faceEyes.forEach((eyeMesh) => {
            const eyeMat = eyeMesh.material as THREE.MeshStandardMaterial;
            eyeMat.color.setHex(eyeColor);
            eyeMat.emissive.setHex(eyeColor);
          });
          const statusColor = nextAgent.state === 'attention'
            ? 0xe11d2e
            : nextAgent.state === 'working'
              ? 0x37a978
              : nextAgent.state === 'done'
                ? 0xe6bb47
                : 0xc5ad8c;
          const beaconMaterial = rig.statusLight.material as THREE.MeshStandardMaterial;
          beaconMaterial.color.setHex(statusColor);
          beaconMaterial.emissive.setHex(statusColor);
          beaconMaterial.emissiveIntensity = nextAgent.state === 'idle' ? .08 : .45;
          const ringMaterial = rig.statusRing.material as THREE.MeshStandardMaterial;
          ringMaterial.color.setHex(statusColor);
          ringMaterial.emissive.setHex(statusColor);
          rig.root.scale.setScalar(1);
        }
      });
    };

    const resize = () => {
      if (!container.clientWidth || !container.clientHeight) return;
      const aspect = container.clientWidth / container.clientHeight;
      const height = Math.max(10.8, 13.1 / Math.max(aspect, .55));
      camera.left = -(height * aspect) / 2;
      camera.right = (height * aspect) / 2;
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    let pointerStart: { x: number; y: number } | null = null;
    const findAgentUnderPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const intersection = raycaster.intersectObjects(stationTargets, false)[0];
      return typeof intersection?.object.userData.agentId === 'string' ? intersection.object.userData.agentId as string : null;
    };
    const onPointerMove = (event: PointerEvent) => {
      hoveredAgentId = findAgentUnderPointer(event);
      canvas.style.cursor = hoveredAgentId ? 'pointer' : 'grab';
    };
    const onPointerLeave = () => {
      hoveredAgentId = null;
      canvas.style.cursor = 'grab';
    };
    const onPointerDown = (event: PointerEvent) => { pointerStart = { x: event.clientX, y: event.clientY }; };
    const onPointerUp = (event: PointerEvent) => {
      if (!pointerStart || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) {
        pointerStart = null;
        return;
      }
      const agentId = findAgentUnderPointer(event);
      if (agentId) onAgentSelect(agentId);
      pointerStart = null;
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('pointerup', onPointerUp);

    const animate = () => {
      const delta = Math.min(timer.getDelta(), .05);
      const time = timer.elapsedTime;
      if (motionEnabled) {
        rigs.forEach((rig) => {
          const working = rig.agent.state === 'running' || rig.agent.state === 'working';
          const needsAttention = rig.agent.state === 'attention' || rig.agent.state === 'failed';
          const finished = rig.agent.state === 'done';
          const strolling = !working && !needsAttention;
          const homeX = rig.baseX;
          const homeZ = rig.deskZ + 1.05;
          let targetX = homeX;
          let targetZ = homeZ;

          const deliveryActive = rig.deliveryPhase === 'outbound'
            || rig.deliveryPhase === 'handoff'
            || rig.deliveryPhase === 'returning';

          // A newly completed run takes its result folder to the shared Team Sync table.
          if (deliveryActive && rig.deliveryCurve) {
            const deliveryCurve = rig.deliveryCurve;
            const curveLength = Math.max(deliveryCurve.getLength(), .01);
            if (rig.deliveryPhase === 'outbound') {
              rig.deliveryProgress = Math.min(1, rig.deliveryProgress + (.62 * delta) / curveLength);
              if (rig.deliveryProgress >= 1) {
                rig.deliveryPhase = 'handoff';
                rig.deliveryPauseUntil = time + 2.6;
                rig.deliveryFolder.visible = false;
              }
            } else if (rig.deliveryPhase === 'handoff' && time >= rig.deliveryPauseUntil) {
              rig.deliveryPhase = 'returning';
              rig.deliveryProgress = 1;
            } else if (rig.deliveryPhase === 'returning') {
              rig.deliveryProgress = Math.max(0, rig.deliveryProgress - (.62 * delta) / curveLength);
              if (rig.deliveryProgress <= 0) {
                rig.deliveryPhase = 'delivered';
                rig.deliveryCurve = null;
                rig.deliveryFolder.visible = false;
              }
            }
            const point = deliveryCurve.getPointAt(THREE.MathUtils.clamp(rig.deliveryProgress, 0, 1));
            targetX = point.x;
            targetZ = point.z;
          } else if (strolling && rig.roamPath.length > 1) {
            // Walk across the office to a destination, take a proper break there,
            // and return along the route. This is an open itinerary, not a tiny closed loop.
            if (time >= rig.pauseUntil) {
              const routeLength = Math.max(rig.roamCurve.getLength(), .01);
              rig.routeProgress += rig.routeDirection * ((.78 * delta) / routeLength);
              if (rig.routeProgress >= 1) {
                rig.routeProgress = 1;
                rig.routeDirection = -1;
                rig.pauseUntil = time + 2.8 + Math.abs(Math.sin(rig.phase * 1.3)) * 2.2;
              } else if (rig.routeProgress <= 0) {
                rig.routeProgress = 0;
                rig.routeDirection = 1;
                rig.pauseUntil = time + 2.1 + Math.abs(Math.cos(rig.phase * 1.7)) * 1.8;
              }
            }
            const point = rig.roamCurve.getPointAt(THREE.MathUtils.clamp(rig.routeProgress, 0, 1));
            targetX = point.x;
            targetZ = point.z;
          }

          const oldX = rig.root.position.x;
          const oldZ = rig.root.position.z;
          const dx = targetX - oldX;
          const dz = targetZ - oldZ;
          const distanceToTarget = Math.hypot(dx, dz);
          const walkSpeed = strolling ? .54 : .62;
          const travelDistance = Math.min(distanceToTarget, walkSpeed * delta);
          if (distanceToTarget > .00001) {
            const proposedX = rig.root.position.x + (dx / distanceToTarget) * travelDistance;
            const proposedZ = rig.root.position.z + (dz / distanceToTarget) * travelDistance;

            // Hard safety envelope around the Team Sync tabletop, its base and monitor.
            // Project each movement step back to the walkable perimeter if a curve overshoots.
            const obstacleDx = proposedX;
            const obstacleDz = proposedZ - 4.18;
            const obstacleDistance = Math.hypot(obstacleDx, obstacleDz);
            const safeRadius = 1.34;
            if (obstacleDistance < safeRadius) {
              const angle = obstacleDistance > .0001 ? Math.atan2(obstacleDz, obstacleDx) : Math.atan2(dz, dx);
              rig.root.position.x = Math.cos(angle) * safeRadius;
              rig.root.position.z = 4.18 + Math.sin(angle) * safeRadius;
            } else {
              rig.root.position.x = proposedX;
              rig.root.position.z = proposedZ;
            }
          }
          const actualDx = rig.root.position.x - oldX;
          const actualDz = rig.root.position.z - oldZ;
          const movedDistance = Math.hypot(actualDx, actualDz);
          const moving = movedDistance > .0002;

          // Turn the complete character toward travel direction before it feels like it is sliding sideways.
          if (moving) {
            const desiredYaw = Math.atan2(actualDx, actualDz);
            const yawDifference = Math.atan2(
              Math.sin(desiredYaw - rig.root.rotation.y),
              Math.cos(desiredYaw - rig.root.rotation.y)
            );
            rig.root.rotation.y += yawDifference * (1 - Math.exp(-delta * 5.2));
          } else if (rig.deliveryPhase === 'handoff') {
            // Face the shared table during the handoff pause.
            const desiredYaw = 0;
            const yawDifference = Math.atan2(
              Math.sin(desiredYaw - rig.root.rotation.y),
              Math.cos(desiredYaw - rig.root.rotation.y)
            );
            rig.root.rotation.y += yawDifference * (1 - Math.exp(-delta * 2.6));
          } else if (working || needsAttention) {
            const desiredYaw = Math.PI;
            const yawDifference = Math.atan2(
              Math.sin(desiredYaw - rig.root.rotation.y),
              Math.cos(desiredYaw - rig.root.rotation.y)
            );
            rig.root.rotation.y += yawDifference * (1 - Math.exp(-delta * 3.8));
          }

          // Real travel advances the gait phase: stopped bots stop stepping.
          if (moving) rig.gaitPhase += movedDistance * 14;
          const atDesk = Math.hypot(rig.root.position.x - homeX, rig.root.position.z - homeZ) < .28;
          rig.chair.visible = atDesk && !moving && !deliveryActive;
          rig.deliveryFolder.visible = deliveryActive && rig.deliveryPhase === 'outbound';

          // Keep the root on the floor; only the swing foot lifts.
          rig.root.position.y = 0;
          rig.head.rotation.y = Math.sin(time * (moving ? .45 : .7) + rig.phase) * (strolling ? .105 : .035);
          rig.head.rotation.z = moving
            ? Math.sin(rig.gaitPhase) * .018
            : Math.sin(time * .7 + rig.phase) * (strolling ? .015 : .006);
          rig.root.rotation.z = moving ? Math.sin(rig.gaitPhase) * .012 : 0;

          rig.leftArm.rotation.x = moving
            ? Math.sin(rig.gaitPhase + Math.PI) * .20
            : working
              ? -.58 + Math.sin(time * 8.2 + rig.phase) * .13
              : finished ? -.28 : -.34 + Math.sin(time * .75 + rig.phase) * .045;
          rig.rightArm.rotation.x = moving
            ? Math.sin(rig.gaitPhase) * .20
            : working
              ? -.58 + Math.sin(time * 8.2 + rig.phase + 1) * .13
              : finished ? -1.0 + Math.sin(time * 1.1) * .07 : -.36 + Math.sin(time * .8 + rig.phase + 1) * .05;
          rig.leftArm.rotation.z = moving
            ? -.1 + Math.sin(rig.gaitPhase + Math.PI) * .075
            : -.1 + Math.sin(time * (working ? 8 : .75) + rig.phase) * (working ? .15 : .035);
          rig.rightArm.rotation.z = moving
            ? .1 + Math.sin(rig.gaitPhase) * .075
            : .1 + Math.sin(time * (working ? 8 : .8) + rig.phase + 2) * (working ? .15 : .035);

          rig.legs.forEach((leg, index) => {
            const stride = Math.sin(rig.gaitPhase + index * Math.PI);
            const swing = Math.max(0, stride);
            const legAngle = moving ? stride * .36 : 0;
            leg.rotation.x = legAngle;
            leg.rotation.z = moving ? stride * .025 : 0;

            const foot = rig.feet[index];
            if (foot) {
              const footHeight = .082 + (moving ? swing * .105 : 0);
              const footZ = foot.position.z;
              foot.position.y = (footHeight - leg.position.y + footZ * Math.sin(legAngle)) / Math.max(.92, Math.cos(legAngle));
              foot.rotation.x = -legAngle;
              foot.rotation.z = -leg.rotation.z;
            }
          });

          const eyeMaterial = rig.faceEyes[0]?.material as THREE.MeshStandardMaterial | undefined;
          if (eyeMaterial) eyeMaterial.emissiveIntensity = working ? .88 + Math.sin(time * 3.5) * .1 : .58;

          const beaconMaterial = rig.statusLight.material as THREE.MeshStandardMaterial;
          const receivingHandoff = rig.agent.id === 'strategy-planner'
            && rigs.some((other) => other.deliveryPhase === 'handoff');
          const pulsing = rig.agent.state === 'working' || rig.agent.state === 'attention' || receivingHandoff;
          if (receivingHandoff) {
            beaconMaterial.color.setHex(0x37a978);
            beaconMaterial.emissive.setHex(0x37a978);
          }
          beaconMaterial.emissiveIntensity = pulsing
            ? .45 + (Math.sin(time * (rig.agent.state === 'attention' ? 5.2 : 2.8) + rig.phase) + 1) * .23
            : rig.agent.state === 'idle' ? .08 : .28;
          rig.statusRing.scale.setScalar(1 + (pulsing ? .08 * (Math.sin(time * 2.5 + rig.phase) + 1) : 0));
          rig.root.scale.setScalar(rig.agent.id === hoveredAgentId ? 1.055 : 1);
        });
        handoffReport.visible = rigs.some((rig) => rig.deliveryPhase === 'handoff');
        handoffReport.rotation.y = Math.sin(time * .7) * .035;
        reportSeal.material && ((reportSeal.material as THREE.MeshStandardMaterial).emissiveIntensity = .25 + (Math.sin(time * 2.4) + 1) * .12);
        // The little courier follows a slower shuttle and turns through the whole arc,
        // rather than instantly flipping its facing direction at each endpoint.
        const previousCourierX = roamer.position.x;
        const previousCourierZ = roamer.position.z;
        const travel = (Math.sin(time * .09) + 1) / 2;
        roamer.position.x = -5.3 + travel * 10.3;
        // The courier patrol stays in the foreground aisle, below the shared table footprint.
        roamer.position.z = 2.72 + Math.sin(time * .22) * .06;
        const courierDx = roamer.position.x - previousCourierX;
        const courierDz = roamer.position.z - previousCourierZ;
        const courierDistance = Math.hypot(courierDx, courierDz);
        if (courierDistance > .0001) {
          roamerGaitPhase += courierDistance * 14;
          const desiredYaw = Math.atan2(courierDx, courierDz);
          const yawDifference = Math.atan2(
            Math.sin(desiredYaw - roamer.rotation.y),
            Math.cos(desiredYaw - roamer.rotation.y)
          );
          roamer.rotation.y += yawDifference * (1 - Math.exp(-delta * 4.2));
        }
        // Keep the courier chassis grounded; lift only its swing foot.
        roamer.position.y = 0;
        const limbs = roamer.userData as { legs: THREE.Group[]; feet: THREE.Group[]; arms: THREE.Group[]; head: THREE.Group };
        limbs.legs.forEach((leg, i) => {
          const stride = Math.sin(roamerGaitPhase + i * Math.PI);
          const legAngle = stride * .24;
          leg.rotation.x = legAngle;
          const foot = limbs.feet[i];
          if (foot) {
            const lift = Math.max(0, stride) * .075;
            const footZ = foot.position.z;
            foot.position.y = (.053 + lift - leg.position.y + footZ * Math.sin(legAngle)) / Math.max(.94, Math.cos(legAngle));
            foot.rotation.x = -legAngle;
          }
        });
        limbs.arms.forEach((arm, i) => { arm.rotation.x = Math.sin(roamerGaitPhase + i * Math.PI + .6) * .15; });
        limbs.head.rotation.y = Math.sin(time * .65) * .075;
      }
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    let roamerGaitPhase = 0;
    let frame = requestAnimationFrame(animate);

    return {
      syncAgents,
      dispose: () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerleave', onPointerLeave);
        canvas.removeEventListener('pointerup', onPointerUp);
        controls.dispose();
        scene.traverse((object) => {
          const renderable = object as THREE.Mesh;
          if (renderable.geometry) renderable.geometry.dispose();
          const mat = renderable.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else if (mat) mat.dispose();
        });
        renderer.dispose();
      }
    };
  }

  onMount(() => {
    try {
      controller = buildScene(agents);
      sceneReady = true;
      return () => { controller?.dispose(); controller = null; };
    } catch (error) {
      console.error('Could not initialize VIXORA miniature 3D office', error);
      webglUnavailable = true;
    }
  });

  $effect(() => {
    const current = agents;
    if (sceneReady) controller?.syncAgents(current);
  });
</script>

<div class="miniature-office" bind:this={container}>
  <canvas bind:this={canvas} class="miniature-office-canvas" aria-label="Miniatur 3D ruang kerja agent AI. Drag untuk memutar sudut pandang, scroll untuk zoom, klik meja untuk membuka Task Center."></canvas>
  {#if webglUnavailable}
    <div class="miniature-office-fallback">
      <strong>Miniatur 3D belum tersedia di browser ini.</strong>
      <span>Aktifkan dukungan WebGL atau gunakan browser versi terbaru.</span>
      <div class="mini-fallback-roster">
        {#each agents as agent (agent.id)}
          <button type="button" onclick={() => onAgentSelect(agent.id)}>
            <span class="mini-fallback-status" class:mini-state-working={agent.state === 'working'} class:mini-state-failed={agent.state === 'attention'}></span>
            <span><strong>{agent.name}</strong><small>{agent.taskTitle} · {agent.statusLabel}</small></span>
            <span>↗</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
  <div class="miniature-office-hint"><span class="hint-dot"></span> MINIATURE 3D STUDIO <span class="hint-divider">/</span> DRAG TO ORBIT <span class="hint-divider">·</span> SCROLL TO ZOOM</div>
</div>

<style>
  .miniature-office{position:relative;overflow:visible;width:100%;height:clamp(620px,66vw,850px);min-height:620px;border:0;border-radius:0;background:transparent;box-shadow:none;isolation:isolate}
  .miniature-office::after{position:absolute;inset:auto 3% 1%;height:7%;content:"";border-radius:50%;background:radial-gradient(ellipse,rgba(141,111,80,.11),transparent 72%);filter:blur(10px);pointer-events:none;z-index:-1}
  .miniature-office-canvas{position:relative;z-index:1;display:block;width:100%;height:100%;outline:none;touch-action:pan-y;cursor:grab;background:transparent}
  .miniature-office-canvas:active{cursor:grabbing}
  .miniature-office-hint{position:absolute;left:14px;bottom:12px;display:flex;align-items:center;gap:7px;padding:8px 11px;border:1px solid rgba(174,145,110,.35);border-radius:7px;background:rgba(255,250,240,.88);color:#88745f;font-size:9px;font-weight:800;letter-spacing:.07em;pointer-events:none;backdrop-filter:blur(4px)}
  .hint-dot{width:6px;height:6px;border-radius:50%;background:#e11d2e;box-shadow:0 0 6px rgba(225,29,46,.28)}
  .hint-divider{color:#c3ab8c}
  .miniature-office-fallback{position:absolute;inset:0;display:grid;align-content:center;gap:9px;padding:24px;background:#f4eadb;color:#302923}
  .miniature-office-fallback>strong{font-size:16px}
  .miniature-office-fallback>span{font-size:12px;color:#897965}
  .mini-fallback-roster{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}
  .mini-fallback-roster button{display:flex;align-items:center;gap:8px;padding:10px;border:1px solid #dfcbb1;border-radius:8px;background:#fff9ef;text-align:left;cursor:pointer}
  .mini-fallback-status{width:7px;height:7px;flex:0 0 auto;border-radius:50%;background:#b6a28b}
  .mini-fallback-status.mini-state-working{background:#299565}
  .mini-fallback-status.mini-state-failed{background:#e11d2e}
  .mini-fallback-roster button>span:nth-child(2){display:grid;gap:4px;min-width:0;flex:1}
  .mini-fallback-roster strong{font-size:11px;color:#322c26}
  .mini-fallback-roster small{overflow:hidden;color:#8a7b68;font-size:9px;text-overflow:ellipsis;white-space:nowrap}
  @media(max-width:680px){.miniature-office{height:680px;min-height:680px}.miniature-office-hint{font-size:8px;left:8px;bottom:7px;gap:5px;padding:7px}.mini-fallback-roster{grid-template-columns:1fr}}
  @media(prefers-reduced-motion:reduce){.miniature-office *{scroll-behavior:auto}}
</style>
