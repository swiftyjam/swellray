const floorFragment = `
precision highp float;  
    varying float vDepth;
    uniform float uDepthScale;
    uniform vec3 u_low_color;
    uniform vec3 u_high_color;
    uniform float u_color_offset;
    uniform float u_color_multiplier;

    void main(){
        float mix_strength = vHeightDepthRatio/2.;
        vec4 breakColor = vec4(mix(u_low_color,vec3(.9,.9,1.),vHeightDepthRatio/4.),1.);
        vec4 color=vec4(mix(u_low_color,u_high_color,mix_strength),1.);
        gl_FragColor=color;
        return;
        
    }
    `
export { floorFragment }