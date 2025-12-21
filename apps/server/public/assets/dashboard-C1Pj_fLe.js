const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/settings-B0ZpC5LD.js","assets/auth-CtF7wfY5.js","assets/ui-DJeZlV46.js","assets/bookmarks-hgxSTBhD.js","assets/main-BnFaXbWJ.js","assets/commands-BuWa8uSs.js","assets/main-BOkpivqf.css"])))=>i.map(i=>d[i]);
import{F as l,P as Be,Q as ie,G as Te,R as ne,S as De,T as Ae,_ as f,o as H,q as Ve,f as re,h as T,l as Pe,D as de,i as pe,d as W,g as $,U as qe,V as ue,W as S,X as M,Y as le,Z as me,$ as L,a0 as ce,a1 as ve,a2 as he,a3 as ye,a4 as fe,a5 as we,a6 as be,a7 as ze,a8 as Me,a9 as xe,aa as Oe,ab as ke,ac as Re}from"./auth-CtF7wfY5.js";import{u as We,e as k}from"./bookmarks-hgxSTBhD.js";import{s as w,a as _e}from"./ui-DJeZlV46.js";const ge=20;function O(e){return Me?Math.round(e/ge)*ge:e}function dt(){const e=document.body.classList.toggle("fullscreen-mode"),t=document.querySelector("#dashboard-fullscreen-btn .fullscreen-enter-icon"),s=document.querySelector("#dashboard-fullscreen-btn .fullscreen-exit-icon");t&&s&&(t.classList.toggle("hidden",e),s.classList.toggle("hidden",!e))}function He(){return JSON.stringify({widgets:l,mode:$.mode,tags:$.tags,sort:$.bookmarkSort})}function Ee(){Oe(He()),ke(!1),Se()}function je(){ke(!0),Se()}function Se(){const e=document.getElementById("dashboard-unsaved-indicator");e&&e.classList.toggle("hidden",!xe)}function j(e){const t=document.getElementById("dashboard-view-name");t&&(e?(t.textContent=e,t.classList.remove("hidden")):(t.textContent="",t.classList.add("hidden")))}function Fe(){return xe?confirm("You have unsaved changes to the dashboard layout. These changes will be lost if you switch views. Continue?"):!0}async function Ne(){const e=document.querySelector(".header-right");if(e){if(document.getElementById("bookmark-views-btn")?.remove(),!document.getElementById("dashboard-views-btn")){const t=document.createElement("button");t.id="dashboard-views-btn",t.className="btn btn-secondary",t.innerHTML=`
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
                <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
            </svg>
            Views
        `,t.addEventListener("click",s=>{s.stopPropagation(),Ue()}),e.insertBefore(t,e.firstChild)}await $e()}}async function Ue(){document.getElementById("views-dropdown")?.remove();const e=await $e(),t=document.createElement("div");t.id="views-dropdown",t.className="dropdown-menu",t.style.cssText=`
        position: absolute;
        top: 3rem;
        right: 1rem;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        z-index: 50;
        min-width: 200px;
        padding: 0.5rem;
    `;let s=`
        <div style="font-weight:600;padding:0.5rem;border-bottom:1px solid var(--border-color);margin-bottom:0.5rem">
            Dashboard Views
        </div>
        <div class="views-list" style="max-height:200px;overflow-y:auto">
    `;e.length===0?s+='<div style="padding:0.5rem;color:var(--text-tertiary);text-align:center">No saved views</div>':e.forEach(a=>{s+=`
                <div class="dropdown-item view-item" data-view-id="${a.id}" style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem;cursor:pointer;border-radius:4px">
                    <span class="view-name" style="flex:1">${k(a.name)}</span>
                    <button class="btn-icon small text-danger delete-view-btn" data-view-id="${a.id}" title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            `}),s+=`
        </div>
        <div style="border-top:1px solid var(--border-color);margin-top:0.5rem;padding-top:0.5rem">
            <button class="btn btn-primary btn-sm btn-full" id="save-view-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;margin-right:4px">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                    <polyline points="7 3 7 8 15 8"/>
                </svg>
                Save Current View
            </button>
        </div>
    `,t.innerHTML=s,document.body.appendChild(t),t.querySelectorAll(".view-item").forEach(a=>{const i=a.dataset.viewId,o=a.querySelector(".view-name"),d=o?.textContent||null,r=a.querySelector(".delete-view-btn");o&&o.addEventListener("click",async g=>{g.preventDefault(),g.stopPropagation(),await U(i,d)}),r&&r.addEventListener("click",async g=>{g.preventDefault(),g.stopPropagation(),await N(i)})});const n=t.querySelector("#save-view-btn");n&&n.addEventListener("click",async a=>{a.preventDefault(),a.stopPropagation(),await F()}),setTimeout(()=>{document.addEventListener("click",Le)},0)}function Le(e){const t=document.getElementById("views-dropdown");t&&!t.contains(e.target)&&e.target.id!=="dashboard-views-btn"&&(t.remove(),document.removeEventListener("click",Le))}async function F(){const e=prompt("Enter a name for this view:");if(e)try{const t={dashboard_mode:$.mode,dashboard_tags:$.tags,dashboard_sort:$.bookmarkSort,widget_order:ze,dashboard_widgets:l,include_child_bookmarks:pe?1:0},s=await T("/dashboard/views",{method:"POST",body:JSON.stringify({name:e,config:t})});w("View saved!","success"),document.getElementById("views-dropdown")?.remove(),we(s.id),be(e),j(e),Ee();const{saveSettings:n}=await f(async()=>{const{saveSettings:a}=await import("./settings-B0ZpC5LD.js");return{saveSettings:a}},__vite__mapDeps([0,1,2,3]));if(await n({current_dashboard_view_id:s.id,current_dashboard_view_name:e}),confirm("Create a bookmark shortcut for this view?")){const{createBookmark:a}=await f(async()=>{const{createBookmark:i}=await import("./bookmarks-hgxSTBhD.js").then(o=>o.c);return{createBookmark:i}},__vite__mapDeps([3,1,2]));await a({title:e,url:`view:${s.id}`,description:"Dashboard View Shortcut",tags:"dashboard-views"})}}catch(t){w(t.message,"error")}}async function $e(){try{return await T("/dashboard/views")}catch{return[]}}async function N(e){if(confirm("Delete this view?"))try{await T(`/dashboard/views/${e}`,{method:"DELETE"}),w("View deleted","success"),document.getElementById("views-dropdown")?.remove()}catch(t){w(t.message,"error")}}async function U(e,t){if(Fe())try{await T(`/dashboard/views/${e}/restore`,{method:"POST"}),w("View restored!","success"),document.getElementById("views-dropdown")?.remove(),we(e),be(t||null),j(t||null);const{loadSettings:s,saveSettings:n}=await f(async()=>{const{loadSettings:a,saveSettings:i}=await import("./settings-B0ZpC5LD.js");return{loadSettings:a,saveSettings:i}},__vite__mapDeps([0,1,2,3]));await s(),H("dashboard"),await n({current_view:"dashboard",current_dashboard_view_id:e,current_dashboard_view_name:t||null}),I(),X(),Ee()}catch(s){w(s.message,"error")}}window.saveCurrentView=F;window.deleteView=N;window.restoreView=U;function Ce(e){const t=e.color?`--bookmark-color: ${e.color}; background-color: color-mix(in srgb, ${e.color} 20%, var(--bg-primary)); border-left: 6px solid ${e.color};`:"";return`
    <div class="compact-item${e.color?" has-color":""}" style="${t}">
        <a href="${e.url}" target="_blank" class="compact-item-link" data-action="track-click" data-id="${e.id}">
            <div class="compact-favicon">
                ${!qe&&e.favicon?`<img src="${e.favicon}" alt="" loading="lazy">`:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/></svg>'}
            </div>
            <span class="compact-text">${k(e.title)}</span>
        </a>
        <div class="compact-actions">
            <button class="compact-action-btn" data-action="edit-bookmark" data-id="${e.id}" title="Edit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="compact-action-btn" data-action="copy-link" data-url="${k(e.url)}" title="Copy link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button class="compact-action-btn compact-action-danger" data-action="delete-bookmark" data-id="${e.id}" title="Delete">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
        </div>
    </div>
    `}function Ie(e,t){const s=t||$.bookmarkSort||"recently_added";return[...e].sort((n,a)=>{switch(s){case"a_z":case"a-z":case"alpha":return n.title.localeCompare(a.title);case"z_a":case"z-a":return a.title.localeCompare(n.title);case"most_visited":return(a.click_count||0)-(n.click_count||0);case"oldest_first":case"created_asc":return new Date(n.created_at).getTime()-new Date(a.created_at).getTime();case"recently_added":case"created_desc":default:return new Date(a.created_at).getTime()-new Date(n.created_at).getTime()}})}function I(){We();const e=document.getElementById("bookmarks-container"),t=document.getElementById("empty-state"),s=document.getElementById("bulk-bar");if(!e)return;document.querySelector(".view-toggle")?.classList.add("hidden"),s?.classList.add("hidden"),e.className="dashboard-freeform",e.innerHTML="",t&&t.classList.add("hidden"),Ne();const n=document.getElementById("dashboard-views-btn");n&&n.classList.remove("hidden"),j(Re);const a=`
        <div class="dashboard-freeform-container" id="dashboard-drop-zone">
            <div class="dashboard-help-text">
                ${l.length===0?"<p>Drag folders or tags from the sidebar to create widgets</p>":""}
            </div>
            <div class="dashboard-widgets-container" id="dashboard-widgets-freeform">
                ${Ge()}
            </div>
        </div>
    `;e.innerHTML=a,e.innerHTML=a,Je(),E(),Ye()}function Ye(){const e=document.querySelectorAll(".widget-load-more");if(e.length===0)return;const t=new IntersectionObserver(s=>{s.forEach(n=>{if(n.isIntersecting){const a=n.target;Xe(a)}})},{rootMargin:"100px"});e.forEach(s=>t.observe(s))}function Xe(e){const t=parseInt(e.dataset.widgetIndex||"-1"),s=l[t];if(!s||e.dataset.loading==="true")return;e.dataset.loading="true";const n=Y(s);if(!n)return;const a=Ie(n.bookmarks,s.sort),i=e.parentElement;if(!i)return;const o=i.querySelectorAll(".compact-item").length,r=a.slice(o,o+20);if(r.length>0){const g=r.map(p=>Ce(p)).join("");e.insertAdjacentHTML("beforebegin",g)}o+r.length>=a.length?e.remove():e.dataset.loading="false"}async function E(){try{const e=document.querySelectorAll('.dashboard-widget-freeform[data-widget-type="tag-analytics"] .tag-analytics');if(!e||e.length===0)return;const t=await T("/tags/analytics");let s=[],n=[];t&&typeof t=="object"&&(t.success&&Array.isArray(t.tags)?(s=t.tags,n=t.cooccurrence||[]):Array.isArray(t)&&(s=t)),e.forEach(a=>{const i=a.getAttribute("data-analytics-widget"),o=parseInt(i),r=(l[o]||{}).settings||{metric:"count",limit:20,pairSort:"count",colors:{usage:"#6366f1",clicks:"#f97316",favorites:"#eab308",pairs:"#6b7280"}},g=r.metric||"count",p=r.limit||20,y=r.pairSort||"count",v=r.colors||{usage:"#6366f1",clicks:"#f97316",favorites:"#eab308",pairs:"#6b7280"},h=a.querySelector(".tag-analytics-metric"),B=a.querySelector(".tag-analytics-limit"),D=a.querySelector(".tag-analytics-pairsort"),A=a.querySelector(".tag-analytics-color-usage"),V=a.querySelector(".tag-analytics-color-clicks"),P=a.querySelector(".tag-analytics-color-favorites"),q=a.querySelector(".tag-analytics-color-pairs"),G=a.querySelector(".legend-usage"),J=a.querySelector(".legend-clicks"),Z=a.querySelector(".legend-favorites"),Q=a.querySelector(".legend-pairs");h&&(h.value=g),B&&(B.value=String(p)),D&&(D.value=y),A&&(A.value=v.usage),V&&(V.value=v.clicks),P&&(P.value=v.favorites),q&&(q.value=v.pairs),G&&(G.style.backgroundColor=v.usage),J&&(J.style.backgroundColor=v.clicks),Z&&(Z.style.backgroundColor=v.favorites),Q&&(Q.style.backgroundColor=v.pairs);const K=a.querySelector(".tag-analytics-top-tags"),ee=a.querySelector(".tag-analytics-cooccurrence");if(K){const c=[...s].sort((b,_)=>(_[g]||0)-(b[g]||0)).slice(0,p),u=g==="count"?v.usage:g==="click_count_sum"?v.clicks:v.favorites;K.innerHTML=c.map(b=>`
              <div class="tag-name" title="${k(b.name)}">${k(b.name)}</div>
              <div class="tag-count" style="text-align:right;color:${u}">${b[g]||0}</div>
            `).join("")}if(ee){const c=[...n].sort((u,b)=>{if(y==="alpha"){const _=(u.tag_name_a+" + "+u.tag_name_b).toLowerCase(),x=(b.tag_name_a+" + "+b.tag_name_b).toLowerCase();return _.localeCompare(x)}return(b.count||0)-(u.count||0)}).slice(0,p);ee.innerHTML=c.map(u=>`
              <div class="pair-name" title="${k(u.tag_name_a)} + ${k(u.tag_name_b)}">${k(u.tag_name_a)} + ${k(u.tag_name_b)}</div>
              <div class="pair-count" style="text-align:right;color:${v.pairs}">${u.count}</div>
            `).join("")}h&&h.addEventListener("change",m=>{const c=m.target.value;l[o].settings||(l[o].settings={}),l[o].settings.metric=c,f(async()=>{const{saveSettings:u}=await import("./settings-B0ZpC5LD.js");return{saveSettings:u}},__vite__mapDeps([0,1,2,3])).then(({saveSettings:u})=>u({dashboard_widgets:l})),E()}),B&&B.addEventListener("change",m=>{const c=parseInt(m.target.value);l[o].settings||(l[o].settings={}),l[o].settings.limit=c,f(async()=>{const{saveSettings:u}=await import("./settings-B0ZpC5LD.js");return{saveSettings:u}},__vite__mapDeps([0,1,2,3])).then(({saveSettings:u})=>u({dashboard_widgets:l})),E()}),D&&D.addEventListener("change",m=>{const c=m.target.value;l[o].settings||(l[o].settings={}),l[o].settings.pairSort=c,f(async()=>{const{saveSettings:u}=await import("./settings-B0ZpC5LD.js");return{saveSettings:u}},__vite__mapDeps([0,1,2,3])).then(({saveSettings:u})=>u({dashboard_widgets:l})),E()});function z(){l[o].settings||(l[o].settings={}),l[o].settings.colors||(l[o].settings.colors={})}A&&A.addEventListener("change",m=>{z(),l[o].settings.colors.usage=m.target.value,f(async()=>{const{saveSettings:c}=await import("./settings-B0ZpC5LD.js");return{saveSettings:c}},__vite__mapDeps([0,1,2,3])).then(({saveSettings:c})=>c({dashboard_widgets:l})),E()}),V&&V.addEventListener("change",m=>{z(),l[o].settings.colors.clicks=m.target.value,f(async()=>{const{saveSettings:c}=await import("./settings-B0ZpC5LD.js");return{saveSettings:c}},__vite__mapDeps([0,1,2,3])).then(({saveSettings:c})=>c({dashboard_widgets:l})),E()}),P&&P.addEventListener("change",m=>{z(),l[o].settings.colors.favorites=m.target.value,f(async()=>{const{saveSettings:c}=await import("./settings-B0ZpC5LD.js");return{saveSettings:c}},__vite__mapDeps([0,1,2,3])).then(({saveSettings:c})=>c({dashboard_widgets:l})),E()}),q&&q.addEventListener("change",m=>{z(),l[o].settings.colors.pairs=m.target.value,f(async()=>{const{saveSettings:c}=await import("./settings-B0ZpC5LD.js");return{saveSettings:c}},__vite__mapDeps([0,1,2,3])).then(({saveSettings:c})=>c({dashboard_widgets:l})),E()});function R(m,c,u){const b=new Blob([u],{type:c}),_=URL.createObjectURL(b),x=document.createElement("a");x.href=_,x.download=m,document.body.appendChild(x),x.click(),document.body.removeChild(x),URL.revokeObjectURL(_)}function te(m,c){const u=c.join(","),b=m.map(_=>c.map(x=>`"${(_[x]!=null?String(_[x]):"").replace(/"/g,'""')}"`).join(",")).join(`
`);return`${u}
${b}`}const ae=a.querySelector(".tag-analytics-export-json"),oe=a.querySelector(".tag-analytics-export-tags-csv"),se=a.querySelector(".tag-analytics-export-pairs-csv");ae&&ae.addEventListener("click",()=>{const m=JSON.stringify({tags:s,cooccurrence:n},null,2);R("tag-analytics.json","application/json",m)}),oe&&oe.addEventListener("click",()=>{const m=te(s,["name","count"]);R("tag-analytics-tags.csv","text/csv",m)}),se&&se.addEventListener("click",()=>{const m=te(n,["tag_name_a","tag_name_b","count"]);R("tag-analytics-pairs.csv","text/csv",m)})})}catch(e){Pe.error("Failed to load tag analytics",e)}}function Ge(){let e="";return l.forEach((t,s)=>{if(Be){e+=`
        <div class="dashboard-widget-freeform skeleton-card" 
             style="left: ${t.x||0}px; top: ${t.y||0}px; width: ${t.w||320}px; height: ${t.h||400}px;">
            <div class="widget-header">
                <div class="skeleton" style="width: 100px; height: 16px;"></div>
            </div>
            <div class="widget-body">
                <div class="compact-list">
                    ${Array(5).fill(null).map(()=>`
                        <div class="compact-item">
                            <div class="skeleton skeleton-favicon"></div>
                            <div class="skeleton" style="width: 80%; height: 14px;"></div>
                        </div>
                    `).join("")}
                </div>
            </div>
        </div>
      `;return}const n=Y(t);if(!n)return;const{name:a,color:i,bookmarks:o,count:d}=n,r=Ie(o,t.sort),g=t.color||i;e+=`
        <div class="dashboard-widget-freeform" 
             data-widget-index="${s}"
             data-widget-id="${t.id}"
             data-widget-type="${t.type}"
             draggable="true"
             style="left: ${t.x||0}px; top: ${t.y||0}px; width: ${t.w||320}px; height: ${t.h||400}px;">
            <div class="widget-header" data-color="${g}">
                <div class="widget-drag-handle" title="Drag to move">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                        <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
                        <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
                    </svg>
                </div>
                ${t.type==="folder"?`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:6px">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>`:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:6px">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                        <line x1="7" y1="7" x2="7.01" y2="7"/>
                    </svg>`}
                <div class="widget-title">${k(a)}</div>
                <div class="widget-count">${d}</div>
                <div class="widget-actions">
                    <div class="widget-options-container">
                        <button class="btn-icon widget-options-btn" data-action="toggle-widget-options" data-index="${s}" title="Options">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                                <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
                            </svg>
                        </button>
                        <div class="widget-options-menu hidden" data-widget-index="${s}">
                            ${t.type!=="tag-analytics"?`
                            <button class="widget-option" data-action="widget-sort-az" data-widget-index="${s}" data-widget-type="${t.type}" data-widget-id="${t.id}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M3 6h18M3 12h12M3 18h6"/></svg>
                                Sort A-Z
                            </button>
                            <button class="widget-option" data-action="widget-sort-za" data-widget-index="${s}" data-widget-type="${t.type}" data-widget-id="${t.id}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M3 6h6M3 12h12M3 18h18"/></svg>
                                Sort Z-A
                            </button>
                            <div class="widget-option-divider"></div>
                            <button class="widget-option" data-action="widget-add-bookmark" data-widget-type="${t.type}" data-widget-id="${t.id}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                Add Bookmark
                            </button>
                            <button class="widget-option" data-action="widget-open-all" data-widget-index="${s}" data-widget-type="${t.type}" data-widget-id="${t.id}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                Open All
                            </button>
                            <button class="widget-option" data-action="widget-show-in-view" data-widget-type="${t.type}" data-widget-id="${t.id}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                Show in Bookmarks
                            </button>
                            <div class="widget-option-divider"></div>
                            `:""}
                            <button class="widget-option" data-action="change-widget-color" data-index="${s}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20"/></svg>
                                Change Color
                            </button>
                        </div>
                    </div>
                    <button class="btn-icon widget-remove" data-action="remove-widget" data-index="${s}" title="Remove widget">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="widget-body">
              ${t.type==="tag-analytics"?`
                <div class="tag-analytics" data-analytics-widget="${s}">
                   <!-- Tag analytics content -->
                   <div class="tag-analytics-controls" style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;margin-bottom:0.5rem;">
                     <label style="display:flex;align-items:center;gap:0.25rem;">
                       <span style="font-size:0.75rem;color:var(--text-tertiary)">Metric</span>
                       <select class="tag-analytics-metric">
                         <option value="count">Usage</option>
                         <option value="click_count_sum">Clicks</option>
                         <option value="favorites_count">Favorites</option>
                       </select>
                     </label>
                     <label style="display:flex;align-items:center;gap:0.25rem;">
                       <span style="font-size:0.75rem;color:var(--text-tertiary)">Top N</span>
                       <select class="tag-analytics-limit">
                         <option value="10">10</option>
                         <option value="20" selected>20</option>
                         <option value="30">30</option>
                         <option value="50">50</option>
                       </select>
                     </label>
                     <label style="display:flex;align-items:center;gap:0.25rem;">
                       <span style="font-size:0.75rem;color:var(--text-tertiary)">Pairs Sort</span>
                       <select class="tag-analytics-pairsort">
                         <option value="count" selected>Count</option>
                         <option value="alpha">A→Z</option>
                       </select>
                     </label>
                     <div class="tag-analytics-exports" style="margin-left:auto;display:flex;gap:0.25rem;">
                       <button class="btn btn-sm tag-analytics-export-json" title="Export JSON">JSON</button>
                       <button class="btn btn-sm tag-analytics-export-tags-csv" title="Export Tags CSV">Tags CSV</button>
                       <button class="btn btn-sm tag-analytics-export-pairs-csv" title="Export Pairs CSV">Pairs CSV</button>
                     </div>
                   </div>
                   <!-- ... rest of analytics ... -->
                   <div class="tag-analytics-colors" style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.5rem;flex-wrap:wrap;">
                     <!-- Colors inputs placeholders, populated by initTagAnalyticsWidgets -->
                     <label style="display:flex;align-items:center;gap:0.25rem;">
                       <span style="font-size:0.75rem;color:var(--text-tertiary)">Usage</span>
                       <input type="color" class="tag-analytics-color-usage" style="width:24px;height:20px;border:none;cursor:pointer;" />
                     </label>
                     <label style="display:flex;align-items:center;gap:0.25rem;">
                       <span style="font-size:0.75rem;color:var(--text-tertiary)">Clicks</span>
                       <input type="color" class="tag-analytics-color-clicks" style="width:24px;height:20px;border:none;cursor:pointer;" />
                     </label>
                     <label style="display:flex;align-items:center;gap:0.25rem;">
                       <span style="font-size:0.75rem;color:var(--text-tertiary)">Favorites</span>
                       <input type="color" class="tag-analytics-color-favorites" style="width:24px;height:20px;border:none;cursor:pointer;" />
                     </label>
                     <label style="display:flex;align-items:center;gap:0.25rem;">
                       <span style="font-size:0.75rem;color:var(--text-tertiary)">Pairs</span>
                       <input type="color" class="tag-analytics-color-pairs" style="width:24px;height:20px;border:none;cursor:pointer;" />
                     </label>
                   </div>
                   <div class="tag-analytics-legend" style="display:flex;gap:0.75rem;align-items:center;margin-bottom:0.5rem;">
                     <span class="legend-item" style="display:flex;align-items:center;gap:0.25rem;font-size:0.75rem;color:var(--text-tertiary)"><span class="legend-color legend-usage" style="display:inline-block;width:10px;height:10px;background:#6366f1;border-radius:2px"></span>Usage</span>
                     <span class="legend-item" style="display:flex;align-items:center;gap:0.25rem;font-size:0.75rem;color:var(--text-tertiary)"><span class="legend-color legend-clicks" style="display:inline-block;width:10px;height:10px;background:#f97316;border-radius:2px"></span>Clicks</span>
                     <span class="legend-item" style="display:flex;align-items:center;gap:0.25rem;font-size:0.75rem;color:var(--text-tertiary)"><span class="legend-color legend-favorites" style="display:inline-block;width:10px;height:10px;background:#eab308;border-radius:2px"></span>Favorites</span>
                     <span class="legend-item" style="display:flex;align-items:center;gap:0.25rem;font-size:0.75rem;color:var(--text-tertiary)"><span class="legend-color legend-pairs" style="display:inline-block;width:10px;height:10px;background:#6b7280;border-radius:2px"></span>Pairs</span>
                   </div>
                   <div class="tag-analytics-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
                     <div class="tag-analytics-col">
                       <div class="tag-analytics-col-title" style="font-weight:600;margin-bottom:0.25rem;">Top Tags</div>
                       <div class="tag-analytics-list tag-analytics-top-tags" style="display:grid;grid-template-columns:1fr auto;gap:0.25rem"></div>
                     </div>
                     <div class="tag-analytics-col">
                       <div class="tag-analytics-col-title" style="font-weight:600;margin-bottom:0.25rem;">Top Co-occurrence</div>
                       <div class="tag-analytics-list tag-analytics-cooccurrence" style="display:grid;grid-template-columns:1fr auto;gap:0.25rem"></div>
                     </div>
                   </div>
                </div>
                `:`
                <div class="compact-list">
                    ${r.slice(0,20).map(p=>Ce(p)).join("")}
                    ${r.length>20?`
                    <div class="widget-load-more" data-widget-index="${s}" style="padding:0.5rem;text-align:center;color:var(--text-tertiary);">
                        <div class="loading-spinner small"></div>
                    </div>`:""}
                </div>
                `}
            </div>
            <div class="widget-resize-handle" title="Drag to resize"></div>
        </div>
        `}),e}function Y(e){if(e.type==="folder"){const t=de.find(n=>n.id===e.id);if(!t)return null;let s;if(pe){const n=i=>{const o=[i];return de.filter(d=>d.parent_id===i).forEach(d=>o.push(...n(d.id))),o},a=n(t.id);s=W.filter(i=>i.folder_id&&a.includes(i.folder_id)&&!i.is_archived)}else s=W.filter(n=>n.folder_id===t.id&&!n.is_archived);return{name:t.name,color:t.color||"#6366f1",bookmarks:s,count:s.length}}else if(e.type==="tag"){const t=W.filter(s=>!s.is_archived&&s.tags&&s.tags.split(",").map(n=>n.trim()).includes(e.id));return{name:e.id,color:"#10b981",bookmarks:t,count:t.length}}else if(e.type==="tag-analytics")return{name:"Tag Analytics",color:"#6b7280",bookmarks:[],count:""};return null}function Je(){const e=document.getElementById("dashboard-drop-zone");if(!e)return;e.addEventListener("dragover",a=>{a.preventDefault(),a.dataTransfer&&(a.dataTransfer.dropEffect="copy"),e.classList.add("drag-over")}),e.addEventListener("dragleave",a=>{a.target===e&&e.classList.remove("drag-over")}),e.addEventListener("drop",a=>{a.preventDefault(),e.classList.remove("drag-over");const i=e.getBoundingClientRect(),o=a.clientX-i.left+e.scrollLeft,d=a.clientY-i.top+e.scrollTop;if(ie){const{type:r,id:g}=ie;Ke(r,g,o,d),Te(null)}}),document.querySelectorAll(".dashboard-widget-freeform").forEach(a=>{const i=a.querySelector(".widget-header"),o=a.querySelector(".widget-resize-handle");i?.addEventListener("mousedown",d=>{d.target.closest(".widget-remove")||d.target.closest(".widget-color-btn")||(ve(!0),he(a),ne({x:d.clientX,y:d.clientY}),De({x:parseInt(a.style.left)||0,y:parseInt(a.style.top)||0}),a.classList.add("dragging"),d.preventDefault())}),o?.addEventListener("mousedown",d=>{ye(!0),fe(a),ne({x:d.clientX,y:d.clientY}),Ae({w:parseInt(a.style.width)||320,h:parseInt(a.style.height)||400}),a.classList.add("resizing"),d.preventDefault(),d.stopPropagation()})}),document.addEventListener("mousemove",Ze),document.addEventListener("mouseup",Qe),document.querySelectorAll('[data-action="remove-widget"]').forEach(a=>{a.addEventListener("click",i=>{i.stopPropagation();const o=parseInt(a.dataset.index);et(o)})}),document.querySelectorAll('[data-action="change-widget-color"]').forEach(a=>{a.addEventListener("click",i=>{i.stopPropagation();const o=parseInt(a.dataset.index);document.querySelectorAll(".widget-options-menu").forEach(r=>r.classList.add("hidden"));const d=document.querySelector(`.widget-options-container [data-action="toggle-widget-options"][data-index="${o}"]`);tt(o,d||a)})}),document.querySelectorAll('[data-action="toggle-widget-options"]').forEach(a=>{a.addEventListener("click",i=>{i.stopPropagation();const o=a.dataset.index,d=document.querySelector(`.widget-options-menu[data-widget-index="${o}"]`);document.querySelectorAll(".widget-options-menu").forEach(r=>{r!==d&&r.classList.add("hidden")}),d?.classList.toggle("hidden")})});const t=a=>{const i=a.target;i.closest(".widget-options-menu")||i.closest('[data-action="toggle-widget-options"]')||i.closest("select")||i.closest("input")||i.closest(".tag-analytics")||document.querySelectorAll(".widget-options-menu").forEach(o=>{o.classList.add("hidden")})},s=document.getElementById("dashboard-widgets-freeform");s&&!s._menuListenerAdded&&(document.addEventListener("click",t),s._menuListenerAdded=!0),document.querySelectorAll('[data-action="widget-sort-az"]').forEach(a=>{a.addEventListener("click",i=>{i.stopPropagation();const o=parseInt(a.dataset.widgetIndex);l[o]&&(l[o].sort="a-z",C(),I())})}),document.querySelectorAll('[data-action="widget-sort-za"]').forEach(a=>{a.addEventListener("click",i=>{i.stopPropagation();const o=parseInt(a.dataset.widgetIndex);l[o]&&(l[o].sort="z-a",C(),I())})}),document.querySelectorAll('[data-action="widget-add-bookmark"]').forEach(a=>{a.addEventListener("click",async i=>{i.stopPropagation();const o=a.dataset.widgetType,d=a.dataset.widgetId;document.querySelectorAll(".widget-options-menu").forEach(p=>p.classList.add("hidden"));const{openModal:r,resetForms:g}=await f(async()=>{const{openModal:p,resetForms:y}=await import("./ui-DJeZlV46.js").then(v=>v.e);return{openModal:p,resetForms:y}},__vite__mapDeps([2,3,1]));if(g(),o==="folder"){const p=document.getElementById("bookmark-folder");p&&(p.value=d)}else if(o==="tag"){const p=document.getElementById("bookmark-tags");p&&(p.value=d);try{const{loadTagsFromInput:y}=await f(async()=>{const{loadTagsFromInput:v}=await import("./main-BnFaXbWJ.js").then(h=>h.t);return{loadTagsFromInput:v}},__vite__mapDeps([4,2,3,1,5,6]));y(d)}catch{}}r("bookmark-modal")})}),document.querySelectorAll('[data-action="widget-open-all"]').forEach(a=>{a.addEventListener("click",async i=>{i.stopPropagation();const o=a.dataset.widgetType,d=a.dataset.widgetId,r=l.find(h=>h.type===o&&h.id===d);if(!r){w("Widget not found","error"),console.error("Widget not found for open-all",{widgetType:o,widgetId:d});return}const g=Y(r);if(!g){w("Could not retrieve bookmarks","error");return}document.querySelectorAll(".widget-options-menu").forEach(h=>h.classList.add("hidden"));const{bookmarks:p}=g;if(!p||p.length===0){w("No bookmarks to open","info");return}if(p.length>5&&!confirm(`Open ${p.length} bookmarks in new tabs?`))return;let y=0;const v=[];p.forEach(h=>{h&&h.url&&(window.open(h.url,"_blank")?y++:v.push(h))}),y===p.length?w(`Opened ${y} tab${y>1?"s":""}`,"success"):n(v,y)})});function n(a,i){let o=document.getElementById("blocked-links-modal");if(o||(o=document.createElement("div"),o.id="blocked-links-modal",o.className="modal-overlay",o.style.zIndex="9999",document.body.appendChild(o),o.addEventListener("click",r=>{r.target===o&&o?.classList.add("hidden")})),!o)return;const d=a.length>1;if(o.innerHTML=`
    <div class="modal">
      <div class="modal-header">
        <h3>${i>0?"Some Tabs Blocked":"Popups Blocked"}</h3>
        <button class="btn-icon" onclick="document.getElementById('blocked-links-modal').classList.add('hidden')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom: 1rem; color: var(--text-secondary);">
          Your browser blocked ${a.length} link${d?"s":""} from opening automatically. 
          Use the links below to open them manually:
        </p>
        <div class="blocked-links-list" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
          ${a.map(r=>`
            <a href="${r.url}" target="_blank" class="blocked-link-item" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border-bottom: 1px solid var(--border-color); text-decoration: none; color: var(--text-primary); transition: background 0.2s;">
              ${r.favicon?`<img src="${r.favicon}" style="width:16px;height:16px;border-radius:2px" onerror="this.style.display='none'">`:'<span style="width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;background:var(--bg-tertiary);border-radius:2px;font-size:10px">🔗</span>'}
              <div style="flex:1;min-width:0">
                <div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.title||r.url}</div>
                <div style="font-size:0.75rem;color:var(--text-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.url}</div>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:var(--primary-500)"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          `).join("")}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="document.getElementById('blocked-links-modal').classList.add('hidden')">Done</button>
      </div>
    </div>
  `,!document.getElementById("blocked-links-style")){const r=document.createElement("style");r.id="blocked-links-style",r.textContent=`
      .blocked-link-item:hover { background: var(--bg-tertiary) !important; }
      .blocked-link-item:last-child { border-bottom: none !important; }
    `,document.head.appendChild(r)}o.classList.remove("hidden")}document.querySelectorAll('[data-action="widget-show-in-view"]').forEach(a=>{a.addEventListener("click",async i=>{i.stopPropagation();const o=a.dataset.widgetType,d=a.dataset.widgetId;if(document.querySelectorAll(".widget-options-menu").forEach(r=>r.classList.add("hidden")),o==="folder"){const{loadBookmarks:r}=await f(async()=>{const{loadBookmarks:g}=await import("./bookmarks-hgxSTBhD.js").then(p=>p.c);return{loadBookmarks:g}},__vite__mapDeps([3,1,2]));H("folder"),Ve(d),await r()}else if(o==="tag"){const{loadBookmarks:r,renderBookmarks:g}=await f(async()=>{const{loadBookmarks:y,renderBookmarks:v}=await import("./bookmarks-hgxSTBhD.js").then(h=>h.c);return{loadBookmarks:y,renderBookmarks:v}},__vite__mapDeps([3,1,2])),{updateActiveNav:p}=await f(async()=>{const{updateActiveNav:y}=await import("./ui-DJeZlV46.js").then(v=>v.e);return{updateActiveNav:y}},__vite__mapDeps([2,3,1]));H("all"),re.tags=[d],re.tagMode="OR",await r(),g(),p()}})})}function Ze(e){if(ue&&S){const t=e.clientX-M.x,s=e.clientY-M.y,n=le.x+t,a=le.y+s;S.style.left=`${O(n)}px`,S.style.top=`${O(a)}px`}else if(me&&L){const t=e.clientX-M.x,s=e.clientY-M.y,n=Math.max(150,ce.w+t),a=Math.max(100,ce.h+s);L.style.width=`${O(n)}px`,L.style.height=`${O(a)}px`}}function Qe(e){if(ue&&S){S.classList.remove("dragging");const t=parseInt(S.dataset.widgetIndex||"-1");l[t]&&(l[t].x=parseInt(S.style.left)||0,l[t].y=parseInt(S.style.top)||0,C()),ve(!1),he(null)}else if(me&&L){L.classList.remove("resizing");const t=parseInt(L.dataset.widgetIndex||"-1");l[t]&&(l[t].w=parseInt(L.style.width)||320,l[t].h=parseInt(L.style.height)||400,C()),ye(!1),fe(null)}}function Ke(e,t,s,n){if(l.some(o=>o.type===e&&o.id===t)){w("Widget already exists on dashboard","info");return}const i={id:t,type:e,x:s,y:n,w:320,h:400};e==="tag-analytics"&&(i.settings={metric:"count",limit:20,pairSort:"count",colors:{usage:"#6366f1",clicks:"#f97316",favorites:"#eab308",pairs:"#6b7280"}}),l.push(i),C(),I(),_e(),X(),w(`${e==="folder"?"Folder":"Tag"} added to dashboard`,"success")}function et(e){l.splice(e,1),C(),I(),_e(),X(),w("Widget removed","success")}function tt(e,t){const s=document.querySelector(".widget-color-picker");s&&s.remove();const n=l[e];if(!n)return;const a=[{name:"Blue",value:"#6366f1"},{name:"Purple",value:"#a855f7"},{name:"Pink",value:"#ec4899"},{name:"Red",value:"#ef4444"},{name:"Orange",value:"#f97316"},{name:"Yellow",value:"#eab308"},{name:"Green",value:"#10b981"},{name:"Teal",value:"#14b8a6"},{name:"Cyan",value:"#06b6d4"},{name:"Indigo",value:"#4f46e5"},{name:"Gray",value:"#6b7280"},{name:"Slate",value:"#475569"}],i=document.createElement("div");i.className="widget-color-picker",i.innerHTML=`
        <div class="color-picker-grid">
            ${a.map(d=>`
                <button class="color-picker-option" 
                        data-color="${d.value}" 
                        title="${d.name}"
                        style="background: ${d.value}">
                    ${n.color===d.value?'<span class="color-check">✓</span>':""}
                </button>
            `).join("")}
        </div>
    `;const o=t.getBoundingClientRect();i.style.position="fixed",i.style.top=`${o.bottom+8}px`,i.style.right=`${window.innerWidth-o.right}px`,document.body.appendChild(i),i.querySelectorAll(".color-picker-option").forEach(d=>{d.addEventListener("click",r=>{r.stopPropagation();const g=d.dataset.color;at(e,g),i.remove()})}),setTimeout(()=>{document.addEventListener("click",function d(r){i.contains(r.target)||(i.remove(),document.removeEventListener("click",d))})},100)}function at(e,t){l[e]&&(l[e].color=t,C(),I(),w("Widget color updated","success"))}function C(){f(async()=>{const{saveSettings:e}=await import("./settings-B0ZpC5LD.js");return{saveSettings:e}},__vite__mapDeps([0,1,2,3])).then(({saveSettings:e})=>e({dashboard_widgets:l})),je()}function lt(e){const t=document.querySelectorAll(".dashboard-widget"),s=e.toLowerCase();t.forEach(n=>{const a=n.querySelectorAll(".compact-item");let i=!1;a.forEach(o=>{const r=(o.querySelector(".compact-text")?.textContent.toLowerCase()||"").includes(s);o.style.display=r||!e?"":"none",(r||!e)&&(i=!0)}),n.style.opacity=i||!e?"1":"0.5"})}function X(){const e=document.getElementById("layout-stats-content");if(e){const t=l.length;e.innerHTML=`<strong>${t}</strong> widget${t!==1?"s":""} on dashboard`}}window.saveCurrentView=F;window.deleteView=N;window.restoreView=U;export{Ke as addDashboardWidget,Fe as confirmViewSwitch,N as deleteView,lt as filterDashboardBookmarks,Je as initDashboardDragDrop,Ne as initDashboardViews,E as initTagAnalyticsWidgets,je as markDashboardModified,et as removeDashboardWidget,I as renderDashboard,U as restoreView,F as saveCurrentView,Ee as saveDashboardStateSnapshot,dt as toggleFullscreen,X as updateLayoutStats,j as updateViewNameBadge};
//# sourceMappingURL=dashboard-C1Pj_fLe.js.map
