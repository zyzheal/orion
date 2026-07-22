var R=Object.defineProperty;var $=(a,t)=>R(a,"name",{value:t,configurable:!0});import{_ as l,s as F,g as I,t as _,q as E,a as D,b as G,K as z,z as P,F as C,G as w,H,l as V,a2 as W}from"./index-CWZ_FNac.js";import{p as B}from"./chunk-4BX2VUAB-CdboTfkF.js";import{p as j}from"./treemap-KMMF4GRG-Dcv9duw5.js";var x={showLegend:!0,ticks:5,max:null,min:0,graticule:"circle"},b={axes:[],curves:[],options:x},h=structuredClone(b),q=H.radar,K=l(()=>C({...q,...w().radar}),"getConfig"),M=l(()=>h.axes,"getAxes"),N=l(()=>h.curves,"getCurves"),U=l(()=>h.options,"getOptions"),X=l(a=>{h.axes=a.map(t=>({name:t.name,label:t.label??t.name}))},"setAxes"),Y=l(a=>{h.curves=a.map(t=>({name:t.name,label:t.label??t.name,entries:Z(t.entries)}))},"setCurves"),Z=l(a=>{if(a[0].axis==null)return a.map(e=>e.value);const t=M();if(t.length===0)throw new Error("Axes must be populated before curves for reference entries");return t.map(e=>{const r=a.find(s=>s.axis?.$refText===e.name);if(r===void 0)throw new Error("Missing entry for axis "+e.label);return r.value})},"computeCurveEntries"),J=l(a=>{const t=a.reduce((e,r)=>(e[r.name]=r,e),{});h.options={showLegend:t.showLegend?.value??x.showLegend,ticks:t.ticks?.value??x.ticks,max:t.max?.value??x.max,min:t.min?.value??x.min,graticule:t.graticule?.value??x.graticule}},"setOptions"),Q=l(()=>{P(),h=structuredClone(b)},"clear"),f={getAxes:M,getCurves:N,getOptions:U,setAxes:X,setCurves:Y,setOptions:J,getConfig:K,clear:Q,setAccTitle:G,getAccTitle:D,setDiagramTitle:E,getDiagramTitle:_,getAccDescription:I,setAccDescription:F},tt=l(a=>{B(a,f);const{axes:t,curves:e,options:r}=a;f.setAxes(t),f.setCurves(e),f.setOptions(r)},"populate"),et={parse:l(async a=>{const t=await j("radar",a);V.debug(t),tt(t)},"parse")},at=l((a,t,e,r)=>{const s=r.db,o=s.getAxes(),i=s.getCurves(),n=s.getOptions(),c=s.getConfig(),d=s.getDiagramTitle(),p=z(t),u=rt(p,c),g=n.max??Math.max(...i.map(y=>Math.max(...y.entries))),m=n.min,v=Math.min(c.width,c.height)/2;st(u,o,v,n.ticks,n.graticule),nt(u,o,v,c),A(u,o,i,m,g,n.graticule,c),O(u,i,n.showLegend,c),u.append("text").attr("class","radarTitle").text(d).attr("x",0).attr("y",-c.height/2-c.marginTop)},"draw"),rt=l((a,t)=>{const e=t.width+t.marginLeft+t.marginRight,r=t.height+t.marginTop+t.marginBottom,s={x:t.marginLeft+t.width/2,y:t.marginTop+t.height/2};return a.attr("viewbox",`0 0 ${e} ${r}`).attr("width",e).attr("height",r),a.append("g").attr("transform",`translate(${s.x}, ${s.y})`)},"drawFrame"),st=l((a,t,e,r,s)=>{if(s==="circle")for(let o=0;o<r;o++){const i=e*(o+1)/r;a.append("circle").attr("r",i).attr("class","radarGraticule")}else if(s==="polygon"){const o=t.length;for(let i=0;i<r;i++){const n=e*(i+1)/r,c=t.map((d,p)=>{const u=2*p*Math.PI/o-Math.PI/2,g=n*Math.cos(u),m=n*Math.sin(u);return`${g},${m}`}).join(" ");a.append("polygon").attr("points",c).attr("class","radarGraticule")}}},"drawGraticule"),nt=l((a,t,e,r)=>{const s=t.length;for(let o=0;o<s;o++){const i=t[o].label,n=2*o*Math.PI/s-Math.PI/2;a.append("line").attr("x1",0).attr("y1",0).attr("x2",e*r.axisScaleFactor*Math.cos(n)).attr("y2",e*r.axisScaleFactor*Math.sin(n)).attr("class","radarAxisLine"),a.append("text").text(i).attr("x",e*r.axisLabelFactor*Math.cos(n)).attr("y",e*r.axisLabelFactor*Math.sin(n)).attr("class","radarAxisLabel")}},"drawAxes");function A(a,t,e,r,s,o,i){const n=t.length,c=Math.min(i.width,i.height)/2;e.forEach((d,p)=>{if(d.entries.length!==n)return;const u=d.entries.map((g,m)=>{const v=2*Math.PI*m/n-Math.PI/2,y=L(g,r,s,c),S=y*Math.cos(v),k=y*Math.sin(v);return{x:S,y:k}});o==="circle"?a.append("path").attr("d",T(u,i.curveTension)).attr("class",`radarCurve-${p}`):o==="polygon"&&a.append("polygon").attr("points",u.map(g=>`${g.x},${g.y}`).join(" ")).attr("class",`radarCurve-${p}`)})}$(A,"drawCurves");l(A,"drawCurves");function L(a,t,e,r){const s=Math.min(Math.max(a,t),e);return r*(s-t)/(e-t)}$(L,"relativeRadius");l(L,"relativeRadius");function T(a,t){const e=a.length;let r=`M${a[0].x},${a[0].y}`;for(let s=0;s<e;s++){const o=a[(s-1+e)%e],i=a[s],n=a[(s+1)%e],c=a[(s+2)%e],d={x:i.x+(n.x-o.x)*t,y:i.y+(n.y-o.y)*t},p={x:n.x-(c.x-i.x)*t,y:n.y-(c.y-i.y)*t};r+=` C${d.x},${d.y} ${p.x},${p.y} ${n.x},${n.y}`}return`${r} Z`}$(T,"closedRoundCurve");l(T,"closedRoundCurve");function O(a,t,e,r){if(!e)return;const s=(r.width/2+r.marginRight)*3/4,o=-(r.height/2+r.marginTop)*3/4,i=20;t.forEach((n,c)=>{const d=a.append("g").attr("transform",`translate(${s}, ${o+c*i})`);d.append("rect").attr("width",12).attr("height",12).attr("class",`radarLegendBox-${c}`),d.append("text").attr("x",16).attr("y",0).attr("class","radarLegendText").text(n.label)})}$(O,"drawLegend");l(O,"drawLegend");var ot={draw:at},it=l((a,t)=>{let e="";for(let r=0;r<a.THEME_COLOR_LIMIT;r++){const s=a[`cScale${r}`];e+=`
		.radarCurve-${r} {
			color: ${s};
			fill: ${s};
			fill-opacity: ${t.curveOpacity};
			stroke: ${s};
			stroke-width: ${t.curveStrokeWidth};
		}
		.radarLegendBox-${r} {
			fill: ${s};
			fill-opacity: ${t.curveOpacity};
			stroke: ${s};
		}
		`}return e},"genIndexStyles"),lt=l(a=>{const t=W(),e=w(),r=C(t,e.themeVariables),s=C(r.radar,a);return{themeVariables:r,radarOptions:s}},"buildRadarStyleOptions"),ct=l(({radar:a}={})=>{const{themeVariables:t,radarOptions:e}=lt(a);return`
	.radarTitle {
		font-size: ${t.fontSize};
		color: ${t.titleColor};
		dominant-baseline: hanging;
		text-anchor: middle;
	}
	.radarAxisLine {
		stroke: ${e.axisColor};
		stroke-width: ${e.axisStrokeWidth};
	}
	.radarAxisLabel {
		dominant-baseline: middle;
		text-anchor: middle;
		font-size: ${e.axisLabelFontSize}px;
		color: ${e.axisColor};
	}
	.radarGraticule {
		fill: ${e.graticuleColor};
		fill-opacity: ${e.graticuleOpacity};
		stroke: ${e.graticuleColor};
		stroke-width: ${e.graticuleStrokeWidth};
	}
	.radarLegendText {
		text-anchor: start;
		font-size: ${e.legendFontSize}px;
		dominant-baseline: hanging;
	}
	${it(t,e)}
	`},"styles"),ht={parser:et,db:f,renderer:ot,styles:ct};export{ht as diagram};
//# sourceMappingURL=diagram-QEK2KX5R-C0o4-ImX.js.map
