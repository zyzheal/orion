var F=Object.defineProperty;var p=(e,l)=>F(e,"name",{value:l,configurable:!0});import{G as K}from"./graph-Bq1BFXFX.js";import{aK as z,aL as U,aM as j,aN as H,B as J,d as $,aw as E}from"./index-CWZ_FNac.js";import{l as y,g as T,u as W,I as X,J as B,K as N,G as q,i as M,q as Q}from"./index-CAEX9gTM.js";import{r as Y}from"./index-3862675e-H-HFZrYs.js";import{v as Z}from"./__federation_expose_Index-Blki2IV6.js";import{c as O}from"./channel-BhV_tf7C.js";function ee(e){return typeof e=="string"?new z([document.querySelectorAll(e)],[document.documentElement]):new z([j(e)],U)}p(ee,"selectAll");function he(e,l){return!!e.children(l).length}p(he,"isSubgraph");function ge(e){return A(e.v)+":"+A(e.w)+":"+A(e.name)}p(ge,"edgeToId");var te=/:/g;function A(e){return e?String(e).replace(te,"\\:"):""}p(A,"escapeId");function re(e,l){l&&e.attr("style",l)}p(re,"applyStyle");function ye(e,l,c){l&&e.attr("class",l).attr("class",c+" "+e.attr("class"))}p(ye,"applyClass");function ke(e,l){var c=l.graph();if(H(c)){var a=c.transition;if(Z(a))return a(e)}return e}p(ke,"applyTransition");function le(e,l){var c=e.append("foreignObject").attr("width","100000"),a=c.append("xhtml:div");a.attr("xmlns","http://www.w3.org/1999/xhtml");var i=l.label;switch(typeof i){case"function":a.insert(i);break;case"object":a.insert(function(){return i});break;default:a.html(i)}re(a,l.labelStyle),a.style("display","inline-block"),a.style("white-space","nowrap");var d=a.node().getBoundingClientRect();return c.attr("width",d.width).attr("height",d.height),c}p(le,"addHtmlLabel");const P={},ae=p(function(e){const l=Object.keys(e);for(const c of l)P[c]=e[c]},"setConf"),V=p(async function(e,l,c,a,i,d){const w=a.select(`[id="${c}"]`),n=Object.keys(e);for(const b of n){const r=e[b];let k="default";r.classes.length>0&&(k=r.classes.join(" ")),k=k+" flowchart-label";const h=B(r.styles);let t=r.text!==void 0?r.text:r.id,s;if(y.info("vertex",r,r.labelType),r.labelType==="markdown")y.info("vertex",r,r.labelType);else if(Q(T().flowchart.htmlLabels))s=le(w,{label:t}).node(),s.parentNode.removeChild(s);else{const x=i.createElementNS("http://www.w3.org/2000/svg","text");x.setAttribute("style",h.labelStyle.replace("color:","fill:"));const C=t.split(M.lineBreakRegex);for(const L of C){const S=i.createElementNS("http://www.w3.org/2000/svg","tspan");S.setAttributeNS("http://www.w3.org/XML/1998/namespace","xml:space","preserve"),S.setAttribute("dy","1em"),S.setAttribute("x","1"),S.textContent=L,x.appendChild(S)}s=x}let f=0,o="";switch(r.type){case"round":f=5,o="rect";break;case"square":o="rect";break;case"diamond":o="question";break;case"hexagon":o="hexagon";break;case"odd":o="rect_left_inv_arrow";break;case"lean_right":o="lean_right";break;case"lean_left":o="lean_left";break;case"trapezoid":o="trapezoid";break;case"inv_trapezoid":o="inv_trapezoid";break;case"odd_right":o="rect_left_inv_arrow";break;case"circle":o="circle";break;case"ellipse":o="ellipse";break;case"stadium":o="stadium";break;case"subroutine":o="subroutine";break;case"cylinder":o="cylinder";break;case"group":o="rect";break;case"doublecircle":o="doublecircle";break;default:o="rect"}const _=await q(t,T());l.setNode(r.id,{labelStyle:h.labelStyle,shape:o,labelText:_,labelType:r.labelType,rx:f,ry:f,class:k,style:h.style,id:r.id,link:r.link,linkTarget:r.linkTarget,tooltip:d.db.getTooltip(r.id)||"",domId:d.db.lookUpDomId(r.id),haveCallback:r.haveCallback,width:r.type==="group"?500:void 0,dir:r.dir,type:r.type,props:r.props,padding:T().flowchart.padding}),y.info("setNode",{labelStyle:h.labelStyle,labelType:r.labelType,shape:o,labelText:_,rx:f,ry:f,class:k,style:h.style,id:r.id,domId:d.db.lookUpDomId(r.id),width:r.type==="group"?500:void 0,type:r.type,dir:r.dir,props:r.props,padding:T().flowchart.padding})}},"addVertices"),R=p(async function(e,l,c){y.info("abc78 edges = ",e);let a=0,i={},d,w;if(e.defaultStyle!==void 0){const n=B(e.defaultStyle);d=n.style,w=n.labelStyle}for(const n of e){a++;const b="L-"+n.start+"-"+n.end;i[b]===void 0?(i[b]=0,y.info("abc78 new entry",b,i[b])):(i[b]++,y.info("abc78 new entry",b,i[b]));let r=b+"-"+i[b];y.info("abc78 new link id to be used is",b,r,i[b]);const k="LS-"+n.start,h="LE-"+n.end,t={style:"",labelStyle:""};switch(t.minlen=n.length||1,n.type==="arrow_open"?t.arrowhead="none":t.arrowhead="normal",t.arrowTypeStart="arrow_open",t.arrowTypeEnd="arrow_open",n.type){case"double_arrow_cross":t.arrowTypeStart="arrow_cross";case"arrow_cross":t.arrowTypeEnd="arrow_cross";break;case"double_arrow_point":t.arrowTypeStart="arrow_point";case"arrow_point":t.arrowTypeEnd="arrow_point";break;case"double_arrow_circle":t.arrowTypeStart="arrow_circle";case"arrow_circle":t.arrowTypeEnd="arrow_circle";break}let s="",f="";switch(n.stroke){case"normal":s="fill:none;",d!==void 0&&(s=d),w!==void 0&&(f=w),t.thickness="normal",t.pattern="solid";break;case"dotted":t.thickness="normal",t.pattern="dotted",t.style="fill:none;stroke-width:2px;stroke-dasharray:3;";break;case"thick":t.thickness="thick",t.pattern="solid",t.style="stroke-width: 3.5px;fill:none;";break;case"invisible":t.thickness="invisible",t.pattern="solid",t.style="stroke-width: 0;fill:none;";break}if(n.style!==void 0){const o=B(n.style);s=o.style,f=o.labelStyle}t.style=t.style+=s,t.labelStyle=t.labelStyle+=f,n.interpolate!==void 0?t.curve=N(n.interpolate,E):e.defaultInterpolate!==void 0?t.curve=N(e.defaultInterpolate,E):t.curve=N(P.curve,E),n.text===void 0?n.style!==void 0&&(t.arrowheadStyle="fill: #333"):(t.arrowheadStyle="fill: #333",t.labelpos="c"),t.labelType=n.labelType,t.label=await q(n.text.replace(M.lineBreakRegex,`
`),T()),n.style===void 0&&(t.style=t.style||"stroke: #333; stroke-width: 1.5px;fill:none;"),t.labelStyle=t.labelStyle.replace("color:","fill:"),t.id=r,t.classes="flowchart-link "+k+" "+h,l.setEdge(n.start,n.end,t,a)}},"addEdges"),oe=p(function(e,l){return l.db.getClasses()},"getClasses"),ne=p(async function(e,l,c,a){y.info("Drawing flowchart");let i=a.db.getDirection();i===void 0&&(i="TD");const{securityLevel:d,flowchart:w}=T(),n=w.nodeSpacing||50,b=w.rankSpacing||50;let r;d==="sandbox"&&(r=$("#i"+l));const k=d==="sandbox"?$(r.nodes()[0].contentDocument.body):$("body"),h=d==="sandbox"?r.nodes()[0].contentDocument:document,t=new K({multigraph:!0,compound:!0}).setGraph({rankdir:i,nodesep:n,ranksep:b,marginx:0,marginy:0}).setDefaultEdgeLabel(function(){return{}});let s;const f=a.db.getSubGraphs();y.info("Subgraphs - ",f);for(let u=f.length-1;u>=0;u--)s=f[u],y.info("Subgraph - ",s),a.db.addVertex(s.id,{text:s.title,type:s.labelType},"group",void 0,s.classes,s.dir);const o=a.db.getVertices(),_=a.db.getEdges();y.info("Edges",_);let x=0;for(x=f.length-1;x>=0;x--){s=f[x],ee("cluster").append("text");for(let u=0;u<s.nodes.length;u++)y.info("Setting up subgraphs",s.nodes[u],s.id),t.setParent(s.nodes[u],s.id)}await V(o,t,l,k,h,a),await R(_,t);const C=k.select(`[id="${l}"]`),L=k.select("#"+l+" g");if(await Y(L,t,["point","circle","cross"],"flowchart",l),W.insertTitle(C,"flowchartTitleText",w.titleTopMargin,a.db.getDiagramTitle()),X(t,C,w.diagramPadding,w.useMaxWidth),a.db.indexNodes("subGraph"+x),!w.htmlLabels){const u=h.querySelectorAll('[id="'+l+'"] .edgeLabel .label');for(const m of u){const v=m.getBBox(),g=h.createElementNS("http://www.w3.org/2000/svg","rect");g.setAttribute("rx",0),g.setAttribute("ry",0),g.setAttribute("width",v.width),g.setAttribute("height",v.height),m.insertBefore(g,m.firstChild)}}Object.keys(o).forEach(function(u){const m=o[u];if(m.link){const v=$("#"+l+' [id="'+u+'"]');if(v){const g=h.createElementNS("http://www.w3.org/2000/svg","a");g.setAttributeNS("http://www.w3.org/2000/svg","class",m.classes.join(" ")),g.setAttributeNS("http://www.w3.org/2000/svg","href",m.link),g.setAttributeNS("http://www.w3.org/2000/svg","rel","noopener"),d==="sandbox"?g.setAttributeNS("http://www.w3.org/2000/svg","target","_top"):m.linkTarget&&g.setAttributeNS("http://www.w3.org/2000/svg","target",m.linkTarget);const I=v.insert(function(){return g},":first-child"),D=v.select(".label-container");D&&I.append(function(){return D.node()});const G=v.select(".label");G&&I.append(function(){return G.node()})}}})},"draw"),xe={setConf:ae,addVertices:V,addEdges:R,getClasses:oe,draw:ne},se=p((e,l)=>{const c=O,a=c(e,"r"),i=c(e,"g"),d=c(e,"b");return J(a,i,d,l)},"fade"),ie=p(e=>`.label {
    font-family: ${e.fontFamily};
    color: ${e.nodeTextColor||e.textColor};
  }
  .cluster-label text {
    fill: ${e.titleColor};
  }
  .cluster-label span,p {
    color: ${e.titleColor};
  }

  .label text,span,p {
    fill: ${e.nodeTextColor||e.textColor};
    color: ${e.nodeTextColor||e.textColor};
  }

  .node rect,
  .node circle,
  .node ellipse,
  .node polygon,
  .node path {
    fill: ${e.mainBkg};
    stroke: ${e.nodeBorder};
    stroke-width: 1px;
  }
  .flowchart-label text {
    text-anchor: middle;
  }
  // .flowchart-label .text-outer-tspan {
  //   text-anchor: middle;
  // }
  // .flowchart-label .text-inner-tspan {
  //   text-anchor: start;
  // }

  .node .katex path {
    fill: #000;
    stroke: #000;
    stroke-width: 1px;
  }

  .node .label {
    text-align: center;
  }
  .node.clickable {
    cursor: pointer;
  }

  .arrowheadPath {
    fill: ${e.arrowheadColor};
  }

  .edgePath .path {
    stroke: ${e.lineColor};
    stroke-width: 2.0px;
  }

  .flowchart-link {
    stroke: ${e.lineColor};
    fill: none;
  }

  .edgeLabel {
    background-color: ${e.edgeLabelBackground};
    rect {
      opacity: 0.5;
      background-color: ${e.edgeLabelBackground};
      fill: ${e.edgeLabelBackground};
    }
    text-align: center;
  }

  /* For html labels only */
  .labelBkg {
    background-color: ${se(e.edgeLabelBackground,.5)};
    // background-color: 
  }

  .cluster rect {
    fill: ${e.clusterBkg};
    stroke: ${e.clusterBorder};
    stroke-width: 1px;
  }

  .cluster text {
    fill: ${e.titleColor};
  }

  .cluster span,p {
    color: ${e.titleColor};
  }
  /* .cluster div {
    color: ${e.titleColor};
  } */

  div.mermaidTooltip {
    position: absolute;
    text-align: center;
    max-width: 200px;
    padding: 2px;
    font-family: ${e.fontFamily};
    font-size: 12px;
    background: ${e.tertiaryColor};
    border: 1px solid ${e.border2};
    border-radius: 2px;
    pointer-events: none;
    z-index: 100;
  }

  .flowchartTitleText {
    text-anchor: middle;
    font-size: 18px;
    fill: ${e.textColor};
  }
`,"getStyles"),me=ie;export{xe as a,re as b,le as c,ke as d,ge as e,me as f,ye as g,he as i,ee as s};
//# sourceMappingURL=styles-c10674c1-DQdGt9B2.js.map
