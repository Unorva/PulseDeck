// Hardware-accelerated additive particle strokes. The instrument layer remains a
// separate 2D canvas, keeping typography and subpixel rings crisp at every DPR.
export class ParticleLayer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas?.getContext('webgl', { alpha: true, antialias: false, depth: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!this.gl) return;
    const gl = this.gl;
    const compile = (type, source) => {
      const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    };
    const vs = compile(gl.VERTEX_SHADER, `
      attribute vec2 aPosition;
      attribute vec4 aColor;
      uniform vec2 uResolution;
      uniform float uPointSize;
      varying vec4 vColor;
      varying vec2 vPosition;
      void main(){
        vec2 p=aPosition/uResolution*2.0-1.0;
        gl_Position=vec4(p.x,-p.y,0.0,1.0);
        gl_PointSize=uPointSize;
        vColor=aColor; vPosition=aPosition;
      }`);
    const fs = compile(gl.FRAGMENT_SHADER, `
      precision mediump float;
      uniform vec3 uCore;
      uniform float uPoints;
      uniform float uHeight;
      varying vec4 vColor;
      varying vec2 vPosition;
      void main(){
        if(distance(vPosition,uCore.xy)<uCore.z || vPosition.x<uCore.x || vPosition.y<58.0 || vPosition.y>uHeight-35.0) discard;
        float a=vColor.a;
        if(uPoints>0.5){
          float d=length(gl_PointCoord-vec2(0.5))*2.0;
          if(d>1.0) discard;
          a*=exp(-d*d*5.5)*0.40;
        }
        gl_FragColor=vec4(vColor.rgb,a);
      }`);
    this.program = gl.createProgram(); gl.attachShader(this.program, vs); gl.attachShader(this.program, fs); gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
    gl.deleteShader(vs); gl.deleteShader(fs);
    this.buffer = gl.createBuffer(); this.vertices = new Float32Array(24000 * 12);
    this.position = gl.getAttribLocation(this.program, 'aPosition'); this.color = gl.getAttribLocation(this.program, 'aColor');
    this.uniforms = Object.fromEntries(['uResolution', 'uCore', 'uPoints', 'uPointSize', 'uHeight'].map(name => [name, gl.getUniformLocation(this.program, name)]));
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.clearColor(0, 0, 0, 0);
  }
  resize(w, h, dpr) { if (!this.gl) return; this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr); this.gl.viewport(0, 0, this.canvas.width, this.canvas.height); this.dpr = dpr; }
  draw(count, width, height, cx, cy, radius, glow) {
    const gl = this.gl; if (!gl) return;
    gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(this.program); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices.subarray(0, count * 12), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.position); gl.vertexAttribPointer(this.position, 2, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(this.color); gl.vertexAttribPointer(this.color, 4, gl.FLOAT, false, 24, 8);
    gl.uniform2f(this.uniforms.uResolution, width, height); gl.uniform3f(this.uniforms.uCore, cx, cy, radius * 1.02); gl.uniform1f(this.uniforms.uHeight, height);
    gl.uniform1f(this.uniforms.uPointSize, (1.1 + glow * 2.4) * this.dpr);
    gl.uniform1f(this.uniforms.uPoints, 0); gl.drawArrays(gl.LINES, 0, count * 2);
    if (glow > 0) { gl.uniform1f(this.uniforms.uPoints, 1); gl.drawArrays(gl.POINTS, 0, count * 2); }
  }
  dispose() { if (!this.gl) return; this.gl.deleteBuffer(this.buffer); this.gl.deleteProgram(this.program); }
}
