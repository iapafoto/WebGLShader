#version 300 es

// Sebastien Durand 2023 - Shadertoy
// ----------------------------------------------------------------
// License: Creative Commons Attribution-ShareAlike 3.0 Unported License
//-----------------------------------------------------------------


precision mediump float;

uniform float iTime;
uniform vec2 iResolution;
uniform sampler2D u_texture1;
out vec4 outColor;

// Created by sebastien durand - 10/2022
//-------------------------------------------------------------------------------------

#define FAR 10.

float gDist;
vec3 closest;

#define PI 3.141592
float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

float noise3D(in vec3 p){
	const vec3 s = vec3(113, 157, 1);
	vec3 ip = floor(p); 
    vec4 h = vec4(0., s.yz, s.y + s.z) + dot(ip, s);
	p -= ip; 
    p = p*p*(3. - 2.*p);
    h = mix(fract(sin(h)*43758.5453), fract(sin(h + s.x)*43758.5453), p.x);
    h.xy = mix(h.xz, h.yw, p.y);
    float n = mix(h.x, h.y, p.z);
    return n;
}

float fbm(in vec3 p){
    return 0.5333*noise3D( p ) + 0.2667*noise3D( p*2.02 ) + 0.1333*noise3D( p*4.03 ) + 0.0667*noise3D( p*8.03 );
}

// 2D rotation formula.
mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

vec2 hash2(vec2 p) {
   // Dave Hoskin's hash as in https://www.shadertoy.com/view/4djSRW
   vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
   p3 += dot(p3, p3.yzx+19.19);
   return fract(vec2((p3.x + p3.y)*p3.z, (p3.x+p3.z)*p3.y));
}

float hash( const in vec3 p ) {
    return fract(sin(dot(p,vec3(127.1,311.7,758.5453123)))*43758.5453123);
}

// [iq] https://www.shadertoy.com/view/4lyfzw
float opExtrussion(vec3 p, float sdf, float h) {
    vec2 w = vec2(sdf, abs(p.z) - h);
  	return min(max(w.x,w.y),0.) + length(max(w,0.));
}

float smin(float a, float b, float k )
{
	float h = clamp( 0.5 + 0.5*(b-a)/k, 0.0, 1.0 );
	return mix( b, a, h ) - k*h*(1.0-h);
}

// --------------------------------------
// Distance Functions
// --------------------------------------

float sdOcc1( in vec2 p) {
    return min(max(length(p)-2.8, 3.-
        min(length(p-vec2(0,3.4)), length(p-vec2(5.4,1.75)))), 
        min(length(p-vec2(2.352,1.404)), length(p-vec2(3,0))) - .33);
}
float sdOcc0( in vec2 p) {
    return max(length(p)-2.8, 3.-
        min(length(p-vec2(0,3.4)), length(p-vec2(5.4,1.75))) 
         );
}
float sdOcc( in vec2 p) {
    p = abs(p);
    return min(sdOcc1(p),sdOcc1(p.yx));
}
float sdOcc00( in vec2 p) {
    p = abs(p);
    return min(sdOcc0(p),sdOcc0(p.yx));
}

float sdOcc3D(in vec3 p, float h) {
    p.z = -abs(p.z);
    float d1 = opExtrussion(p, sdOcc(p.xy), h);   
    float d2 = opExtrussion(p+vec3(0,0,h), sdOcc00(p.xy)+.25, h*.15);    
    return /*max(d1,-d2); //*/smin(d1-.025,-d2,-.05);
}

float map0(vec3 p) {
    return .5*sdOcc3D(p.zxy*2., 1.);
}

float map(vec3 p) {
    return map0(p);
    // Avarage arround to get a more interesting shape 
    float d = 0.;
      for( int i=0; i<4; i++) {
        vec3 e = .57735*(2.*vec3((((i+3)>>1)&1),((i>>1)&1),(i&1)) - 1.);
        d += map0(p + .045*e);
    }
    d /= 4.;
    return d;
}


//------------------------------------------------------------------------
// Normal and Curvature (adapted from Shane shader)
//------------------------------------------------------------------------
vec3 calcNormal(vec3 p, inout vec3 edge, inout float crv, float t) { 
    float d = map(p);
    vec2 ec = 7.*vec2(12./450., 0);
	float d1 = map(p + ec.xyy), d2 = map(p - ec.xyy),
          d3 = map(p + ec.yxy), d4 = map(p - ec.yxy),
          d5 = map(p + ec.yyx), d6 = map(p - ec.yyx);
    crv = (d1 + d2 + d3 + d4 + d5 + d6 - d*3.)*32. + .5;
  
    vec3 n = vec3(0.0);
    for( int i=0; i<4; i++) {
        vec3 e = .57735*(2.*vec3((((i+3)>>1)&1),((i>>1)&1),(i&1)) - 1.);
        n += e*map(p + .001*e);
    }
    return normalize(n);
}

float trace(in vec3 ro, in vec3 rd){
    float t = 0., tmax=FAR, d;
    for(int i = 0; i<200; i++){
        d = map(ro + rd*t);
        if(abs(d)<.001*(1. + t*.05) || t > tmax) break;
        t += d; // the distance field is over estimated
    }
    if(t>tmax) t = FAR;
    return min(t, FAR);
}

// Ambient occlusion, for that self shadowed look.
// Based on the original by IQ.
float calcAO(in vec3 p, in vec3 n) {
	float sca = 4., occ = 0.;
    for( int i=1; i<6; i++ ) {
        float hr = float(i)*.3/5.,       
              dd = map(p + hr*n);
        occ += (hr - dd)*sca;
        sca *= .75;
    }
    return clamp(1. - occ, 0., 1.);   
}

// The iterations should be higher for proper accuracy.
float softShadow(in vec3 ro, in vec3 rd, float t, in float end, in float k){
    float shade = 1.;
    float dist = .001*(1. + t*.05) + .001*abs(hash2(ro.xz).x);
    for (int i = 0; i<32; i++){
        float h = map(ro + rd*dist);
        shade = min(shade, k*h/dist);    
        dist += clamp(h, .001, .025);        
        if (h<.001 || dist > end) break; 
    }
    return min(max(shade, 0.) + .1, 1.); 
}

// Shane magie
vec3 envMap(vec3 p){
    p *= 3.;
    float n3D2 = noise3D(p*3.);
    float c = noise3D(p)*.57 + noise3D(p*2.)*.28 + noise3D(p*4.)*.15;
    c = smoothstep(.25, 1., c); 
    p = vec3(c, c*c, c*c*c);
    return mix(p, p.zyx, n3D2*.5 + .5);
}

//------------------------------------------------------------------------
// [Shane] - Desert Canyon - https://www.shadertoy.com/view/Xs33Df
//------------------------------------------------------------------------
// Tri-Planar blending function. Based on an old Nvidia writeup:
// GPU Gems 3 - Ryan Geiss: http://http.developer.nvidia.com/GPUGems3/gpugems3_ch01.html
float tex3D(sampler2D tex, in vec3 p, in vec3 n){
    n = max(n*n, .001);
    n /= (n.x + n.y + n.z );  
	return (texture(tex, p.yz)*n.x + texture(tex, p.zx)*n.y + texture(tex, p.xy)*n.z).x;
}

// Texture bump mapping. Four tri-planar lookups, or 12 texture lookups in total.
vec3 doBumpMap( sampler2D tex, in vec3 p, in vec3 n, float k){
    const float ep = .001;
    vec3 grad = vec3( tex3D(tex, vec3(p.x-ep, p.y, p.z), n),
                      tex3D(tex, vec3(p.x, p.y-ep, p.z), n),
                      tex3D(tex, vec3(p.x, p.y, p.z-ep), n));
    grad = (grad - tex3D(tex, p, n))/ep;             
    grad -= n*dot(n, grad);          
    return normalize(n + grad*k);
}

//------------------------------------------------------------------------

mat3 setCamera( in vec3 ro, in vec3 ta, float cr ) {
	vec3 cw = normalize(ta-ro),
         cp = vec3(sin(cr), cos(cr),.0),
         cu = normalize( cross(cw,cp) ),
         cv =          ( cross(cu,cw) );
    return mat3( cu, cv, cw );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
  //  float time = .1*iTime;
    vec2 m = vec2(0);//iMouse.xy/iResolution.xy;

    float a = mix(.3,3.*cos(.04*iTime),.5+.5*cos(.2*iTime))+3.14*m.x;
    
    // camera	
    vec3 ta = vec3(0),
         ro = vec3(2.5*cos(a), 3.*cos(.4*iTime+15.) + 3., 3.5*sin(a)+3.*sin(.4*iTime+15.));
    // camera-to-world transformation
    mat3 ca = setCamera( ro, ta, .1*cos(.123*iTime) );

    vec2 p = (2.*fragCoord-iResolution.xy)/iResolution.y;
        
    // ray direction
    vec3 rd = ca * normalize(vec3(p,2.5)),
         lp = ro + 3.*vec3(.25, 2, -.1);
        
    // Ray march.
    float t = trace(ro, rd);

    // Background
    vec2 q = fragCoord/iResolution.xy;
    vec3 sceneCol = vec3(0);//texture(iChannel0, q).xyz; 

    if (t < FAR){
        vec3 col = vec3(.9, .2, .4); // Pink
        // Position.
        vec3 pos = ro + rd*t;
        vec3 edge = vec3(0);
        float crv = 1.;
        vec3 nor = calcNormal(pos, edge, crv, t);
        float border = .015*crv; //length(edge);
        // Scratchs   
        nor = doBumpMap(u_texture1, pos, nor, .04*border*fbm(pos*10.)); 
        
        // Light direction vector.
        vec3 li = lp - pos;
        float lDist = max(length(li), .001);
        li /= lDist;
       
        // Light falloff - attenuation.
        float atten = 1./(1. + lDist*.05 + lDist*lDist*0.025);
        
        // Soft shadow and occlusion.
        float shd = softShadow(pos + nor*.0015, li, t, lDist, 8.); // Shadows.
        float ao = .3+.7*calcAO(pos, nor);
        float diff = max(dot(li, nor), .0); // Diffuse.
        float spec = pow(max(dot(reflect(-li, nor), -rd), 0.), 99.); // Specular.
        
        // Ramping up the diffuse. Sometimes, it can make things look more metallic.
        float od = diff;
        diff += mix(.1,3.5,smoothstep(0.,.7,border))*spec;
        diff = pow(diff, 4.)*2.; 
        
        float Schlick = pow( 1. - max(dot(rd, normalize(rd + li)), 0.), 5.),
		      fre2 = mix(.5, 1., Schlick);
        // Metalic effect
        col *= fbm(pos*64.)*.75 + .5;
        // Wear effect
        col = mix(col, vec3(1)*fbm(pos*128.), 3.*border);
        sceneCol = col*(diff + .25); 
           
        // Fake environment mapping (Metalic effect)
        sceneCol += sceneCol*envMap(reflect(rd, nor))*8.;
        sceneCol *= atten*shd*ao; // Applying the light falloff, shadows and AO.
    } 
    
    fragColor = vec4(pow(clamp(sceneCol, 0., 1.),vec3(.47)), t< FAR ? 1.: 0.);
}


void main() {
	mainImage(outColor, gl_FragCoord.xy);
	
//	outColor = texture(u_texture1, gl_FragCoord.xy/iResolution.xy);
}