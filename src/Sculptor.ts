import * as THREE from 'three';
import {  PlaneGeometry, Texture } from 'three';

export class Sculptor {
    private maxHeight: number;
    private effectRadius: number;
    private power: number;
    private segments: number;
    private segmentScale: number;

    constructor(
        maxHeight: number,
        effectRadius: number,
        power: number,
        segments: number,
        segmentScale: number
    ) {
        this.maxHeight = maxHeight;
        this.effectRadius = effectRadius;
        this.power = power;
       this.segments = segments;
        this.segmentScale = segmentScale; 
    }



    updateDisplacementTexture(displacementTexture: Texture,i: number, j: number, height: number): void {
        const size: number = displacementTexture.image.width;
        const index: number = (j * size + i) * 4;
        const data: Uint8ClampedArray = displacementTexture.image.data;
        const normalizedHeight: number = height / this.maxHeight;
        data[index] = normalizedHeight * 255;
        data[index + 1] = normalizedHeight * 255;
        data[index + 2] = normalizedHeight * 255;
        data[index + 3] = 255;
        // Indicates that the texture needs to be updated
        displacementTexture.needsUpdate = true;
    }

     sculpt(displacementTexture: Texture, intersect: THREE.Intersection,  plane: THREE.Mesh): void {
        const width =this.segments * this.segmentScale
        const height =this.segments * this.segmentScale
        const size = this.segments;
        const vertices =  plane.geometry.attributes.position.array;

        const localPos = new THREE.Vector3();
        localPos.copy(intersect.point).sub(plane.position);

        const i = Math.floor((localPos.x + 0.5 *  width) /  width * size);
        const j = Math.floor((localPos.z + 0.5 *  height) /  height * size);

        for (let dj = -Math.ceil(this.effectRadius); dj <= Math.ceil(this.effectRadius); dj++) {
            for (let di = -Math.ceil(this.effectRadius); di <= Math.ceil(this.effectRadius); di++) {
                const ni = i + di;
                const nj = j + dj;

                if (ni >= 0 && ni <= size && nj >= 0 && nj <= size) {
                    const index = (nj * (size + 1) + ni) * 3;
                    const indexDisplacement = (nj * size + ni) * 4;

                    const localX = (ni / size) *  width - 0.5 *  width;
                    const localZ = (nj / size) * height - 0.5 *  height;

                    const dx = localPos.x - localX;
                    const dy = localPos.z - localZ;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < this.effectRadius) {
                        const deltaHeight = (1.0 - distance / this.effectRadius) * this.power;
                        const currentHeight = displacementTexture.image.data[indexDisplacement] * this.maxHeight;
                        const newHeight = Math.min(currentHeight + deltaHeight, this.maxHeight);

                        if (newHeight < this.maxHeight) {
                            vertices[index + 2] += deltaHeight;
                            this.updateDisplacementTexture(displacementTexture,ni, nj, vertices[index + 2]);
                        }
                    }
                }
            }
        }

        plane.geometry.attributes.position.needsUpdate = true;
    }
    
     exportDisplacementMap(displacementTexture: Texture): void {
        const size: number = displacementTexture.image.width;
        const data: Uint8Array = new Uint8Array(displacementTexture.image.data.buffer);
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

