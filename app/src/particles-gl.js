// Hardware-accelerated additive particle strokes. The instrument layer remains a
// separate 2D canvas, keeping typography and subpixel rings crisp at every DPR.
export class ParticleLayer {
  constructor(canvas) {
    this.canvas = canvas;
    try { this.initialize(); }
    catch (error) {
      console.warn('Particle acceleration unavailable; using Canvas 2D.', error);
      this.dispose(); this.gl = null;
    }
    this.lost = event => { event.preventDefault(); this.gl = null; };
    this.restored = () => {
      try { this.initialize(); } catch { this.gl = null; }
    };
    canvas?.addEventListener('webglcontextlost', this.lost);
    canvas?.addEventListener('webglcontextrestored', this.restored);
  }
  initialize() {
    const canvas = this.canvas;
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
        if(vPosition.x<uCore.x-uCore.z || vPosition.y<8.0 || vPosition.y>uHeight-8.0) discard;
        float a=vColor.a;
        if(distance(vPosition,uCore.xy)<uCore.z*0.92) a*=0.18;
        if(uPoints>0.5){
          float d=length(gl_PointCoord-vec2(0.5))*2.0;
          if(d>1.0) discard;
          a*=exp(-d*d*4.0)*0.75+exp(-d*d*1.8)*0.50;
        }
        gl_FragColor=vec4(vColor.rgb,a);
      }`);
    this.program = gl.createProgram(); gl.attachShader(this.program, vs); gl.attachShader(this.program, fs); gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
    gl.deleteShader(vs); gl.deleteShader(fs);
    this.buffer = gl.createBuffer(); this.vertices = new Float32Array(24000 * 12);
    this.position = gl.getAttribLocation(this.program, 'aPosition'); this.color = gl.getAttribLocation(this.program, 'aColor');
    this.uniforms = Object.fromEntries(['uResolution', 'uCore', 'uPoints', 'uPointSize', 'uHeight'].map(name => [name, gl.getUniformLocation(this.program, name)]));
    this.instancing=gl.getExtension('ANGLE_instanced_arrays');
    if(this.instancing){
      const vertex=compile(gl.VERTEX_SHADER,`
        attribute vec2 aCorner;attribute vec2 aStart;attribute vec2 aEnd;attribute vec4 aTint;
        uniform vec2 uResolution;uniform float uWidth;
        varying vec4 vTint;varying vec2 vPosition;varying float vEdge;
        void main(){vec2 delta=aEnd-aStart;float len=max(length(delta),0.01);vec2 normal=vec2(-delta.y,delta.x)/len;
          vec2 pos=mix(aStart,aEnd,aCorner.x)+normal*aCorner.y*uWidth*0.5;
          vec2 p=pos/uResolution*2.0-1.0;gl_Position=vec4(p.x,-p.y,0.,1.);vTint=aTint;vPosition=pos;vEdge=aCorner.y;}`);
      const fragment=compile(gl.FRAGMENT_SHADER,`
        precision mediump float;uniform vec3 uCore;uniform float uHeight;
        varying vec4 vTint;varying vec2 vPosition;varying float vEdge;
        void main(){if(vPosition.x<uCore.x-uCore.z||vPosition.y<8.||vPosition.y>uHeight-8.)discard;
          float alpha=vTint.a*0.22*(1.-smoothstep(0.45,1.,abs(vEdge)));
          if(distance(vPosition,uCore.xy)<uCore.z*0.92)alpha*=0.18;
          gl_FragColor=vec4(vTint.rgb,alpha);}`);
      this.quadProgram=gl.createProgram();gl.attachShader(this.quadProgram,vertex);gl.attachShader(this.quadProgram,fragment);gl.linkProgram(this.quadProgram);
      if(!gl.getProgramParameter(this.quadProgram,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.quadProgram));
      gl.deleteShader(vertex);gl.deleteShader(fragment);
      this.quadAttributes=Object.fromEntries(['aCorner','aStart','aEnd','aTint'].map(key=>[key,gl.getAttribLocation(this.quadProgram,key)]));
      this.quadUniforms=Object.fromEntries(['uResolution','uWidth','uCore','uHeight'].map(key=>[key,gl.getUniformLocation(this.quadProgram,key)]));
      this.cornerBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.cornerBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,-1,1,-1,0,1,0,1,1,-1,1,1]),gl.STATIC_DRAW);
    }
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.clearColor(0, 0, 0, 0);
  }
  resize(w, h, dpr) { if (!this.gl) return; this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr); this.gl.viewport(0, 0, this.canvas.width, this.canvas.height); this.dpr = dpr; }
  draw(count, width, height, cx, cy, radius, glow,lineWidth=1.6) {
    const gl = this.gl; if (!gl) return;
    gl.clear(gl.COLOR_BUFFER_BIT); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices.subarray(0, count * 12), gl.DYNAMIC_DRAW);
    if(this.quadProgram){
      const a=this.quadAttributes,u=this.quadUniforms,ext=this.instancing;gl.useProgram(this.quadProgram);
      gl.enableVertexAttribArray(a.aStart);gl.vertexAttribPointer(a.aStart,2,gl.FLOAT,false,48,0);ext.vertexAttribDivisorANGLE(a.aStart,1);
      gl.enableVertexAttribArray(a.aEnd);gl.vertexAttribPointer(a.aEnd,2,gl.FLOAT,false,48,24);ext.vertexAttribDivisorANGLE(a.aEnd,1);
      gl.enableVertexAttribArray(a.aTint);gl.vertexAttribPointer(a.aTint,4,gl.FLOAT,false,48,8);ext.vertexAttribDivisorANGLE(a.aTint,1);
      gl.bindBuffer(gl.ARRAY_BUFFER,this.cornerBuffer);gl.enableVertexAttribArray(a.aCorner);gl.vertexAttribPointer(a.aCorner,2,gl.FLOAT,false,8,0);ext.vertexAttribDivisorANGLE(a.aCorner,0);
      gl.uniform2f(u.uResolution,width,height);gl.uniform1f(u.uWidth,lineWidth);gl.uniform3f(u.uCore,cx,cy,radius*1.02);gl.uniform1f(u.uHeight,height);
      ext.drawArraysInstancedANGLE(gl.TRIANGLES,0,6,count);
      for(const index of Object.values(a)){ext.vertexAttribDivisorANGLE(index,0);gl.disableVertexAttribArray(index);}
    }
    gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    gl.enableVertexAttribArray(this.position); gl.vertexAttribPointer(this.position, 2, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(this.color); gl.vertexAttribPointer(this.color, 4, gl.FLOAT, false, 24, 8);
    gl.uniform2f(this.uniforms.uResolution, width, height); gl.uniform3f(this.uniforms.uCore, cx, cy, radius * 1.02); gl.uniform1f(this.uniforms.uHeight, height);
    gl.uniform1f(this.uniforms.uPointSize, (2.0 + glow * 2.5) * this.dpr);
    if(!this.quadProgram){gl.uniform1f(this.uniforms.uPoints, 0);gl.drawArrays(gl.LINES,0,count*2);}
    gl.vertexAttribPointer(this.position,2,gl.FLOAT,false,48,0);gl.vertexAttribPointer(this.color,4,gl.FLOAT,false,48,8);
    gl.uniform1f(this.uniforms.uPoints,1);gl.drawArrays(gl.POINTS,0,count);
  }
  dispose() {
    this.canvas?.removeEventListener('webglcontextlost', this.lost);
    this.canvas?.removeEventListener('webglcontextrestored', this.restored);
    if (!this.gl) return;
    if(this.buffer)this.gl.deleteBuffer(this.buffer);
    if(this.program)this.gl.deleteProgram(this.program);
    if(this.cornerBuffer)this.gl.deleteBuffer(this.cornerBuffer);
    if(this.quadProgram)this.gl.deleteProgram(this.quadProgram);
  }
}
