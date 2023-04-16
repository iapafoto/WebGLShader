#version 300 es

precision mediump float;

uniform float iTime;
uniform vec2 iResolution;
uniform float u_param;
out vec4 outColor;

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  outColor = vec4(uv+u_param, .5+.5*cos(3.*iTime), 1.0);
}