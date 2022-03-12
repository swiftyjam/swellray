import * as THREE from "three";
import { BufferAttribute, MathUtils, Vector2, Vector3 } from "three";
export class TorochoidalWave {
    period: number
    direction: Vector2
    height: number
    steepness: number
    wavelength: number
    // the max scale of the dot distributed in the heihgt of the grid

    constructor(SCALE: number, in_period: number, in_direction: Vector2, in_height: number,in_steepness : number,in_wavelength : number) {
        this.period = in_period
        this.direction = in_direction.normalize()
        this.height = in_height
        this.steepness = in_steepness
        this.wavelength = in_wavelength
    }

}

