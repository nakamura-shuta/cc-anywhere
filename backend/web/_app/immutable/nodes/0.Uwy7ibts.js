import"../chunks/NZTpNUN0.js";import{p as k,f as x,e as _,a as c,b as M,s as b,d as w,c as d,r as n,t as C,y,x as V,h as $,V as q,n as F}from"../chunks/DsgVtOPg.js";import{o as G,a as I,s as P}from"../chunks/2BTfzV6r.js";import{I as O,s as j,e as H,i as J}from"../chunks/Ctyd3DqP.js";import{s as Q,a as U}from"../chunks/C7eHOOXC.js";import{B as X}from"../chunks/Dgibhu4a.js";import{i as S,l as A,s as T}from"../chunks/8Ee0J66D.js";import{s as Y,c as Z,a as ee}from"../chunks/Y_npjkox.js";import"../chunks/BVfiLATO.js";import{i as te}from"../chunks/Bkg11KQm.js";import{p as ae}from"../chunks/BkMkSroM.js";const re=!0,se=re,oe=!1,ne=!1,ie=!0,ze=Object.freeze(Object.defineProperty({__proto__:null,csr:ie,prerender:oe,ssr:ne},Symbol.toStringTag,{value:"Module"}));var de=x('<div class="fixed bottom-4 right-4 max-w-sm z-50"><div class="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg"><p class="text-sm font-medium">WebSocket接続エラー</p> <p class="text-sm"> </p></div></div>'),ce=x("<!> <!>",1);function le(u,a){k(a,!0);const e=Z();Y(e);const i=!0;G(()=>(console.log("[WebSocketProvider] onMountが呼ばれました",{browser:se,ENABLE_WEBSOCKET:i,wsInstance:!!e}),console.log("[WebSocketProvider] ブラウザ環境でWebSocket接続を開始"),setTimeout(()=>{e.connect()},100),()=>{console.log("[WebSocketProvider] アンマウント時にWebSocket切断"),e.disconnect()}));var p=ce(),h=_(p);{var l=t=>{var r=w(),f=_(r);I(f,()=>a.children),c(t,r)};S(h,t=>{a.children&&t(l)})}var s=b(h,2);{var v=t=>{var r=de(),f=d(r),o=b(d(f),2),m=d(o,!0);n(o),n(f),n(r),C(()=>P(m,e.error.message)),c(t,r)};S(s,t=>{e.error&&i&&t(v)})}c(u,p),M()}function ve(u,a){const e=A(a,["children","$$slots","$$events","$$legacy"]);/**
 * @license lucide-svelte v0.525.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 */const i=[["path",{d:"M12 20h.01"}],["path",{d:"M8.5 16.429a5 5 0 0 1 7 0"}],["path",{d:"M5 12.859a10 10 0 0 1 5.17-2.69"}],["path",{d:"M19 12.859a10 10 0 0 0-2.007-1.523"}],["path",{d:"M2 8.82a15 15 0 0 1 4.177-2.643"}],["path",{d:"M22 8.82a15 15 0 0 0-11.288-3.764"}],["path",{d:"m2 2 20 20"}]];O(u,T({name:"wifi-off"},()=>e,{get iconNode(){return i},children:(p,h)=>{var l=w(),s=_(l);j(s,a,"default",{}),c(p,l)},$$slots:{default:!0}}))}function N(u,a){const e=A(a,["children","$$slots","$$events","$$legacy"]);/**
 * @license lucide-svelte v0.525.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 */const i=[["path",{d:"M12 20h.01"}],["path",{d:"M2 8.82a15 15 0 0 1 20 0"}],["path",{d:"M5 12.859a10 10 0 0 1 14 0"}],["path",{d:"M8.5 16.429a5 5 0 0 1 7 0"}]];O(u,T({name:"wifi"},()=>e,{get iconNode(){return i},children:(p,h)=>{var l=w(),s=_(l);j(s,a,"default",{}),c(p,l)},$$slots:{default:!0}}))}var fe=x('<!> <span class="text-muted-foreground"> </span>',1),pe=x('<!> <span class="text-muted-foreground">接続中...</span>',1),ue=x('<!> <span class="text-muted-foreground">未接続</span>',1),me=x('<div class="flex items-center gap-2 text-sm"><!></div>');function he(u,a){k(a,!1);const e=ee();te();var i=me(),p=d(i);{var h=s=>{var v=fe(),t=_(v);N(t,{class:"h-4 w-4 text-green-500"});var r=b(t,2),f=d(r,!0);n(r),C(()=>P(f,e.authenticated?"接続済み":"認証中...")),c(s,v)},l=s=>{var v=w(),t=_(v);{var r=o=>{var m=pe(),g=_(m);N(g,{class:"h-4 w-4 text-yellow-500 animate-pulse"}),y(2),c(o,m)},f=o=>{var m=ue(),g=_(m);ve(g,{class:"h-4 w-4 text-destructive"}),y(2),c(o,m)};S(t,o=>{e.connecting?o(r):o(f,!1)},!0)}c(s,v)};S(p,s=>{e.connected?s(h):s(l,!1)})}n(i),c(u,i),M()}var _e=x('<div class="h-screen flex flex-col overflow-hidden"><header class="border-b"><div class="container mx-auto px-4 py-4"><nav class="flex items-center justify-between"><div class="flex items-center gap-4"><a href="/" class="text-xl font-bold">CC-Anywhere</a> <!></div> <div class="flex gap-2"></div></nav></div></header> <main class="flex-1 overflow-y-auto"><div class="container mx-auto px-4 py-8"><!></div></main> <footer class="border-t flex-shrink-0"><div class="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">CC-Anywhere © 2024 - Claude Code SDK Server</div></footer></div>');function Be(u,a){k(a,!0);const[e,i]=Q(),p=()=>U(ae,"$page",e),h=[{href:"/",label:"ホーム"},{href:"/tasks",label:"タスク一覧"},{href:"/scheduler",label:"スケジューラー"},{href:"/settings",label:"設定"}];le(u,{children:(l,s)=>{var v=_e(),t=d(v),r=d(t),f=d(r),o=d(f),m=b(d(o),2);he(m,{}),n(o);var g=b(o,2);H(g,21,()=>h,J,(R,W)=>{{let D=q(()=>p().url.pathname===$(W).href?"default":"ghost");X(R,{get href(){return $(W).href},get variant(){return $(D)},size:"sm",children:(L,xe)=>{y();var E=V();C(()=>P(E,$(W).label)),c(L,E)},$$slots:{default:!0}})}}),n(g),n(f),n(r),n(t);var z=b(t,2),B=d(z),K=d(B);I(K,()=>a.children??F),n(B),n(z),y(2),n(v),c(l,v)},$$slots:{default:!0}}),M(),i()}export{Be as component,ze as universal};
