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
    uniform vec2 uSpotOrientation;
    varying vec2 vWindDirection;
    uniform float uTime;
    uniform float uScale;
    uniform float uDepthScale;
    uniform sampler2D uDepthmap;
    uniform sampler2D uEnergymap;
    uniform sampler2D uNoiseMap;
    varying float vDepth;
    varying float vEnergyAtt;
    varying vec2 vUv;
    varying float vSteepness;
    varying float vHeightDepthRatio;
    varying float vDisplacementY;

    vec3 gerstnerWave(vec4 wave,vec3 p,inout float windDisplace,inout vec3 tangent,inout vec3 binormal){
        vUv=uv;
       
        
        vDepth=(1.-(texture2D(uDepthmap, vec2(1.- vUv.y,1.- vUv.x)).x)) * uDepthScale;
        vEnergyAtt=((texture2D(uEnergymap, vec2(1.- vUv.y,1.- vUv.x)).x));
        float period= wave.z;
        float height= wave.w;
        float w = 2.*PI / period ; 

        float calculatedWavelength = G*pow(period,2.) / 2.*PI;
        float wdRatio = vDepth / calculatedWavelength ;
        float calculatedSpeed = 1.56 * period;
        if(wdRatio >= 0.5){
            calculatedSpeed = calculatedSpeed;
            calculatedWavelength = calculatedWavelength;
        }else if(wdRatio > 0.05){
            calculatedSpeed = (G*period / 2.*PI) * tanh((2.*PI*vDepth) / calculatedWavelength);
            calculatedWavelength = (G*pow(period,2.) / 2.*PI) * tanh((2.*PI*vDepth) / calculatedWavelength);
        }else if(wdRatio <= 0.05){
            calculatedSpeed =sqrt(G*vDepth);
            calculatedWavelength = sqrt(G*vDepth*period);
        }
    
        float steepness = (height / calculatedWavelength) * vEnergyAtt;
        float windSteepness = windDisplace  ;
        steepness += windSteepness;
        
           
        float k = w / calculatedSpeed;
        
        float c = calculatedSpeed;
        vec2 d = normalize(vec2(wave.x,-wave.y) + (vWindDirection * windDisplace));
        float f = k*(dot(d,p.xz)-c*uTime);
        
        // float a = (steepness/k) * length(uSpotOrientation.xy + d.xy);
        float a = (steepness/k) * length(uSpotOrientation.xy + d.xy)+ windDisplace;
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
        

        // float vertical = min(a*cos(f), vDepth );
        //float vertical = a*cos(f);
        float vertical = min(a*cos(f), vDepth - 1. * uScale  );
        vertical = vertical;
        vSteepness += (-vertical) / calculatedWavelength ;
        return vec3(
            d.x*(a*sin(f)),
            vertical,
            d.y*(a*sin(f))
        );
    }
    
    
    void main(){
        vec3 tangent=vec3(1.,0.,0.);
        vec3 binormal=vec3(0.,0.,1.);
  
        vec3 p=vec3(position.xyz);
      
     
    
        float windWaveHeight = (.27 * pow(uWindSpeed,2.))/G * length(uSpotOrientation.xy + uWindDirection.xy)/6.;
        vWindDirection = vec2(uWindDirection.x,-uWindDirection.y);
        float windDisplace = (texture2D(uNoiseMap, uv  ).r * windWaveHeight * uScale )  ;
    
        float wcount=0.;
        for(int i=0;i<uWaves.length();i++){
            vec4 wave=uWaves[i];
            if(wave.w>0.){
                p+=gerstnerWave(wave,position,windDisplace,tangent,binormal);
                wcount++;
            }
        }

        vDisplacementY= -p.y;
        vSteepness = vSteepness ;
        vHeightDepthRatio = 2.*(vDisplacementY) / (vDepth);

         if( vSteepness > 0.142 && vHeightDepthRatio > .78){
             gl_PointSize= pow(min(vHeightDepthRatio,2.),2.);
         }else{
             gl_PointSize=1.;
         }
        
        vNormal=normalize(cross(binormal,tangent));
        vViewPosition=-mvPosition.xyz;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
    }
    `
export { vertex }