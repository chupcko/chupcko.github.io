import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';

class Cgl3dElement extends HTMLElement {

  static vertices = [
    1, 0, 0,
    4, 0, 0,
    1, 0, 1,
    5, 0, 1,
    1, 1, 0,
    4, 1, 0,
    5, 3, 1,
    4, 2, 0,
    4, 3, 0,
    4, 1, 1,
    1, 1, 1,
    4, 2, 1,
    2, 3, 1,
    2, 2, 1,
    0, 1, 1,
    0, 1, 4,
    1, 0, 4,
    1, 0, 5,
    1, 4, 0,
    0, 4, 1,
    1, 5, 0,
    2, 3, 0,
    2, 2, 0,
    1, 1, 4,
    1, 1, 5,
    4, 0, 5,
    5, 0, 4,
    1, 4, 1,
    4, 5, 0,
    4, 4, 0,
    1, 5, 1,
    4, 5, 1,
    5, 4, 1,
    5, 1, 4,
    4, 1, 5
  ];

  static indices = [
     0,  1,  2,
     1,  3,  2,
     4,  5,  0,
     0,  5,  1,
     6,  7,  8,
     3,  1,  5,
     3,  5,  7,
     3,  7,  6,
     9, 10,  2,
     3,  9,  2,
    11, 12, 13,
     6, 11,  9,
     6, 12, 11,
     6,  9,  3,
     2, 14,  0,
    15, 14,  2,
    16, 15,  2,
    17, 15, 16,
    18, 19, 20,
    14, 19, 18,
     4, 14, 18,
     0, 14,  4,
    10,  9,  4,
     4,  9,  5,
    12,  8, 21,
    12,  6,  8,
    22,  8,  7,
    21,  8, 22,
     9, 11,  5,
     5, 11,  7,
    16,  2, 23,
    23,  2, 10,
    11, 13,  7,
     7, 13, 22,
    13, 12, 22,
    22, 12, 21,
    15, 17, 24,
    16, 25, 17,
    16, 26, 25,
    27,  4, 18,
    27, 10,  4,
    20, 28, 18,
    18, 28, 29,
    19, 30, 20,
    27, 14, 10,
    27, 19, 14,
    30, 19, 27,
    31, 27, 32,
    31, 30, 27,
    26, 16, 33,
    33, 16, 23,
    25, 24, 17,
    34, 24, 25,
    25, 26, 34,
    34, 26, 33,
    32, 27, 29,
    29, 27, 18,
    28, 20, 31,
    31, 20, 30,
    32, 29, 28,
    31, 32, 28,
    23, 10, 14,
    23, 14, 15,
    24, 23, 15,
    34, 33, 23,
    34, 23, 24
  ];

  static autoplayViews = [
    { x: -Math.PI/2, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: Math.PI/2, z: 0 }
  ];

  connectedCallback() {
    this.options = this.readOptions();
    this.applyHostStyles();
    this.textContent = '';
    this.isDragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.autoplay = this.options.autoplay;
    this.autoplayResumeTimer = 0;
    this.animationFrame = 0;
    this.resizeFrame = 0;
    this.lastFrameTime = 0;
    this.autoplayStartTime = performance.now();
    this.resumePath = null;
    this.resumeStartTime = 0;
    this.resumeTargetIndex = 0;

    this.createScene();
    this.createRenderer();
    this.createModel();
    this.createLighting();
    this.createCamera();
    this.bindHandlers();
    this.addHandlers();
    this.setAutoplayStartTime(performance.now(), this.options.initialView);
    this.animationFrame = requestAnimationFrame(this.onAnimationFrame);
  }

  disconnectedCallback() {
    this.removeHandlers();
    window.clearTimeout(this.autoplayResumeTimer);

    if(this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = 0;
    }

    if(this.resizeFrame) {
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = 0;
    }

    if(this.geometry) {
      this.geometry.dispose();
      this.geometry = null;
    }

    if(this.material) {
      this.material.dispose();
      this.material = null;
    }

    if(this.edgesGeometry) {
      this.edgesGeometry.dispose();
      this.edgesGeometry = null;
    }

    if(this.edgesMaterial) {
      this.edgesMaterial.dispose();
      this.edgesMaterial = null;
    }

    if(this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.textContent = '';
  }

  readTextAttribute(name, fallback) {
    const rawValue = this.getAttribute(name);

    if(rawValue === null || rawValue.trim() === '') {
      return fallback;
    }

    return rawValue;
  }

  readNumberAttribute(name, fallback) {
    const rawValue = this.getAttribute(name);

    if(rawValue === null || rawValue.trim() === '') {
      return fallback;
    }

    const value = Number(rawValue);
    return Number.isFinite(value) ? value : fallback;
  }

  readBooleanAttribute(name, fallback) {
    const rawValue = this.getAttribute(name);

    if(rawValue === null) {
      return fallback;
    }

    return rawValue !== 'false' && rawValue !== '0' && rawValue !== 'no';
  }

  readOptions() {
    return {
      backgroundColor:       this.readTextAttribute('background-color', 'rgb(238, 243, 246)'),
      modelColor:            this.readTextAttribute('model-color', 'rgb(168, 195, 216)'),
      edgeColor:             this.readTextAttribute('edge-color', 'rgb(16, 36, 61)'),
      edgeOpacity:           this.readNumberAttribute('edge-opacity', 0.7),
      ambientLightColor:     this.readTextAttribute('ambient-light-color', 'rgb(255, 255, 255)'),
      ambientLightIntensity: this.readNumberAttribute('ambient-light-intensity', 0.55),
      cameraSpanScale:       this.readNumberAttribute('camera-span-scale', 0.95),
      cameraDistanceScale:   this.readNumberAttribute('camera-distance-scale', 3),
      initialZoom:           this.readNumberAttribute('initial-zoom', 1),
      minZoom:               this.readNumberAttribute('min-zoom', 0.35),
      maxZoom:               this.readNumberAttribute('max-zoom', 5),
      autoplay:              this.readBooleanAttribute('autoplay', true),
      autoplaySegmentMs:     this.readNumberAttribute('autoplay-segment-ms', 2000),
      autoplayHoldMs:        this.readNumberAttribute('autoplay-hold-ms', 500),
      autoplayResumeDelayMs: this.readNumberAttribute('autoplay-resume-delay', 2500),
      autoplayWobbleAmount:  this.readNumberAttribute('autoplay-wobble-amount', 0.35),
      dragSpeed:             this.readNumberAttribute('drag-speed', 0.01),
      wheelLineScale:        this.readNumberAttribute('wheel-line-scale', 0.08),
      wheelPageScale:        this.readNumberAttribute('wheel-page-scale', 0.25),
      wheelPixelScale :      this.readNumberAttribute('wheel-pixel-scale', 0.002),
      initialRotationX:      this.readNumberAttribute('initial-rotation-x', -0.35),
      initialRotationY:      this.readNumberAttribute('initial-rotation-y', -0.55),
      initialRotationZ:      this.readNumberAttribute('initial-rotation-z', 0),
      initialView:           this.readNumberAttribute('initial-view', 0),
      hostDisplay:           this.readTextAttribute('host-display', 'block'),
      hostAlignSelf:         this.readTextAttribute('host-align-self', 'stretch'),
      hostJustifySelf:       this.readTextAttribute('host-justify-self', 'stretch'),
      hostMinWidth:          this.readTextAttribute('host-min-width', '0'),
      hostMinHeight:         this.readTextAttribute('host-min-height', '360px'),
      hostWidth:             this.readTextAttribute('host-width', ''),
      hostHeight:            this.readTextAttribute('host-height', ''),
      hostOverflow:          this.readTextAttribute('host-overflow', 'hidden'),
      hostBorder:            this.readTextAttribute('host-border', '1px solid rgb(27 36 48 / 10%)'),
      hostBackground:        this.readTextAttribute('host-background', 'rgb(255 255 255 / 25%)')
    };
  }

  applyHostStyles() {
    this.style.display = this.options.hostDisplay;
    this.style.alignSelf = this.options.hostAlignSelf;
    this.style.justifySelf = this.options.hostJustifySelf;
    this.style.minWidth = this.options.hostMinWidth;
    this.style.minHeight = this.options.hostMinHeight;
    this.style.overflow = this.options.hostOverflow;
    this.style.border = this.options.hostBorder;
    this.style.background = this.options.hostBackground;

    if(this.options.hostWidth) {
      this.style.width = this.options.hostWidth;
    }

    if(this.options.hostHeight) {
      this.style.height = this.options.hostHeight;
    }
  }

  createScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.options.backgroundColor);
  }

  createRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    const initialSize = this.getContainerSize();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(initialSize.width, initialSize.height, false);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.appendChild(this.renderer.domElement);
  }

  createModel() {
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(Cgl3dElement.vertices, 3));
    this.geometry.setIndex(Cgl3dElement.indices);
    this.geometry.computeVertexNormals();
    this.geometry.center();

    this.material = new THREE.MeshLambertMaterial({
      color: this.options.modelColor,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.edgesGeometry = new THREE.EdgesGeometry(this.geometry);
    this.edgesMaterial = new THREE.LineBasicMaterial({
      color: this.options.edgeColor,
      transparent: true,
      opacity: this.options.edgeOpacity,
      depthTest: true,
    });
    this.edges = new THREE.LineSegments(this.edgesGeometry, this.edgesMaterial);

    this.model = new THREE.Group();
    this.model.add(this.mesh);
    this.model.add(this.edges);

    if(this.options.autoplay) {
      this.setModelRotation(this.getAutoplayView(this.options.initialView));
    } else {
      this.setModelRotation({
        x: this.options.initialRotationX,
        y: this.options.initialRotationY,
        z: this.options.initialRotationZ,
      });
    }

    this.scene.add(this.model);

    const bounds = new THREE.Box3().setFromObject(this.model);
    const size = bounds.getSize(new THREE.Vector3());
    this.maxDimension = Math.max(size.x, size.y, size.z);
  }

  createLighting() {
    this.ambientLight = new THREE.AmbientLight(
      this.options.ambientLightColor,
      this.options.ambientLightIntensity,
    );
    this.scene.add(this.ambientLight);
  }

  createCamera() {
    const size = this.getContainerSize();
    const aspect = size.width/size.height;
    this.orthoSpan = this.maxDimension*this.options.cameraSpanScale;
    this.camera = new THREE.OrthographicCamera(
      -this.orthoSpan*aspect,
      this.orthoSpan*aspect,
      this.orthoSpan,
      -this.orthoSpan,
      0.1,
      2000,
    );
    this.camera.position.set(0, 0, this.maxDimension*this.options.cameraDistanceScale);
    this.camera.lookAt(0, 0, 0);
    this.camera.zoom = this.options.initialZoom;
    this.camera.updateProjectionMatrix();
  }

  bindHandlers() {
    this.onMouseDown = this.handleMouseDown.bind(this);
    this.onMouseUp = this.handleMouseUp.bind(this);
    this.onMouseMove = this.handleMouseMove.bind(this);
    this.onWheel = this.handleWheel.bind(this);
    this.onResize = this.scheduleResize.bind(this);
    this.onAnimationFrame = this.animate.bind(this);
  }

  addHandlers() {
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    this.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('resize', this.onResize);

    if('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(this.onResize);
      this.resizeObserver.observe(this);
    }
  }

  removeHandlers() {
    if(this.renderer) {
      this.renderer.domElement.removeEventListener('mousedown', this.onMouseDown);
    }

    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    this.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('resize', this.onResize);

    if(this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  getContainerSize() {
    const bounds = this.getBoundingClientRect();

    return {
      width: Math.max(Math.floor(bounds.width), 1),
      height: Math.max(Math.floor(bounds.height), 1),
    };
  }

  stopAutoplay() {
    this.autoplay = false;
    window.clearTimeout(this.autoplayResumeTimer);
  }

  scheduleAutoplayResume() {
    window.clearTimeout(this.autoplayResumeTimer);

    if(!this.options.autoplay) {
      return;
    }

    this.autoplayResumeTimer = window.setTimeout(() => {
      this.resumeAutoplayFromCurrent(performance.now());
      this.autoplay = true;
    }, this.options.autoplayResumeDelayMs);
  }

  resizeRenderer() {
    if(!this.renderer || !this.camera) {
      return;
    }

    const nextSize = this.getContainerSize();
    const aspect = nextSize.width/nextSize.height;
    this.renderer.setSize(nextSize.width, nextSize.height, false);
    this.camera.left = -this.orthoSpan*aspect;
    this.camera.right = this.orthoSpan*aspect;
    this.camera.top = this.orthoSpan;
    this.camera.bottom = -this.orthoSpan;
    this.camera.updateProjectionMatrix();
  }

  scheduleResize() {
    if(this.resizeFrame) {
      return;
    }

    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = 0;
      this.resizeRenderer();
    });
  }

  handleMouseDown(event) {
    if(event.button !== 0) {
      return;
    }

    this.isDragging = true;
    this.stopAutoplay();
    this.lastX = event.clientX;
    this.lastY = event.clientY;
  }

  handleMouseUp() {
    if(this.isDragging) {
      this.scheduleAutoplayResume();
    }

    this.isDragging = false;
  }

  handleMouseMove(event) {
    if(!this.isDragging) {
      return;
    }

    const deltaX = event.clientX-this.lastX;
    const deltaY = event.clientY-this.lastY;
    this.lastX = event.clientX;
    this.lastY = event.clientY;

    this.model.rotation.y += deltaX*this.options.dragSpeed;
    this.model.rotation.x += deltaY*this.options.dragSpeed;
  }

  handleWheel(event) {
    event.preventDefault();
    this.stopAutoplay();

    let wheelScale;

    if(event.deltaMode === 1) {
      wheelScale = this.options.wheelLineScale;
    } else if(event.deltaMode === 2) {
      wheelScale = this.options.wheelPageScale;
    } else {
      wheelScale = this.options.wheelPixelScale;
    }
    this.zoomBy(Math.exp(-event.deltaY*wheelScale));
    this.scheduleAutoplayResume();
  }

  zoomBy(factor) {
    this.camera.zoom = this.clamp(
      this.camera.zoom*factor,
      this.options.minZoom,
      this.options.maxZoom,
    );
    this.camera.updateProjectionMatrix();
  }

  animate(now) {
    this.lastFrameTime = now;

    if(this.autoplay) {
      this.animateAutoplay(now);
    }

    this.renderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(this.onAnimationFrame);
  }

  animateAutoplay(now) {
    if(this.resumePath) {
      const rawT = this.clamp(
        (now-this.resumeStartTime)/this.options.autoplaySegmentMs,
        0,
        1,
      );
      this.applyRotationPath(this.resumePath, this.easeInOut(rawT));

      if(rawT < 1) {
        return;
      }

      const targetView = this.getAutoplayView(this.resumeTargetIndex);
      this.setModelRotation(targetView);
      this.resumePath = null;
      this.setAutoplayStartTime(now, this.resumeTargetIndex);
      return;
    }

    const viewCount = Cgl3dElement.autoplayViews.length;
    const segmentBlockMs = this.options.autoplaySegmentMs+this.options.autoplayHoldMs;
    const cycleMs = segmentBlockMs*viewCount;
    const cycleTime = ((now-this.autoplayStartTime)%cycleMs+cycleMs)%cycleMs;
    const viewIndex = Math.floor(cycleTime/segmentBlockMs);
    const nextViewIndex = (viewIndex+1)%viewCount;
    const timeInView = cycleTime%segmentBlockMs;
    const fromView = this.getAutoplayView(viewIndex);
    const toView = this.getAutoplayView(nextViewIndex);

    if(timeInView < this.options.autoplayHoldMs) {
      this.setModelRotation(fromView);
      return;
    }

    const rawT = (timeInView-this.options.autoplayHoldMs)/this.options.autoplaySegmentMs;
    this.applyRotationPath({
      from: fromView,
      to: toView,
      wobble: this.getWobbleVector(viewIndex*3+nextViewIndex),
    }, this.easeInOut(rawT));
  }

  resumeAutoplayFromCurrent(now) {
    const currentRotation = this.getCurrentRotation();
    this.resumeTargetIndex = this.findNearestAutoplayView(currentRotation);
    this.resumePath = {
      from: currentRotation,
      to: this.getAutoplayView(this.resumeTargetIndex),
      wobble: this.getWobbleVector(this.resumeTargetIndex*3+Math.floor(currentRotation.x*1000)),
    };
    this.resumeStartTime = now;
  }

  setAutoplayStartTime(now, viewIndex) {
    const segmentBlockMs = this.options.autoplaySegmentMs+this.options.autoplayHoldMs;
    this.autoplayStartTime = now-viewIndex*segmentBlockMs;
  }

  getAutoplayView(index) {
    const viewCount = Cgl3dElement.autoplayViews.length;
    const normalizedIndex = ((Math.round(index)%viewCount)+viewCount)%viewCount;
    return Cgl3dElement.autoplayViews[normalizedIndex];
  }

  findNearestAutoplayView(rotation) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    Cgl3dElement.autoplayViews.forEach((view, index) => {
      const distance = this.getRotationDistance(rotation, view);

      if(distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    return nearestIndex;
  }

  getRotationDistance(a, b) {
    return Math.abs(this.shortestAngleDelta(a.x, b.x))
      + Math.abs(this.shortestAngleDelta(a.y, b.y))
      + Math.abs(this.shortestAngleDelta(a.z, b.z));
  }

  applyRotationPath(path, t) {
    const wobble = path.wobble;
    const wobbleT = wobble ? Math.sin(t*Math.PI) : 0;

    this.setModelRotation({
      x: this.lerpAngle(path.from.x, path.to.x, t)+(wobble ? wobble.x*wobbleT : 0),
      y: this.lerpAngle(path.from.y, path.to.y, t)+(wobble ? wobble.y*wobbleT : 0),
      z: this.lerpAngle(path.from.z, path.to.z, t)+(wobble ? wobble.z*wobbleT : 0),
    });
  }

  pseudoRandom(seed) {
    const value = Math.sin(seed*12.9898)*43758.5453;
    return value-Math.floor(value);
  }

  getWobbleVector(seed) {
    const amount = this.options.autoplayWobbleAmount;

    return {
      x: (this.pseudoRandom(seed)*2-1)*amount,
      y: (this.pseudoRandom(seed+1)*2-1)*amount,
      z: (this.pseudoRandom(seed+2)*2-1)*amount,
    };
  }

  setModelRotation(rotation) {
    this.model.rotation.set(rotation.x, rotation.y, rotation.z);
  }

  getCurrentRotation() {
    return {
      x: this.model.rotation.x,
      y: this.model.rotation.y,
      z: this.model.rotation.z,
    };
  }

  lerpAngle(from, to, t) {
    return from+this.shortestAngleDelta(from, to)*t;
  }

  shortestAngleDelta(from, to) {
    return Math.atan2(Math.sin(to-from), Math.cos(to-from));
  }

  easeInOut(t) {
    return t*t*(3-2*t);
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

}

customElements.define('cgl-3d', Cgl3dElement);
