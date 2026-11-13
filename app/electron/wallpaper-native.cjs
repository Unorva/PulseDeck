const koffi=require('koffi');
let api;
function win32(){
  if(api)return api;
  const lib=koffi.load('user32.dll');
  koffi.struct('PulsePoint',{x:'int32',y:'int32'});
  koffi.struct('PulseRect',{left:'int32',top:'int32',right:'int32',bottom:'int32'});
  koffi.struct('PulseMonitorInfo',{cbSize:'uint32',monitor:'PulseRect',work:'PulseRect',flags:'uint32'});
  koffi.proto('int32 __stdcall PulseEnumProc(intptr_t hwnd,intptr_t data)');
  const signatures={
    find:'intptr_t __stdcall FindWindowW(str16 className,str16 title)',
    findEx:'intptr_t __stdcall FindWindowExW(intptr_t parent,intptr_t after,str16 className,str16 title)',
    enumerate:'int32 __stdcall EnumWindows(PulseEnumProc *callback,intptr_t data)',
    send:'intptr_t __stdcall SendMessageTimeoutW(intptr_t hwnd,uint32 message,uintptr_t wparam,intptr_t lparam,uint32 flags,uint32 timeout,_Out_ uintptr_t *result)',
    parent:'intptr_t __stdcall SetParent(intptr_t child,intptr_t parent)',
    getStyle:'intptr_t __stdcall GetWindowLongPtrW(intptr_t hwnd,int32 index)',
    setStyle:'intptr_t __stdcall SetWindowLongPtrW(intptr_t hwnd,int32 index,intptr_t value)',
    position:'int32 __stdcall SetWindowPos(intptr_t hwnd,intptr_t after,int32 x,int32 y,int32 width,int32 height,uint32 flags)',
    show:'int32 __stdcall ShowWindow(intptr_t hwnd,int32 command)',
    exists:'int32 __stdcall IsWindow(intptr_t hwnd)',
    getParent:'intptr_t __stdcall GetParent(intptr_t hwnd)',
    rect:'int32 __stdcall GetWindowRect(intptr_t hwnd,_Out_ PulseRect *rect)',
    client:'int32 __stdcall GetClientRect(intptr_t hwnd,_Out_ PulseRect *rect)',
    toClient:'int32 __stdcall ScreenToClient(intptr_t hwnd,_Inout_ PulsePoint *point)',
    toScreen:'int32 __stdcall ClientToScreen(intptr_t hwnd,_Inout_ PulsePoint *point)',
    monitor:'intptr_t __stdcall MonitorFromWindow(intptr_t hwnd,uint32 flags)',
    monitorInfo:'int32 __stdcall GetMonitorInfoW(intptr_t monitor,_Inout_ PulseMonitorInfo *info)',
    cursor:'int32 __stdcall GetCursorPos(_Out_ PulsePoint *point)',
    mouse:'int16 __stdcall GetAsyncKeyState(int32 key)',
    foreground:'intptr_t __stdcall GetForegroundWindow()',
    className:'int32 __stdcall GetClassNameW(intptr_t hwnd,_Out_ uint16 *buffer,int32 count)',
  };
  api=Object.fromEntries(Object.entries(signatures).map(([name,signature])=>[name,lib.func(signature)]));return api;
}
function nameOf(a,hwnd){const buffer=Buffer.alloc(512);a.className(hwnd,buffer,256);return buffer.toString('utf16le').split('\0')[0];}
function monitorBounds(hwnd){
  const a=win32(),info={cbSize:40};
  if(!a.monitorInfo(a.monitor(hwnd,2),info))throw new Error('无法读取显示器的实际像素范围。');
  const r=info.monitor;return {x:r.left,y:r.top,width:r.right-r.left,height:r.bottom-r.top};
}
function inspectWindow(hwnd){
  const a=win32(),outer={},client={},origin={x:0,y:0};
  a.rect(hwnd,outer);a.client(hwnd,client);a.toScreen(hwnd,origin);
  return {outer,client:{x:origin.x,y:origin.y,width:client.right-client.left,height:client.bottom-client.top}};
}
function attachToDesktop(hwnd,bounds,onPointer,onLost){
  const a=win32(),progman=a.find('Progman',null);
  if(!progman)throw new Error('Windows Explorer 桌面尚未准备好。');
  const result=[0];a.send(progman,0x052C,0,0,0,1000,result);a.send(progman,0x052C,0xD,0,0,1000,result);a.send(progman,0x052C,0xD,1,0,1000,result);
  let host=0;
  a.enumerate(top=>{if(a.findEx(top,0,'SHELLDLL_DefView',null)){const next=a.findEx(0,top,'WorkerW',null);if(next)host=next;}return 1;},0);
  if(!host)host=a.findEx(progman,0,'WorkerW',null);
  if(!host)throw new Error('未找到 Windows 壁纸层，请回到桌面后重试。');
  const stripFrame=()=>{
    const style=BigInt(a.getStyle(hwnd,-16))&0xffffffffn,extended=BigInt(a.getStyle(hwnd,-20))&0xffffffffn;
    a.setStyle(hwnd,-16,(style&~(0x80000000n|0x00cf0000n))|0x40000000n);
    a.setStyle(hwnd,-20,(extended&~(0x40000n|0x100n|0x200n|0x20000n))|0x80n|0x08000000n);
  };
  stripFrame();
  a.parent(hwnd,host);
  if(BigInt(a.getParent(hwnd))!==BigInt(host))throw new Error('Windows 拒绝连接壁纸窗口。');
  const fit=()=>{
    stripFrame();
    // Match the visible client surface, including any invisible Chromium frame
    // insets left after reparenting, to the complete physical monitor rectangle.
    for(let pass=0;pass<2;pass++){
      const {outer,client}=inspectWindow(hwnd);
      const left=client.x-outer.left,top=client.y-outer.top;
      const extraWidth=outer.right-outer.left-client.width,extraHeight=outer.bottom-outer.top-client.height;
      const origin={x:bounds.x-left,y:bounds.y-top};a.toClient(host,origin);
      if(!a.position(hwnd,1,origin.x,origin.y,bounds.width+extraWidth,bounds.height+extraHeight,0x10|0x20|0x40))throw new Error('壁纸定位失败。');
    }
  };
  fit();
  a.show(hwnd,4);
  let downBefore=false,previous={x:0,y:0},checks=0;
  const timer=setInterval(()=>{
    if(!a.exists(hwnd)||!a.exists(host)){clearInterval(timer);onLost?.();return;}
    if(++checks%30===0){try{const {client}=inspectWindow(hwnd);if(client.x!==bounds.x||client.y!==bounds.y||client.width!==bounds.width||client.height!==bounds.height)fit();}catch{clearInterval(timer);onLost?.();return;}}
    const cursor={},client={},foregroundRect={};a.cursor(cursor);a.client(hwnd,client);
    const foreground=a.foreground(),className=nameOf(a,foreground);
    const desktop=['Progman','WorkerW','SHELLDLL_DefView'].includes(className);
    a.rect(foreground,foregroundRect);
    const covered=!desktop&&foregroundRect.left<=bounds.x+2&&foregroundRect.top<=bounds.y+2&&foregroundRect.right>=bounds.x+bounds.width-2&&foregroundRect.bottom>=bounds.y+bounds.height-2;
    a.toClient(hwnd,cursor);const down=(a.mouse(1)&0x8000)!==0;
    const active=desktop&&cursor.x>=0&&cursor.y>=0&&cursor.x<client.right&&cursor.y<client.bottom;
    onPointer({x:cursor.x/Math.max(1,client.right),y:cursor.y/Math.max(1,client.bottom),active,down:down&&active,pressed:down&&!downBefore&&active,dx:cursor.x-previous.x,dy:cursor.y-previous.y,covered});
    previous=cursor;downBefore=down;
  },33);
  return {host:Number(host),window:Number(hwnd),fit,inspect:()=>inspectWindow(hwnd),dispose:()=>clearInterval(timer)};
}
function inspectDesktop(){const a=win32(),point={};a.cursor(point);return {available:Boolean(a.find('Progman',null)),cursorReadable:Number.isFinite(point.x)&&Number.isFinite(point.y)};}
module.exports={attachToDesktop,inspectDesktop,monitorBounds,inspectWindow};
