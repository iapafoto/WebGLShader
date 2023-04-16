# WebGL Canvas Shader

Simple example that shows how to associate multi glsl shaders to canvas in html page

Gestion of animation, pause / start, textures, canvas resize, setTime, etc.

The usefull file is ***GLCanvas.js***


Simple association (run glsl animation on canvas0)

		const glRenderer0 = new GLCanvas('canvas0', "fragmentShader.frag");
    
Set a parameter at each animation loop 

		const glRenderer1 = new GLCanvas('canvas1', "fragmentShader.frag", null, (rd) => {
			rd.set1f("u_param", parseFloat(document.getElementById("slider").value)); // render loop
		});

Init a texture and associate it at beginning (report to render.html for full code)

		const glRenderer2 = new GLCanvas('canvas2', "metalocc.frag", (rd) => {
			rd.setTexture("u_texture1", texture0, 0); // init only
		});

Shader variable ***iTime*** and ***iResolution*** (*shadertoy* style) are automatically set 

		#version 300 es

		precision mediump float;

		uniform float iTime;       // auto
		uniform vec2 iResolution;  // auto
		uniform float u_param;     // user responsability
		
		out vec4 outColor;

		void main() {
		  vec2 uv = gl_FragCoord.xy / iResolution.xy;
		  outColor = vec4(uv+u_param, .5+.5*cos(3.*iTime), 1.0);
		}
