// Sebastien Durand 2023
// ----------------------------------------------------------------
// License: Creative Commons Attribution-ShareAlike 3.0 Unported License
//-----------------------------------------------------------------
// Associates a glsl shader to a canvas 
// Enables animation with pause and start (iTime - shadertoy like)
// Manage canvas resize (iResolution - shadertoy like)
// ----------------------------------------------------------------

function getCursorPosition(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return {x:x,y:y};
}


class GLCanvas {
	#paramCallback;
	#iMouse = {x:0, y:0, z:0, w:0};
	#animTime0;
	#time0;
	#isPause;
	#shCode = {head:"", main:"", foot:""};
	
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

		var leftButtonDown = false;
		window.addEventListener('mousedown', function(e){
			// Left mouse button was pressed, set flag
			if(e.which === 1) leftButtonDown = true;
			var xy = getCursorPosition(self.canvas, event);
			self.#iMouse.z = xy.x; //Math.min(Math.max(0,xy.x),this.canvas.width);
			self.#iMouse.w = xy.y; //Math.min(Math.max(0,xy.y),this.canvas.height);
			self.update();
		});
		window.addEventListener('mouseup', function(e){
        // Left mouse button was released, clear flag
			if(e.which === 1) leftButtonDown = false;
		});
		window.addEventListener('mousemove', (e) => {
			if (leftButtonDown) {
				var xy = getCursorPosition(self.canvas, event);
				self.#iMouse.x = Math.min(Math.max(0,xy.x),this.canvas.width);
				self.#iMouse.y = Math.min(Math.max(0,xy.y),this.canvas.height);
				self.update();
			}

		}, false);
		
		if (initCallback != null && typeof initCallback !== 'undefined') {
			initCallback(this);
		}
		this.#render();
	} 
		
	#compile(shader, src) {
		this.gl.shaderSource(shader, src);
		this.gl.compileShader(shader);
		// log de compilation
		let compiled = this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS);
		if (!compiled) {
			console.log('Shader compiler log:\n' + this.gl.getShaderInfoLog(this.fragmentShader));
		} else {
			console.log('Shader compiled successfully: ' + compiled);
		}
		return compiled;
	}

	#initPartsFromSrc(shCodeTxt) {
		const code = shCodeTxt.split(/\/\/\s*##+/);
		const sz = code.length;
		this.#shCode.head = sz > 0 ? code[0] : "";
		this.#shCode.main = sz == 0 ? code[0] : code[1];
		this.#shCode.foot = sz > 2 ? code[2] : "";	
	}
	
	#createProgram(fragmentShaderSrc) {
		this.#initPartsFromSrc(fragmentShaderSrc);
		
		let vertexShaderSrc = `#version 300 es
			in vec4 position;void main() {gl_Position = position;}`;
		let errorShaderSrc = `#version 300 es
			precision mediump float;
			uniform float iTime;
			uniform vec2 iResolution;
			uniform vec4 iMouse;
			out vec4 outColor;
			void main() {outColor = vec4(.5,.5,.5,1);}`;
			
		const program = this.gl.createProgram();
		const vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER);
		this.fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
		this.#compile(vertexShader, vertexShaderSrc);
		this.gl.attachShader(program, vertexShader);
		if (this.#compile(this.fragmentShader, fragmentShaderSrc)) {
			this.gl.attachShader(program, this.fragmentShader);
		} else {
			this.gl.shaderSource(this.fragmentShader, errorShaderSrc);
			this.gl.compileShader(this.fragmentShader);
		}
		this.gl.linkProgram(program);
		this.gl.useProgram(program);
		return program;
	}

	#updateCanvasSize() {
		const k = window.devicePixelRatio || 1;
		const displayWidth  = k*this.canvas.clientWidth;
		const displayHeight = k*this.canvas.clientHeight;
		if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
			this.canvas.width  = displayWidth;
			this.canvas.height = displayHeight;
			return true;
		}
		return false;
	}

	#render() {
		this.#updateCanvasSize();
		
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
		this.set4f('iMouse', this.#iMouse.x, this.canvas.height-this.#iMouse.y, this.#iMouse.z, this.canvas.height-this.#iMouse.w);
	
		// Appel de la fonction de rendu de votre fragment shader
		if (this.#paramCallback != null && typeof this.#paramCallback !== 'undefined') {
			this.#paramCallback(this);
		}
			
		this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
		if (!this.#isPause) {
			window.requestAnimationFrame(() => this.#render());
		}
	}

	// Replace current fragment shader --------------
	
	replaceShader(fragmentShaderSrc) {
		if (this.#compile(this.fragmentShader, fragmentShaderSrc)) {
			// this.gl.attachShader(program, this.fragmentShader); // already in
			this.gl.linkProgram(this.program);
			return true;
		}
		return false;
	}

	replaceShaderPart(txt) {
		this.#shCode.main = txt;
		this.replaceShader(this.#shCode.head + txt + this.#shCode.foot);
	}
	
	testShader(fragmentShaderSrc) {
		return this.#compile(this.fragmentShader, fragmentShaderSrc);
	}
	
	getInfoLog() {
		return this.gl.getShaderInfoLog(this.fragmentShader);
	}
	
	// Fonction pour convertir le texte d'erreur du shader en un objet CodeMirror Linter
	#getErrorLint(dline) {
		var text = this.getInfoLog();
		// Séparer les lignes du texte
		const lines = text.split('\n');
		// Initialiser un tableau pour stocker les erreurs au format Linter
		const lintErrors = [];
		// Parcourir chaque ligne du texte
		for (const line of lines) {
			// Vérifier si la ligne contient des informations d'erreur
			if (line.includes("ERROR:")) {
				// Extraire le numéro de ligne de l'erreur
				const match = line.match(/ERROR: [\d]+:([\d]+)/);
				const lineNumber = match ? parseInt(match[1]) - 1 : null;
				const charNumber = match ? parseInt(match[0]) - 1 : null;
				// Extraire le message d'erreur
				const errorMessage = line.replace(/ERROR: [\d]+:[\d]+:/, '').trim();

				// Ajouter l'erreur au tableau
				if (lineNumber !== null && errorMessage.length > 0) {
					lintErrors.push({
						from: CodeMirror.Pos(dline+lineNumber, charNumber),
						to: CodeMirror.Pos(dline+lineNumber, charNumber+5),
						message: errorMessage,
						severity: 'error'
					});
				}
			}
		}
		return lintErrors;
	}

	// initialisation de l'editeur de code via CodeMirror
	associateEditor(id, isInstantModif = true, theme = "default", lineNumbers = false) {
		var textarea = document.getElementById(id);
		textarea.value = this.#shCode.main;
		var editor = CodeMirror.fromTextArea(textarea, {
			lineNumbers: lineNumbers,    // Afficher les numéros de ligne
			theme: theme,     // Utiliser le thème Dracula
			matchBrackets: true,  // Mettre en surbrillance les crochets correspondants
			mode: "text/x-glsl",  // Utiliser le mode GLSL
			gutters: ["CodeMirror-lint-markers"],// Highlight errors
			lint: { getAnnotations: (txt) => {
					var dline = (this.#shCode.head.match(/\n/g) || '').length;
					if (!this.testShader(this.#shCode.head + txt + this.#shCode.foot)) {
						return this.#getErrorLint(-dline);
					} else if (isInstantModif) {
						this.replaceShaderPart(txt);	
					}
					return [];
				}   // Highlight errors
			}
		});
		return editor;
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

	set4f(param, v1, v2, v3, v4) {		
		let p = this.gl.getUniformLocation(this.program, param);
		if (p != null) this.gl.uniform4f(p, v1, v2, v3, v4);
	}
	
	setTexture(param, texture, id) {
		this.gl.activeTexture(this.gl.TEXTURE0 + id);
		this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
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
	// Default init blue texture
	gl.bindTexture(gl.TEXTURE_2D, texture);
	const pixel = new Uint8Array([0, 0, 255, 255]); // opaque blue
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1,1,0, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
	// Get real picture ad update texture with it
	const image = new Image();
	image.onload = () => {
		const texture = createTexture(gl, image.width, image.height);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
	}
	image.src = url;
	return texture;
}

function isPowerOf2(value) {
  return (value & (value - 1)) === 0;
}

function createTexture(gl, w, h) {
	var texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	// WebGL1 has different requirements for power of 2 images
	if (isPowerOf2(w) && isPowerOf2(h)) {
		gl.generateMipmap(gl.TEXTURE_2D); // Generate mips.
	} else {
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	//	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	}
	return texture;
}

// ------------------------------------------------------------------------------
// Initialize a texture from the rendering of a canvas
function createTextureFromCanvas(canvasGL, canvasImg) {
	const gl = canvasGL.getContext("webgl2");
	const texture = createTexture(gl, texture, canvasImg.width, canvasImg.height);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvasImg);
	return texture;
}

// https://webglfundamentals.org/webgl/lessons/webgl-image-processing-continued.html
function createFrameBuffer(w, h, nb = 1) {
	//var textures = [];
	var framebuffers = [];
	for (var ii = 0; ii < nb; ++ii) {
		var texture = createTexture(gl, w, h);
		var fb = gl.createFramebuffer();
		framebuffers.push(fb);
		// add properties to frame buffer (no needed for webGL, but usefull here)
		fb.texture = texture;
		//fb.width = w;
		//fb.height = h;
		//textures.push(texture);
		// make the empty texture
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0,gl.RGBA, gl.UNSIGNED_BYTE, null);
		// Create a framebuffer
		gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
		// Attach the texture to it.
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
	}
	return framebuffers;
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
