# WebGLShader

Simple example that shows how to associate multi shaders to canvas in html page

Gestion of animation, pause / start, textures, canvas resize, etc.

The usefull file is *GLCanvas.js*


Simple assocaiation: 

		const glRenderer0 = new GLCanvas('canvas2', "fragmentShader.frag");
    
Set a parameter at each animation loop 

		const glRenderer1 = new GLCanvas('canvas1', "fragmentShader.frag", null, (rd) => {
			rd.set1f("u_param", parseFloat(document.getElementById("slider").value)); // render loop
		});

Init a texture and associate it at beginning

		const glRenderer2 = new GLCanvas('canvas2', "metalocc.frag", (rd) => {
			rd.setTexture("u_texture1", texture0, 0); // init only
		});

