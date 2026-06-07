import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import TWEEN from "@tweenjs/tween.js";
import type { Container } from "../types/container";
import { YARD_CONFIG, STATUS_COLORS } from "../types/container";

export class YardScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private containerMeshes: Map<string, THREE.Mesh> = new Map();
  private containerGroup: THREE.Group;
  private gantry: THREE.Group | null = null;
  private trolley: THREE.Group | null = null;
  private spreader: THREE.Mesh | null = null;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private hoveredMesh: THREE.Mesh | null = null;
  private originalColors: Map<THREE.Mesh, THREE.Color> = new Map();
  private heatmapMode: boolean = false;
  private heatmapMeshes: THREE.Mesh[] = [];
  private onContainerHover:
    | ((container: Container | null, event: MouseEvent) => void)
    | null = null;
  private onContainerClick: ((container: Container) => void) | null = null;
  private animationId: number = 0;
  private highlightMesh: THREE.Mesh | null = null;
  private blinkInterval: number | null = null;
  private exitPosition: { col: number; row: number } = { col: 0, row: -2 };

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.scene.fog = new THREE.Fog(0x1a1a2e, 80, 200);

    const aspect = canvas.clientWidth / canvas.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    this.camera.position.set(25, 30, 40);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 100;
    this.controls.maxPolarAngle = Math.PI / 2.1;

    this.containerGroup = new THREE.Group();
    this.scene.add(this.containerGroup);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.setupLights();
    this.createGround();
    this.createGantry();
    this.createHeatmapBase();
    this.animate();

    window.addEventListener("resize", this.handleResize);
    canvas.addEventListener("mousemove", this.handleMouseMove);
    canvas.addEventListener("click", this.handleClick);
  }

  private setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(30, 50, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 200;
    dirLight.shadow.camera.left = -60;
    dirLight.shadow.camera.right = 60;
    dirLight.shadow.camera.top = 60;
    dirLight.shadow.camera.bottom = -60;
    this.scene.add(dirLight);

    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x2d3436, 0.4);
    this.scene.add(hemiLight);
  }

  private createGround() {
    const yardWidth =
      YARD_CONFIG.cols * (YARD_CONFIG.containerWidth + YARD_CONFIG.gap) +
      YARD_CONFIG.gap;
    const yardDepth =
      YARD_CONFIG.rows * (YARD_CONFIG.containerDepth + YARD_CONFIG.gap) +
      YARD_CONFIG.gap;

    const groundGeometry = new THREE.PlaneGeometry(
      yardWidth + 40,
      yardDepth + 40,
    );
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d3436,
      roughness: 0.9,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const yardGroundGeo = new THREE.PlaneGeometry(yardWidth, yardDepth);
    const yardGroundMat = new THREE.MeshStandardMaterial({
      color: 0x4a5568,
      roughness: 0.8,
    });
    const yardGround = new THREE.Mesh(yardGroundGeo, yardGroundMat);
    yardGround.rotation.x = -Math.PI / 2;
    yardGround.position.y = 0.01;
    yardGround.receiveShadow = true;
    this.scene.add(yardGround);

    this.createRailTracks(yardWidth, yardDepth);
    this.createGridLines(yardWidth, yardDepth);
  }

  private createRailTracks(yardWidth: number, yardDepth: number) {
    const railMaterial = new THREE.MeshStandardMaterial({ color: 0x718096 });

    const railY = 0.05;
    const railWidth = 0.3;
    const railHeight = 0.1;

    const offsetX = yardWidth / 2 + 4;

    const railGeo = new THREE.BoxGeometry(
      railWidth,
      railHeight,
      yardDepth + 10,
    );
    const rail1 = new THREE.Mesh(railGeo, railMaterial);
    rail1.position.set(offsetX, railY, 0);
    rail1.receiveShadow = true;
    this.scene.add(rail1);

    const rail2 = new THREE.Mesh(railGeo, railMaterial);
    rail2.position.set(-offsetX, railY, 0);
    rail2.receiveShadow = true;
    this.scene.add(rail2);
  }

  private createGridLines(yardWidth: number, yardDepth: number) {
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x2d3748,
      transparent: true,
      opacity: 0.5,
    });
    const halfW = yardWidth / 2;
    const halfD = yardDepth / 2;

    const verticalPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= YARD_CONFIG.cols; i++) {
      const x =
        -halfW +
        i * (YARD_CONFIG.containerWidth + YARD_CONFIG.gap) +
        YARD_CONFIG.gap / 2;
      verticalPoints.push(new THREE.Vector3(x, 0.02, -halfD));
      verticalPoints.push(new THREE.Vector3(x, 0.02, halfD));
    }
    const vGeo = new THREE.BufferGeometry().setFromPoints(verticalPoints);
    this.scene.add(new THREE.LineSegments(vGeo, lineMaterial));

    const horizontalPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= YARD_CONFIG.rows; i++) {
      const z =
        -halfD +
        i * (YARD_CONFIG.containerDepth + YARD_CONFIG.gap) +
        YARD_CONFIG.gap / 2;
      horizontalPoints.push(new THREE.Vector3(-halfW, 0.02, z));
      horizontalPoints.push(new THREE.Vector3(halfW, 0.02, z));
    }
    const hGeo = new THREE.BufferGeometry().setFromPoints(horizontalPoints);
    this.scene.add(new THREE.LineSegments(hGeo, lineMaterial));
  }

  private createGantry() {
    this.gantry = new THREE.Group();

    const beamMaterial = new THREE.MeshStandardMaterial({ color: 0x48bb78 });
    const legMaterial = new THREE.MeshStandardMaterial({ color: 0x38a169 });

    const yardWidth =
      YARD_CONFIG.cols * (YARD_CONFIG.containerWidth + YARD_CONFIG.gap) +
      YARD_CONFIG.gap;
    const yardDepth =
      YARD_CONFIG.rows * (YARD_CONFIG.containerDepth + YARD_CONFIG.gap) +
      YARD_CONFIG.gap;
    const gantryHeight =
      YARD_CONFIG.maxTiers * YARD_CONFIG.containerHeight + 10;
    const railOffset = yardWidth / 2 + 4;

    const legGeo = new THREE.BoxGeometry(1, gantryHeight, 1);
    const leg1 = new THREE.Mesh(legGeo, legMaterial);
    leg1.position.set(railOffset, gantryHeight / 2, 0);
    leg1.castShadow = true;
    this.gantry.add(leg1);

    const leg2 = new THREE.Mesh(legGeo, legMaterial);
    leg2.position.set(-railOffset, gantryHeight / 2, 0);
    leg2.castShadow = true;
    this.gantry.add(leg2);

    const beamGeo = new THREE.BoxGeometry(railOffset * 2 + 1, 1.5, 2);
    const beam = new THREE.Mesh(beamGeo, beamMaterial);
    beam.position.set(0, gantryHeight, 0);
    beam.castShadow = true;
    this.gantry.add(beam);

    this.trolley = new THREE.Group();
    this.trolley.position.set(0, gantryHeight - 0.5, 0);
    this.gantry.add(this.trolley);

    const trolleyBody = new THREE.Mesh(
      new THREE.BoxGeometry(4, 1.2, 3),
      new THREE.MeshStandardMaterial({ color: 0x68d391 }),
    );
    trolleyBody.castShadow = true;
    this.trolley.add(trolleyBody);

    this.spreader = new THREE.Mesh(
      new THREE.BoxGeometry(
        YARD_CONFIG.containerWidth * 1.1,
        0.4,
        YARD_CONFIG.containerDepth * 0.8,
      ),
      new THREE.MeshStandardMaterial({ color: 0xecc94b }),
    );
    this.spreader.position.set(0, -4, 0);
    this.spreader.castShadow = true;
    this.trolley.add(this.spreader);

    this.scene.add(this.gantry);
  }

  private createHeatmapBase() {
    const yardWidth =
      YARD_CONFIG.cols * (YARD_CONFIG.containerWidth + YARD_CONFIG.gap) +
      YARD_CONFIG.gap;
    const yardDepth =
      YARD_CONFIG.rows * (YARD_CONFIG.containerDepth + YARD_CONFIG.gap) +
      YARD_CONFIG.gap;
    const halfW = yardWidth / 2;
    const halfD = yardDepth / 2;

    for (let col = 0; col < YARD_CONFIG.cols; col++) {
      for (let row = 0; row < YARD_CONFIG.rows; row++) {
        const x =
          -halfW +
          YARD_CONFIG.gap +
          col * (YARD_CONFIG.containerWidth + YARD_CONFIG.gap) +
          YARD_CONFIG.containerWidth / 2;
        const z =
          -halfD +
          YARD_CONFIG.gap +
          row * (YARD_CONFIG.containerDepth + YARD_CONFIG.gap) +
          YARD_CONFIG.containerDepth / 2;

        const geo = new THREE.BoxGeometry(
          YARD_CONFIG.containerWidth,
          0.2,
          YARD_CONFIG.containerDepth,
        );
        const mat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.8,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, 0.1, z);
        mesh.visible = false;
        mesh.userData = { col, row, type: "heatmap" };
        this.heatmapMeshes.push(mesh);
        this.scene.add(mesh);
      }
    }
  }

  private getContainerWorldPosition(
    col: number,
    row: number,
    tier: number,
  ): THREE.Vector3 {
    const yardWidth =
      YARD_CONFIG.cols * (YARD_CONFIG.containerWidth + YARD_CONFIG.gap) +
      YARD_CONFIG.gap;
    const yardDepth =
      YARD_CONFIG.rows * (YARD_CONFIG.containerDepth + YARD_CONFIG.gap) +
      YARD_CONFIG.gap;
    const halfW = yardWidth / 2;
    const halfD = yardDepth / 2;

    const x =
      -halfW +
      YARD_CONFIG.gap +
      col * (YARD_CONFIG.containerWidth + YARD_CONFIG.gap) +
      YARD_CONFIG.containerWidth / 2;
    const z =
      -halfD +
      YARD_CONFIG.gap +
      row * (YARD_CONFIG.containerDepth + YARD_CONFIG.gap) +
      YARD_CONFIG.containerDepth / 2;
    const y =
      tier * YARD_CONFIG.containerHeight + YARD_CONFIG.containerHeight / 2;

    return new THREE.Vector3(x, y, z);
  }

  public loadContainers(containers: Container[]) {
    this.clearContainers();

    containers.forEach((container) => {
      const pos = this.getContainerWorldPosition(
        container.position.col,
        container.position.row,
        container.position.tier,
      );

      const geo = new THREE.BoxGeometry(
        YARD_CONFIG.containerWidth,
        YARD_CONFIG.containerHeight,
        YARD_CONFIG.containerDepth,
      );

      const color = STATUS_COLORS[container.status];
      const mat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.7,
        metalness: 0.2,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { container, type: "container" };

      const edges = new THREE.EdgesGeometry(geo);
      const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0x1a202c }),
      );
      mesh.add(line);

      this.containerMeshes.set(container.id, mesh);
      this.containerGroup.add(mesh);
    });
  }

  private clearContainers() {
    this.containerMeshes.forEach((mesh) => {
      this.containerGroup.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
    });
    this.containerMeshes.clear();
  }

  private handleResize = () => {
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private handleMouseMove = (event: MouseEvent) => {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(
      this.containerGroup.children,
      false,
    );

    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh;
      if (mesh !== this.hoveredMesh) {
        this.restoreHoverColor();
        this.hoveredMesh = mesh;
        this.setHoverColor(mesh);
      }

      if (this.onContainerHover && mesh.userData.container) {
        this.onContainerHover(mesh.userData.container, event);
      }
    } else {
      if (this.hoveredMesh) {
        this.restoreHoverColor();
        this.hoveredMesh = null;
      }
      if (this.onContainerHover) {
        this.onContainerHover(null, event);
      }
    }
  };

  private handleClick = (event: MouseEvent) => {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(
      this.containerGroup.children,
      false,
    );

    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh;
      if (mesh.userData.container && this.onContainerClick) {
        this.onContainerClick(mesh.userData.container);
      }
    }
  };

  private setHoverColor(mesh: THREE.Mesh) {
    const material = mesh.material as THREE.MeshStandardMaterial;
    this.originalColors.set(mesh, material.color.clone());
    material.emissive = new THREE.Color(0x4fd1c5);
    material.emissiveIntensity = 0.5;
  }

  private restoreHoverColor() {
    if (this.hoveredMesh) {
      const material = this.hoveredMesh.material as THREE.MeshStandardMaterial;
      material.emissive = new THREE.Color(0x000000);
      material.emissiveIntensity = 0;
      this.originalColors.delete(this.hoveredMesh);
    }
  }

  public setOnContainerHover(
    callback: (container: Container | null, event: MouseEvent) => void,
  ) {
    this.onContainerHover = callback;
  }

  public setOnContainerClick(callback: (container: Container) => void) {
    this.onContainerClick = callback;
  }

  public setViewPreset(view: "top" | "side" | "bird") {
    const yardWidth =
      YARD_CONFIG.cols * (YARD_CONFIG.containerWidth + YARD_CONFIG.gap);
    const yardDepth =
      YARD_CONFIG.rows * (YARD_CONFIG.containerDepth + YARD_CONFIG.gap);

    let targetPos = new THREE.Vector3();
    let targetTarget = new THREE.Vector3(0, 0, 0);

    switch (view) {
      case "top":
        targetPos.set(0, Math.max(yardWidth, yardDepth) * 1.2, 0.1);
        break;
      case "side":
        targetPos.set(yardWidth * 1.2, 15, 0);
        break;
      case "bird":
        targetPos.set(yardWidth * 0.8, yardDepth * 0.7, yardDepth * 0.8);
        break;
    }

    new TWEEN.Tween(this.camera.position)
      .to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, 1000)
      .easing(TWEEN.Easing.Cubic.InOut)
      .start();

    new TWEEN.Tween(this.controls.target)
      .to({ x: targetTarget.x, y: targetTarget.y, z: targetTarget.z }, 1000)
      .easing(TWEEN.Easing.Cubic.InOut)
      .start();

    this.controls.update();
  }

  public setHeatmapMode(enabled: boolean, containers: Container[]) {
    this.heatmapMode = enabled;
    this.containerGroup.visible = !enabled;

    this.heatmapMeshes.forEach((mesh) => {
      mesh.visible = enabled;
    });

    if (enabled) {
      this.updateHeatmap(containers);
    }
  }

  private updateHeatmap(containers: Container[]) {
    const heightMap: number[][] = Array(YARD_CONFIG.cols)
      .fill(null)
      .map(() => Array(YARD_CONFIG.rows).fill(0));

    containers.forEach((c) => {
      if (c.position.tier + 1 > heightMap[c.position.col][c.position.row]) {
        heightMap[c.position.col][c.position.row] = c.position.tier + 1;
      }
    });

    this.heatmapMeshes.forEach((mesh) => {
      const { col, row } = mesh.userData;
      const height = heightMap[col][row];
      const ratio = height / YARD_CONFIG.maxTiers;

      const color = this.getHeatmapColor(ratio);
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.color.set(color);
    });
  }

  private getHeatmapColor(ratio: number): string {
    if (ratio === 0) return "#ffffff";

    const r = Math.floor(255 * ratio);
    const g = Math.floor(255 * (1 - ratio) * 0.9);
    const b = Math.floor(255 * (1 - ratio) * 0.9);

    return `rgb(${r}, ${g}, ${b})`;
  }

  public flyToContainer(containerId: string) {
    const mesh = this.containerMeshes.get(containerId);
    if (!mesh) return;

    const targetPos = mesh.position.clone();
    const offset = new THREE.Vector3(10, 8, 10);
    const cameraTarget = targetPos.clone().add(offset);

    this.stopBlink();

    const highlightGeo = new THREE.BoxGeometry(
      YARD_CONFIG.containerWidth * 1.15,
      YARD_CONFIG.containerHeight * 1.15,
      YARD_CONFIG.containerDepth * 1.15,
    );
    const highlightMat = new THREE.MeshBasicMaterial({
      color: 0x4fd1c5,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    this.highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
    this.highlightMesh.position.copy(mesh.position);
    this.scene.add(this.highlightMesh);

    new TWEEN.Tween(this.camera.position)
      .to({ x: cameraTarget.x, y: cameraTarget.y, z: cameraTarget.z }, 1500)
      .easing(TWEEN.Easing.Cubic.InOut)
      .start();

    new TWEEN.Tween(this.controls.target)
      .to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, 1500)
      .easing(TWEEN.Easing.Cubic.InOut)
      .start();

    this.startBlink();
  }

  private startBlink() {
    if (!this.highlightMesh) return;

    let visible = true;
    this.blinkInterval = window.setInterval(() => {
      if (this.highlightMesh) {
        visible = !visible;
        this.highlightMesh.visible = visible;
      }
    }, 300);

    setTimeout(() => {
      this.stopBlink();
    }, 4000);
  }

  private stopBlink() {
    if (this.blinkInterval) {
      clearInterval(this.blinkInterval);
      this.blinkInterval = null;
    }
    if (this.highlightMesh) {
      this.scene.remove(this.highlightMesh);
      this.highlightMesh.geometry.dispose();
      if (Array.isArray(this.highlightMesh.material)) {
        this.highlightMesh.material.forEach((m) => m.dispose());
      } else {
        this.highlightMesh.material.dispose();
      }
      this.highlightMesh = null;
    }
  }

  public async performDischargeAnimation(
    container: Container,
    containers: Container[],
  ): Promise<number> {
    if (!this.gantry || !this.trolley || !this.spreader) return 0;

    const aboveContainers = containers
      .filter(
        (c) =>
          c.position.col === container.position.col &&
          c.position.row === container.position.row &&
          c.position.tier > container.position.tier,
      )
      .sort((a, b) => b.position.tier - a.position.tier);

    let rehandleCount = 0;
    const tempPosition = this.findTempPosition(containers);

    const containerMesh = this.containerMeshes.get(container.id);
    if (!containerMesh) return 0;

    for (const aboveContainer of aboveContainers) {
      const aboveMesh = this.containerMeshes.get(aboveContainer.id);
      if (!aboveMesh) continue;

      rehandleCount++;
      await this.moveContainerWithGantry(
        aboveContainer.position.col,
        aboveContainer.position.row,
        aboveContainer.position.tier,
        tempPosition.col,
        tempPosition.row,
        0,
        aboveMesh,
      );

      aboveContainer.position.col = tempPosition.col;
      aboveContainer.position.row = tempPosition.row;
      aboveContainer.position.tier = 0;

      const newPos = this.getContainerWorldPosition(
        tempPosition.col,
        tempPosition.row,
        0,
      );
      aboveMesh.position.copy(newPos);
    }

    await this.moveContainerWithGantry(
      container.position.col,
      container.position.row,
      container.position.tier,
      this.exitPosition.col,
      this.exitPosition.row,
      0,
      containerMesh,
    );

    this.containerGroup.remove(containerMesh);
    this.containerMeshes.delete(container.id);

    return rehandleCount;
  }

  private findTempPosition(containers: Container[]): {
    col: number;
    row: number;
  } {
    const occupied = new Set<string>();
    containers.forEach((c) => {
      if (c.position.tier === 0) {
        occupied.add(`${c.position.col}-${c.position.row}`);
      }
    });

    for (let col = YARD_CONFIG.cols - 1; col >= 0; col--) {
      for (let row = YARD_CONFIG.rows - 1; row >= 0; row--) {
        if (!occupied.has(`${col}-${row}`)) {
          return { col, row };
        }
      }
    }
    return { col: 0, row: 0 };
  }

  private tweenTo(
    target: any,
    props: any,
    duration: number,
    onUpdate?: () => void,
  ): Promise<void> {
    return new Promise((resolve) => {
      const tween = new TWEEN.Tween(target)
        .to(props, duration)
        .easing(TWEEN.Easing.Cubic.InOut)
        .onUpdate(() => {
          if (onUpdate) onUpdate();
        })
        .onComplete(() => resolve());
      tween.start();
    });
  }

  private getSpreaderWorldPosition(): THREE.Vector3 {
    if (!this.spreader) return new THREE.Vector3();
    const worldPos = new THREE.Vector3();
    this.spreader.getWorldPosition(worldPos);
    return worldPos;
  }

  private moveContainerWithGantry(
    fromCol: number,
    fromRow: number,
    fromTier: number,
    toCol: number,
    toRow: number,
    toTier: number,
    containerMesh: THREE.Mesh,
  ): Promise<void> {
    return new Promise(async (resolve) => {
      if (!this.gantry || !this.trolley || !this.spreader) {
        resolve();
        return;
      }

      const fromPos = this.getContainerWorldPosition(
        fromCol,
        fromRow,
        fromTier,
      );
      const toPos = this.getContainerWorldPosition(toCol, toRow, toTier);
      const liftHeight = YARD_CONFIG.maxTiers * YARD_CONFIG.containerHeight + 3;

      await this.tweenTo(this.gantry.position, { z: fromPos.z }, 800);

      const trolleyLocalX = fromPos.x - this.gantry.position.x;
      await this.tweenTo(this.trolley.position, { x: trolleyLocalX }, 600);

      const spreaderDownY =
        fromPos.y +
        YARD_CONFIG.containerHeight / 2 +
        0.5 -
        this.trolley.position.y;
      await this.tweenTo(this.spreader.position, { y: spreaderDownY }, 600);

      let isAttached = false;
      const spreaderUpY =
        -liftHeight + this.trolley.position.y - YARD_CONFIG.containerHeight / 2;

      await new Promise<void>((res) => {
        const tween = new TWEEN.Tween(this.spreader.position)
          .to({ y: -liftHeight }, 700)
          .easing(TWEEN.Easing.Cubic.InOut)
          .onUpdate(() => {
            if (isAttached) {
              const spreaderWorldPos = this.getSpreaderWorldPosition();
              containerMesh.position.x = spreaderWorldPos.x;
              containerMesh.position.y =
                spreaderWorldPos.y - YARD_CONFIG.containerHeight / 2 - 0.5;
              containerMesh.position.z = spreaderWorldPos.z;
            }
          })
          .onStart(() => {
            isAttached = true;
            const spreaderWorldPos = this.getSpreaderWorldPosition();
            containerMesh.position.x = spreaderWorldPos.x;
            containerMesh.position.y =
              spreaderWorldPos.y - YARD_CONFIG.containerHeight / 2 - 0.5;
            containerMesh.position.z = spreaderWorldPos.z;
          })
          .onComplete(() => res());
        tween.start();
      });

      const toTrolleyLocalX = toPos.x - this.gantry.position.x;
      await new Promise<void>((res) => {
        const tween = new TWEEN.Tween(this.trolley.position)
          .to({ x: toTrolleyLocalX }, 900)
          .easing(TWEEN.Easing.Cubic.InOut)
          .onUpdate(() => {
            if (isAttached) {
              const spreaderWorldPos = this.getSpreaderWorldPosition();
              containerMesh.position.x = spreaderWorldPos.x;
              containerMesh.position.z = spreaderWorldPos.z;
            }
          })
          .onComplete(() => res());
        tween.start();
      });

      await new Promise<void>((res) => {
        const tween = new TWEEN.Tween(this.gantry.position)
          .to({ z: toPos.z }, 900)
          .easing(TWEEN.Easing.Cubic.InOut)
          .onUpdate(() => {
            if (isAttached) {
              const spreaderWorldPos = this.getSpreaderWorldPosition();
              containerMesh.position.z = spreaderWorldPos.z;
            }
          })
          .onComplete(() => res());
        tween.start();
      });

      const targetSpreaderY =
        toPos.y +
        YARD_CONFIG.containerHeight / 2 +
        0.5 -
        this.trolley.position.y;
      await new Promise<void>((res) => {
        const tween = new TWEEN.Tween(this.spreader.position)
          .to({ y: targetSpreaderY }, 700)
          .easing(TWEEN.Easing.Cubic.InOut)
          .onUpdate(() => {
            if (isAttached) {
              const spreaderWorldPos = this.getSpreaderWorldPosition();
              containerMesh.position.y =
                spreaderWorldPos.y - YARD_CONFIG.containerHeight / 2 - 0.5;
            }
          })
          .onComplete(() => {
            isAttached = false;
            containerMesh.position.copy(toPos);
            res();
          });
        tween.start();
      });

      await this.tweenTo(this.spreader.position, { y: -liftHeight }, 600);

      resolve();
    });
  }

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);
    TWEEN.update();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  public dispose() {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener("resize", this.handleResize);
    this.renderer.dispose();
    this.stopBlink();
    this.clearContainers();
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  public getControls(): OrbitControls {
    return this.controls;
  }

  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }
}
