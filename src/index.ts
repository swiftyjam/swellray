import * as THREE from 'three';
import { ArrowHelper, BufferAttribute, Mesh, PerspectiveCamera, Points, Scene, Vector2, Vector3, WebGLRenderer, ShaderMaterial, Texture, Clock } from "three";
import { OrbitControls } from '../tools/OrbitControls.js';
import { TorochoidalWave } from "./TorochoidalWave";
import swellRayFragment from "../shaders/swellrayFragment.fs";
import swellRayVertex from "../shaders/swellrayVertex.vs";
export class SWSURF {
    scene: Scene
    renderer: WebGLRenderer
    camera: PerspectiveCamera
    clock: Clock
    controls: OrbitControls
    dots: Points
    plane: Mesh
    sea_floor: Mesh 
    delta: number
    fps_limit: number
    waves: Array<TorochoidalWave>
    maxHeight: number
    heightmap: Texture
    noisemap: Texture
    p_material: ShaderMaterial

    _Centers: BufferAttribute

    settings: Object 
    SCALE: number 
    DEPTH_SCALE: number
    MAX_SCALE: number
    SPEED: number
    readonly AMOUNTX: number = 128
    readonly AMOUNTZ: number = 128
    readonly CENTERS_NUMBER = this.AMOUNTX * this.AMOUNTZ
    readonly G = 9.81
    //DEBUG
    DEBUG_POINT: number
    arrowHelper: ArrowHelper
    // the max scale of the dot distributed in the heihgt of the grid

    async init() {
        //DEBUG
        this.DEBUG_POINT = 5090
        this.clock = new THREE.Clock
        this.fps_limit = 30
        this.waves = []
        this.SCALE = 0.128 * 2.
        this.DEPTH_SCALE = 0.00256
        this.SPEED = 1
        this.MAX_SCALE = this.SCALE
        this.delta = 0
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xeeefff);
        this.scene.fog = new THREE.FogExp2(0xa14, 0.00001);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);
        

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 5000);
        this.camera.position.set(400, 200, 0);

        // controls

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.listenToKeyEvents(window); // optional

        //controls.addEventListener( 'change', render ); // call this only in static scenes (i.e., if there is no animation loop)

        this.controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
        this.controls.enablePan = true;

        this.controls.dampingFactor = 0.05;

        this.controls.screenSpacePanning = false;

        this.controls.minDistance = this.AMOUNTX * this.SCALE / 20;
        this.controls.maxDistance = this.AMOUNTX * this.SCALE * 2;

        this.controls.maxPolarAngle = Math.PI / 2;

        const size = this.AMOUNTX * this.SCALE;
        const divisions = 100;

        // const gridHelper = new THREE.GridHelper(size, divisions);
        // this.scene.add(gridHelper);



        const positions = new Float32Array(this.CENTERS_NUMBER * 3);
        const scales = new Float32Array(this.CENTERS_NUMBER);
        const colors = new Float32Array(this.CENTERS_NUMBER * 3)
        const iColor = new THREE.Color("rgb(5, 10, 30)")
        let i = 0, j = 0;

        for (let ix = 0; ix < this.AMOUNTX; ix++) {

            for (let iz = 0; iz < this.AMOUNTZ; iz++) {

                positions[i] = ix * this.SCALE - ((this.AMOUNTX * this.SCALE) / 2); // x
                positions[i + 1] = 0; // y
                positions[i + 2] = iz * this.SCALE - ((this.AMOUNTZ * this.SCALE) / 2); // z

                colors[i] = iColor.r
                colors[i + 1] = iColor.g
                colors[i + 2] = iColor.b

                scales[j] = this.SCALE;

                i += 3;
                j++;

            }

        }
        this.p_material = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(0x000000) },
                uScale: {
                    value: this.SCALE
                },
                uDepthScale: {
                    value: this.DEPTH_SCALE
                },
                uTime: { value: this.delta },
                uWaves: {
                    value: [0, 0, 0.0, 0]
                },
                uDepthmap: {
                    value: null
                },
                uNoiseMap: {
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

        
       

        const p_geometry = new THREE.PlaneGeometry(this.AMOUNTX * this.SCALE, this.AMOUNTZ * this.SCALE, this.AMOUNTX - 1, this.AMOUNTZ - 1);
        // p_geometry.rotateY(Math.PI);
        p_geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        p_geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
        p_geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.plane = new THREE.Mesh(p_geometry, this.p_material);
        this.plane.rotateX(Math.PI)
        this.scene.add(this.plane);
        this.arrowHelper = new THREE.ArrowHelper(new Vector3(0, 0, 0), new Vector3(0, 0, 0), 1.70, new THREE.Color('red'), 0.25, 1);

        this.scene.add(this.arrowHelper);


        const d_geometry = new THREE.PlaneGeometry(this.AMOUNTX * this.SCALE, this.AMOUNTZ * this.SCALE, this.AMOUNTX - 1, this.AMOUNTZ - 1);
        d_geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        d_geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
        d_geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));




        this.dots = new THREE.Points(d_geometry, this.p_material);
        this.dots.rotateX(Math.PI)
        this.scene.add(this.dots);
        this._Centers = this.dots.geometry.attributes.position.clone()
        // lights

        const dirLight1 = new THREE.DirectionalLight(0xffffff);
        dirLight1.position.set(1, 1, 1);
        this.scene.add(dirLight1);

        const dirLight2 = new THREE.DirectionalLight(0x002288);
        dirLight2.position.set(- 1, - 1, - 1);
        this.scene.add(dirLight2);

        const ambientLight = new THREE.AmbientLight(0x222222);
        this.scene.add(ambientLight);

        //
        window.addEventListener('resize', this.onWindowResize.bind(this));
        // TODO: Decouple await in index.ts
        this.loadHeightMap().then(() => this.update())


    }
    resetWaves() {
        this.waves = []
    }
    addWave() {
        this.waves.push(new TorochoidalWave(this.SCALE, 9, new Vector2(1, 1), 1.25, 1., 25))

        //TODO Calc max Height
    }
    async loadHeightMap() {
        // instantiate a loader
        let loader = new THREE.TextureLoader();
        // load a image resource
        await loader.loadAsync(
            // resource URL
            '/asset/height-map-54.png',
        ).then(image => {
            this.heightmap = image
            this.p_material.uniforms.uDepthmap.value = this.heightmap
            const sea_floor_geometry = new THREE.PlaneGeometry(128*this.SCALE,128*this.SCALE,128,128);
            const sea_floor_material = new THREE.MeshStandardMaterial()
            sea_floor_material.wireframe =  true
            sea_floor_material.displacementMap = this.heightmap
            sea_floor_material.displacementScale = (-1) * this.DEPTH_SCALE * 10 * 256
            this.sea_floor = new THREE.Mesh( sea_floor_geometry, sea_floor_material );     
           this.sea_floor.rotateX(-Math.PI/2)
           this.sea_floor.rotateZ(+Math.PI/2)
         
           this.sea_floor.position.setY(0 )
            this.scene.add(this.sea_floor)
        })
        await loader.loadAsync(
            // resource URL
            '/asset/normal5.png',
        ).then(image => {
            this.noisemap = image
            this.noisemap.wrapT = this.noisemap.wrapS = THREE.RepeatWrapping
            this.p_material.uniforms.uNoiseMap.value = this.noisemap
        })

    }
    onWindowResize() {

        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }


    updateDotGrid() {

    }
    update() {
        this.controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true
        this.updateDotGrid()
        requestAnimationFrame(this.update.bind(this));
        this.delta += this.clock.getDelta()
        if (this.delta > 1 / this.fps_limit) {
            this.p_material.uniforms.uTime.value += this.delta
            if (this.waves.length > 0) {
                this.p_material.uniforms.uWaves.value = this.waves.reduce((prev, curr) => [...prev, ...curr.direction.toArray(), curr.period, curr.height], [0,0,0,0])
                
            } else {
                this.p_material.uniforms.uWaves.value = [0, 0, 0, 0]
            }
            this.render();
            this.delta %= (1/this.fps_limit)
        }
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}

