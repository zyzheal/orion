import{defineComponent as h,openBlock as y,createBlock as z,ref as k,onMounted as F,resolveComponent as _,createElementBlock as S,Fragment as q,createVNode as l,withCtx as p,createElementVNode as v}from"vue";import{e as B,C as L,_ as x,c as O}from"./__federation_expose_Index.91d63fce.js";import{C as U}from"./index.ff08fad2.js";import{O as D}from"./orderTable.55a6c8ab.js";import I from"./list.c3cd1b2c.js";function N(){return B.get(`${L}/record/axis`)}var b={exports:{}},C=[],d=[],R="insert-css: You need to provide a CSS string. Usage: insertCss(cssString[, options]).";function w(t,n){if(n=n||{},t===void 0)throw new Error(R);var r=n.prepend===!0?"prepend":"append",a=n.container!==void 0?n.container:document.querySelector("head"),s=C.indexOf(a);s===-1&&(s=C.push(a)-1,d[s]={});var e;return d[s]!==void 0&&d[s][r]!==void 0?e=d[s][r]:(e=d[s][r]=A(),r==="prepend"?a.insertBefore(e,a.childNodes[0]):a.appendChild(e)),t.charCodeAt(0)===65279&&(t=t.substr(1,t.length)),e.styleSheet?e.styleSheet.cssText+=t:e.textContent+=t,e}function A(){var t=document.createElement("style");return t.setAttribute("type","text/css"),t}b.exports=w;b.exports.insertCss=w;const H=h({__name:"order",setup(t){return(n,r)=>(y(),z(D,{size:"small","disabled-btn":""}))}}),K=x(H,[["__file","/Users/heal/orion-design/orion-dba/frontend/src/views/record/order.vue"]]),j=h({__name:"query",setup(t){return(n,r)=>(y(),z(I,{"is-record":"",size:"small"}))}}),V=x(j,[["__file","/Users/heal/orion-design/orion-dba/frontend/src/views/record/query.vue"]]),Q=v("div",{id:"app-container"},[v("div",{id:"g2-customize-tooltip"}),v("div",{id:"g2-container"})],-1),Y=h({__name:"record",setup(t){const{t:n}=O(),r={title:n("record.title"),subTitle:""},a=k("order");b.exports(`
#app-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

#g2-container {
  flex: auto;
}

#g2-customize-tooltip {
  margin-bottom: 16px;
  font-size: 12px;
}


#g2-customize-tooltip .tooltip-title {
  
}

#g2-customize-tooltip .tooltip-items {
  display: flex;
  flex-direction: row;
}

#g2-customize-tooltip .tooltip-item {
  flex-basis: 240px;
  padding-left: 8px;
  margin-right: 12px;
}

#g2-customize-tooltip .tooltip-item .tooltip-item-value {
  font-size: 16px;
  font-weight: bold;
}



#g2-customize-tooltip .tooltip-item-info {
  display: flex;
  justify-content: space-between;
}

#g2-customize-tooltip .tooltip-item-info .info-item {
  display: flex;
}

#g2-customize-tooltip .tooltip-item-info .info-item .info-item-name {
  opacity: 0.65;
}

#g2-customize-tooltip .tooltip-item-info .info-item .info-item-value {
  margin-left: 8px;
}
`);const s=(e,m)=>{const o=new U({container:"g2-container",autoFit:!0,height:300});o.data(m),o.scale({count:{nice:!0},type:{formatter:i=>{if(i==="0")return"DDL";if(i==="1")return"DML"}}}),o.tooltip({showCrosshairs:!0,shared:!0}),o.axis("count",{label:{formatter:i=>i+" /per"},grid:{line:{style:{opacity:0}}}}),o.line().position("time*count").color("type").shape("smooth"),o.point().position("time*count").color("type").shape("circle");const u=document.getElementById("g2-customize-tooltip");function f(i){const{title:c,items:$}=i;return`
                  <div class="tooltip-title">${c}</div>
                  <div class="tooltip-items">
                  ${$.map(g=>{const E=g.color,T=g.name,M=g.value;return`
                        <div class="tooltip-item" style="border-left: 2px solid ${E}">
                        <div class="tooltip-item-name">${T}</div>
                        <div class="tooltip-item-value">${M} /per</div>
                       
                        </div>
        `}).join("")}
    </div>
  `}o.on("afterrender",()=>{const c={title:"0000-00-00",items:[{color:"#5B8FF9",name:"DML",value:"0"}]};u.innerHTML=f(c)}),o.on("tooltip:change",i=>{u.innerHTML=f(i.data)}),o.render()};return F(async()=>{const{data:e}=await N();s("container",e.payload)}),(e,m)=>{const o=_("a-tab-pane"),u=_("a-tabs"),f=_("a-page-header"),i=_("a-back-top");return y(),S(q,null,[l(f,{title:r.title,ghost:!1,"sub-title":r.subTitle},{footer:p(()=>[l(u,{activeKey:a.value,"onUpdate:activeKey":m[0]||(m[0]=c=>a.value=c),size:"small"},{default:p(()=>[l(o,{key:"order",tab:e.$t("common.order")},{default:p(()=>[l(K)]),_:1},8,["tab"]),l(o,{key:"query",tab:e.$t("common.query")},{default:p(()=>[l(V)]),_:1},8,["tab"])]),_:1},8,["activeKey"])]),default:p(()=>[Q]),_:1},8,["title","sub-title"]),l(i)],64)}}}),Z=x(Y,[["__file","/Users/heal/orion-design/orion-dba/frontend/src/views/record/record.vue"]]);export{Z as default};
//# sourceMappingURL=record.aa3f5835.js.map
