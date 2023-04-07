const floorVertex = `
    precision highp float;
    varying vec3 vViewPosition;
    uniform vec3 mvPosition;
    uniform float uScale;
    uniform float uDepthScale;
    uniform sampler2D uDepthmap;
    uniform float uFloorAugment;
    varying float vDepth;
    varying vec2 vUv;
    void main(){
        vUv = uv;
        vec3 newPosition = position;
        vec3 p=vec3(position.xyz);
        // vDepth=((texture2D(uDepthmap, vec2(vUv.x, 1.0 - vUv.y)).x));
        // p.y *=  uFloorAugment;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
    `
export { floorVertex }