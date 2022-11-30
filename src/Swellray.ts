import * as THREE from 'three';
import { BufferAttribute, Mesh, PerspectiveCamera, Points, Scene, Vector2, Vector3, WebGLRenderer, ShaderMaterial, Texture, Clock, Raycaster, Plane, Group, MeshBasicMaterial } from "three";
import { OrbitControls } from '../tools/OrbitControls.js';
import { TorochoidalWave } from "./TorochoidalWave";
import { fragment } from "../shaders/swellrayFragment.js";
import { vertex } from "../shaders/swellrayVertex.js";
import { floorFragment } from "../shaders/floorFragment.js"
import { floorVertex } from "../shaders/floorVertex.js"
import * as defaultTheme from "../themes/default.json";
export class Swellray {
    container: HTMLElement
    scene: Scene
    renderer: WebGLRenderer
    camera: PerspectiveCamera
    cameraType: string
    mouse: Vector2
    raycaster: Raycaster
    intersectionPlane: Plane
    pointer: Vector3
    ruler: Group
    extensionMeasure: Group
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
    letCompass: any
    rulerElements: any
    windDirection: number
    swellDirection: number
    secondarySwellDirection: number
    spotOrientation: number

    seaSpreadScale: number
    seaDepthScale: number
    simulationSpeed: number

    readonly MAGIC_N: number = 256
    readonly AMOUNTX: number = this.MAGIC_N
    readonly AMOUNTZ: number = this.MAGIC_N
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

        this.letCompass = {
            cardinals: [],
            directions: []
        }
        this.theme = defaultTheme
        this.clock = new THREE.Clock
        this.fps = 60
        this.waves = []
        this.windDirection = 0
        this.swellDirection = 0
        this.secondarySwellDirection = 0
        this.spotOrientation = 0
        this.seaSpreadScale = 0.5 // 1 = 256m 0.5 = 128m ...
        this.seaDepthScale = 10 // 1 means each 1% of B = 0.1m
        this.simulationSpeed = 1
        this.delta = 0
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(`#${this.theme.props.colors.backgroundColor}`);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        // this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);



        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
        this.camera.position.set(400, 200, 0);
        this.pointer = new Vector3()
        this.raycaster = new THREE.Raycaster()
        this.intersectionPlane = new Plane(new THREE.Vector3(0, 1, 0), 0);
        this.mouse = new THREE.Vector2()
        this.initCompass();
        this.initControls();
        this.buildSea();
        this.buildLegends();
        window.addEventListener('resize', this.onWindowResize.bind(this));
        window.addEventListener('pointermove', this.onPointerMove.bind(this),)
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
                uSpotOrientation: {
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
    buildLegends() {
        const axesHelper = new THREE.AxesHelper( 50 );
        this.scene.add( axesHelper );
        //**HEIHGTMARK */ 
        this.ruler = new THREE.Group()
        const m1 = new THREE.LineBasicMaterial({
            color: 0x0124b4,
            transparent: true,
            opacity: 1,
            linewidth: 10,
        });
        const units = 20
       
        let unitcounter = units;
        this.rulerElements = [];

        let eachCut = 4
        while (unitcounter > -units) {
            if (unitcounter % 2 == 0 && eachCut == 4) {
                eachCut = 0
                const span = document.createElement("span")
                span.innerHTML = `🠐 ${unitcounter / 2}m`
                span.className = "rulerComponent"
                if (unitcounter < 1) {
                    span.classList.add("bottom")
                } else {
                    span.classList.add("upper")
                }
                span.id = `ruler-${unitcounter}`
                span.style.position = "absolute"
                this.container.appendChild(span)
                this.rulerElements.push(
                    document.getElementById(`ruler-${unitcounter}`),
                )
            }
            eachCut++

            const pointGroup2 = [];
            pointGroup2.push(new THREE.Vector3(0, (unitcounter / this.seaSpreadScale) / 2, 0));
            pointGroup2.push(new THREE.Vector3(0, (unitcounter / this.seaSpreadScale) / 2, (unitcounter % 2 == 0 ? 5 : unitcounter == 0 ? 10 : 2)));
            const g2 = new THREE.BufferGeometry().setFromPoints(pointGroup2);
            this.ruler.add(new THREE.Line(g2, m1));
            unitcounter--;
        }
        this.scene.add(this.ruler)
        //**END HEIGHTMARK */

        //**FLOOR MEASSURE */ 
        this.extensionMeasure = new THREE.Group()
        const m2 = new THREE.MeshBasicMaterial({
            color: 0x0124b4,
            transparent: true,
            opacity: 1
        });
        const pointGroup3 = [];
        pointGroup3.push(new THREE.Vector3(-(this.seaSpreadScale * this.AMOUNTX)/2,0, -(this.seaSpreadScale * this.AMOUNTX)/2 - 15));
        pointGroup3.push(new THREE.Vector3((this.seaSpreadScale * this.AMOUNTX)/2 ,0, -(this.seaSpreadScale * this.AMOUNTX)/2 - 15));
        const g3 = new THREE.BufferGeometry().setFromPoints(pointGroup3);
        this.extensionMeasure.add(new THREE.Line(g3, m2));
        const cells = this.AMOUNTX * this.seaSpreadScale
        unitcounter = cells;

        while (unitcounter > 0) {
            const pointGroup4 = [];
            pointGroup4.push(new THREE.Vector3(-(this.seaSpreadScale * this.AMOUNTX)/2 + unitcounter ,0, -(this.seaSpreadScale * this.AMOUNTX)/2 - 15));
            pointGroup4.push(new THREE.Vector3(-(this.seaSpreadScale * this.AMOUNTX)/2 + unitcounter ,0, -(this.seaSpreadScale * this.AMOUNTX)/2 - 5));
            const g4 = new THREE.BufferGeometry().setFromPoints(pointGroup4);
            this.extensionMeasure.add(new THREE.Line(g4, m1));
            unitcounter--;
        }
        this.scene.add(this.extensionMeasure)

    }
    initCompass() {
        const c = document.getElementsByClassName('compassComponent')
        Array.prototype.forEach.call(c, (element: any) => {
            this.letCompass.cardinals.push(element)
        });
        const d = document.getElementsByClassName('compassDirection')
        Array.prototype.forEach.call(d, (element: any) => {
            this.letCompass.directions.push(element)
        });

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
        this.camera.position.set(this.controls.maxDistance / (this.camera.aspect * 8), this.controls.maxDistance / (this.camera.aspect * 4), -this.controls.maxDistance / (this.camera.aspect * 2));
        this.controls.update();

    }
    resetWaves() {
        this.waves = []
    }
    setWaveHeight(waveIndex: number, value: number) {
        this.waves[waveIndex].height = (value == (null || 0) || this.waves[waveIndex].period == (null || 0)) ? 0 : value
    }
    setWavePeriod(waveIndex: number, value: number) {
        this.waves[waveIndex].period = value == null ? 0.00001 : value
    }
    setSpotOrientation(value: number) {
        this.spotOrientation = value == null ? 0 : - value * Math.PI / 180;
        const dir = new Vector2(Math.cos(this.spotOrientation), Math.sin(this.spotOrientation));
        this.seaMaterial.uniforms.uSpotOrientation.value = dir

    }
    setWaveDirection(waveIndex: number, value: number) {

        const convertedValue = value == null ? 0 : value * Math.PI / 180
        if (waveIndex == 0) { //TODO: To reduce code, maybe use this.waveDirections as an array and take advantage of using index so you dont have to use if else
            this.swellDirection = convertedValue;
            this.waves[waveIndex].direction.set(Math.cos(this.swellDirection), Math.sin(this.swellDirection))
        } else if (waveIndex == 1) {
            this.secondarySwellDirection = convertedValue;
            this.waves[waveIndex].direction.set(Math.cos(this.secondarySwellDirection), Math.sin(this.secondarySwellDirection))
        }
    }
    setWind(speed: number, direction: number) {
        this.windDirection = direction == null ? 0 : direction * Math.PI / 180;
        const dir = new Vector2(Math.cos(this.windDirection), Math.sin(this.windDirection));
        this.seaMaterial.uniforms.uWindSpeed.value = speed == null ? 0 : speed
        this.seaMaterial.uniforms.uWindDirection.value = dir
    }
    addWave(period: number, direction: number, height: number) {

        direction = direction * Math.PI / 180;
        this.waves.push(new TorochoidalWave(period, direction, height))
        if (this.waves.length == 1) {
            this.swellDirection = direction;
        } else if (this.waves.length == 2) {
            this.secondarySwellDirection = direction;
        }
        //TODO Calc max Height
    }
    async setBathymetry(bathymetryMapImage: string) {
        this.scene.remove(this.floorPlane)
        this.loadBathymetry(bathymetryMapImage)
    }
    async loadBathymetry(bathymetryMapImage: string) {
        // instantiate a loader
        const loader1 = new THREE.TextureLoader();
        // load a image resource
        await loader1.loadAsync(bathymetryMapImage).then(image => {
            this.bathymetryMap = image
            this.seaMaterial.uniforms.uDepthmap.value = this.bathymetryMap
            const seaFloor_geometry = new THREE.PlaneGeometry(256 * this.seaSpreadScale, 256 * this.seaSpreadScale, 256, 256);
            const seaFloor_material = new THREE.MeshStandardMaterial()
            seaFloor_material.wireframe = false
            seaFloor_material.emissive = new THREE.Color(`#${this.theme.props.colors.seaFloorColor}`)
            seaFloor_material.displacementMap = this.bathymetryMap
            seaFloor_material.displacementScale = this.seaDepthScale * 2.5
            this.floorPlane = new THREE.Mesh(seaFloor_geometry, seaFloor_material);
            this.floorPlane.rotateX(-Math.PI / 2)
            this.floorPlane.rotateZ(Math.PI / 2)
            this.floorPlane.position.setY(-1.5 * this.seaDepthScale * 2.5)
            this.scene.add(this.floorPlane)
        })

    }
    async loadChop(chopMapImage: string) {
        const loader2 = new THREE.TextureLoader();
        await loader2.loadAsync(chopMapImage).then(image => {
            this.chopMap = image
            this.chopMap.wrapT = this.chopMap.wrapS = THREE.RepeatWrapping
            this.seaMaterial.uniforms.uNoiseMap.value = this.chopMap
        })
    }
    onPointerMove(e) {
        this.moveRulerToPointer(e)
    }
    onWindowResize() {

        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
    toScreenPosition(coord: Vector3) {
        const widthHalf = 0.5 * this.renderer.domElement.width;
        const heightHalf = 0.5 * this.renderer.domElement.height;
        coord.project(this.camera);
        coord.x = (coord.x * widthHalf) + widthHalf;
        coord.y = - (coord.y * heightHalf) + heightHalf;
    };
    moveRulerToPointer(e) {
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / this.container.clientWidth) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / this.container.clientHeight) * 2 + 1;
        const intersection = new THREE.Vector3()
        this.raycaster.setFromCamera(this.mouse, this.camera)
        this.raycaster.ray.intersectPlane(this.intersectionPlane, intersection)
        this.pointer.set(intersection.x, intersection.y, intersection.z)
        this.ruler.position.set(intersection.x, intersection.y, intersection.z)
        this.updatePointer()
    };
    moveTag(element: HTMLElement, coords: Vector3, lockY: boolean, lockX: boolean) {
        const centerToCamera = this.camera.position.distanceTo(new Vector3())
        const cardinalToCamera = this.camera.position.distanceTo(coords)
        this.toScreenPosition(coords);
        let outside = false
        const baseOffset = 0
        const offset = {
            right: baseOffset + element.offsetWidth,
            top: baseOffset + element.offsetHeight,
            bottom: baseOffset + element.offsetWidth,
            left: baseOffset + element.offsetWidth
        }

        if (coords.x > this.renderer.domElement.width - offset.right) {
            coords.x = this.renderer.domElement.width - offset.right
            // outside = true
        } else if (coords.x < offset.left) {
            coords.x = offset.left
            // outside = true
        }

        if (coords.y > this.renderer.domElement.height - offset.bottom) {
            coords.y = this.renderer.domElement.height - offset.bottom
            //  outside = true
        } else if (coords.y < offset.top) {
            coords.y = offset.top
            //  outside = true
        }




        if (element.classList[0] === 'compassComponent' || 'compassData') {
            if (lockY) {
                if (centerToCamera > cardinalToCamera) {
                    outside = true
                }
                coords.y = offset.top
            }
            element.style.opacity = outside ? '0.0' : '1.0'
            element.style.pointerEvents = 'none'

        }
        element.style.transform = 'translate3d(' + coords.x + 'px,' + coords.y + 'px, 0)'


    }

    updateControls() {
        this.controls.update();
    }
    updateCompass() {
        let r = 0 + this.spotOrientation
        const compassDistance = this.seaSpreadScale * this.AMOUNTX

        this.letCompass.cardinals.forEach((cardinal: HTMLElement) => {
            this.moveTag(cardinal, new Vector3(-compassDistance * Math.cos(r), 20, compassDistance * Math.sin(r)), true, false)
            r += Math.PI / 4
        });

        this.moveTag(this.letCompass.directions[0], new Vector3(-compassDistance * Math.cos(this.swellDirection), 20, -compassDistance * Math.sin(this.swellDirection)), true, false)
        this.moveTag(this.letCompass.directions[1], new Vector3(-compassDistance * Math.cos(this.secondarySwellDirection), 20, -compassDistance * Math.sin(this.secondarySwellDirection)), true, false)
        this.moveTag(this.letCompass.directions[2], new Vector3(-compassDistance * Math.cos(this.windDirection), 20, -compassDistance * Math.sin(this.windDirection)), true, false)

    }
    updatePointer() {
        this.rulerElements.forEach((line: HTMLElement, index: Number) => {
            this.moveTag(line, new THREE.Vector3(this.pointer.x, (2 * (5 - index) / this.seaSpreadScale), this.pointer.z), false, false)
        });
    }
    update() {
        this.updateControls()
        this.updateCompass()

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
    destroy() {
        this.renderer.forceContextLoss()
    }
    render() {
        this.renderer.render(this.scene, this.camera);
    }

}

