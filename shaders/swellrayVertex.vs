#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec3 vNormal;
varying vec3 vViewPosition;
uniform vec3 mvPosition;
const float PI=3.14159265;
const float G=9.81;
uniform vec4[5]uWaves;
uniform float uTime;
uniform float uScale;
uniform float uDepthScale;
uniform sampler2D uDepthmap;
uniform sampler2D uNoiseMap;
varying float vDepth;
varying vec2 vUv;
varying float vSteepness;
varying float vHeightDepthRatio;
varying float vDisplacementY;
float rand(in vec2 co){
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}
// float gold_noise(in vec2 xy, in float seed){
//        return fract(tan(distance(xy*PHI, xy)*seed)*xy.x);
// }
vec3 gerstnerWave(vec4 wave,vec3 p,float windDisplace,inout vec3 tangent,inout vec3 binormal){
    vUv=uv;
    
    float vDepth=(texture2D(uDepthmap,uv).x)*256.*uDepthScale;
    float period=wave.z;
    float height=2.*wave.w + windDisplace;
    
    float deep_wavelength=1.56*pow(period,2.);
    float shallow_wavelength=period*sqrt(G*vDepth);
    
    float k=2.*PI/shallow_wavelength;
    
    float c=sqrt(G*vDepth);
    
    vec2 d=normalize(wave.xy);
    float f=k*(dot(d,p.xz)-c*uTime);
    // float shoalingCoef=pow(.4466*(deep_wavelength/vDepth),.25);
    float shoalingCoef=pow(8.*PI,-.25)*pow((vDepth/deep_wavelength),-.25);
    
    float steepness=height/shallow_wavelength;
    vSteepness+=steepness;
    float a=shoalingCoef*(steepness/k);
    
    tangent+=vec3(
        -d.x*d.x*(steepness*sin(f)),
        d.x*(steepness*cos(f)),
        -d.x*d.y*(steepness*sin(f))
    );
    binormal+=vec3(
        -d.x*d.y*(steepness*sin(f)),
        d.y*(steepness*cos(f)),
        -d.y*d.y*(steepness*sin(f))
    );
    
    float vertical=min(a*cos(f),vDepth-.01);
    vHeightDepthRatio+=abs(vertical)/vDepth;
    return vec3(
        d.x*(a*sin(f)),
        vertical,
        d.y*(a*sin(f))
    );
}

void main(){
    vec3 tangent=vec3(1.,0.,0.);
    vec3 binormal=vec3(0.,0.,1.);
    float avgW=0.;
    vec3 p=vec3(position.xyz);
     //WIND
    float windSpeed = 10.;
    vec2 windDir = vec2(0.,1.);

    //-
     windSpeed *= uScale;
     windDir = normalize(windDir);
    vec2 offset1 = windDir * uTime * 0.01 ;
    // vec2 offset2 = vec2(windDir.x + rand(vec2(-0.5,0.5)),windDir.y + rand(vec2(-0.5,0.5))) * uTime * 0.01 ;
    float windDisplace = (texture2D(uNoiseMap, uv * uScale + offset1).r * windSpeed - windSpeed/2.) / (1.+uScale) ;
    // windDisplace += (texture2D(uNoiseMap, uv * uScale+ offset2).r * windSpeed - windSpeed/2.) / (1.+uScale) ;

    float wcount=0.;
    for(int i=0;i<uWaves.length();i++){
        // dir x, dir z, steepness, wavelength
        vec4 wave=uWaves[i];
        
        if(wave.w>0.){
            p+=gerstnerWave(wave,position,windDisplace,tangent,binormal);
            wcount++;
        }
    }
    
    //vSteepness = vSteepness / count; //! This has changed
    vDisplacementY=p.y;

    vNormal=normalize(cross(binormal,tangent));
    
    vViewPosition=-mvPosition.xyz;
    if(vNormal.z>.142&&vSteepness>.142&&vHeightDepthRatio>1.2*uDepthScale){
        gl_PointSize=50.*vNormal.z;
    }else{
        gl_PointSize=1.;
    }
    
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
}