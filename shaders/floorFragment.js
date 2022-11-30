const floorFragment = `
precision highp float;  
    varying float vDepth;
    uniform float uDepthScale;
    uniform sampler2D uDepthMap;
    uniform float uFloorAugment;
    varying vec2 vUv;

    void main(){
        float mix_strength = vDepth * uFloorAugment;
        vec4 color=vec4(mix( vec3(1.,.5,.5),vec3(vDepth/2.,0.,vDepth/2.),mix_strength),1.);
        gl_FragColor=color;
        return;
    }
    `
export { floorFragment }