const fragment = `
precision highp float;  
    varying float vDepth;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vTangent;
    varying float vDisplacementY;
    varying float vSteepness;
    varying float vHeightDepthRatio;
    uniform sampler2D uDepthmap;
    uniform vec3 u_low_color;
    uniform vec3 u_high_color;
    uniform float u_color_offset;
    uniform float u_color_multiplier;
    const float PI=3.14159265;
    void main(){
        //  if(length(gl_PointCoord-vec2(.5,.5))>.475)discard;

        float mix_strength=(-vDisplacementY);

        vec4 breakColor = vec4(mix(u_low_color,vec3(1.,1.,1.),1.-vHeightDepthRatio),1.);
        vec4 color=vec4(mix(u_low_color,u_high_color,mix_strength),1.);

        // vec4 color=vec4(vHeightDepthRatio,0.,0.,1.);
        gl_FragColor=color;

        if( vSteepness > .142  && vHeightDepthRatio < 0.78){ // 1/7 = 0.142 which is stepness max point, x2 is 0.284, Normal.z is bigger than this it breaks LOL
        gl_FragColor=breakColor;
        }
        return;
        
    }
    `
export { fragment }