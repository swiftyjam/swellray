import * as THREE from 'three';
import { ArrowHelper, BufferAttribute, Mesh, PerspectiveCamera, Points, Scene, Vector2, Vector3, WebGLRenderer, ShaderMaterial, Texture, Clock } from "three";
import { OrbitControls } from '../tools/OrbitControls.js';
import { TorochoidalWave } from "./TorochoidalWave";
import swellRayFragment from "../shaders/swellrayFragment.fs";
import swellRayVertex from "../shaders/swellrayVertex.vs";
export class Swellray {
    container : HTMLElement
    scene: Scene
    renderer: WebGLRenderer
    camera: PerspectiveCamera
    clock: Clock
    controls: OrbitControls
    dots: Points
    plane: Mesh
    seaFloor: Mesh 
    delta: number
    fps: number
    waves: Array<TorochoidalWave>
    maxHeight: number
    depthMap: Texture
    noiseMap: Texture
    seaMaterial: ShaderMaterial
    seaCenters: BufferAttribute
    
    seaSpreadScale: number 
    seaDepthScale: number
    simulationSpeed: number
    readonly AMOUNTX: number = 128
    readonly AMOUNTZ: number = 128
    readonly CENTERS_NUMBER = this.AMOUNTX * this.AMOUNTZ
    readonly G = 9.81
    //DEBUG
    persona: ArrowHelper
    // the max scale of the dot distributed in the heihgt of the grid
    constructor(container:HTMLElement) { 
        this.container = container;
     }  
    async init() {

        this.clock = new THREE.Clock
        this.fps = 30
        this.waves = []
        this.seaSpreadScale = 0.128 * 2.
        this.seaDepthScale = 0.00256
        this.simulationSpeed = 1
        this.delta = 0
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xeeefff);
        this.scene.fog = new THREE.FogExp2(0xa14, 0.00001);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.container.appendChild(this.renderer.domElement);
        

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 5000);
        this.camera.position.set(400, 200, 0);

        this.initControls();
        this.buildSea();
 
        this.persona = new THREE.ArrowHelper(new Vector3(0, 0, 0), new Vector3(0, 0, 0), 1.70, new THREE.Color('red'), 0.25, 1);
        this.scene.add(this.persona);
        // lights

        const dirLight1 = new THREE.DirectionalLight(0xffffff);
        dirLight1.position.set(1, 1, 1);
        this.scene.add(dirLight1);

        const dirLight2 = new THREE.DirectionalLight(0x002288);
        dirLight2.position.set(- 1, - 1, - 1);
        this.scene.add(dirLight2);

        const ambientLight = new THREE.AmbientLight(0x222222);
        this.scene.add(ambientLight);

        window.addEventListener('resize', this.onWindowResize.bind(this));
        // TODO: Decouple await in index.ts
        this.loadheightMap().then(() => this.update())


    }
    buildSea(){
        const positions = new Float32Array(this.CENTERS_NUMBER * 3);
        const scales = new Float32Array(this.CENTERS_NUMBER);
        const colors = new Float32Array(this.CENTERS_NUMBER * 3)
        const iColor = new THREE.Color("rgb(5, 10, 30)")
        let i = 0, j = 0;

        for (let ix = 0; ix < this.AMOUNTX; ix++) {

            for (let iz = 0; iz < this.AMOUNTZ; iz++) {

                positions[i] = ix * this.seaSpreadScale - ((this.AMOUNTX * this.seaSpreadScale) / 2); // x
                positions[i + 1] = 0; // y
                positions[i + 2] = iz * this.seaSpreadScale - ((this.AMOUNTZ * this.seaSpreadScale) / 2); // z

                colors[i] = iColor.r
                colors[i + 1] = iColor.g
                colors[i + 2] = iColor.b

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
                uDepthmap: {
                    value: null
                },
                unoiseMap: {
                    value: null
                },
                u_low_color: { value: new THREE.Color('#0032a8') },
                u_high_color: { value: new THREE.Color('#0054a8') },
                u_color_offset: { value: 1 },
                u_color_multiplier: { value: 1.5 },

                resolution: { value: new THREE.Vector2() }

            },
            wireframe: false,

            vertexShader: swellRayVertex,

            fragmentShader: swellRayFragment
        });

        
       

        const p_geometry = new THREE.PlaneGeometry(this.AMOUNTX * this.seaSpreadScale, this.AMOUNTZ * this.seaSpreadScale, this.AMOUNTX - 1, this.AMOUNTZ - 1);
        // p_geometry.rotateY(Math.PI);
        p_geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        p_geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
        p_geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.plane = new THREE.Mesh(p_geometry, this.seaMaterial);
        this.plane.rotateX(Math.PI)
        this.scene.add(this.plane);
  


        const d_geometry = new THREE.PlaneGeometry(this.AMOUNTX * this.seaSpreadScale, this.AMOUNTZ * this.seaSpreadScale, this.AMOUNTX - 1, this.AMOUNTZ - 1);
        d_geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        d_geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
        d_geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));




        this.dots = new THREE.Points(d_geometry, this.seaMaterial);
        this.dots.rotateX(Math.PI)
        this.scene.add(this.dots);
        this.seaCenters = this.dots.geometry.attributes.position.clone()
        
    }
    initControls(){
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
     
    }
    resetWaves() {
        this.waves = []
    }
    addWave() {
        this.waves.push(new TorochoidalWave(this.seaSpreadScale, 9, new Vector2(1, 1), 1.25, 1., 25))

        //TODO Calc max Height
    }
    async loadheightMap() {
        // instantiate a loader
        let loader = new THREE.TextureLoader();
        // load a image resource
        await loader.loadAsync(
            // resource URL
            '/asset/height-map-54.png',
        ).then(image => {
            this.depthMap = image
            this.seaMaterial.uniforms.uDepthmap.value = this.depthMap
            const seaFloor_geometry = new THREE.PlaneGeometry(128*this.seaSpreadScale,128*this.seaSpreadScale,128,128);
            const seaFloor_material = new THREE.MeshStandardMaterial()
            seaFloor_material.wireframe =  true
            seaFloor_material.displacementMap = this.depthMap
            seaFloor_material.displacementScale = (-1) * this.seaDepthScale * 10 * 256
            this.seaFloor = new THREE.Mesh( seaFloor_geometry, seaFloor_material );     
           this.seaFloor.rotateX(-Math.PI/2)
           this.seaFloor.rotateZ(+Math.PI/2)
         
           this.seaFloor.position.setY(0 )
            this.scene.add(this.seaFloor)
        })
        await loader.loadAsync(
            // resource URL
            '/asset/normal5.png',
        ).then(image => {
            this.noiseMap = image
            this.noiseMap.wrapT = this.noiseMap.wrapS = THREE.RepeatWrapping
            this.seaMaterial.uniforms.unoiseMap.value = this.noiseMap
        })

    }
    onWindowResize() {

        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }


    updateGrid() {

    }
    update() {
        this.controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true
        this.updateGrid()
        requestAnimationFrame(this.update.bind(this));
        this.delta += this.clock.getDelta()
        if (this.delta > 1 / this.fps) {
            this.seaMaterial.uniforms.uTime.value += this.delta
            if (this.waves.length > 0) {
                this.seaMaterial.uniforms.uWaves.value = this.waves.reduce((prev, curr) => [...prev, ...curr.direction.toArray(), curr.period, curr.height], [0,0,0,0])
                
            } else {
                this.seaMaterial.uniforms.uWaves.value = [0, 0, 0, 0]
            }
            this.render();
            this.delta %= (1/this.fps)
        }
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}

