const floorFragment = `
precision highp float;  

    varying vec2 vUv;
    uniform sampler2D uDepthMap;
    void main() {
        float displacement = texture2D(uDepthMap, vec2(vUv.x, 1.0-vUv.y)).x;
         vec3 color = mix( vec3(0.2,.3,0.6),vec3(displacement,.5,.5), displacement);
        //vec3 color = vec3(displacement,1.,1.);
        gl_FragColor = vec4(color, 1.0);
    }
    `
export { floorFragment }