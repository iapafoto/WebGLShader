// Sebastien Durand 2023
// ----------------------------------------------------------------
// License: Creative Commons Attribution-ShareAlike 3.0 Unported License
//-----------------------------------------------------------------
// Associates a glsl shader to a canvas 
// Enables animation with pause and start (iTime - shadertoy like)
// Manage canvas resize (iResolution - shadertoy like)
// ----------------------------------------------------------------

class GLCanvas {
	#paramCallback;
	#animTime0;
	#time0;
	#isPause;
	
	constructor(canvas, fragmentShader, initCallback, renderCallback) {
		if (typeof canvas === 'string' || canvas instanceof String) {
			this.canvas = document.getElementById(canvas);
		} else {	
			this.canvas = canvas;
		}
		this.gl = this.canvas.getContext('webgl2');
		this.#paramCallback = renderCallback;
		this.#isPause = false;

		if (fragmentShader.endsWith(".frag") || fragmentShader.endsWith(".gl") || fragmentShader.endsWith(".glsl")) {
			loadShader(fragmentShader, (src) => { // load file form url
				this.#init(src, initCallback);
			});
		} else {
			this.#init(fragmentShader, initCallback); // already source code
		}
	}

	#init(fragmentShaderSrc, initCallback) {
		this.program = this.#createProgram(fragmentShaderSrc);
		this.setAnimTime(0); // Begining of the animation

		const self = this;
		window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
		window.addEventListener('resize', function() {
			self.#resizeMe();
		});
		if (initCallback != null && typeof initCallback !== 'undefined') {
			initCallback(this);
		}
		this.#resizeMe();
		this.#render();
	} 
	
	#resizeMe() {
		// Update canvas size to real size to avoid stretch effects
		const k = window.devicePixelRatio || 1;
		if (this.canvas.width != k*this.canvas.clientWidth ||
			this.canvas.height != k*this.canvas.clientHeight) {
			this.canvas.width = k*this.canvas.clientWidth;
			this.canvas.height = k*this.canvas.clientHeight;
			this.update();
		}
	}

	#compile(shader, src) {
		this.gl.shaderSource(shader, src);
		this.gl.compileShader(shader);
		// log de compilation
		let compiled = this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS);
		console.log('Shader compiled successfully: ' + compiled);
		let compilationLog = this.gl.getShaderInfoLog(shader);
		console.log('Shader compiler log: ' + compilationLog);
	}

	#createProgram(fragmentShaderSrc) {
		let vertexShaderSrc = `#version 300 es
			in vec4 position;void main() {gl_Position = position;}`;

		const vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER);
		const fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
		this.#compile(vertexShader, vertexShaderSrc)
		this.#compile(fragmentShader, fragmentShaderSrc)

		const program = this.gl.createProgram();
		this.gl.attachShader(program, vertexShader);
		this.gl.attachShader(program, fragmentShader);
		this.gl.linkProgram(program);
		this.gl.useProgram(program);

		return program;
	}

	#render() {
		this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

		const positionAttributeLocation = this.gl.getAttribLocation(this.program, 'position');
		const positionBuffer = this.gl.createBuffer();
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
		this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), this.gl.STATIC_DRAW);
		
		this.gl.enableVertexAttribArray(positionAttributeLocation);
		this.gl.vertexAttribPointer(positionAttributeLocation, 2, this.gl.FLOAT, false, 0, 0);

		// Charge les paramètres du shader
		this.gl.useProgram(this.program);
		
		// par defaut
		this.set1f('iTime', this.getAnimTime());
		this.set2f('iResolution', this.canvas.width, this.canvas.height);
	
		// Appel de la fonction de rendu de votre fragment shader
		if (this.#paramCallback != null && typeof this.#paramCallback !== 'undefined') {
			this.#paramCallback(this);
		}
			
		this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
		if (!this.#isPause) {
			window.requestAnimationFrame(() => this.#render());
		}
	}

	// Control of animation -------------------------
	
	isPaused() {
		return this.#isPause;
	}
	
	start()	{
		this.#isPause = false;
		this.setAnimTime(this.#animTime0);
		this.#render();
	}
	
	pause() {
		if (!this.#isPause) {
			this.#animTime0 = this.#animTime0 + (performance.now()/1000. - this.#time0);
			this.#isPause = true;
		}
	}	
	
	update() {
		if (this.#isPause) { // update is automatic if anim
			this.#render();
		}
	}
		
	setAnimTime(t) { // indirect set anim time
		this.#animTime0 = t;
		this.#time0 = performance.now()/1000.;
	}
	
	getAnimTime() { // indirect get anim time
		return this.#isPause ? this.#animTime0 : this.#animTime0 + (performance.now() / 1000 - this.#time0);
	}
	
	// Modest simplification of function calls ------------------------
	
	set1f(param, v) {		
		let p = this.gl.getUniformLocation(this.program, param);
		if (p != null) this.gl.uniform1f(p, v);
	}
	
	set1i(param, v) {		
		let p = this.gl.getUniformLocation(this.program, param);
		if (p != null) this.gl.uniform1i(p, v);
	}
	
	set2f(param, v1, v2) {		
		let p = this.gl.getUniformLocation(this.program, param);
		if (p != null) this.gl.uniform2f(p, v1, v2);
	}
	
	setTexture(param, txt, id) {
		this.gl.activeTexture(this.gl.TEXTURE0 + id);
		this.gl.bindTexture(this.gl.TEXTURE_2D, txt);
		this.set1i(param, id);
	}
}

// ------------------------------------------------------------------------------
// Initialize a texture and load an image.
// When the image finished loading copy it into the texture.
// The texture is create froma canvas but could be use in all canvas
function loadTexture(canvas, url) {
	var gl = canvas.getContext("webgl2");
	const texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	// Default init blue texture
	const pixel = new Uint8Array([0, 0, 255, 255]); // opaque blue
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1,1,0, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
	// Get real picture
	const image = new Image();
	image.onload = () => {
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
		// WebGL1 has different requirements for power of 2 images
		if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
			gl.generateMipmap(gl.TEXTURE_2D); // Generate mips.
		} else {
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		}
	};
	image.src = url;
	return texture;
}

function isPowerOf2(value) {
  return (value & (value - 1)) === 0;
}

// ------------------------------------------------------------------------------
// Initialize a texture from the rendering of a canvas
function loadTexture(canvas) {
	const gl = canvas.getContext("webgl2");
	const texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	return texture;
}

// ------------------------------------------------------------------------------------
function loadShader(url, callback) {
	var xhr = new XMLHttpRequest();
	// xhr.overrideMimeType("x-shader/x-fragment"); // not usefull
	xhr.onreadystatechange = function() {
		if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
			callback(xhr.responseText);
		}
	};
	xhr.open("GET", url, true);
	xhr.send();
}

/* Multi loading (not used)
function loadShaders(urls, callback) {
    let results = [];
    let loadedCount = 0;
    for (let i = 0; i < urls.length; i++) {
        let xhr = new XMLHttpRequest();
        xhr.overrideMimeType("x-shader/x-fragment");
        xhr.open("GET", urls[i], true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4 && xhr.status === 200) {
                results[i] = JSON.parse(xhr.responseText);
                loadedCount++;
                if (loadedCount === urls.length) {
                    callback(results);
                }
            }
        };
        xhr.send();
    }
}

*/
