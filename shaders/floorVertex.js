const floorVertex = `
    precision highp float;
    varying vec3 vViewPosition;
    uniform vec3 mvPosition;
    uniform float uScale;
    uniform float uDepthScale;
    uniform sampler2D uDepthmap;
    varying float vDepth;
    varying vec2 vUv;
    void main(){
        vUv=uv;
        vDepth=(1.-(texture2D(uDepthmap,uv).x));
        vec3 p=vec3(position.xyz);
        p.z = p.z - vDepth * uDepthScale * 5. ;
        vViewPosition=-mvPosition.xyz;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
    }
    `
export { floorVertex }