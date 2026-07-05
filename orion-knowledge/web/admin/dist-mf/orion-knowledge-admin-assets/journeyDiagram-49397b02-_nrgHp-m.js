var ft=Object.defineProperty;var i=(t,e)=>ft(t,"name",{value:e,configurable:!0});import{a as dt,s as pt,b as gt,c as mt,m as xt,n as kt,g as A,d as _t,p as bt}from"./index-CAEX9gTM.js";import{d as W}from"./index-CWZ_FNac.js";import{a as vt,g as rt,f as wt,d as $t}from"./svgDrawCommon-08f97a94-BWk3AaBC.js";import"./__federation_expose_Index-Blki2IV6.js";import"./percentages-BXMCSKIN--8I_CNJ0.js";import{a as D}from"./arc-DFfw3kBy.js";var G=(function(){var t=i(function(g,s,a,o){for(a=a||{},o=g.length;o--;a[g[o]]=s);return a},"o"),e=[6,8,10,11,12,14,16,17,18],r=[1,9],c=[1,10],n=[1,11],u=[1,12],h=[1,13],d=[1,14],f={trace:i(function(){},"trace"),yy:{},symbols_:{error:2,start:3,journey:4,document:5,EOF:6,line:7,SPACE:8,statement:9,NEWLINE:10,title:11,acc_title:12,acc_title_value:13,acc_descr:14,acc_descr_value:15,acc_descr_multiline_value:16,section:17,taskName:18,taskData:19,$accept:0,$end:1},terminals_:{2:"error",4:"journey",6:"EOF",8:"SPACE",10:"NEWLINE",11:"title",12:"acc_title",13:"acc_title_value",14:"acc_descr",15:"acc_descr_value",16:"acc_descr_multiline_value",17:"section",18:"taskName",19:"taskData"},productions_:[0,[3,3],[5,0],[5,2],[7,2],[7,1],[7,1],[7,1],[9,1],[9,2],[9,2],[9,1],[9,1],[9,2]],performAction:i(function(s,a,o,y,p,l,$){var _=l.length-1;switch(p){case 1:return l[_-1];case 2:this.$=[];break;case 3:l[_-1].push(l[_]),this.$=l[_-1];break;case 4:case 5:this.$=l[_];break;case 6:case 7:this.$=[];break;case 8:y.setDiagramTitle(l[_].substr(6)),this.$=l[_].substr(6);break;case 9:this.$=l[_].trim(),y.setAccTitle(this.$);break;case 10:case 11:this.$=l[_].trim(),y.setAccDescription(this.$);break;case 12:y.addSection(l[_].substr(8)),this.$=l[_].substr(8);break;case 13:y.addTask(l[_-1],l[_]),this.$="task";break}},"anonymous"),table:[{3:1,4:[1,2]},{1:[3]},t(e,[2,2],{5:3}),{6:[1,4],7:5,8:[1,6],9:7,10:[1,8],11:r,12:c,14:n,16:u,17:h,18:d},t(e,[2,7],{1:[2,1]}),t(e,[2,3]),{9:15,11:r,12:c,14:n,16:u,17:h,18:d},t(e,[2,5]),t(e,[2,6]),t(e,[2,8]),{13:[1,16]},{15:[1,17]},t(e,[2,11]),t(e,[2,12]),{19:[1,18]},t(e,[2,4]),t(e,[2,9]),t(e,[2,10]),t(e,[2,13])],defaultActions:{},parseError:i(function(s,a){if(a.recoverable)this.trace(s);else{var o=new Error(s);throw o.hash=a,o}},"parseError"),parse:i(function(s){var a=this,o=[0],y=[],p=[null],l=[],$=this.table,_="",N=0,J=0,ct=2,K=1,ht=l.slice.call(arguments,1),k=Object.create(this.lexer),E={yy:{}};for(var Y in this.yy)Object.prototype.hasOwnProperty.call(this.yy,Y)&&(E.yy[Y]=this.yy[Y]);k.setInput(s,E.yy),E.yy.lexer=k,E.yy.parser=this,typeof k.yylloc>"u"&&(k.yylloc={});var O=k.yylloc;l.push(O);var ut=k.options&&k.options.ranges;typeof E.yy.parseError=="function"?this.parseError=E.yy.parseError:this.parseError=Object.getPrototypeOf(this).parseError;function yt(){var M;return M=y.pop()||k.lex()||K,typeof M!="number"&&(M instanceof Array&&(y=M,M=y.pop()),M=a.symbols_[M]||M),M}i(yt,"lex");for(var b,P,v,q,C={},B,T,Q,j;;){if(P=o[o.length-1],this.defaultActions[P]?v=this.defaultActions[P]:((b===null||typeof b>"u")&&(b=yt()),v=$[P]&&$[P][b]),typeof v>"u"||!v.length||!v[0]){var H="";j=[];for(B in $[P])this.terminals_[B]&&B>ct&&j.push("'"+this.terminals_[B]+"'");k.showPosition?H="Parse error on line "+(N+1)+`:
`+k.showPosition()+`
Expecting `+j.join(", ")+", got '"+(this.terminals_[b]||b)+"'":H="Parse error on line "+(N+1)+": Unexpected "+(b==K?"end of input":"'"+(this.terminals_[b]||b)+"'"),this.parseError(H,{text:k.match,token:this.terminals_[b]||b,line:k.yylineno,loc:O,expected:j})}if(v[0]instanceof Array&&v.length>1)throw new Error("Parse Error: multiple actions possible at state: "+P+", token: "+b);switch(v[0]){case 1:o.push(b),p.push(k.yytext),l.push(k.yylloc),o.push(v[1]),b=null,J=k.yyleng,_=k.yytext,N=k.yylineno,O=k.yylloc;break;case 2:if(T=this.productions_[v[1]][1],C.$=p[p.length-T],C._$={first_line:l[l.length-(T||1)].first_line,last_line:l[l.length-1].last_line,first_column:l[l.length-(T||1)].first_column,last_column:l[l.length-1].last_column},ut&&(C._$.range=[l[l.length-(T||1)].range[0],l[l.length-1].range[1]]),q=this.performAction.apply(C,[_,J,N,E.yy,v[1],p,l].concat(ht)),typeof q<"u")return q;T&&(o=o.slice(0,-1*T*2),p=p.slice(0,-1*T),l=l.slice(0,-1*T)),o.push(this.productions_[v[1]][0]),p.push(C.$),l.push(C._$),Q=$[o[o.length-2]][o[o.length-1]],o.push(Q);break;case 3:return!0}}return!0},"parse")},x=(function(){var g={EOF:1,parseError:i(function(a,o){if(this.yy.parser)this.yy.parser.parseError(a,o);else throw new Error(a)},"parseError"),setInput:i(function(s,a){return this.yy=a||this.yy||{},this._input=s,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},"setInput"),input:i(function(){var s=this._input[0];this.yytext+=s,this.yyleng++,this.offset++,this.match+=s,this.matched+=s;var a=s.match(/(?:\r\n?|\n).*/g);return a?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),s},"input"),unput:i(function(s){var a=s.length,o=s.split(/(?:\r\n?|\n)/g);this._input=s+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-a),this.offset-=a;var y=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),o.length-1&&(this.yylineno-=o.length-1);var p=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:o?(o.length===y.length?this.yylloc.first_column:0)+y[y.length-o.length].length-o[0].length:this.yylloc.first_column-a},this.options.ranges&&(this.yylloc.range=[p[0],p[0]+this.yyleng-a]),this.yyleng=this.yytext.length,this},"unput"),more:i(function(){return this._more=!0,this},"more"),reject:i(function(){if(this.options.backtrack_lexer)this._backtrack=!0;else return this.parseError("Lexical error on line "+(this.yylineno+1)+`. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
`+this.showPosition(),{text:"",token:null,line:this.yylineno});return this},"reject"),less:i(function(s){this.unput(this.match.slice(s))},"less"),pastInput:i(function(){var s=this.matched.substr(0,this.matched.length-this.match.length);return(s.length>20?"...":"")+s.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:i(function(){var s=this.match;return s.length<20&&(s+=this._input.substr(0,20-s.length)),(s.substr(0,20)+(s.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:i(function(){var s=this.pastInput(),a=new Array(s.length+1).join("-");return s+this.upcomingInput()+`
`+a+"^"},"showPosition"),test_match:i(function(s,a){var o,y,p;if(this.options.backtrack_lexer&&(p={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges&&(p.yylloc.range=this.yylloc.range.slice(0))),y=s[0].match(/(?:\r\n?|\n).*/g),y&&(this.yylineno+=y.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:y?y[y.length-1].length-y[y.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+s[0].length},this.yytext+=s[0],this.match+=s[0],this.matches=s,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._backtrack=!1,this._input=this._input.slice(s[0].length),this.matched+=s[0],o=this.performAction.call(this,this.yy,this,a,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),o)return o;if(this._backtrack){for(var l in p)this[l]=p[l];return!1}return!1},"test_match"),next:i(function(){if(this.done)return this.EOF;this._input||(this.done=!0);var s,a,o,y;this._more||(this.yytext="",this.match="");for(var p=this._currentRules(),l=0;l<p.length;l++)if(o=this._input.match(this.rules[p[l]]),o&&(!a||o[0].length>a[0].length)){if(a=o,y=l,this.options.backtrack_lexer){if(s=this.test_match(o,p[l]),s!==!1)return s;if(this._backtrack){a=!1;continue}else return!1}else if(!this.options.flex)break}return a?(s=this.test_match(a,p[y]),s!==!1?s:!1):this._input===""?this.EOF:this.parseError("Lexical error on line "+(this.yylineno+1)+`. Unrecognized text.
`+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:i(function(){var a=this.next();return a||this.lex()},"lex"),begin:i(function(a){this.conditionStack.push(a)},"begin"),popState:i(function(){var a=this.conditionStack.length-1;return a>0?this.conditionStack.pop():this.conditionStack[0]},"popState"),_currentRules:i(function(){return this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1]?this.conditions[this.conditionStack[this.conditionStack.length-1]].rules:this.conditions.INITIAL.rules},"_currentRules"),topState:i(function(a){return a=this.conditionStack.length-1-Math.abs(a||0),a>=0?this.conditionStack[a]:"INITIAL"},"topState"),pushState:i(function(a){this.begin(a)},"pushState"),stateStackSize:i(function(){return this.conditionStack.length},"stateStackSize"),options:{"case-insensitive":!0},performAction:i(function(a,o,y,p){switch(y){case 0:break;case 1:break;case 2:return 10;case 3:break;case 4:break;case 5:return 4;case 6:return 11;case 7:return this.begin("acc_title"),12;case 8:return this.popState(),"acc_title_value";case 9:return this.begin("acc_descr"),14;case 10:return this.popState(),"acc_descr_value";case 11:this.begin("acc_descr_multiline");break;case 12:this.popState();break;case 13:return"acc_descr_multiline_value";case 14:return 17;case 15:return 18;case 16:return 19;case 17:return":";case 18:return 6;case 19:return"INVALID"}},"anonymous"),rules:[/^(?:%(?!\{)[^\n]*)/i,/^(?:[^\}]%%[^\n]*)/i,/^(?:[\n]+)/i,/^(?:\s+)/i,/^(?:#[^\n]*)/i,/^(?:journey\b)/i,/^(?:title\s[^#\n;]+)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:section\s[^#:\n;]+)/i,/^(?:[^#:\n;]+)/i,/^(?::[^#\n;]+)/i,/^(?::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{acc_descr_multiline:{rules:[12,13],inclusive:!1},acc_descr:{rules:[10],inclusive:!1},acc_title:{rules:[8],inclusive:!1},INITIAL:{rules:[0,1,2,3,4,5,6,7,9,11,14,15,16,17,18,19],inclusive:!0}}};return g})();f.lexer=x;function m(){this.yy={}}return i(m,"Parser"),m.prototype=f,f.Parser=m,new m})();G.parser=G;const Tt=G;let V="";const U=[],F=[],L=[],Mt=i(function(){U.length=0,F.length=0,V="",L.length=0,bt()},"clear"),St=i(function(t){V=t,U.push(t)},"addSection"),Et=i(function(){return U},"getSections"),Pt=i(function(){let t=tt();const e=100;let r=0;for(;!t&&r<e;)t=tt(),r++;return F.push(...L),F},"getTasks"),It=i(function(){const t=[];return F.forEach(r=>{r.people&&t.push(...r.people)}),[...new Set(t)].sort()},"updateActors"),At=i(function(t,e){const r=e.substr(1).split(":");let c=0,n=[];r.length===1?(c=Number(r[0]),n=[]):(c=Number(r[0]),n=r[1].split(","));const u=n.map(d=>d.trim()),h={section:V,type:V,people:u,task:t,score:c};L.push(h)},"addTask"),Ct=i(function(t){const e={section:V,type:V,description:t,task:t,classes:[]};F.push(e)},"addTaskOrg"),tt=i(function(){const t=i(function(r){return L[r].processed},"compileTask");let e=!0;for(const[r,c]of L.entries())t(r),e=e&&c.processed;return e},"compileTasks"),Vt=i(function(){return It()},"getActors"),et={getConfig:i(()=>A().journey,"getConfig"),clear:Mt,setDiagramTitle:kt,getDiagramTitle:xt,setAccTitle:mt,getAccTitle:gt,setAccDescription:pt,getAccDescription:dt,addSection:St,getSections:Et,getTasks:Pt,addTask:At,addTaskOrg:Ct,getActors:Vt},Ft=i(t=>`.label {
    font-family: 'trebuchet ms', verdana, arial, sans-serif;
    font-family: var(--mermaid-font-family);
    color: ${t.textColor};
  }
  .mouth {
    stroke: #666;
  }

  line {
    stroke: ${t.textColor}
  }

  .legend {
    fill: ${t.textColor};
  }

  .label text {
    fill: #333;
  }
  .label {
    color: ${t.textColor}
  }

  .face {
    ${t.faceColor?`fill: ${t.faceColor}`:"fill: #FFF8DC"};
    stroke: #999;
  }

  .node rect,
  .node circle,
  .node ellipse,
  .node polygon,
  .node path {
    fill: ${t.mainBkg};
    stroke: ${t.nodeBorder};
    stroke-width: 1px;
  }

  .node .label {
    text-align: center;
  }
  .node.clickable {
    cursor: pointer;
  }

  .arrowheadPath {
    fill: ${t.arrowheadColor};
  }

  .edgePath .path {
    stroke: ${t.lineColor};
    stroke-width: 1.5px;
  }

  .flowchart-link {
    stroke: ${t.lineColor};
    fill: none;
  }

  .edgeLabel {
    background-color: ${t.edgeLabelBackground};
    rect {
      opacity: 0.5;
    }
    text-align: center;
  }

  .cluster rect {
  }

  .cluster text {
    fill: ${t.titleColor};
  }

  div.mermaidTooltip {
    position: absolute;
    text-align: center;
    max-width: 200px;
    padding: 2px;
    font-family: 'trebuchet ms', verdana, arial, sans-serif;
    font-family: var(--mermaid-font-family);
    font-size: 12px;
    background: ${t.tertiaryColor};
    border: 1px solid ${t.border2};
    border-radius: 2px;
    pointer-events: none;
    z-index: 100;
  }

  .task-type-0, .section-type-0  {
    ${t.fillType0?`fill: ${t.fillType0}`:""};
  }
  .task-type-1, .section-type-1  {
    ${t.fillType0?`fill: ${t.fillType1}`:""};
  }
  .task-type-2, .section-type-2  {
    ${t.fillType0?`fill: ${t.fillType2}`:""};
  }
  .task-type-3, .section-type-3  {
    ${t.fillType0?`fill: ${t.fillType3}`:""};
  }
  .task-type-4, .section-type-4  {
    ${t.fillType0?`fill: ${t.fillType4}`:""};
  }
  .task-type-5, .section-type-5  {
    ${t.fillType0?`fill: ${t.fillType5}`:""};
  }
  .task-type-6, .section-type-6  {
    ${t.fillType0?`fill: ${t.fillType6}`:""};
  }
  .task-type-7, .section-type-7  {
    ${t.fillType0?`fill: ${t.fillType7}`:""};
  }

  .actor-0 {
    ${t.actor0?`fill: ${t.actor0}`:""};
  }
  .actor-1 {
    ${t.actor1?`fill: ${t.actor1}`:""};
  }
  .actor-2 {
    ${t.actor2?`fill: ${t.actor2}`:""};
  }
  .actor-3 {
    ${t.actor3?`fill: ${t.actor3}`:""};
  }
  .actor-4 {
    ${t.actor4?`fill: ${t.actor4}`:""};
  }
  .actor-5 {
    ${t.actor5?`fill: ${t.actor5}`:""};
  }
`,"getStyles"),Lt=Ft,Z=i(function(t,e){return $t(t,e)},"drawRect"),Rt=i(function(t,e){const c=t.append("circle").attr("cx",e.cx).attr("cy",e.cy).attr("class","face").attr("r",15).attr("stroke-width",2).attr("overflow","visible"),n=t.append("g");n.append("circle").attr("cx",e.cx-15/3).attr("cy",e.cy-15/3).attr("r",1.5).attr("stroke-width",2).attr("fill","#666").attr("stroke","#666"),n.append("circle").attr("cx",e.cx+15/3).attr("cy",e.cy-15/3).attr("r",1.5).attr("stroke-width",2).attr("fill","#666").attr("stroke","#666");function u(f){const x=D().startAngle(Math.PI/2).endAngle(3*(Math.PI/2)).innerRadius(7.5).outerRadius(6.8181818181818175);f.append("path").attr("class","mouth").attr("d",x).attr("transform","translate("+e.cx+","+(e.cy+2)+")")}i(u,"smile");function h(f){const x=D().startAngle(3*Math.PI/2).endAngle(5*(Math.PI/2)).innerRadius(7.5).outerRadius(6.8181818181818175);f.append("path").attr("class","mouth").attr("d",x).attr("transform","translate("+e.cx+","+(e.cy+7)+")")}i(h,"sad");function d(f){f.append("line").attr("class","mouth").attr("stroke",2).attr("x1",e.cx-5).attr("y1",e.cy+7).attr("x2",e.cx+5).attr("y2",e.cy+7).attr("class","mouth").attr("stroke-width","1px").attr("stroke","#666")}return i(d,"ambivalent"),e.score>3?u(n):e.score<3?h(n):d(n),c},"drawFace"),at=i(function(t,e){const r=t.append("circle");return r.attr("cx",e.cx),r.attr("cy",e.cy),r.attr("class","actor-"+e.pos),r.attr("fill",e.fill),r.attr("stroke",e.stroke),r.attr("r",e.r),r.class!==void 0&&r.attr("class",r.class),e.title!==void 0&&r.append("title").text(e.title),r},"drawCircle"),ot=i(function(t,e){return wt(t,e)},"drawText"),Nt=i(function(t,e){function r(n,u,h,d,f){return n+","+u+" "+(n+h)+","+u+" "+(n+h)+","+(u+d-f)+" "+(n+h-f*1.2)+","+(u+d)+" "+n+","+(u+d)}i(r,"genPoints");const c=t.append("polygon");c.attr("points",r(e.x,e.y,50,20,7)),c.attr("class","labelBox"),e.y=e.y+e.labelMargin,e.x=e.x+.5*e.labelMargin,ot(t,e)},"drawLabel"),Bt=i(function(t,e,r){const c=t.append("g"),n=rt();n.x=e.x,n.y=e.y,n.fill=e.fill,n.width=r.width*e.taskCount+r.diagramMarginX*(e.taskCount-1),n.height=r.height,n.class="journey-section section-type-"+e.num,n.rx=3,n.ry=3,Z(c,n),lt(r)(e.text,c,n.x,n.y,n.width,n.height,{class:"journey-section section-type-"+e.num},r,e.colour)},"drawSection");let st=-1;const jt=i(function(t,e,r){const c=e.x+r.width/2,n=t.append("g");st++,n.append("line").attr("id","task"+st).attr("x1",c).attr("y1",e.y).attr("x2",c).attr("y2",450).attr("class","task-line").attr("stroke-width","1px").attr("stroke-dasharray","4 2").attr("stroke","#666"),Rt(n,{cx:c,cy:300+(5-e.score)*30,score:e.score});const h=rt();h.x=e.x,h.y=e.y,h.fill=e.fill,h.width=r.width,h.height=r.height,h.class="task task-type-"+e.num,h.rx=3,h.ry=3,Z(n,h);let d=e.x+14;e.people.forEach(f=>{const x=e.actors[f].color,m={cx:d,cy:e.y,r:7,fill:x,stroke:"#000",title:f,pos:e.actors[f].position};at(n,m),d+=10}),lt(r)(e.task,n,h.x,h.y,h.width,h.height,{class:"task"},r,e.colour)},"drawTask"),zt=i(function(t,e){vt(t,e)},"drawBackgroundRect"),lt=(function(){function t(n,u,h,d,f,x,m,g){const s=u.append("text").attr("x",h+f/2).attr("y",d+x/2+5).style("font-color",g).style("text-anchor","middle").text(n);c(s,m)}i(t,"byText");function e(n,u,h,d,f,x,m,g,s){const{taskFontSize:a,taskFontFamily:o}=g,y=n.split(/<br\s*\/?>/gi);for(let p=0;p<y.length;p++){const l=p*a-a*(y.length-1)/2,$=u.append("text").attr("x",h+f/2).attr("y",d).attr("fill",s).style("text-anchor","middle").style("font-size",a).style("font-family",o);$.append("tspan").attr("x",h+f/2).attr("dy",l).text(y[p]),$.attr("y",d+x/2).attr("dominant-baseline","central").attr("alignment-baseline","central"),c($,m)}}i(e,"byTspan");function r(n,u,h,d,f,x,m,g){const s=u.append("switch"),o=s.append("foreignObject").attr("x",h).attr("y",d).attr("width",f).attr("height",x).attr("position","fixed").append("xhtml:div").style("display","table").style("height","100%").style("width","100%");o.append("div").attr("class","label").style("display","table-cell").style("text-align","center").style("vertical-align","middle").text(n),e(n,s,h,d,f,x,m,g),c(o,m)}i(r,"byFo");function c(n,u){for(const h in u)h in u&&n.attr(h,u[h])}return i(c,"_setTextAttrs"),function(n){return n.textPlacement==="fo"?r:n.textPlacement==="old"?t:e}})(),Yt=i(function(t){t.append("defs").append("marker").attr("id","arrowhead").attr("refX",5).attr("refY",2).attr("markerWidth",6).attr("markerHeight",4).attr("orient","auto").append("path").attr("d","M 0,0 V 4 L6,2 Z")},"initGraphics"),R={drawRect:Z,drawCircle:at,drawSection:Bt,drawText:ot,drawLabel:Nt,drawTask:jt,drawBackgroundRect:zt,initGraphics:Yt},Ot=i(function(t){Object.keys(t).forEach(function(r){z[r]=t[r]})},"setConf"),S={};function qt(t){const e=A().journey;let r=60;Object.keys(S).forEach(c=>{const n=S[c].color,u={cx:20,cy:r,r:7,fill:n,stroke:"#000",pos:S[c].position};R.drawCircle(t,u);const h={x:40,y:r+7,fill:"#666",text:c,textMargin:e.boxTextMargin|5};R.drawText(t,h),r+=20})}i(qt,"drawActorLegend");const z=A().journey,I=z.leftMargin,Ht=i(function(t,e,r,c){const n=A().journey,u=A().securityLevel;let h;u==="sandbox"&&(h=W("#i"+e));const d=u==="sandbox"?W(h.nodes()[0].contentDocument.body):W("body");w.init();const f=d.select("#"+e);R.initGraphics(f);const x=c.db.getTasks(),m=c.db.getDiagramTitle(),g=c.db.getActors();for(const l in S)delete S[l];let s=0;g.forEach(l=>{S[l]={color:n.actorColours[s%n.actorColours.length],position:s},s++}),qt(f),w.insert(0,0,I,Object.keys(S).length*50),Wt(f,x,0);const a=w.getBounds();m&&f.append("text").text(m).attr("x",I).attr("font-size","4ex").attr("font-weight","bold").attr("y",25);const o=a.stopy-a.starty+2*n.diagramMarginY,y=I+a.stopx+2*n.diagramMarginX;_t(f,o,y,n.useMaxWidth),f.append("line").attr("x1",I).attr("y1",n.height*4).attr("x2",y-I-4).attr("y2",n.height*4).attr("stroke-width",4).attr("stroke","black").attr("marker-end","url(#arrowhead)");const p=m?70:0;f.attr("viewBox",`${a.startx} -25 ${y} ${o+p}`),f.attr("preserveAspectRatio","xMinYMin meet"),f.attr("height",o+p+25)},"draw"),w={data:{startx:void 0,stopx:void 0,starty:void 0,stopy:void 0},verticalPos:0,sequenceItems:[],init:i(function(){this.sequenceItems=[],this.data={startx:void 0,stopx:void 0,starty:void 0,stopy:void 0},this.verticalPos=0},"init"),updateVal:i(function(t,e,r,c){t[e]===void 0?t[e]=r:t[e]=c(r,t[e])},"updateVal"),updateBounds:i(function(t,e,r,c){const n=A().journey,u=this;let h=0;function d(f){return i(function(m){h++;const g=u.sequenceItems.length-h+1;u.updateVal(m,"starty",e-g*n.boxMargin,Math.min),u.updateVal(m,"stopy",c+g*n.boxMargin,Math.max),u.updateVal(w.data,"startx",t-g*n.boxMargin,Math.min),u.updateVal(w.data,"stopx",r+g*n.boxMargin,Math.max),u.updateVal(m,"startx",t-g*n.boxMargin,Math.min),u.updateVal(m,"stopx",r+g*n.boxMargin,Math.max),u.updateVal(w.data,"starty",e-g*n.boxMargin,Math.min),u.updateVal(w.data,"stopy",c+g*n.boxMargin,Math.max)},"updateItemBounds")}i(d,"updateFn"),this.sequenceItems.forEach(d())},"updateBounds"),insert:i(function(t,e,r,c){const n=Math.min(t,r),u=Math.max(t,r),h=Math.min(e,c),d=Math.max(e,c);this.updateVal(w.data,"startx",n,Math.min),this.updateVal(w.data,"starty",h,Math.min),this.updateVal(w.data,"stopx",u,Math.max),this.updateVal(w.data,"stopy",d,Math.max),this.updateBounds(n,h,u,d)},"insert"),bumpVerticalPos:i(function(t){this.verticalPos=this.verticalPos+t,this.data.stopy=this.verticalPos},"bumpVerticalPos"),getVerticalPos:i(function(){return this.verticalPos},"getVerticalPos"),getBounds:i(function(){return this.data},"getBounds")},X=z.sectionFills,nt=z.sectionColours,Wt=i(function(t,e,r){const c=A().journey;let n="";const u=c.height*2+c.diagramMarginY,h=r+u;let d=0,f="#CCC",x="black",m=0;for(const[g,s]of e.entries()){if(n!==s.section){f=X[d%X.length],m=d%X.length,x=nt[d%nt.length];let o=0;const y=s.section;for(let l=g;l<e.length&&e[l].section==y;l++)o=o+1;const p={x:g*c.taskMargin+g*c.width+I,y:50,text:s.section,fill:f,num:m,colour:x,taskCount:o};R.drawSection(t,p,c),n=s.section,d++}const a=s.people.reduce((o,y)=>(S[y]&&(o[y]=S[y]),o),{});s.x=g*c.taskMargin+g*c.width+I,s.y=h,s.width=c.diagramMarginX,s.height=c.diagramMarginY,s.colour=x,s.fill=f,s.num=m,s.actors=a,R.drawTask(t,s,c),w.insert(s.x,s.y,s.x+s.width+c.taskMargin,450)}},"drawTasks"),it={setConf:Ot,draw:Ht},Dt={parser:Tt,db:et,renderer:it,styles:Lt,init:i(t=>{it.setConf(t.journey),et.clear()},"init")};export{Dt as diagram};
//# sourceMappingURL=journeyDiagram-49397b02-_nrgHp-m.js.map
