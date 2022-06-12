import * as THREE from "three";
import { BufferAttribute, MathUtils, Vector2, Vector3 } from "three";
export class TorochoidalWave {
    period: number
    direction: Vector2
    height: number
    // the max scale of the dot distributed in the heihgt of the grid

    constructor(in_period: number, in_direction: number, in_height: number) {
        this.period = in_period
        this.setDirection(in_direction)
        this.height = in_height
    }

    setPeriod(value: number) {
        this.period = value
    }
    setDirection(value: number) {
        value = value * Math.PI / 180;
        this.direction = new Vector2(Math.cos(value), Math.sin(value));
    }
    setHeight(value: number) {
        this.height = value
    }

}

