import * as THREE from 'three';
import { BufferAttribute, Mesh, PerspectiveCamera, Points, Scene, Vector2, Vector3, WebGLRenderer, ShaderMaterial, Texture, Clock } from "three";
import { OrbitControls } from '../tools/OrbitControls.js';
import { TorochoidalWave } from "./TorochoidalWave";
import { fragment } from "../shaders/swellrayFragment.js";
import { vertex } from "../shaders/swellrayVertex.js";
import * as defaultTheme from "../themes/default.json";
export class Swellray {
    container: HTMLElement
    scene: Scene
    renderer: WebGLRenderer
    camera: PerspectiveCamera
    cameraType: string
    clock: Clock
    controls: OrbitControls
    dots: Points
    seaPlane: Mesh
    floorPlane: Mesh
    theme: any
    backgroundColor: string
    delta: number
    fps: number
    waves: Array<TorochoidalWave>
    maxHeight: number
    bathymetryMap: Texture
    chopMap: Texture
    seaMaterial: ShaderMaterial
    seaCenters: BufferAttribute

    seaSpreadScale: number
    seaDepthScale: number
    simulationSpeed: number
    readonly AMOUNTX: number = 256
    readonly AMOUNTZ: number = 256
    readonly LIB_PATH: string
    readonly CENTERS_NUMBER = this.AMOUNTX * this.AMOUNTZ
    readonly G = 9.81

    // the max scale of the dot distributed in the heihgt of the grid
    constructor(container: HTMLElement, bathymetryMapImage: string, chopMapImage: string) {
        this.loadBathymetry(bathymetryMapImage);
        this.loadChop(chopMapImage);
        this.container = container;
    }
    async init() {

        this.theme = defaultTheme
        this.clock = new THREE.Clock
        this.fps = 60
        this.waves = []
        this.seaSpreadScale = 0.256 * 1.
        this.seaDepthScale = 0.00256
        this.simulationSpeed = 1
        this.delta = 0
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(`#${this.theme.props.colors.backgroundColor}`);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.container.appendChild(this.renderer.domElement);


        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
        this.camera.position.set(400, 200, 0);

        this.initControls();
        this.buildSea();
        const axesHelper = new THREE.AxesHelper( 5 );
        this.scene.add( axesHelper );

        window.addEventListener('resize', this.onWindowResize.bind(this));

        this.update();
        this.onWindowResize();


    }
    buildSea() {
        const positions = new Float32Array(this.CENTERS_NUMBER * 3);
        const scales = new Float32Array(this.CENTERS_NUMBER);
        let i = 0, j = 0;

        for (let ix = 0; ix < this.AMOUNTX; ix++) {

            for (let iz = 0; iz < this.AMOUNTZ; iz++) {

                positions[i] = ix * this.seaSpreadScale - ((this.AMOUNTX * this.seaSpreadScale) / 2); // x
                positions[i + 1] = 0; // y
                positions[i + 2] = iz * this.seaSpreadScale - ((this.AMOUNTZ * this.seaSpreadScale) / 2); // z

                scales[j] = this.seaSpreadScale;

                i += 3;
                j++;

            }

        }
        this.seaMaterial = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(0x000000) },
                uScale: {
                    value: this.seaSpreadScale
                },
                uDepthScale: {
                    value: this.seaDepthScale
                },
                uTime: { value: this.delta },
                uWaves: {
                    value: [0, 0, 0.0, 0]
                },
                uWindDirection: {
                    value: null
                },
                uWindSpeed: {
                    value: null
                },
                uDepthmap: {
                    value: null
                },
                uNoiseMap: {
                    value: null
                },
                u_low_color: { value: new THREE.Color(`#${this.theme.props.colors.lowSeaColor}`) },
                u_high_color: { value: new THREE.Color(`#${this.theme.props.colors.highSeaColor}`) },
                u_color_offset: { value: 1 },
                u_color_multiplier: { value: 1.5 },

                resolution: { value: new THREE.Vector2() }

            },
            wireframe: false,
            clipping: false,
            vertexShader: vertex,
            fragmentShader: fragment
        });




        const p_geometry = new THREE.PlaneGeometry(this.AMOUNTX * this.seaSpreadScale, this.AMOUNTZ * this.seaSpreadScale, this.AMOUNTX - 1, this.AMOUNTZ - 1);
        // p_geometry.rotateY(Math.PI);
        p_geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        p_geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));

        this.seaPlane = new THREE.Mesh(p_geometry, this.seaMaterial);
        this.seaPlane.rotateX(Math.PI);
         this.scene.add(this.seaPlane);



        const d_geometry = new THREE.PlaneGeometry(this.AMOUNTX * this.seaSpreadScale, this.AMOUNTZ * this.seaSpreadScale, this.AMOUNTX - 1, this.AMOUNTZ - 1);
        d_geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        d_geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));

        this.dots = new THREE.Points(d_geometry, this.seaMaterial);
        this.dots.rotateX(Math.PI)
        this.scene.add(this.dots);
        this.seaCenters = this.dots.geometry.attributes.position.clone()

    }
    initControls() {
        // controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.listenToKeyEvents(window); // optional
        this.controls.enableDamping = true;
        this.controls.enablePan = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = this.AMOUNTX * this.seaSpreadScale / 20;
        this.controls.maxDistance = this.AMOUNTX * this.seaSpreadScale * 2;
        this.controls.maxPolarAngle = Math.PI / 2;
        this.camera.position.set(this.controls.maxDistance/(this.camera.aspect * 8), this.controls.maxDistance/(this.camera.aspect * 4),-this.controls.maxDistance/(this.camera.aspect*2) );
        this.controls.update();      

    }
    resetWaves() {
        this.waves = []
    }
    setWaveHeight(waveIndex: number, value: number) {
        this.waves[waveIndex].height = value
    }
    setWavePeriod(waveIndex: number, value: number) {
        this.waves[waveIndex].period = value
    }
    setWaveDirection(waveIndex: number, value: number) {
        value = value * Math.PI/180
        this.waves[waveIndex].direction.set(Math.cos(value),Math.sin(value))
        // console.log(this.waves[waveIndex].direction);
        
    }
    setWind(speed: number, direction: number) {
        direction = direction * Math.PI/180;
        const dir = new Vector2(Math.cos(direction), Math.sin(direction));
        console.log("wind",dir);
        this.seaMaterial.uniforms.uWindSpeed.value = speed
        this.seaMaterial.uniforms.uWindDirection.value = [dir.x,dir.y]
    }
    addWave(period: number, direction: number, height: number) {
        direction = direction * Math.PI/180;
        const dir = new Vector2(Math.cos(direction), Math.sin(direction));
        console.log("sea",dir);
        this.waves.push(new TorochoidalWave(period, dir, height))

        //TODO Calc max Height
    }
    async loadBathymetry(bathymetryMapImage: string) {
        // instantiate a loader
        let loader1 = new THREE.TextureLoader();
        // load a image resource
        await loader1.loadAsync(bathymetryMapImage).then(image => {
            this.bathymetryMap = image
            this.seaMaterial.uniforms.uDepthmap.value = this.bathymetryMap
            const seaFloor_geometry = new THREE.PlaneGeometry(256 * this.seaSpreadScale, 256 * this.seaSpreadScale, 256, 256);
            const seaFloor_material = new THREE.MeshStandardMaterial()
            seaFloor_material.wireframe = true
            seaFloor_material.emissive = new THREE.Color(`#${this.theme.props.colors.seaFloorColor}`)
            seaFloor_material.displacementMap = this.bathymetryMap
            seaFloor_material.displacementScale = this.seaDepthScale * 10 * 256
            this.floorPlane = new THREE.Mesh(seaFloor_geometry, seaFloor_material);
            this.floorPlane.rotateX(Math.PI / 2)
            this.floorPlane.rotateZ(-Math.PI / 2)
            this.floorPlane.position.setY(0)
            this.scene.add(this.floorPlane)
        })

    }
    async loadChop(chopMapImage: string) {
        let loader2 = new THREE.TextureLoader();
        await loader2.loadAsync(chopMapImage).then(image => {
            this.chopMap = image
            this.chopMap.wrapT = this.chopMap.wrapS = THREE.RepeatWrapping
            this.seaMaterial.uniforms.uNoiseMap.value = this.chopMap
        })
    }
    onWindowResize() {

        this.camera.aspect = this.container.offsetWidth / this.container.offsetHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.offsetWidth, this.container.offsetHeight);
        // this.renderer.setPixelRatio( this.container.offsetWidth / this.container.offsetHeight);

    }


    updateControls() {
        this.controls.update();
    }
    update() {
        this.updateControls()
        requestAnimationFrame(this.update.bind(this));
        this.delta += this.clock.getDelta()
        if (this.delta > 1 / this.fps) {
            this.seaMaterial.uniforms.uTime.value += this.delta
            if (this.waves.length > 0) {
                this.seaMaterial.uniforms.uWaves.value = this.waves.reduce((prev, curr) => [...prev, ...curr.direction.toArray(), curr.period, curr.height], [0, 0, 0, 0])

            } else {
                this.seaMaterial.uniforms.uWaves.value = [0, 0, 0, 0]
            }
            this.render();
            this.delta %= (1 / this.fps)
        }
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}

