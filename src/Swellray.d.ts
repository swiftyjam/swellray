import { BufferAttribute, Mesh, PerspectiveCamera, Points, Scene, WebGLRenderer, ShaderMaterial, Texture, Clock } from "three";
import { OrbitControls } from '../tools/OrbitControls.js';
import { TorochoidalWave } from "./TorochoidalWave";
export declare class Swellray {
    container: HTMLElement;
    scene: Scene;
    renderer: WebGLRenderer;
    camera: PerspectiveCamera;
    cameraType: string;
    clock: Clock;
    controls: OrbitControls;
    dots: Points;
    seaPlane: Mesh;
    floorPlane: Mesh;
    theme: any;
    backgroundColor: string;
    delta: number;
    fps: number;
    waves: Array<TorochoidalWave>;
    maxHeight: number;
    bathymetryMap: Texture;
    chopMap: Texture;
    seaMaterial: ShaderMaterial;
    seaCenters: BufferAttribute;
    seaSpreadScale: number;
    seaDepthScale: number;
    simulationSpeed: number;
    readonly AMOUNTX: number;
    readonly AMOUNTZ: number;
    readonly LIB_PATH: string;
    readonly CENTERS_NUMBER: number;
    readonly G = 9.81;
    constructor(container: HTMLElement, bathymetryMapImage: string, chopMapImage: string);
    init(): Promise<void>;
    buildSea(): void;
    initControls(): void;
    resetWaves(): void;
    setWind(speed: number, direction: [number, number]): void;
    addWave(period: number, direction: [number, number], height: number): void;
    loadBathymetry(bathymetryMapImage: string): Promise<void>;
    loadChop(chopMapImage: string): Promise<void>;
    onWindowResize(): void;
    updateControls(): void;
    update(): void;
    render(): void;
}
