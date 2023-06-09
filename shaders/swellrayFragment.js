const fragment = `
precision highp float;  
    varying float vDepth;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vTangent;
    varying float vDisplacementY;
    varying float vSteepness;
    varying float vHeightDepthRatio;
    varying vec2 vWindDirection;
    uniform sampler2D uDepthmap;
    uniform sampler2D uEnergymap;
    varying float vEnergyAtt;
    uniform float uDepthScale;
    uniform vec3 u_low_color;
    uniform vec3 u_high_color;
    uniform float u_color_offset;
    uniform float u_color_multiplier;
    const float PI=3.14159265;
    void main(){
        //  if(length(gl_PointCoord-vec2(.5,.5))>.475)discard;

        float mix_strength = vHeightDepthRatio/2.;

        vec4 breakColor = vec4(mix(u_low_color,vec3(.9,.9,1.),vHeightDepthRatio/4.),1.);
        
        vec4 color=vec4(mix(u_low_color,u_high_color,mix_strength),1.);
    
        gl_FragColor=color;

        if(  vSteepness > 0.142 && vHeightDepthRatio > .78){ 
            gl_FragColor=breakColor;
        }
        return;
        
    }
    `
export { fragment }