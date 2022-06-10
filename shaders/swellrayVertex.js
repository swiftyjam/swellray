const vertex = `
    precision highp float;

    varying vec3 vNormal;
    varying vec3 vViewPosition;
    uniform vec3 mvPosition;
    const float PI=3.14159265;
    const float G=9.81;
    uniform vec4[5]uWaves;
    uniform float uWindSpeed;
    uniform vec2 uWindDirection;
    varying vec2 vWindDirection;
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

    vec3 gerstnerWave(vec4 wave,vec3 p,inout float windDisplace,inout vec3 tangent,inout vec3 binormal){
        vUv=uv;
        vDepth=(1.-(texture2D(uDepthmap,uv).x))*255.*uDepthScale;
        float period=wave.z;
        float height= 2.*wave.w  ;
        
        float deep_wavelength=1.56*pow(period,2.0);
        float shallow_wavelength=period*sqrt(G*vDepth);

        float steepness=height / shallow_wavelength;
        float windSteepness = windDisplace / shallow_wavelength;
        steepness += windSteepness;
        vSteepness += steepness;
        
        float k=2.*PI/shallow_wavelength;
        
        float c=sqrt(G*vDepth);
        vec2 d=normalize(wave.xy + (vWindDirection * windDisplace));
        float f=k*(dot(d,p.xz)-c*uTime);
        float shoalingCoef=pow(8.*PI,-.25)*pow((vDepth/deep_wavelength),-.25);
       

        float a=shoalingCoef*(steepness/k)+ windDisplace;
        
        tangent+=vec3(
            -d.x*d.x*(a*sin(f)),
            d.x*(a*cos(f)),
            -d.x*d.y*(a*sin(f))
        );
        binormal+=vec3(
            -d.x*d.y*(a*sin(f)),
            d.y*(a*cos(f)),
            -d.y*d.y*(a*sin(f))
        );
        
        float vertical=min(a*cos(f),vDepth-.01);
        return vec3(
            d.x*(a*sin(f)),
            vertical + windDisplace,
            d.y*(a*sin(f))
        );
    }
    
    
    void main(){
        vec3 tangent=vec3(1.,0.,0.);
        vec3 binormal=vec3(0.,0.,1.);
  
        vec3 p=vec3(position.xyz);
      
     
    
        float windWaveHeight = (.27 * pow(uWindSpeed,2.))/G;
        vec2 offset1 = vec2(uWindDirection.x,uWindDirection.y) * uTime * 0.01 ;
        float windDisplace = (texture2D(uNoiseMap, uv * uScale + offset1).r * windWaveHeight ) ;
    
        float wcount=0.;
        for(int i=0;i<uWaves.length();i++){
            vec4 wave=uWaves[i];
            if(wave.w>0.){
                p+=gerstnerWave(wave,position,windDisplace,tangent,binormal);
                wcount++;
            }
        }

        vDisplacementY= -p.y;
        vSteepness = vSteepness / wcount;
        vHeightDepthRatio = (vDisplacementY/2.) / (vDepth);

         if( vSteepness > .142  && vHeightDepthRatio > .78){
             gl_PointSize= pow(min(vHeightDepthRatio,4.),min(vDisplacementY,2.));
         }else{
             gl_PointSize=1.;
         }
        
        vNormal=normalize(cross(binormal,tangent));
        vViewPosition=-mvPosition.xyz;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
    }
    `
export { vertex }