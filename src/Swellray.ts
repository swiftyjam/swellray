import * as THREE from 'three';
import { BufferAttribute, Mesh, PerspectiveCamera, Points, Scene, Vector2, Vector3, WebGLRenderer, ShaderMaterial, Texture, Clock, Raycaster, Plane, Group, MeshBasicMaterial } from "three";
import { OrbitControls } from '../tools/OrbitControls.js';
import { TorochoidalWave } from "./TorochoidalWave";
import { fragment } from "../shaders/swellrayFragment.js";
import { vertex } from "../shaders/swellrayVertex.js";
import { floorFragment } from "../shaders/floorFragment.js"
import { floorVertex } from "../shaders/floorVertex.js"
import * as defaultTheme from "../themes/default.json";
import { Sculptor } from './Sculptor.js';
import { log } from 'console';
export class Swellray {
    container: HTMLElement
    scene: Scene
    renderer: WebGLRenderer
    camera: PerspectiveCamera
    cameraType: string
    mouse: Vector2
    raycaster: Raycaster
    intersectionPlane: Plane
    lastSculptTime: number
    sculptInterval: number
    sculptPointer: Mesh
    sculptAreaPointer: THREE.Line
    pointer: Vector3
    upperRuler: Group
    axisMarkerZ: THREE.Line
    axisMarkerX: THREE.Line
    axisMarkerZTag:HTMLElement
    axisMarkerXTag:HTMLElement
    floorDepthTag:HTMLElement
    extensionMeasure: Group
    clock: Clock
    controls: OrbitControls
    dots: Points
    seaPlane: Mesh
    floorGeometry: THREE.PlaneGeometry
    floorPlane: Mesh
    theme: any
    backgroundColor: string
    delta: number
    fps: number
    waves: Array<TorochoidalWave>
    sculptDiameterA: number
    sculptDiameterB: number
    sculptAngle: number
    sculptPower: number
    sculptAttenuationFactor: number
    maxSculptHeight: number
    bathymetryMap: Texture
    energyMap: Texture
    seaMap : Texture
    chopMap: Texture
    seaMaterial: ShaderMaterial
    seaCenters: BufferAttribute
    letCompass: any
    upperRulerHTML: any
    lowerRulerHTML: any
    floorMeasureHTML: any
    windDirection: number
    swellDirection: number
    secondarySwellDirection: number
    spotOrientation: number

    seaSpreadScale: number
    seaDepthScale: number
    seaFloorVisAugment: number
    floorPosition: number
    simulationSpeed: number

    sculptor: Sculptor

    mode: Array<string>
    sculptMode: string
    isMouseDown: boolean

    readonly MAGIC_N: number = 256
    readonly AMOUNTX: number = this.MAGIC_N
    readonly AMOUNTZ: number = this.MAGIC_N
    readonly LIB_PATH: string
    readonly CENTERS_NUMBER = this.AMOUNTX * this.AMOUNTZ
    readonly G = 9.81

    // the max scale of the dot distributed in the heihgt of the grid
    constructor(container: HTMLElement, bathymetryMapImage: string, chopMapImage: string) {
        this.setBathymetry(bathymetryMapImage);
        this.loadChop(chopMapImage);
        this.container = container;
    }
    async init() {

        this.letCompass = {
            cardinals: [],
            directions: []
        }
        this.mode = ['preset', 'sculpt'];
        this.sculptMode = false;
        this.theme = defaultTheme
        this.clock = new THREE.Clock
        this.fps = 60
        this.waves = []
        this.windDirection = 0
        this.swellDirection = 0
        this.secondarySwellDirection = 0
        this.spotOrientation = 0
        this.seaSpreadScale = 0.5// 1 = 256m 0.5 = 128m ...
        this.seaDepthScale = 10 // 1 means each 1% of B = 0.1m //!LEAVE THIS VALUE UNTIL WE CHANGE DEPTH SYSTEM
        this.seaFloorVisAugment = 1 // This value stretches the floor height visually to make it easier to interpretate
        this.floorPosition = - this.seaDepthScale * this.seaFloorVisAugment
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
        this.sculptDiameterA = 50
        this.sculptDiameterB = 35
        this.sculptAngle = 45
        this.sculptPower = 2
        this.sculptAttenuationFactor = 6
        this.maxSculptHeight = this.seaDepthScale
        this.lastSculptTime = 0;
        this.sculptInterval = 16; // Limitar a llamar la función sculpt cada 16 ms (aproximadamente 60 FPS)
        this.intersectionPlane = new Plane(new THREE.Vector3(0, 1, 0), 0);
        this.createSculptAreaPointer();
        this.createSculptPointer()
        this.mouse = new THREE.Vector2()
        this.isMouseDown = false;
        this.initCompass();
        this.initControls();

        this.buildSea();
        this.buildLegends();
        this.setBrush(0,0,0,0);
        
        window.addEventListener('resize', this.onWindowResize.bind(this));
        window.addEventListener('pointermove', this.onPointerMove.bind(this))
        window.addEventListener("mousedown", () => this.isMouseDown = true, false);
        window.addEventListener("mouseup", () => this.isMouseDown = false, false);
        window.addEventListener('keyup', (event) => {
            if (event.key === 'd' || event.key === 'D') {
                this.saveTextureAsPNG(this.bathymetryMap, 'bathymetryMap.png');
                this.saveTextureAsPNG(this.energyMap, 'energyMap.png');
            }
            if (event.key === 'k' || event.key === 'K') {
                this.updateEnergyMap()
               console.log('dddd')
        
            }
            
          });
       
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
                uEnergymap: {
                    value: null
                },
                uNoiseMap: {
                    value: null
                },
                u_low_color: { value: new THREE.Color(`#${this.theme.props.colors.lowSeaColor}`) },
                u_high_color: { value: new THREE.Color(`#${this.theme.props.colors.highSeaColor}`) },
                u_color_offset: { value: 1 },
                u_color_multiplier: { value: 1.5 },


            },
            wireframe: false,
            clipping: false,
            vertexShader: vertex,
            fragmentShader: fragment
        });




        const p_geometry = new THREE.PlaneGeometry(this.AMOUNTX / this.seaSpreadScale, this.AMOUNTZ / this.seaSpreadScale, this.AMOUNTX - 1, this.AMOUNTZ - 1);

        p_geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        p_geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));

        this.seaPlane = new THREE.Mesh(p_geometry, this.seaMaterial);
        this.seaPlane.rotateX(Math.PI);
        this.scene.add(this.seaPlane);
        this.seaPlane.visible=true;


        const d_geometry = new THREE.PlaneGeometry(this.AMOUNTX * this.seaSpreadScale, this.AMOUNTZ * this.seaSpreadScale, this.AMOUNTX - 1, this.AMOUNTZ - 1);
        d_geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        d_geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
        //d_geometry.rotateX(Math.PI)

        this.dots = new THREE.Points(d_geometry, this.seaMaterial);
        this.dots.rotateX(Math.PI)
        // this.dots.rotateY(Math.PI/2 )
        this.scene.add(this.dots);
        this.seaCenters = this.dots.geometry.attributes.position.clone()

    }
    buildLegends() {

        //**HEIHGTMARK */
        this.upperRuler = new THREE.Group()
        const m1 = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1,
            linewidth: 1,
        });
        let units = 12

        let unitcounter = 0;
        let eachCut = 0

        this.upperRulerHTML = [];
        while (unitcounter < units) {
            if (eachCut == 2) {
                eachCut = 0
                const span = document.createElement("span")
                span.innerHTML = `${unitcounter}m`
                span.className = "rulerComponent"
                span.classList.add("upper")
                span.id = `upperRuler-${unitcounter}`
                span.style.position = "absolute"
                this.container.appendChild(span)
                this.upperRulerHTML.unshift(
                    document.getElementById(`upperRuler-${unitcounter}`),
                )
            }


            const pointGroup2 = [];
            pointGroup2.push(new THREE.Vector3(0, (unitcounter), 0));
            pointGroup2.push(new THREE.Vector3(0, (unitcounter), (eachCut == 0 ? 2 : 1)));
            const g2 = new THREE.BufferGeometry().setFromPoints(pointGroup2);
            this.upperRuler.add(new THREE.Line(g2, m1));
            eachCut++
            unitcounter++;
        }
        this.scene.add(this.upperRuler)
  
        //**END HEIGHTMARK */

        //**FLOOR MEASSURE */
        this.floorMeasureHTML = [];
        this.extensionMeasure = new THREE.Group()
        const cells = this.AMOUNTX * this.seaSpreadScale
        unitcounter = 0;

        eachCut = 0
        while (unitcounter < cells) {
            if (eachCut == 8) {
                eachCut = 0
                const span = document.createElement("span")
                span.innerHTML = `${unitcounter}m`
                span.className = "floorMeasureComponent"
                span.id = `floor-${unitcounter}`
                span.style.position = "absolute"
                this.container.appendChild(span)
                this.floorMeasureHTML.unshift(
                    document.getElementById(`floor-${unitcounter}`),
                )

            }
            const pointGroup4 = [];
            pointGroup4.push(new THREE.Vector3(-(this.seaSpreadScale * this.AMOUNTX) / 2 + unitcounter, 0, -(this.seaSpreadScale * this.AMOUNTX) / 2 - 4));
            pointGroup4.push(new THREE.Vector3(-(this.seaSpreadScale * this.AMOUNTX) / 2 + unitcounter, 0, -(this.seaSpreadScale * this.AMOUNTX) / 2 - (eachCut == 0 ? 12 : 8)));
            const g4 = new THREE.BufferGeometry().setFromPoints(pointGroup4);
            this.extensionMeasure.add(new THREE.Line(g4, m1));
            unitcounter++;
            eachCut++;
        }
        this.scene.add(this.extensionMeasure)

        //AXIS MARKER
        const amz_mat = new THREE.LineBasicMaterial({ color: 0x00ee90 });
        const amz_geo= new THREE.BufferGeometry().setFromPoints([new Vector3(-(this.AMOUNTX * this.seaSpreadScale)/2,0,0),new Vector3((this.AMOUNTX * this.seaSpreadScale)/2,0,0)]);

        this.axisMarkerZ = new THREE.Line(amz_geo,amz_mat)
        this.scene.add(this.axisMarkerZ)

        const amx_mat = new THREE.LineBasicMaterial({ color: 0xee0090 });
        const amx_geo= new THREE.BufferGeometry().setFromPoints([new Vector3(0,0,-(this.AMOUNTX * this.seaSpreadScale)/2),new Vector3(0,0,(this.AMOUNTX * this.seaSpreadScale)/2)]);

        this.axisMarkerX = new THREE.Line(amx_geo,amx_mat)
        this.scene.add(this.axisMarkerX)

        const span_amx = document.createElement("span")
        span_amx.innerHTML = `${this.axisMarkerX.position.z}m`
        span_amx.className = "axisMarker"
        span_amx.id = `amx`
        span_amx.style.position = "absolute"
        this.axisMarkerXTag = span_amx
        this.container.appendChild(this.axisMarkerXTag)

        const span_amz = document.createElement("span")
        span_amz.innerHTML = `${this.axisMarkerZ.position.x}m`
        span_amz.className = "axisMarker"
        span_amz.id = `amz`
        span_amz.style.position = "absolute"
        this.axisMarkerZTag = span_amz
        this.container.appendChild(this.axisMarkerZTag)

        //FLOOR HEIGHT
        const span_sh = document.createElement("span")
        span_sh.innerHTML = `${0}m`
        span_sh.className = "floorDepthMarker"
        span_sh.id = `fd`
        span_sh.style.position = "absolute"
        this.floorDepthTag = span_sh
        this.container.appendChild(this.floorDepthTag)
        
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
        this.controls.enableZoom = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = this.AMOUNTX * this.seaSpreadScale * 0.25;
        this.controls.maxDistance = this.AMOUNTX * this.seaSpreadScale * 2;
        this.controls.maxPolarAngle = Math.PI / 2;
        this.camera.position.set(this.controls.maxDistance / (this.camera.aspect * 8), this.controls.maxDistance / (this.camera.aspect * 4), -this.controls.maxDistance / (this.camera.aspect * 2));
        this.controls.update();

    }
    resetWaves() {
        this.waves = []
    }
    toggleSculptMode(value){
        this.sculptMode = value
        this.sculptAreaPointer.visible = value
        this.controls.enabled = !value
    }
   
    
    setBrush(brushSizeX,brushSizeY,brushAttenuation,brushRotation,brushPower){
        this.sculptDiameterA = brushSizeX; 
        this.sculptDiameterB = brushSizeY; 
        this.sculptAttenuationFactor = brushAttenuation;
        this.sculptAngle = brushRotation;
        this.sculptPower = brushPower;
        this.createSculptAreaPointer();
        
    }
    updateSculptPointer(intersect: any) {
        
        this.sculptPointer.position.copy(intersect.point);
        this.sculptPointer.position.setY(this.sculptPointer.position.y * this.seaFloorVisAugment);
        
        this.moveTag(this.floorDepthTag,new Vector3().copy(intersect.point).setY(intersect.point.y + this.seaDepthScale * 2),false,false,true)
        this.floorDepthTag.innerText = `Depth: ${(intersect.point.y).toPrecision(3)}m`
        
    }
    updateSculptAreaPointer(intersect: any) {
        
        if(this.sculptAreaPointer !== "undefined")
        this.sculptAreaPointer.position.copy(this.sculptPointer.position)
        
    }

    createSculptPointer() {
        const geometry = new THREE.SphereGeometry(0.5, 16, 16);
        const material = new THREE.MeshBasicMaterial({ color: this.theme.props.colors.sculptPointerColor, wireframe: false });
        const sphere = new THREE.Mesh(geometry, material);
 // Ocultar inicialmente el cilindro
        sphere.position.setY(this.floorPosition);
        this.sculptPointer = sphere;
        this.scene.add(this.sculptPointer)
        
    }
    createSculptAreaPointer() {
        if(this.sculptAreaPointer !== "undefined"){
            this.scene.remove(this.sculptAreaPointer);
        }
        const a = this.sculptDiameterA / 2;
        const b = this.sculptDiameterB / 2;
        const angle = this.sculptAngle * Math.PI / 180 // Puedes ajustar este valor para controlar la relación de aspecto de la elipse
        const ellipseCurve = new THREE.EllipseCurve(
            0,
            0,
            a,
            b,
            0,
            2 * Math.PI,
            false,
            0
        );

        const ellipsePoints = ellipseCurve.getPoints(50);
        const ellipseGeometry = new THREE.BufferGeometry().setFromPoints(ellipsePoints);

        const ellipseMaterial = new THREE.LineBasicMaterial({ color: this.theme.props.colors.sculptPointerColor });
        this.sculptAreaPointer = new THREE.Line(ellipseGeometry, ellipseMaterial);
        this.sculptAreaPointer.rotateX(Math.PI / 2)
        this.sculptAreaPointer.rotateZ(-angle)
        this.scene.add(this.sculptAreaPointer);
    }
    
    updateDisplacementTexture(i: number, j: number, height: number): void {
        const size = this.bathymetryMap.image.width;
        const index = (j * size + i) * 4;
    
        const normalizedHeight = height / this.maxSculptHeight;
        this.bathymetryMap.image.data[index] = normalizedHeight;
        this.bathymetryMap.image.data[index + 1] = normalizedHeight;
        this.bathymetryMap.image.data[index + 2] = normalizedHeight;
        this.bathymetryMap.image.data[index + 3] = 1;
        // Indicates that the texture needs to be updated
        this.bathymetryMap.needsUpdate = true;
    
  
    }

    updateEnergyMap(): void {
        const size = this.bathymetryMap.image.width;
        const radians = (this.swellDirection * Math.PI) / 180;
    
        const dx = -Math.round(Math.cos(radians));
        const dy = -Math.round(Math.sin(radians));
    
        // Crear una copia de los datos de la imagen de bathymetryMap
        const bathymetryData = new Float32Array(this.bathymetryMap.image.data);
    
        for (let j = 0; j < size; j++) {
            for (let i = 0; i < size; i++) {
                let energyReduction = 0;
                let x = i;
                let y = j;
    
                while (x >= 0 && x < size && y >= 0 && y < size) {
                    const index = (y * size + x) * 4;
                    const normalizedHeight = bathymetryData[index];
    
                    // energyReduction += normalizedHeight;
                    energyReduction += 0.01 * normalizedHeight;
                    energyReduction = Math.min(energyReduction, 1);
    
                    const energyIndex = (j * size + i) * 4;
                    this.energyMap.image.data[energyIndex] = 1 - energyReduction;
                    this.energyMap.image.data[energyIndex + 1] = 1 - energyReduction;
                    this.energyMap.image.data[energyIndex + 2] = 1 - energyReduction;
                    this.energyMap.image.data[energyIndex + 3] = 1;
    
                    x += dx;
                    y += dy;
                }
            }
        }
    
        this.energyMap.needsUpdate = true;
        this.seaMaterial.uniforms.uEnergymap.value = this.energyMap;
    }
     saveTextureAsPNG(texture, fileName) {
        // Create a canvas to render the texture
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
      
        // Set canvas size to match the texture
        canvas.width = texture.image.width;
        canvas.height = texture.image.height;
      
        // Create an ImageData object to store the texture data
        const imageData = context.createImageData(canvas.width, canvas.height);
      
        // Copy the texture data to the ImageData object
        for (let i = 0; i < texture.image.data.length; i++) {
          imageData.data[i] = texture.image.data[i] * 255;
        }
      
        // Put the ImageData object into the canvas
        context.putImageData(imageData, 0, 0);
      
        // Create a link element to download the image
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = fileName;
        link.click();
      }
      
      // Usage:
     


  logAlteredPosition(mesh) {
  const width = 1;
  const height = 1;

  const renderer = new THREE.WebGLRenderer();
  const renderTarget = new THREE.WebGLRenderTarget(width, height);

  const scene = new THREE.Scene();
  scene.add(mesh);

  const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 1, 1000);
  camera.position.set(0, 0, 2);
  camera.lookAt(0, 0, 0);

  renderer.setRenderTarget(renderTarget);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);

  const buffer = new Float32Array(width * height * 4);
  renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, buffer);

  const x = buffer[0];
  const y = buffer[1];
  const z = buffer[2];

  console.log(`Altered position at (0, 0, 0): (${x}, ${y}, ${z})`);
}
    getElipseAttenuation(distance: number, di: number, dj: number): number {
        const ellipseRotation = this.sculptAngle * (Math.PI / 180); // Convierte a radianes
        const a = this.sculptDiameterA;
        const b = this.sculptDiameterB;

        // Aplica la rotación
        const cosTheta = Math.cos(ellipseRotation);
        const sinTheta = Math.sin(ellipseRotation);
        const rotatedDi = di * cosTheta - dj * sinTheta;
        const rotatedDj = di * sinTheta + dj * cosTheta;

        const ellipseDistance = Math.sqrt((rotatedDi * rotatedDi) / (a * a) + (rotatedDj * rotatedDj) / (b * b));

        if (ellipseDistance <= 1) {
            return Math.pow(1 - ellipseDistance, this.sculptAttenuationFactor); // Retorna una atenuación gradual desde el centro hacia los extremos con el grado de atenuación ajustado
        }

        return 0;
    }
    sculpt(intersect: THREE.Intersection): void {
        const size = this.floorGeometry.parameters.widthSegments;
        const vertices = this.floorGeometry.attributes.position.array;

        const localPos = new THREE.Vector3();
        localPos.copy(intersect.point).sub(this.floorPlane.position);

        const i = Math.floor((localPos.x + 0.5 * this.floorGeometry.parameters.width) / this.floorGeometry.parameters.width * size);
        const j = Math.floor((localPos.z + 0.5 * this.floorGeometry.parameters.height) / this.floorGeometry.parameters.height * size);

        for (let dj = -Math.ceil(this.sculptDiameterB); dj <= Math.ceil(this.sculptDiameterB); dj++) {
            for (let di = -Math.ceil(this.sculptDiameterA); di <= Math.ceil(this.sculptDiameterA); di++) {
                const ni = i + di;
                const nj = j + dj;

                if (ni >= 0 && ni <= size && nj >= 0 && nj <= size) {
                    const index = (nj * (size + 1) + ni) * 3;
                    const indexDisplacement = (nj * size + ni) * 4;

                    const localX = (ni / size) * this.floorGeometry.parameters.width - 0.5 * this.floorGeometry.parameters.width;
                    const localZ = (nj / size) * this.floorGeometry.parameters.height - 0.5 * this.floorGeometry.parameters.height;

                    const dx = localPos.x - localX;
                    const dy = localPos.z - localZ;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < Math.max(this.sculptDiameterA, this.sculptDiameterB)) {
                        const attenuation = this.getElipseAttenuation(distance, di, dj);
                        const deltaHeight = attenuation * this.sculptPower;
                        const newHeight = vertices[index + 1] + deltaHeight;

                        if (newHeight <= this.maxSculptHeight * 2) {
                            vertices[index + 1] = newHeight;
                            this.updateDisplacementTexture(ni, nj, vertices[index + 1]);
                        }
                    }
                }
            }
        }

        this.floorGeometry.attributes.position.needsUpdate = true;
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
    createEmptyMapLayer(size: number): THREE.DataTexture {
        const data: Float32Array = new Float32Array(size * size * 4);
        for (let i = 0; i < size * size * 4; i += 4) {
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
            data[i + 3] = 1;
        }
        return new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
    }
   
    async setBathymetry(bathymetryMapImage: string) {
        this.scene.remove(this.floorPlane);
        const img = this.createEmptyMapLayer(this.AMOUNTX);
        this.buildFloor(img)
       
    }
    async loadBathymetry(bathymetryMapImage: string) {
        const loader1 = new THREE.TextureLoader();
        // load a image resource
        await loader1.loadAsync(bathymetryMapImage).then(image => {
            this.buildFloor(image)
        })

    }
    buildFloor(img: Texture) {
        this.bathymetryMap = img
        this.energyMap = this.createEmptyMapLayer(this.AMOUNTX);
        this.seaMaterial.uniforms.uDepthmap.value = this.bathymetryMap;
        this.seaMaterial.uniforms.uEnergymap.value = this.energyMap;
        this.floorGeometry = new THREE.PlaneGeometry(this.AMOUNTX * this.seaSpreadScale, this.AMOUNTZ * this.seaSpreadScale, this.AMOUNTX - 1, this.AMOUNTZ - 1);
        this.floorGeometry.rotateX(-Math.PI / 2)
        //const seaFloor_geometry = new THREE.PlaneGeometry(256, 256, 256, 256);

        const seaFloor_material = new THREE.ShaderMaterial({
            uniforms: {
                uScale: {
                    value: this.seaSpreadScale
                },
                uDepthScale: {
                    value: this.seaDepthScale
                },
                uDepthmap: {
                    value: this.bathymetryMap
                },
                uFloorAugment: {
                    value: this.seaFloorVisAugment
                }
            },
            vertexShader: floorVertex,
            fragmentShader: floorFragment
        });

        this.floorPlane = new THREE.Mesh(this.floorGeometry, seaFloor_material);
        this.floorPlane.position.setY(this.floorPosition)
        this.scene.add(this.floorPlane)
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
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / this.container.clientWidth) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / this.container.clientHeight) * 2 + 1;

        

            // Usar la instancia de raycaster existente en lugar de crear una nueva
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects([this.floorPlane]);

            if (intersects.length > 0) {
                const intersect = intersects[0];
                this.updateSculptPointer(intersect);
                
                if (this.sculptMode) {
                    this.updateSculptAreaPointer(intersect)
                    if (!this.isMouseDown) return;
                // Limitar la frecuencia de llamadas a la función sculpt
                const currentTime = performance.now();
                if (currentTime - this.lastSculptTime >= this.sculptInterval) {
                    this.bathymetryMap.needsUpdate = true
                    this.sculpt(intersect);
                    this.lastSculptTime = currentTime;
                }

            }
        }
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

    moveRulerToPointer() {

        const intersection = new THREE.Vector3()
        this.raycaster.setFromCamera(this.mouse, this.camera)
        this.raycaster.ray.intersectPlane(this.intersectionPlane, intersection)
        this.pointer.set(intersection.x, intersection.y, intersection.z)
        this.upperRuler.position.set(intersection.x, intersection.y, intersection.z)

        //Axis
        this.axisMarkerZ.position.setZ(intersection.z)
        this.axisMarkerX.position.setX(intersection.x)

        this.moveTag(this.axisMarkerXTag,new Vector3(intersection.x, 0, (this.AMOUNTX * this.seaSpreadScale)/2),false,false,true)
        this.axisMarkerXTag.innerText = `X: ${((this.AMOUNTX * this.seaSpreadScale)/2 - intersection.x).toPrecision(3)}m`

        this.moveTag(this.axisMarkerZTag,new Vector3((this.AMOUNTX * this.seaSpreadScale)/2,0,intersection.z),false,false,true)
        this.axisMarkerZTag.innerText = `Z: ${((this.AMOUNTX * this.seaSpreadScale)/2 - intersection.z).toPrecision(3)}m`

    };
    moveTag(element: HTMLElement, coords: Vector3, lockY: boolean, lockX: boolean, canOut: boolean) {
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
            outside = true
        } else if (coords.x < offset.left) {
            coords.x = offset.left
            outside = true
        }

        if (coords.y > this.renderer.domElement.height - offset.bottom) {
            coords.y = this.renderer.domElement.height - offset.bottom
            outside = true
        } else if (coords.y < offset.top) {
            coords.y = offset.top
            outside = true
        }




        if (element.classList[0] === 'compassComponent' || element.classList[0] === 'compassDirection') {
            if (lockY) {
                if (centerToCamera > cardinalToCamera) {
                    outside = true
                }
                coords.y = offset.top
            }
            // element.style.opacity = outside ? '0.0' : '1.0'
            element.style.pointerEvents = 'none'

        }
        element.style.transform = 'translate3d(' + coords.x + 'px,' + coords.y + 'px, 0)'
        element.style.visibility = outside ? 'hidden' : 'visible'


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
        this.moveRulerToPointer();
        this.upperRulerHTML.forEach((line: HTMLElement, index: Number) => {
            this.moveTag(line, new THREE.Vector3(this.pointer.x, (2 * (this.upperRulerHTML.length - index)), this.pointer.z), false, false, true)
        });
    }
    updateFloorMeasure() {
        this.floorMeasureHTML.forEach((line: HTMLElement, index: Number) => {
            this.moveTag(line, new THREE.Vector3((this.seaSpreadScale * this.AMOUNTX) / 2 - 8 * (this.floorMeasureHTML.length - index), 0, -(this.seaSpreadScale * this.AMOUNTX) / 2 - 15), false, false, true)
        });
    }
    update() {

        this.updateControls()
        this.updateCompass()
        this.updateFloorMeasure()
        this.updatePointer()
        requestAnimationFrame(this.update.bind(this));
        this.delta += this.clock.getDelta()
        if (this.delta > 1 / this.fps) {
            this.seaMaterial.uniforms.uTime.value += this.delta
            if (this.waves.length > 0) {
                this.seaMaterial.uniforms.uWaves.value = this.waves.reduce((prev, curr) => [...prev, ...curr.direction.toArray(), curr.period, curr.height], [0, 0, 0, 0])

            } else {
                this.seaMaterial.uniforms.uWaves.value = [0, 0, 0, 0]
            }
            this.floorPlane.geometry.attributes.position.needsUpdate = true;
            this.dots.geometry.attributes.position.needsUpdate = true;
            this.seaPlane.geometry.attributes.position.needsUpdate = true;

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
    exportDisplacementMap(): void {
        const size: number = this.bathymetryMap.image.width;
        const data: Uint8Array = new Uint8Array(this.bathymetryMap.image.data.buffer);
        const canvas: HTMLCanvasElement = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context: CanvasRenderingContext2D = canvas.getContext("2d");
        const imageData: ImageData = context.createImageData(size, size);

        for (let i = 0; i < data.length; i += 4) {
            const value: number = Math.floor(data[i] * 255);
            imageData.data[i] = value;
            imageData.data[i + 1] = value;
            imageData.data[i + 2] = value;
            imageData.data[i + 3] = 255;
        }

        context.putImageData(imageData, 0, 0);

        const a: HTMLAnchorElement = document.createElement("a");
        a.href = canvas.toDataURL("image/png");
        a.download = "displacement_map.png";
        a.click();
    }

}

