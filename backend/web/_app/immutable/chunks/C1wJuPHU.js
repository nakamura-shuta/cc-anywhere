import"./NZTpNUN0.js";import"./CvXniH3t.js";import{ap as ee,b4 as te,b8 as re,e as S,h as y,a as h,d as f,g as l,l as P,p as C,b as N,aq as se,f as M,s as U,c as E,n as W,r as B,aI as ie,aJ as ne}from"./BC3TVD7I.js";import{I as ae,s as oe,e as ce,a as de,i as ue}from"./DsjvRSSA.js";import{l as le,s as J,i as V,p as c,r as q,b as K}from"./DlBJ8HRE.js";import{a as D}from"./l49-8nyp.js";import{a as I}from"./CBF8HN5J.js";import{a as he,c as G}from"./D0eVI3ve.js";import{b as fe}from"./CBkskisn.js";import{c as ge}from"./02-ts27b.js";import{a as me,w as F,h as pe,o as ve,p as ke,c as be,b as xe,d as w,m as _e}from"./Lb74Bh-E.js";import{C as X,d as we,S as ye}from"./B_F1uDVs.js";import{i as Ce}from"./IU_TjQgQ.js";import{H as Ne}from"./BQ90MmJD.js";const Pe=[];function Se(t,e=!1){return O(t,new Map,"",Pe)}function O(t,e,n,r,s=null){if(typeof t=="object"&&t!==null){var a=e.get(t);if(a!==void 0)return a;if(t instanceof Map)return new Map(t);if(t instanceof Set)return new Set(t);if(ee(t)){var i=Array(t.length);e.set(t,i),s!==null&&e.set(s,i);for(var o=0;o<t.length;o+=1){var u=t[o];o in t&&(i[o]=O(u,e,n,r))}return i}if(te(t)===re){i={},e.set(t,i),s!==null&&e.set(s,i);for(var b in t)i[b]=O(t[b],e,n,r);return i}if(t instanceof Date)return structuredClone(t);if(typeof t.toJSON=="function")return O(t.toJSON(),e,n,r,t)}if(t instanceof EventTarget)return t;try{return structuredClone(t)}catch{return t}}function it(t,e){const n=le(e,["children","$$slots","$$events","$$legacy"]);/**
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
 */const r=[["path",{d:"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"}],["path",{d:"m21.854 2.147-10.94 10.939"}]];ae(t,J({name:"send"},()=>n,{get iconNode(){return r},children:(s,a)=>{var i=S(),o=y(i);oe(o,e,"default",{}),h(s,i)},$$slots:{default:!0}}))}const qe=be({component:"checkbox",parts:["root","group","group-label","input"]}),Re=new X("Checkbox.Group"),Y=new X("Checkbox.Root");class L{static create(e,n=null){return Y.set(new L(e,n))}opts;group;#e=f(()=>this.group&&this.group.opts.name.current?this.group.opts.name.current:this.opts.name.current);get trueName(){return l(this.#e)}set trueName(e){P(this.#e,e)}#t=f(()=>this.group&&this.group.opts.required.current?!0:this.opts.required.current);get trueRequired(){return l(this.#t)}set trueRequired(e){P(this.#t,e)}#r=f(()=>this.group&&this.group.opts.disabled.current?!0:this.opts.disabled.current);get trueDisabled(){return l(this.#r)}set trueDisabled(e){P(this.#r,e)}attachment;constructor(e,n){this.opts=e,this.group=n,this.attachment=me(this.opts.ref),this.onkeydown=this.onkeydown.bind(this),this.onclick=this.onclick.bind(this),F.pre([()=>Se(this.group?.opts.value.current),()=>this.opts.value.current],([r,s])=>{!r||!s||(this.opts.checked.current=r.includes(s))}),F.pre(()=>this.opts.checked.current,r=>{this.group&&(r?this.group?.addValue(this.opts.value.current):this.group?.removeValue(this.opts.value.current))})}onkeydown(e){this.opts.disabled.current||(e.key===we&&e.preventDefault(),e.key===ye&&(e.preventDefault(),this.#s()))}#s(){this.opts.indeterminate.current?(this.opts.indeterminate.current=!1,this.opts.checked.current=!0):this.opts.checked.current=!this.opts.checked.current}onclick(e){this.opts.disabled.current||this.#s()}#i=f(()=>({checked:this.opts.checked.current,indeterminate:this.opts.indeterminate.current}));get snippetProps(){return l(this.#i)}set snippetProps(e){P(this.#i,e)}#n=f(()=>({id:this.opts.id.current,role:"checkbox",type:this.opts.type.current,disabled:this.trueDisabled,"aria-checked":ke(this.opts.checked.current,this.opts.indeterminate.current),"aria-required":ve(this.trueRequired),"data-disabled":pe(this.trueDisabled),"data-state":De(this.opts.checked.current,this.opts.indeterminate.current),[qe.root]:"",onclick:this.onclick,onkeydown:this.onkeydown,...this.attachment}));get props(){return l(this.#n)}set props(e){P(this.#n,e)}}class Q{static create(){return new Q(Y.get())}root;#e=f(()=>this.root.group?!!(this.root.opts.value.current!==void 0&&this.root.group.opts.value.current.includes(this.root.opts.value.current)):this.root.opts.checked.current);get trueChecked(){return l(this.#e)}set trueChecked(e){P(this.#e,e)}#t=f(()=>!!this.root.trueName);get shouldRender(){return l(this.#t)}set shouldRender(e){P(this.#t,e)}constructor(e){this.root=e}#r=f(()=>({type:"checkbox",checked:this.root.opts.checked.current===!0,disabled:this.root.trueDisabled,required:this.root.trueRequired,name:this.root.trueName,value:this.root.opts.value.current}));get props(){return l(this.#r)}set props(e){P(this.#r,e)}}function De(t,e){return e?"indeterminate":t?"checked":"unchecked"}function Ae(t,e){C(e,!1);const n=Q.create();Ce();var r=S(),s=y(r);{var a=i=>{Ne(i,J(()=>n.props))};V(s,i=>{n.shouldRender&&i(a)})}h(t,r),N()}var ze=M("<button><!></button>"),Ie=M("<!> <!>",1);function Me(t,e){const n=se();C(e,!0);let r=c(e,"checked",15,!1),s=c(e,"ref",15,null),a=c(e,"disabled",3,!1),i=c(e,"required",3,!1),o=c(e,"name",3,void 0),u=c(e,"value",3,"on"),b=c(e,"id",19,()=>xe(n)),x=c(e,"indeterminate",15,!1),p=c(e,"type",3,"button"),g=q(e,["$$slots","$$events","$$legacy","checked","ref","onCheckedChange","children","disabled","required","name","value","id","indeterminate","onIndeterminateChange","child","type"]);const v=Re.getOr(null);v&&u()&&(v.opts.value.current.includes(u())?r(!0):r(!1)),F.pre(()=>u(),()=>{v&&u()&&(v.opts.value.current.includes(u())?r(!0):r(!1))});const _=L.create({checked:w.with(()=>r(),d=>{r(d),e.onCheckedChange?.(d)}),disabled:w.with(()=>a()??!1),required:w.with(()=>i()),name:w.with(()=>o()),value:w.with(()=>u()),id:w.with(()=>b()),ref:w.with(()=>s(),d=>s(d)),indeterminate:w.with(()=>x(),d=>{x(d),e.onIndeterminateChange?.(d)}),type:w.with(()=>p())},v),A=f(()=>_e({...g},_.props));var R=Ie(),z=y(R);{var k=d=>{var m=S(),T=y(m);{let $=f(()=>({props:l(A),..._.snippetProps}));D(T,()=>e.child,()=>l($))}h(d,m)},j=d=>{var m=ze();I(m,()=>({...l(A)}));var T=E(m);D(T,()=>e.children??W,()=>_.snippetProps),B(m),h(d,m)};V(z,d=>{e.child?d(k):d(j,!1)})}var H=U(z,2);Ae(H,{}),h(t,R),N()}const We=he({base:"relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",variants:{variant:{default:"bg-card text-card-foreground",destructive:"text-destructive bg-card *:data-[slot=alert-description]:text-destructive/90 [&>svg]:text-current"}},defaultVariants:{variant:"default"}});var je=M("<div><!></div>");function nt(t,e){C(e,!0);let n=c(e,"ref",15,null),r=c(e,"variant",3,"default"),s=q(e,["$$slots","$$events","$$legacy","ref","class","variant","children"]);var a=je();I(a,o=>({"data-slot":"alert",class:o,...s,role:"alert"}),[()=>G(We({variant:r()}),e.class)]);var i=E(a);D(i,()=>e.children??W),B(a),K(a,o=>n(o),()=>n()),h(t,a),N()}var Ee=M("<div><!></div>");function at(t,e){C(e,!0);let n=c(e,"ref",15,null),r=q(e,["$$slots","$$events","$$legacy","ref","class","children"]);var s=Ee();I(s,i=>({"data-slot":"alert-description",class:i,...r}),[()=>G("text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed",e.class)]);var a=E(s);D(a,()=>e.children??W),B(s),K(s,i=>n(i),()=>n()),h(t,s),N()}const ot={async list(){return(await fe.get("/api/repositories")).repositories}};/**
 * @license @lucide/svelte v0.515.0 - ISC
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
 */const Be={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":2,"stroke-linecap":"round","stroke-linejoin":"round"};var Je=ie("<svg><!><!></svg>");function Z(t,e){C(e,!0);const n=c(e,"color",3,"currentColor"),r=c(e,"size",3,24),s=c(e,"strokeWidth",3,2),a=c(e,"absoluteStrokeWidth",3,!1),i=c(e,"iconNode",19,()=>[]),o=q(e,["$$slots","$$events","$$legacy","name","color","size","strokeWidth","absoluteStrokeWidth","iconNode","children"]);var u=Je();I(u,p=>({...Be,...o,width:r(),height:r(),stroke:n(),"stroke-width":p,class:["lucide-icon lucide",e.name&&`lucide-${e.name}`,e.class]}),[()=>a()?Number(s())*24/Number(r()):s()]);var b=E(u);ce(b,17,i,ue,(p,g)=>{var v=f(()=>ne(l(g),2));let _=()=>l(v)[0],A=()=>l(v)[1];var R=S(),z=y(R);de(z,_,!0,(k,j)=>{I(k,()=>({...A()}))}),h(p,R)});var x=U(b);D(x,()=>e.children??W),B(u),h(t,u),N()}function Oe(t,e){C(e,!0);/**
 * @license @lucide/svelte v0.515.0 - ISC
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
 */let n=q(e,["$$slots","$$events","$$legacy"]);const r=[["path",{d:"M20 6 9 17l-5-5"}]];Z(t,J({name:"check"},()=>n,{get iconNode(){return r},children:(s,a)=>{var i=S(),o=y(i);D(o,()=>e.children??W),h(s,i)},$$slots:{default:!0}})),N()}function Ve(t,e){C(e,!0);/**
 * @license @lucide/svelte v0.515.0 - ISC
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
 */let n=q(e,["$$slots","$$events","$$legacy"]);const r=[["path",{d:"M5 12h14"}]];Z(t,J({name:"minus"},()=>n,{get iconNode(){return r},children:(s,a)=>{var i=S(),o=y(i);D(o,()=>e.children??W),h(s,i)},$$slots:{default:!0}})),N()}var Ge=M('<div data-slot="checkbox-indicator" class="text-current transition-none"><!></div>');function ct(t,e){C(e,!0);let n=c(e,"ref",15,null),r=c(e,"checked",15,!1),s=c(e,"indeterminate",15,!1),a=q(e,["$$slots","$$events","$$legacy","ref","checked","indeterminate","class"]);var i=S(),o=y(i);{const u=(x,p)=>{let g=()=>p?.().checked,v=()=>p?.().indeterminate;var _=Ge(),A=E(_);{var R=k=>{Oe(k,{class:"size-3.5"})},z=k=>{var j=S(),H=y(j);{var d=m=>{Ve(m,{class:"size-3.5"})};V(H,m=>{v()&&m(d)},!0)}h(k,j)};V(A,k=>{g()?k(R):k(z,!1)})}B(_),h(x,_)};let b=f(()=>G("border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive shadow-xs peer flex size-4 shrink-0 items-center justify-center rounded-[4px] border outline-none transition-shadow focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",e.class));ge(o,()=>Me,(x,p)=>{p(x,J({"data-slot":"checkbox",get class(){return l(b)}},()=>a,{get ref(){return n()},set ref(g){n(g)},get checked(){return r()},set checked(g){r(g)},get indeterminate(){return s()},set indeterminate(g){s(g)},children:u,$$slots:{default:!0}}))})}h(t,i),N()}var He=M("<div></div>");function dt(t,e){C(e,!0);let n=c(e,"ref",15,null),r=q(e,["$$slots","$$events","$$legacy","ref","class"]);var s=He();I(s,a=>({"data-slot":"skeleton",class:a,...r}),[()=>G("bg-accent animate-pulse rounded-md",e.class)]),K(s,a=>n(a),()=>n()),h(t,s),N()}export{nt as A,ct as C,dt as S,at as a,it as b,ot as r};
