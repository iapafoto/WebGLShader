
const shHead = 
`#version 300 es
precision mediump float;
uniform float iTime;
uniform vec2 iResolution;
uniform vec4 iMouse;
out vec4 outColor;
`;





const shCode1 = shHead + 
`// ###############
void mainImage(out vec3 col, in vec2 coord) {
	vec2 R = iResolution.xy, uv = (2.*coord.xy - R) / R.y;
	col = .5+.5*vec3(uv.xy,0);
}
/*
void mainImage(out vec3 col, in vec2 coord) {
	vec2 R = iResolution.xy, uv = (2.*coord.xy - R) / R.y;
	float d = length(uv) - .5;
	col = mix(vec4(.5,.2,.8,1), vec4(0), d);//
                 //  smoothstep(-2./R.y,2./R.y, (d)-.02));
}
*/
// ###############
void main() {
	vec3 c = vec3(0);
	mainImage(c, gl_FragCoord.xy);
	outColor = vec4(c, 1);
}
`;

const shCode2 = shHead + 
`
float smin(float a, float b, float k) {
    float h = max( k-abs(a-b), 0. )/k;
    return min( a, b ) - h*h*k*.25;
}
vec3 drawSDF(float d) {
    vec3 col = d>0. ? vec3(.9,.6,.3) : vec3(.65,.85,1);
    col *= 1. - exp(-6.*abs(d));
	col *= .8 + .2*cos(150.*d);
	float k = fwidth(d);
	return mix(col, vec3(1.), 1.-smoothstep(k,2.*k,abs(d)) );
}
mat2 rot(float a) {
	return mat2(cos(a), sin(a), -sin(a), cos(a));
}
// ###############
float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p)-b;
    return length(max(d,0.)) + min(max(d.x,d.y),0.);
}
float sdSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p-a, ba = b-a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0., 1.);
    return length( pa - ba*h );
}
float sdMap(vec2 uv) {
	float d1 = length(uv-vec2(-.3,0.)) - .6;
	float d2 = sdBox(uv-vec2(.3,0.), vec2(.5,.1)) - .2;
	return d1;
}
// ###############
void main() {
	vec2 R = iResolution.xy, uv = (2.*gl_FragCoord.xy - R) / R.y;
	float d = sdMap(uv);
	vec3 c = drawSDF(d);
	outColor = vec4(sqrt(c), 1);
}
`;



const shCode0 = shHead + 
`
int iFrame = 0;
#define RAY_STEP 48
#define ZERO min(0,iFrame)
#define PI 3.14159279

bool WithChameleon;	    // for optim : true if the ray intersect the bounding sphere of the chameleon
float Anim;				// pos in animation
mat2 Rotanim, Rotanim2, Rot3; // rotation matrix
float ca3, sa3;         // pre calculater sin and cos
float closest;			// min distance to chameleon on the ray (use for glow light) 
float hash( float n ) { return fract(sin(n)*43758.5453123); }
bool intersectSphere(in vec3 ro, in vec3 rd, in vec3 c, in float r) {
    ro -= c;
	float b = dot(rd,ro), d = b*b - dot(ro,ro) + r*r;
	return (d>0. && -sqrt(d)-b > 0.);
}
float udRoundBox( vec3 p, vec3 b, float r ){
  	return length(max(abs(p)-b,0.))-r;
}
vec2 sdCapsule( vec3 p, vec3 a, vec3 b, float r ) {
    vec3 pa = p - a, ba = b - a;
    float h = clamp(dot(pa,ba)/dot(ba,ba), 0., 1. );
    float dd = cos(3.14*h*2.5);  // Little adaptation
    return vec2(length(pa - ba*h) - r*(1.-.1*dd+.4*h), 30.-15.*dd); 
}
vec2 smin(in vec2 a, in vec2 b, in float k ) {
	float h = clamp( .5 + (b.x-a.x)/k, 0., 1. );
	return mix( b, a, h ) - k*h*(1.-h);
}
float smin(in float a, in float b, in float k ) {
	float h = clamp( .5 + (b-a)/k, 0., 1. );
	return mix(b, a, h) - k*h*(1.-h);
}
vec2 min2(in vec2 a, in vec2 b) {
	return a.x<b.x?a:b;
}
vec2 spiralTail(in vec3 p) {
    float a = atan(p.y,p.x)+.2*Anim;
	float r = length(p.xy);
    float lr = log(r);
    float th = 0.475-.25*r; // thickness according to distance
    float d = fract(.5*(a-lr*10.)/PI); //apply rotation and scaling.
    d = (0.5-abs(d-0.5))*2.*PI*r/10.;
  	d *= 1.1-1.1*lr;  // space fct of distance
    r+=.05*cos(a*60.); // radial bumps
    r+=(.2-.2*(smoothstep(0.,.08, abs(p.z))));
    return vec2(
        max(max(sqrt(d*d+p.z*p.z)-th*r, length(p.xy-vec2(.185,-.14))-1.05), -length(p.xy-vec2(.4,1.5))+.77),
        abs(30.*cos(10.*d)) + abs(20.*cos(a*10.)));
}
vec2 body(in vec3 p) {
    const float scale = 3.1;
    p.y=-p.y;
    p.x += 2.;
    p/=scale;
    float a = atan(p.y,p.x);
	float r = length(p.xy);
    float d = (.5*a-log(r))/PI; //apply rotation and scaling.
    float th = .4*(1.-smoothstep(.0,1.,abs(a+.35-Anim*.05)));    
    d = (1.-2.*abs(d-.5))*r*1.5;
    r+=.01*cos(a*200.); // radial bumps
    r-=.2*(smoothstep(0.,.1,abs(p.z)));
    float dis = sqrt(d*d+p.z*p.z)-th*r;
 	dis *= scale;
    dis = max(dis, length(p.xy-vec2(.86,-.07))-.7);
    return vec2(dis, abs(30.*cos(17.*d)) + abs(20.*cos(a*20.)));
}
vec2 head(in vec3 p) {
    p.z = abs(p.z);
    p.y += .25+.03*Anim;
    p.x += .03+.03*Anim;
    p.xy *= Rotanim;
    vec3 pa1 = p, ba = vec3(1.,-.2,-.3);
    pa1.z = p.z-.22;
    float h = clamp(dot(pa1, ba), 0.0, 1.0 );
    pa1.x -= h;
	float dh = length(pa1) - .8*(-.5+1.3*sqrt(abs(cos(1.5701+h*1.5701))))+.08*(1.+h)*smoothstep(0.,.2,abs(p.z));
    dh = max(-p.y-.2, dh); 
    dh += -.04+.04*(smoothstep(0.,.2,abs(p.z)));
    dh = min(dh, max(p.x-1.35,max(p.y+.3, length(p-vec3(1.-.035*Anim,.25,-.1))-.85)));
    dh += .01*cos(40.*h) -.06;
    vec3 eye = vec3(-.2,-.0105,.15);
  	eye.zy *= Rotanim2;
    float de = max(length(p-vec3(.7,.26,.45))-.3, -(length(p-vec3(.7,.26,.45) - eye)-.13*clamp(Anim+.2,.7,1.1)));
    vec2 dee = min2(vec2(de,20.+1000.*abs(dot(p,eye))), vec2(length(p-vec3(.7,.26,.45))-.2, -102.));
  
    return smin(dee, vec2(dh*.8, 40.- abs(20.*cos(h*3.))) ,.06); 
}  
vec2 support(vec3 p, vec2 c, float th) {
    p-=vec3(-2.5,-.7,0);
    float d1 = length(p-vec3(0,-6.5,0)) - 3.;          
    float d = length(max(abs(p-vec3(0,-2,.75))-vec3(.5,2.5,.1),0.))-.11;     
    p.xy *= Rot3; 
    d = min(d, max(length(max(abs(p)-vec3(4,3,.1),0.))-.1,
                  -length(max(abs(p)-vec3(3.5,2.5,.5),0.))+.1));
    return min2(vec2(d1,-105.),
        min2(vec2(d,-100.), 
                 vec2(length(max(abs(p-vec3(0,0,.2))-vec3(3.4,2.4,.01),0.))-.3, -103.)));
}
vec2 map(in vec3 pos) {
    // Ground
    vec2 res1 = vec2( pos.y+4.2, -101.0 );
    // Screen
	res1 = min2(support(pos+vec3(2.5,-0.56,0), vec2(.1,15.), 0.05), res1);
    if (WithChameleon) {
        // Tail + Body
        vec2 res = smin(spiralTail(pos.xyz-vec3(0,-.05-.05*Anim,0)), body( pos.xyz-vec3(-.49,1.5,0)),.1 ); 
        // Head
        res = smin(res, head(pos - vec3(-2.8,3.65,0)), .5);
        pos.z = abs(pos.z);
        // legs
        res = min2(res, min2(sdCapsule(pos, vec3(.23,-.1*Anim+1.3,.65), vec3(.75,-.1*Anim+.6,.05),.16),
                             sdCapsule(pos, vec3(.23,-.1*Anim+1.3,.65), vec3(-.35,1.35,.3),.16)));
        res = min2(res, vec2(length(pos-vec3(-.35,1.35,.1))- .33, 30.));   
        // arms 
        res = smin(res, min2(sdCapsule(pos, vec3(-.8+.06*Anim,2.5,.85),vec3(-1.25+.03*Anim,3.,.2), .16),
                             sdCapsule(pos, vec3(-.8+.06*Anim,2.5,.85), vec3(-1.25,2.1,.3),.16)),.15);
        res = min2(res, vec2(length(pos-vec3(-1.55,1.9,.1))- .3, 30.));
        
        if (res.x < closest) {
            closest = abs(res.x);
        }
        return min2(res, res1);
    } else {
        return res1;
    }
}
#define EDGE_WIDTH 0.15
vec2 castRay(in vec3 ro, in vec3 rd, in float maxd, inout float hmin) {
    closest = 9999.; // reset closest trap
	float precis = .0006, h = EDGE_WIDTH+precis, t = 2., m = -1.;
    hmin = 0.;
    for( int i=ZERO; i<RAY_STEP; i++) {
        if( abs(h)<t*precis || t>maxd ) break;
        t += h;
	    vec2 res = map(ro+rd*t);
        if (h < EDGE_WIDTH && res.x > h + 0.001) {
			hmin = 10.0;
		}
        h = res.x;
	    m = res.y;
    }
    
	//if (hmin != h) hmin = 10.;
    if( t>maxd ) m = -200.0;
    return vec2( t, m );
}
float softshadow( in vec3 ro, in vec3 rd, in float mint, in float maxt, in float k) {
	float res = 1.0;
    float t = mint;
    for( int i=ZERO; i<26; i++ ) {
		if( t>maxt ) break;
        float h = map( ro + rd*t ).x;
        res = min( res, k*h/t );
        t += h;
    }
    return clamp( res, 0., 1.);
}
vec3 calcNormal(in vec3 pos, vec3 rd, float t ) {
    vec3 n = vec3(0);
    for( int i=ZERO; i<4; i++) {
        vec3 e = .5773*(2.*vec3((((i+3)>>1)&1),((i>>1)&1),(i&1))-1.);
        n += e*map(pos+.002*e).x;
    }
	return normalize(n - max(0., dot(n,rd ))*rd);
}
float calcAO( in vec3 pos, in vec3 nor) {
	float totao = 0.0;
    float sca = 1.0;
    for( int aoi=ZERO; aoi<5; aoi++ ) {
        float hr = 0.01 + 0.05*float(aoi);
        vec3 aopos =  nor * hr + pos;
        float dd = map( aopos ).x;
        totao += -(dd-hr)*sca;
        sca *= .75;
    }
    return clamp( 1.0 - 4.0*totao, 0.0, 1.0 );
}
vec3 mandelbrot(in vec2 uv, vec3 col) {
    uv.x += 1.5;
    uv.x = -uv.x;
    float a=.05*sqrt(abs(Anim)), ca = cos(a), sa = sin(a);
    mat2 rot = mat2(ca,-sa,sa,ca);
    uv *= rot;
	float kk=0., k = abs(.15+.01*Anim);
    uv *= mix(.02, 2., k);
	uv.x-=(1.-k)*1.8;
    vec2 z = vec2(0);
    vec3 c = vec3(0);
    for(int i=ZERO;i<50;i++) {
        if(length(z) >= 4.0) break;
        z = vec2(z.x*z.x-z.y*z.y, 2.*z.y*z.x) + uv;
        if(length(z) >= 4.0) {
            kk = float(i)*.07;
            break; // does not works on some engines !
        }
    }
    return clamp(mix(vec3(.1,.1,.2), clamp(col*kk*kk,0.,1.), .6+.4*Anim),0.,1.);
}
vec3 screen(in vec2 uv, vec3 scrCol) {
    // tv effect with horizontal lines and color switch
    vec3 oricol = mandelbrot(vec2(uv.x,uv.y), scrCol);
    vec3 col;
	float colorShift = .2*cos(.5*iTime);
    col.r = mandelbrot(vec2(uv.x,uv.y+colorShift), scrCol).x;
    col.g = oricol.y;
    col.b = mandelbrot(vec2(uv.x,uv.y-colorShift), scrCol).z;
    
	uv *= Rot3;	
	col =(.5*scrCol+col)*(.5+.5*cos(iTime*5.))*cos(iTime*10.+40.*uv.y);  
    return col*col;
}
float isGridLine(vec2 p, vec2 v) {
    vec2 k = smoothstep(.1,.9,abs(mod(p+v*.5, v)-v*.5)/.08);
    return k.x * k.y;
}
vec4 render( in vec3 ro, in vec3 rd, inout float hmin) { 
    // Test bounding sphere (optim)
    WithChameleon = intersectSphere(ro,rd,vec3(-.5,1.65,0),3.15); //2.95);
    vec2 res = castRay(ro,rd,60.0, hmin);
    float distCham = abs(closest);
    float t = res.x;
	float m = res.y;
    vec3 cscreen = vec3(sin(.1+1.1*iTime), cos(.1+1.1*iTime),.5);
    cscreen *= cscreen;
    vec3 col;
	float dt;
    float glow = 1.-smoothstep(Anim + cos(iTime),.9+1.15,2.2);
    glow *= step(.3, hash(iTime)); //floor(.01+10.5*iTime)));
    if( m>-150.)  { 
        vec3 pos = ro + t*rd;
        vec3 nor = calcNormal(pos, rd, t);
        if( m>0. ) { // Chameleon
			col = vec3(.4) + .35*cscreen + .3*sin(1.57*.5*iTime + vec3(.05,.09,.1)*(m-1.) );
        } else if (m<-104.5) {  // bottom of screen
            col = vec3(.92);
            dt = dot(normalize(pos-vec3(-4,-4,0)), vec3(0,0,-1));
            col += (dt>0.) ? (.75*glow+.3)*dt*cscreen: vec3(0); 
        } else if (m<-102.5) {
           	if (pos.z<0.) { // screen
            	col = screen(pos.xy,cscreen);
                col += 20.*glow*col;
            } else { // back of screen
                col = vec3(.92);
            	distCham *= .25; // Hack for chameleon light on screen
            }
        } else if (m<-101.5) {
            col = .2+3.5*cscreen*glow;
        } else if(m<-100.5) {  // Ground
            float f = mod( floor(2.*pos.z) + floor(2.*pos.x), 2.0);
            col = 0.4 + 0.1*f*vec3(1.);
            col = .1+.9*col*isGridLine(pos.xz, vec2(2.));
            dt = dot(normalize(pos-vec3(-4,-4,0)), vec3(0,0,-1));
 			col += (dt>0.) ? (.75*glow+.3)*dt*cscreen: vec3(0);     
    		//col = clamp(col,0.,1.);
        } else {  // Screen
            col = vec3(.92);
            distCham *= .25; // Hack for chameleon light on screen
        }
        float ao = calcAO( pos, nor );
		vec3 lig = normalize( vec3(-0.6, 0.7, -0.5) );
		float amb = clamp( 0.5+0.5*nor.y, 0.0, 1.0 );
        float dif = clamp( dot( nor, lig ), 0.0, 1.0 );
        float bac = clamp( dot( nor, normalize(vec3(-lig.x,0.0,-lig.z))), 0.0, 1.0 )*clamp( 1.0-pos.y,0.0,1.0);
		float sh = 1.0;
		if( dif>0.02 ) { 
            WithChameleon = intersectSphere(pos,lig,vec3(-.5,1.65,0),2.95);
            sh = softshadow( pos, lig, 0.02, 13., 8.0 ); 
            dif *= sh; 
        }
		vec3 brdf = vec3(0.0);
		brdf += 1.80*amb*vec3(0.10,0.11,0.13)*ao;
        brdf += 1.80*bac*vec3(0.15,0.15,0.15)*ao;
        brdf += 0.8*dif*vec3(1.00,0.90,0.70)*ao;
		float pp = clamp( dot( reflect(rd,nor), lig ), 0.0, 1.0 );
		float spe = 1.2*sh*pow(pp,16.0);
		float fre = ao*pow( clamp(1.0+dot(nor,rd),0.0,1.0), 2.0 );
		col = col*brdf*(.5+.5*sh) + vec3(.25)*col*spe + 0.2*fre*(0.5+0.5*col);
        float rimMatch =  1. - max( 0. , dot( nor , -rd ) );
        col += vec3((.1+cscreen*.1 )* pow( rimMatch, 10.));
	}
	col = mix(col,vec3(.08), smoothstep(15.,30.,t));
    float BloomFalloff = 15000.; //mix(1000.,5000., Anim);
 	col += .5*glow*cscreen/(1.+distCham*distCham*distCham*BloomFalloff);
    return vec4( clamp(col,0.,1.), t); 
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec2 R = iResolution.xy,
         q = fragCoord.xy/R,
         p = (2.*fragCoord.xy-R)/R.y,
         mo = iMouse.xy/R;
	mo.y = .3;
    // animation
    float GlobalTime = iTime; // + .1*hash(iTime);
    Anim = clamp(5.6*cos(GlobalTime)*cos(4.*GlobalTime),-2.5,1.2);
    ca3 = cos(.275+.006*Anim); sa3 = sin(.275+.006*Anim);   
	Rot3 = mat2(ca3,-sa3,sa3,ca3);
    float a=.1+.05*Anim, ca = cos(a), sa = sin(a);
    Rotanim = mat2(ca,-sa,sa,ca);
    float b = mod(GlobalTime,12.)>10.?cos(8.*GlobalTime):.2*cos(4.*GlobalTime), cb = cos(b), sb = sin(b);
    Rotanim2 = mat2(cb,-sb,sb,cb);
    float time = 17. + /*14.5 +*/ GlobalTime;
    float dist = 18.;
    vec3 ro = vec3( -0.5+dist*cos(0.1*time + 6.0*mo.x), 8., 0.5 + dist*sin(0.1*time + 6.0*mo.x) );
    vec3 ta = vec3( -3.5, .3, 0);
    vec3 cw = normalize( ta-ro );
    vec3 cp = vec3(0, 1, 0);
    vec3 cu = normalize( cross(cw,cp) );
    vec3 cv = normalize( cross(cu,cw) );
    vec3 rd = normalize( p.x*cu + p.y*cv + 2.5*cw );
    float hmin = 100.;
    vec4 res = render(ro,rd, hmin);
    fragColor = vec4(pow(res.rgb, vec3(.7)), 1.);
    if (res.w>15.&& p.y<-.9) {
        fragColor = vec4(0,0,0,0); 
    }
}
void main() {
	mainImage(outColor, gl_FragCoord.xy);
}
`;



const shCode3 = shHead + 
`
float hash( const in vec2 p ) {
	float h = dot(p,vec2(127.1,311.7));	
    return fract(sin(h)*43758.5453123);
}
vec3 bary(vec2 a, vec2 b, vec2 c, vec2 p) {
    vec2 v0 = b - a, v1 = c - a, v2 = p - a;
    float d = (v0.x * v1.y - v1.x * v0.y),
          v = (v2.x * v1.y - v1.x * v2.y) / d,
          w = (v0.x * v2.y - v2.x * v0.y) / d;
    return abs(vec3(1.-v-w,v,w));
}
float grid(vec2 p, vec2 v) {
    vec2 k = smoothstep(.0,1., abs(mod(p+v*.5, v)-v*.5)/1.5*iResolution.y);
    return min(k.x,k.y);
}
float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p)-b;
    return length(max(d,0.)) + min(max(d.x,d.y),0.);
}
vec3 getColorAt(vec2 uvt) {
    float time = mod(iTime, 2.); 
    float h = smoothstep(0., 1., hash(uvt)+1.5-1.5*time);     
    float t = max(0., time-2.); 
    t = .2*floor(iTime/2.);
    uvt *= mat2(cos(t), -sin(t), sin(t), cos(t));
    vec2 a = vec2(-.5, -0.7),
         b = vec2(-.3, 0.75),
         c = vec2(.7, -.2);
    vec3 col = bary(a, b, c, uvt/20.);
    bool isActive = col.x + col.y + col.z < 1.01;
    return !isActive ? vec3(.0) : mix(col,vec3(0.025), h);
}
void mainImage( out vec4 fragColor, in vec2 xy ) {
	vec2 R = iResolution.xy, uv = (2.*xy - R)/R.y,  
         q = xy/R;
    float sz = 1./20.;
    vec2 uvt = floor(uv/sz);
    vec3 c, sum = vec3(0), col = vec3(.025);
    for (int y=-2; y<3; y++) {
        for (int x=-2; x<3; x++) {
             if(x==0 && y==0) {
                col += 1.5*getColorAt(uvt);
             } else {
                c = getColorAt(uvt+vec2(x,y));
                float d = sdBox(uv-sz*((uvt+vec2(x,y))+.5), vec2(sz*.25));
                sum += mix(c*c, vec3(0), pow(smoothstep(sz*.15, sz*1.3,d),.2));
            } 
        }
    }
    col = mix(vec3(0), col, grid(uv, vec2(sz)));
    col += .7*sum;
    col =  pow(col,vec3(.42));
    col *= pow(16.*q.x*q.y*(1.-q.x)*(1.-q.y),.53);
    fragColor = vec4(col, 1.);
}
void main() {
	mainImage(outColor, gl_FragCoord.xy);
	
}
`;



const shCode5 = shHead + 
`
mat2 rot(float a) {
    return mat2(cos(a),sin(a), -sin(a), cos(a));
}
float anim2(float t) {
    float tt = mod(t,1.5)/1.5;
    float ss = pow(tt,.2)*0.5 + 0.5;
    ss = 1.0 + ss*0.5*sin(tt*6.2831*3.0)*exp(-tt*4.0);
    return ss*.5;
}
vec3 drawDistance(float d) {
    vec3 col = d>0. ? vec3(.9,.6,.3) : vec3(.65,.85,1);
    col *= 1. - exp(-6.*abs(d));
	col *= .8 + .2*cos(150.*d);
	float k = fwidth(d);
	return mix(vec3(1), col, smoothstep(0.,2./iResolution.y,abs(d)));
}
vec3 draw2(float d, vec3 c, vec3 back) {
    return mix(c, back, smoothstep(0.,2./iResolution.y,d));
}
float sdSegment( in vec2 p, in vec2 a, in vec2 b ) {
    vec2 pa = p-a, ba = b-a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h );
}
float sdBox( in vec2 p, in vec2 b ) {
    vec2 d = abs(p)-b;
    return length(max(d,0.)) + min(max(d.x,d.y),0.);
}
float map(vec2 uv) {
	uv *= 1.5;
	float  d = length(uv-vec2(0,0)) -.4 - .1*anim2(iTime);
	d = min(d, sdBox(uv, vec2(.5,.2)) - .1*anim2(iTime)); 
	uv *= rot(.3*iTime);
	uv += vec2(.8,.0);
	uv *= rot(iTime);
	d = min(d, sdBox(uv, vec2(.0,.1))-.06); 
	return d/1.5;
}
vec2 normal(vec2 uv) {
    return normalize(vec2(
        map(uv+vec2(1,0)) - map(uv+vec2(-1,0)),
        map(uv+vec2(0,1)) - map(uv+vec2(0,-1))));    
}
vec3 trace(vec2 pos, vec2 rd, vec2 uv, vec3 col) {
    float d2 = 999., d3 = d2;
    float d = abs(length(pos-uv) - .03) -.006;
    d = min(d, sdSegment(uv, pos+.03*rd, pos+10.*rd)-.006);
	float h, t = 0.;
    int nb = int(mod(2.*iTime,10.));
	for (int i=0; i<nb; i++) {
        vec2 p = pos + t*rd;
        if (i>0) {
            d = min(d, length(p-uv) - .02);
        }
		h = map(pos+t*rd );
        d2 = min(d2, abs(length(p-uv) - h));
        d3 = min(d3, (length(p-uv) - h));
		if (h < 1e-2 || t > 2.)
			break;
        t = t+h;
	}
    vec3 c2 = h<1e-2 ? vec3(0,1,0) : vec3(1,0,0); 
    col = mix(c2, col, .8+.2*step(0.,d3));
    col = draw2(d2, c2, col);   
    
	return draw2(d, vec3(1), col);
}
void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec2  R = iResolution.xy,
          uv = (2.*fragCoord - R) / R.y,
          m1 = (2.*iMouse.xy - R) / R.y,
          m2 = (2.*abs(iMouse.zw) - R) / R.y;
    vec3 c = drawDistance(map(uv));
    c = trace(m2, normalize(m1-m2), uv, c);
    fragColor = vec4(sqrt(c),1);
}
void main() {
	mainImage(outColor, gl_FragCoord.xy);
	
}
`;


const shCode5B = shHead + 
`
mat2 rot(float a) {
    return mat2(cos(a),sin(a), -sin(a), cos(a));
}
float anim2(float t) {
    float tt = mod(t,1.5)/1.5;
    float ss = pow(tt,.2)*0.5 + 0.5;
    ss = 1.0 + ss*0.5*sin(tt*6.2831*3.0)*exp(-tt*4.0);
    return ss*.5;
}
vec3 drawDistance(float d) {
    vec3 col = d>0. ? vec3(.9,.6,.3) : vec3(.65,.85,1);
    col *= 1. - exp(-6.*abs(d));
	col *= .8 + .2*cos(150.*d);
	float k = fwidth(d);
	return mix(vec3(1), col, smoothstep(0.,2./iResolution.y,abs(d)));
}
vec3 draw2(float d, vec3 c, vec3 back) {
    return mix(c, back, smoothstep(0.,2./iResolution.y,d));
}
float sdSegment( in vec2 p, in vec2 a, in vec2 b ) {
    vec2 pa = p-a, ba = b-a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h );
}
float sdBox( in vec2 p, in vec2 b ) {
    vec2 d = abs(p)-b;
    return length(max(d,0.)) + min(max(d.x,d.y),0.);
}
float map(vec2 uv) {
	uv *= 1.5;
   float  d = length(uv-vec2(0,0)) -.4 - .1*anim2(iTime);
   d = min(d, sdBox(uv, vec2(.5,.2)) - .1*anim2(iTime)); 
   uv *= rot(.3*iTime);
   uv += vec2(.8,.0);
   uv *= rot(iTime);
   d = min(d, sdBox(uv, vec2(.0,.1))-.06); 
   return d/1.5;
}
vec2 normal(vec2 uv) {
    return normalize(vec2(
        map(uv+vec2(.001,0)) - map(uv+vec2(-.001,0)),
        map(uv+vec2(0,.001)) - map(uv+vec2(0,-.001))));    
}
vec3 trace(vec2 p, vec2 uv, vec3 col) {
    vec2 n = normal(p);
    float d = sdSegment(uv, p+.03*n, p+.4*n)-.01;
    col = draw2(d, vec3(0,1,0), col);
    n = vec2(-n.y, n.x);
    d = sdSegment(uv, p+.03*n, p+.4*n)-.01;
    col = draw2(d, vec3(0,0,1), col);
    d = abs(length(p-uv) - .03) -.006;
	return draw2(d, vec3(1), col);
}
void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec2  R = iResolution.xy,
          uv = (2.*fragCoord - R) / R.y,
          m1 = (2.*iMouse.xy - R) / R.y;
    vec3 c = drawDistance(map(uv));
    c = trace(m1, uv, c);
    fragColor = vec4(sqrt(c),1);
}
void main() {
	mainImage(outColor, gl_FragCoord.xy);
	
}
`;



const shCode6 = shHead + 
`
// ###############
vec2 min2(vec2 a, vec2 b) {
    return a.x < b.x ? a : b;
}

vec2 max2(vec2 a, vec2 b) {
    return a.x > b.x ? a : b;
}

vec2 smin2( vec2 a, vec2 b, float k ) {
    float h = max( k-abs(a.x-b.x), 0.)/k,
          m = h*h*.5,
          s = m*k*.5,
          c = a.x<b.x ? mix(a.y, b.y, m) : mix(a.y, b.y, 1.-m);
    return a.x<b.x ? vec2(a.x-s, c) : vec2(b.x-s, c);
}

vec2 smax2( vec2 a, vec2 b, float k ) {
    return -smin2(-a, -b, k);
}

// -----------------------------------

float sdBox( vec3 p, vec3 b ) {
    vec3 d = abs(p) - b;
    return min(max(d.x,max(d.y,d.z)),0.) + length(max(d,0.));
}

float sdTorus( vec3 p, vec2 t ) {
    return length(vec2(length(p.xz)-t.x, p.y)) - t.y;
}

vec2 sdMap( in vec3 p ) {   
    float dp = p.y;
    float ds = length(p-vec3(0,.5, 0)) - .5;
    
    p -= vec3(.5,.8,.3);
    float db = sdBox(p, vec3(.6,.4,.2));
    
    vec2 res = min2( vec2( dp, 1.0 ),
                     smin2(vec2( db, 30.0 ),
                           vec2( ds, 46.9 ),.25));
    return res;
}
// -----------------------------------

vec2 castRay( vec3 ro, vec3 rd ) {
    float tmin = 1., tmax = 20.,
          t = tmin, m = -1.;
    for( int i=0; i<64; i++ ) {
	    float precis = 5e-4*t;
	    vec2 res = sdMap( ro+rd*t );
        if( res.x<precis || t>tmax ) break;
        t += res.x;
	    m = res.y;
    }
    if( t>tmax ) m=-1.;
    return vec2( t, m );
}

float softshadow( vec3 ro, vec3 rd, float mint, float tmax ) {
	float res = 1., t = mint;
    for( int i=0; i<16; i++ ) {
		float h = sdMap( ro + rd*t ).x;
        res = min( res, 8.0*h/t );
        t += clamp( h, 0.02, 0.10 );
        if( h<0.001 || t>tmax ) break;
    }
    return clamp( res, 0., 1.);
}

// Compute normal vector to surface at pos
vec3 calcNormal( in vec3 p ) {
    vec2 e = vec2(1,-1)*.5773*5e-4;
    return normalize( e.xyy * sdMap( p + e.xyy ).x + 
					  e.yyx * sdMap( p + e.yyx ).x + 
					  e.yxy * sdMap( p + e.yxy ).x + 
					  e.xxx * sdMap( p + e.xxx ).x );
}

// compute ambient occlusion value at given position/normal
float calcAO( in vec3 pos, in vec3 nor ) {
	float occ = 0., sca = 1.;
    for( int i=0; i<5; i++ ) {
        float hr = .01 + .12*float(i)/4.;
        vec3 aopos =  nor * hr + pos;
        float dd = sdMap( aopos ).x;
        occ += -(dd-hr)*sca;
        sca *= .95;
    }
    return clamp(1. - 3.*occ, 0., 1.);    
}

// -----------------------------------

// Figure out color value when casting ray from origin ro in direction rd.
vec3 render( in vec3 ro, in vec3 rd ) { 
    // background sky color gradient
    vec3 back = vec3(.7, .9, 1.) +rd.y*.8, col = back;
    // cast ray to nearest object
    vec2 res = castRay(ro,rd);
    float t = res.x, // distance
          m = res.y; // material code
    if( m > -0.5 ) {
        vec3 pos = ro + t*rd;
        vec3 nor = calcNormal( pos );
        vec3 ref = reflect( rd, nor ); // reflected ray
        // material        
		col = 0.45 + 0.35*sin( vec3(0.05,0.08,0.10)*(m-1.0) );
        if( m < 1.5 ) {
            // gray checkerboard floor material
            float f = mod( floor(2.*pos.z) + floor(2.*pos.x), 2.);
            col = 0.3 + 0.1*f*vec3(1.0);
        }
        // lighting        
        float occ = calcAO( pos, nor ); // ambient occlusion
		vec3  lig = normalize( vec3(-0.4, 0.7, -0.6) ); // sunlight
		float amb = clamp( 0.5+0.5*nor.y, 0.0, 1.0 ); // ambient light
        float dif = clamp( dot( nor, lig ), 0.0, 1.0 ); // diffuse reflection from sunlight
        // backlight
        float bac = clamp( dot( nor, normalize(vec3(-lig.x,0.0,-lig.z))), 0.0, 1.0 )*clamp( 1.0-pos.y,0.0,1.0);
        float dom = smoothstep( -0.1, 0.1, ref.y ); // dome light
        float fre = pow( clamp(1.0+dot(nor,rd),0.0,1.0), 2.0 ); // fresnel
		float spe = pow(clamp( dot( ref, lig ), 0.0, 1.0 ),16.0); // specular reflection
        dif *= softshadow( pos, lig, 0.02, 2.5 );
        dom *= softshadow( pos, ref, 0.02, 2.5 );
		vec3 lin = vec3(0.0);
        lin += 1.30*dif*vec3(1.00,0.80,0.55);
		lin += 2.00*spe*vec3(1.00,0.90,0.70)*dif;
        lin += 0.40*amb*vec3(0.40,0.60,1.00)*occ;
        lin += 0.50*dom*vec3(0.40,0.60,1.00)*occ;
        lin += 0.50*bac*vec3(0.25,0.25,0.25)*occ;
        lin += 0.25*fre*vec3(1.00,1.00,1.00)*occ;
		col = col*lin;
        // mix fog
    	col = mix(col, back, smoothstep(5.,20.,t) );
    }

	return vec3( clamp(col,0.0,1.0) );
}

// Compute camera-to-world transformation.
mat3 setCamera( in vec3 ro, in vec3 ta, float cr ) {
	vec3 cw = normalize(ta - ro),
        cp = vec3(sin(cr), cos(cr), 0.),
        cu = normalize( cross(cw,cp) ),
        cv = normalize( cross(cu,cw) );
    return mat3( cu, cv, cw );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec2 R = iResolution.xy, mo = iMouse.xy/R, q = fragCoord/R;
	float time = 15. + iTime;
    vec2 p = (2.*fragCoord - R)/R.y;
    // camera (ro = ray origin)	
    vec3 ro = vec3(3.5*cos(.1*time + 6.*mo.x), 1. + 2.*mo.y, 3.5*sin(.1*time + 6.*mo.x) );
    vec3 ta = vec3(0, .3, 0);
    mat3 ca = setCamera(ro, ta, 0.);
    // ray direction
    vec3 rd = ca * normalize( vec3(p.xy,2) );
    // render	
    vec3 col = render( ro, rd );
    // gamma
    col = pow(col, vec3(.4545));
	col *= .5 + .5*pow(16.*q.x*q.y*(1.-q.x)*(1.-q.y),.23);
    fragColor = vec4(col, 1);
}
// ###############
void main() {
	mainImage(outColor, gl_FragCoord.xy);
	
}
`;