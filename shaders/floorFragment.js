const floorFragment = `
precision highp float;  
    varying float vDepth;
    uniform float uDepthScale;
    uniform sampler2D uDepthMap;
    uniform vec3 u_low_color;
    uniform vec3 u_high_color;
    uniform float u_color_offset;
    uniform float u_color_multiplier;
    varying vec2 vUv;

    void main(){
        float mix_strength = vDepth;
        vec4 color=vec4(mix( vec3(1.,1.,0.),vec3(0.,0.,1.),mix_strength),1.);
        gl_FragColor=color;
        return;
    }
    `
export { floorFragment }