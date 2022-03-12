import { Vector2 } from "three";
export declare class TorochoidalWave {
    period: number;
    direction: Vector2;
    height: number;
    steepness: number;
    wavelength: number;
    constructor(SCALE: number, in_period: number, in_direction: Vector2, in_height: number, in_steepness: number, in_wavelength: number);
}
