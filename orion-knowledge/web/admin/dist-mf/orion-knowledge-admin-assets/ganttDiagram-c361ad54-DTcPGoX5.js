var Zt=Object.defineProperty;var c=(t,s)=>Zt(t,"name",{value:s,configurable:!0});import{d as $t}from"./percentages-BXMCSKIN--8I_CNJ0.js";import{d as L}from"./__federation_expose_Index-Blki2IV6.js";import{t as te,m as ee,a as se,i as ie,b as ne,c as Ft,d as Mt,e as re,f as ae,g as ce,h as oe,j as le,k as ue,l as de,n as Vt,o as Pt,p as Ot,s as Rt,q as Bt,r as fe,u as he,v as me,w as ke}from"./advancedFormat-DO6ifB_3.js";import{a as ye,s as ge,m as pe,n as be,b as Te,c as xe,g as G,d as ve,l as mt,i as _e,p as we,u as Ce}from"./index-CAEX9gTM.js";import{d as dt}from"./index-CWZ_FNac.js";import{l as Ee}from"./linear-CrYHcbjr.js";var pt=(function(){var t=c(function(p,i,d,f){for(d=d||{},f=p.length;f--;d[p[f]]=i);return d},"o"),s=[6,8,10,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,30,32,33,35,37],n=[1,25],r=[1,26],a=[1,27],m=[1,28],h=[1,29],M=[1,30],R=[1,31],B=[1,9],D=[1,10],I=[1,11],W=[1,12],V=[1,13],P=[1,14],_=[1,15],et=[1,16],st=[1,18],it=[1,19],nt=[1,20],rt=[1,21],at=[1,22],ct=[1,24],ot=[1,32],k={trace:c(function(){},"trace"),yy:{},symbols_:{error:2,start:3,gantt:4,document:5,EOF:6,line:7,SPACE:8,statement:9,NL:10,weekday:11,weekday_monday:12,weekday_tuesday:13,weekday_wednesday:14,weekday_thursday:15,weekday_friday:16,weekday_saturday:17,weekday_sunday:18,dateFormat:19,inclusiveEndDates:20,topAxis:21,axisFormat:22,tickInterval:23,excludes:24,includes:25,todayMarker:26,title:27,acc_title:28,acc_title_value:29,acc_descr:30,acc_descr_value:31,acc_descr_multiline_value:32,section:33,clickStatement:34,taskTxt:35,taskData:36,click:37,callbackname:38,callbackargs:39,href:40,clickStatementDebug:41,$accept:0,$end:1},terminals_:{2:"error",4:"gantt",6:"EOF",8:"SPACE",10:"NL",12:"weekday_monday",13:"weekday_tuesday",14:"weekday_wednesday",15:"weekday_thursday",16:"weekday_friday",17:"weekday_saturday",18:"weekday_sunday",19:"dateFormat",20:"inclusiveEndDates",21:"topAxis",22:"axisFormat",23:"tickInterval",24:"excludes",25:"includes",26:"todayMarker",27:"title",28:"acc_title",29:"acc_title_value",30:"acc_descr",31:"acc_descr_value",32:"acc_descr_multiline_value",33:"section",35:"taskTxt",36:"taskData",37:"click",38:"callbackname",39:"callbackargs",40:"href"},productions_:[0,[3,3],[5,0],[5,2],[7,2],[7,1],[7,1],[7,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,2],[9,2],[9,1],[9,1],[9,1],[9,2],[34,2],[34,3],[34,3],[34,4],[34,3],[34,4],[34,2],[41,2],[41,3],[41,3],[41,4],[41,3],[41,4],[41,2]],performAction:c(function(i,d,f,o,y,e,A){var u=e.length-1;switch(y){case 1:return e[u-1];case 2:this.$=[];break;case 3:e[u-1].push(e[u]),this.$=e[u-1];break;case 4:case 5:this.$=e[u];break;case 6:case 7:this.$=[];break;case 8:o.setWeekday("monday");break;case 9:o.setWeekday("tuesday");break;case 10:o.setWeekday("wednesday");break;case 11:o.setWeekday("thursday");break;case 12:o.setWeekday("friday");break;case 13:o.setWeekday("saturday");break;case 14:o.setWeekday("sunday");break;case 15:o.setDateFormat(e[u].substr(11)),this.$=e[u].substr(11);break;case 16:o.enableInclusiveEndDates(),this.$=e[u].substr(18);break;case 17:o.TopAxis(),this.$=e[u].substr(8);break;case 18:o.setAxisFormat(e[u].substr(11)),this.$=e[u].substr(11);break;case 19:o.setTickInterval(e[u].substr(13)),this.$=e[u].substr(13);break;case 20:o.setExcludes(e[u].substr(9)),this.$=e[u].substr(9);break;case 21:o.setIncludes(e[u].substr(9)),this.$=e[u].substr(9);break;case 22:o.setTodayMarker(e[u].substr(12)),this.$=e[u].substr(12);break;case 24:o.setDiagramTitle(e[u].substr(6)),this.$=e[u].substr(6);break;case 25:this.$=e[u].trim(),o.setAccTitle(this.$);break;case 26:case 27:this.$=e[u].trim(),o.setAccDescription(this.$);break;case 28:o.addSection(e[u].substr(8)),this.$=e[u].substr(8);break;case 30:o.addTask(e[u-1],e[u]),this.$="task";break;case 31:this.$=e[u-1],o.setClickEvent(e[u-1],e[u],null);break;case 32:this.$=e[u-2],o.setClickEvent(e[u-2],e[u-1],e[u]);break;case 33:this.$=e[u-2],o.setClickEvent(e[u-2],e[u-1],null),o.setLink(e[u-2],e[u]);break;case 34:this.$=e[u-3],o.setClickEvent(e[u-3],e[u-2],e[u-1]),o.setLink(e[u-3],e[u]);break;case 35:this.$=e[u-2],o.setClickEvent(e[u-2],e[u],null),o.setLink(e[u-2],e[u-1]);break;case 36:this.$=e[u-3],o.setClickEvent(e[u-3],e[u-1],e[u]),o.setLink(e[u-3],e[u-2]);break;case 37:this.$=e[u-1],o.setLink(e[u-1],e[u]);break;case 38:case 44:this.$=e[u-1]+" "+e[u];break;case 39:case 40:case 42:this.$=e[u-2]+" "+e[u-1]+" "+e[u];break;case 41:case 43:this.$=e[u-3]+" "+e[u-2]+" "+e[u-1]+" "+e[u];break}},"anonymous"),table:[{3:1,4:[1,2]},{1:[3]},t(s,[2,2],{5:3}),{6:[1,4],7:5,8:[1,6],9:7,10:[1,8],11:17,12:n,13:r,14:a,15:m,16:h,17:M,18:R,19:B,20:D,21:I,22:W,23:V,24:P,25:_,26:et,27:st,28:it,30:nt,32:rt,33:at,34:23,35:ct,37:ot},t(s,[2,7],{1:[2,1]}),t(s,[2,3]),{9:33,11:17,12:n,13:r,14:a,15:m,16:h,17:M,18:R,19:B,20:D,21:I,22:W,23:V,24:P,25:_,26:et,27:st,28:it,30:nt,32:rt,33:at,34:23,35:ct,37:ot},t(s,[2,5]),t(s,[2,6]),t(s,[2,15]),t(s,[2,16]),t(s,[2,17]),t(s,[2,18]),t(s,[2,19]),t(s,[2,20]),t(s,[2,21]),t(s,[2,22]),t(s,[2,23]),t(s,[2,24]),{29:[1,34]},{31:[1,35]},t(s,[2,27]),t(s,[2,28]),t(s,[2,29]),{36:[1,36]},t(s,[2,8]),t(s,[2,9]),t(s,[2,10]),t(s,[2,11]),t(s,[2,12]),t(s,[2,13]),t(s,[2,14]),{38:[1,37],40:[1,38]},t(s,[2,4]),t(s,[2,25]),t(s,[2,26]),t(s,[2,30]),t(s,[2,31],{39:[1,39],40:[1,40]}),t(s,[2,37],{38:[1,41]}),t(s,[2,32],{40:[1,42]}),t(s,[2,33]),t(s,[2,35],{39:[1,43]}),t(s,[2,34]),t(s,[2,36])],defaultActions:{},parseError:c(function(i,d){if(d.recoverable)this.trace(i);else{var f=new Error(i);throw f.hash=d,f}},"parseError"),parse:c(function(i){var d=this,f=[0],o=[],y=[null],e=[],A=this.table,u="",l=0,g=0,E=2,v=1,w=e.slice.call(arguments,1),x=Object.create(this.lexer),C={yy:{}};for(var K in this.yy)Object.prototype.hasOwnProperty.call(this.yy,K)&&(C.yy[K]=this.yy[K]);x.setInput(i,C.yy),C.yy.lexer=x,C.yy.parser=this,typeof x.yylloc>"u"&&(x.yylloc={});var Q=x.yylloc;e.push(Q);var Kt=x.options&&x.options.ranges;typeof C.yy.parseError=="function"?this.parseError=C.yy.parseError:this.parseError=Object.getPrototypeOf(this).parseError;function Qt(){var z;return z=o.pop()||x.lex()||v,typeof z!="number"&&(z instanceof Array&&(o=z,z=o.pop()),z=d.symbols_[z]||z),z}c(Qt,"lex");for(var F,j,O,yt,U={},lt,Y,Lt,ut;;){if(j=f[f.length-1],this.defaultActions[j]?O=this.defaultActions[j]:((F===null||typeof F>"u")&&(F=Qt()),O=A[j]&&A[j][F]),typeof O>"u"||!O.length||!O[0]){var gt="";ut=[];for(lt in A[j])this.terminals_[lt]&&lt>E&&ut.push("'"+this.terminals_[lt]+"'");x.showPosition?gt="Parse error on line "+(l+1)+`:
`+x.showPosition()+`
Expecting `+ut.join(", ")+", got '"+(this.terminals_[F]||F)+"'":gt="Parse error on line "+(l+1)+": Unexpected "+(F==v?"end of input":"'"+(this.terminals_[F]||F)+"'"),this.parseError(gt,{text:x.match,token:this.terminals_[F]||F,line:x.yylineno,loc:Q,expected:ut})}if(O[0]instanceof Array&&O.length>1)throw new Error("Parse Error: multiple actions possible at state: "+j+", token: "+F);switch(O[0]){case 1:f.push(F),y.push(x.yytext),e.push(x.yylloc),f.push(O[1]),F=null,g=x.yyleng,u=x.yytext,l=x.yylineno,Q=x.yylloc;break;case 2:if(Y=this.productions_[O[1]][1],U.$=y[y.length-Y],U._$={first_line:e[e.length-(Y||1)].first_line,last_line:e[e.length-1].last_line,first_column:e[e.length-(Y||1)].first_column,last_column:e[e.length-1].last_column},Kt&&(U._$.range=[e[e.length-(Y||1)].range[0],e[e.length-1].range[1]]),yt=this.performAction.apply(U,[u,g,l,C.yy,O[1],y,e].concat(w)),typeof yt<"u")return yt;Y&&(f=f.slice(0,-1*Y*2),y=y.slice(0,-1*Y),e=e.slice(0,-1*Y)),f.push(this.productions_[O[1]][0]),y.push(U.$),e.push(U._$),Lt=A[f[f.length-2]][f[f.length-1]],f.push(Lt);break;case 3:return!0}}return!0},"parse")},T=(function(){var p={EOF:1,parseError:c(function(d,f){if(this.yy.parser)this.yy.parser.parseError(d,f);else throw new Error(d)},"parseError"),setInput:c(function(i,d){return this.yy=d||this.yy||{},this._input=i,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},"setInput"),input:c(function(){var i=this._input[0];this.yytext+=i,this.yyleng++,this.offset++,this.match+=i,this.matched+=i;var d=i.match(/(?:\r\n?|\n).*/g);return d?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),i},"input"),unput:c(function(i){var d=i.length,f=i.split(/(?:\r\n?|\n)/g);this._input=i+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-d),this.offset-=d;var o=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),f.length-1&&(this.yylineno-=f.length-1);var y=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:f?(f.length===o.length?this.yylloc.first_column:0)+o[o.length-f.length].length-f[0].length:this.yylloc.first_column-d},this.options.ranges&&(this.yylloc.range=[y[0],y[0]+this.yyleng-d]),this.yyleng=this.yytext.length,this},"unput"),more:c(function(){return this._more=!0,this},"more"),reject:c(function(){if(this.options.backtrack_lexer)this._backtrack=!0;else return this.parseError("Lexical error on line "+(this.yylineno+1)+`. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
`+this.showPosition(),{text:"",token:null,line:this.yylineno});return this},"reject"),less:c(function(i){this.unput(this.match.slice(i))},"less"),pastInput:c(function(){var i=this.matched.substr(0,this.matched.length-this.match.length);return(i.length>20?"...":"")+i.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:c(function(){var i=this.match;return i.length<20&&(i+=this._input.substr(0,20-i.length)),(i.substr(0,20)+(i.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:c(function(){var i=this.pastInput(),d=new Array(i.length+1).join("-");return i+this.upcomingInput()+`
`+d+"^"},"showPosition"),test_match:c(function(i,d){var f,o,y;if(this.options.backtrack_lexer&&(y={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges&&(y.yylloc.range=this.yylloc.range.slice(0))),o=i[0].match(/(?:\r\n?|\n).*/g),o&&(this.yylineno+=o.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:o?o[o.length-1].length-o[o.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+i[0].length},this.yytext+=i[0],this.match+=i[0],this.matches=i,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._backtrack=!1,this._input=this._input.slice(i[0].length),this.matched+=i[0],f=this.performAction.call(this,this.yy,this,d,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),f)return f;if(this._backtrack){for(var e in y)this[e]=y[e];return!1}return!1},"test_match"),next:c(function(){if(this.done)return this.EOF;this._input||(this.done=!0);var i,d,f,o;this._more||(this.yytext="",this.match="");for(var y=this._currentRules(),e=0;e<y.length;e++)if(f=this._input.match(this.rules[y[e]]),f&&(!d||f[0].length>d[0].length)){if(d=f,o=e,this.options.backtrack_lexer){if(i=this.test_match(f,y[e]),i!==!1)return i;if(this._backtrack){d=!1;continue}else return!1}else if(!this.options.flex)break}return d?(i=this.test_match(d,y[o]),i!==!1?i:!1):this._input===""?this.EOF:this.parseError("Lexical error on line "+(this.yylineno+1)+`. Unrecognized text.
`+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:c(function(){var d=this.next();return d||this.lex()},"lex"),begin:c(function(d){this.conditionStack.push(d)},"begin"),popState:c(function(){var d=this.conditionStack.length-1;return d>0?this.conditionStack.pop():this.conditionStack[0]},"popState"),_currentRules:c(function(){return this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1]?this.conditions[this.conditionStack[this.conditionStack.length-1]].rules:this.conditions.INITIAL.rules},"_currentRules"),topState:c(function(d){return d=this.conditionStack.length-1-Math.abs(d||0),d>=0?this.conditionStack[d]:"INITIAL"},"topState"),pushState:c(function(d){this.begin(d)},"pushState"),stateStackSize:c(function(){return this.conditionStack.length},"stateStackSize"),options:{"case-insensitive":!0},performAction:c(function(d,f,o,y){switch(o){case 0:return this.begin("open_directive"),"open_directive";case 1:return this.begin("acc_title"),28;case 2:return this.popState(),"acc_title_value";case 3:return this.begin("acc_descr"),30;case 4:return this.popState(),"acc_descr_value";case 5:this.begin("acc_descr_multiline");break;case 6:this.popState();break;case 7:return"acc_descr_multiline_value";case 8:break;case 9:break;case 10:break;case 11:return 10;case 12:break;case 13:break;case 14:this.begin("href");break;case 15:this.popState();break;case 16:return 40;case 17:this.begin("callbackname");break;case 18:this.popState();break;case 19:this.popState(),this.begin("callbackargs");break;case 20:return 38;case 21:this.popState();break;case 22:return 39;case 23:this.begin("click");break;case 24:this.popState();break;case 25:return 37;case 26:return 4;case 27:return 19;case 28:return 20;case 29:return 21;case 30:return 22;case 31:return 23;case 32:return 25;case 33:return 24;case 34:return 26;case 35:return 12;case 36:return 13;case 37:return 14;case 38:return 15;case 39:return 16;case 40:return 17;case 41:return 18;case 42:return"date";case 43:return 27;case 44:return"accDescription";case 45:return 33;case 46:return 35;case 47:return 36;case 48:return":";case 49:return 6;case 50:return"INVALID"}},"anonymous"),rules:[/^(?:%%\{)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:%%(?!\{)*[^\n]*)/i,/^(?:[^\}]%%*[^\n]*)/i,/^(?:%%*[^\n]*[\n]*)/i,/^(?:[\n]+)/i,/^(?:\s+)/i,/^(?:%[^\n]*)/i,/^(?:href[\s]+["])/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:call[\s]+)/i,/^(?:\([\s]*\))/i,/^(?:\()/i,/^(?:[^(]*)/i,/^(?:\))/i,/^(?:[^)]*)/i,/^(?:click[\s]+)/i,/^(?:[\s\n])/i,/^(?:[^\s\n]*)/i,/^(?:gantt\b)/i,/^(?:dateFormat\s[^#\n;]+)/i,/^(?:inclusiveEndDates\b)/i,/^(?:topAxis\b)/i,/^(?:axisFormat\s[^#\n;]+)/i,/^(?:tickInterval\s[^#\n;]+)/i,/^(?:includes\s[^#\n;]+)/i,/^(?:excludes\s[^#\n;]+)/i,/^(?:todayMarker\s[^\n;]+)/i,/^(?:weekday\s+monday\b)/i,/^(?:weekday\s+tuesday\b)/i,/^(?:weekday\s+wednesday\b)/i,/^(?:weekday\s+thursday\b)/i,/^(?:weekday\s+friday\b)/i,/^(?:weekday\s+saturday\b)/i,/^(?:weekday\s+sunday\b)/i,/^(?:\d\d\d\d-\d\d-\d\d\b)/i,/^(?:title\s[^\n]+)/i,/^(?:accDescription\s[^#\n;]+)/i,/^(?:section\s[^\n]+)/i,/^(?:[^:\n]+)/i,/^(?::[^#\n;]+)/i,/^(?::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{acc_descr_multiline:{rules:[6,7],inclusive:!1},acc_descr:{rules:[4],inclusive:!1},acc_title:{rules:[2],inclusive:!1},callbackargs:{rules:[21,22],inclusive:!1},callbackname:{rules:[18,19,20],inclusive:!1},href:{rules:[15,16],inclusive:!1},click:{rules:[24,25],inclusive:!1},INITIAL:{rules:[0,1,3,5,8,9,10,11,12,13,14,17,23,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50],inclusive:!0}}};return p})();k.lexer=T;function b(){this.yy={}}return c(b,"Parser"),b.prototype=k,k.Parser=b,new b})();pt.parser=pt;const De=pt;L.extend(he);L.extend(me);L.extend(ke);let N="",vt="",_t,wt="",Z=[],$=[],Ct={},Et=[],kt=[],J="",Dt="";const Yt=["active","done","crit","milestone"];let St=[],tt=!1,At=!1,It="sunday",bt=0;const Se=c(function(){Et=[],kt=[],J="",St=[],ft=0,xt=void 0,ht=void 0,S=[],N="",vt="",Dt="",_t=void 0,wt="",Z=[],$=[],tt=!1,At=!1,bt=0,Ct={},we(),It="sunday"},"clear"),Ae=c(function(t){vt=t},"setAxisFormat"),Ie=c(function(){return vt},"getAxisFormat"),Le=c(function(t){_t=t},"setTickInterval"),Fe=c(function(){return _t},"getTickInterval"),Me=c(function(t){wt=t},"setTodayMarker"),Ve=c(function(){return wt},"getTodayMarker"),Pe=c(function(t){N=t},"setDateFormat"),Oe=c(function(){tt=!0},"enableInclusiveEndDates"),Re=c(function(){return tt},"endDatesAreInclusive"),Be=c(function(){At=!0},"enableTopAxis"),Ne=c(function(){return At},"topAxisEnabled"),We=c(function(t){Dt=t},"setDisplayMode"),Ye=c(function(){return Dt},"getDisplayMode"),ze=c(function(){return N},"getDateFormat"),qe=c(function(t){Z=t.toLowerCase().split(/[\s,]+/)},"setIncludes"),je=c(function(){return Z},"getIncludes"),Xe=c(function(t){$=t.toLowerCase().split(/[\s,]+/)},"setExcludes"),Ue=c(function(){return $},"getExcludes"),Ge=c(function(){return Ct},"getLinks"),He=c(function(t){J=t,Et.push(t)},"addSection"),Je=c(function(){return Et},"getSections"),Ke=c(function(){let t=Nt();const s=10;let n=0;for(;!t&&n<s;)t=Nt(),n++;return kt=S,kt},"getTasks"),zt=c(function(t,s,n,r){return r.includes(t.format(s.trim()))?!1:t.isoWeekday()>=6&&n.includes("weekends")||n.includes(t.format("dddd").toLowerCase())?!0:n.includes(t.format(s.trim()))},"isInvalidDate"),Qe=c(function(t){It=t},"setWeekday"),Ze=c(function(){return It},"getWeekday"),qt=c(function(t,s,n,r){if(!n.length||t.manualEndTime)return;let a;t.startTime instanceof Date?a=L(t.startTime):a=L(t.startTime,s,!0),a=a.add(1,"d");let m;t.endTime instanceof Date?m=L(t.endTime):m=L(t.endTime,s,!0);const[h,M]=$e(a,m,s,n,r);t.endTime=h.toDate(),t.renderEndTime=M},"checkTaskDates"),$e=c(function(t,s,n,r,a){let m=!1,h=null;for(;t<=s;)m||(h=s.toDate()),m=zt(t,n,r,a),m&&(s=s.add(1,"d")),t=t.add(1,"d");return[s,h]},"fixTaskDates"),Tt=c(function(t,s,n){n=n.trim();const a=/^after\s+(?<ids>[\d\w- ]+)/.exec(n);if(a!==null){let h=null;for(const R of a.groups.ids.split(" ")){let B=X(R);B!==void 0&&(!h||B.endTime>h.endTime)&&(h=B)}if(h)return h.endTime;const M=new Date;return M.setHours(0,0,0,0),M}let m=L(n,s.trim(),!0);if(m.isValid())return m.toDate();{mt.debug("Invalid date:"+n),mt.debug("With date format:"+s.trim());const h=new Date(n);if(h===void 0||isNaN(h.getTime())||h.getFullYear()<-1e4||h.getFullYear()>1e4)throw new Error("Invalid date:"+n);return h}},"getStartDate"),jt=c(function(t){const s=/^(\d+(?:\.\d+)?)([Mdhmswy]|ms)$/.exec(t.trim());return s!==null?[Number.parseFloat(s[1]),s[2]]:[NaN,"ms"]},"parseDuration"),Xt=c(function(t,s,n,r=!1){n=n.trim();const m=/^until\s+(?<ids>[\d\w- ]+)/.exec(n);if(m!==null){let D=null;for(const W of m.groups.ids.split(" ")){let V=X(W);V!==void 0&&(!D||V.startTime<D.startTime)&&(D=V)}if(D)return D.startTime;const I=new Date;return I.setHours(0,0,0,0),I}let h=L(n,s.trim(),!0);if(h.isValid())return r&&(h=h.add(1,"d")),h.toDate();let M=L(t);const[R,B]=jt(n);if(!Number.isNaN(R)){const D=M.add(R,B);D.isValid()&&(M=D)}return M.toDate()},"getEndDate");let ft=0;const H=c(function(t){return t===void 0?(ft=ft+1,"task"+ft):t},"parseId"),ts=c(function(t,s){let n;s.substr(0,1)===":"?n=s.substr(1,s.length):n=s;const r=n.split(","),a={};Jt(r,a,Yt);for(let h=0;h<r.length;h++)r[h]=r[h].trim();let m="";switch(r.length){case 1:a.id=H(),a.startTime=t.endTime,m=r[0];break;case 2:a.id=H(),a.startTime=Tt(void 0,N,r[0]),m=r[1];break;case 3:a.id=H(r[0]),a.startTime=Tt(void 0,N,r[1]),m=r[2];break}return m&&(a.endTime=Xt(a.startTime,N,m,tt),a.manualEndTime=L(m,"YYYY-MM-DD",!0).isValid(),qt(a,N,$,Z)),a},"compileData"),es=c(function(t,s){let n;s.substr(0,1)===":"?n=s.substr(1,s.length):n=s;const r=n.split(","),a={};Jt(r,a,Yt);for(let m=0;m<r.length;m++)r[m]=r[m].trim();switch(r.length){case 1:a.id=H(),a.startTime={type:"prevTaskEnd",id:t},a.endTime={data:r[0]};break;case 2:a.id=H(),a.startTime={type:"getStartDate",startData:r[0]},a.endTime={data:r[1]};break;case 3:a.id=H(r[0]),a.startTime={type:"getStartDate",startData:r[1]},a.endTime={data:r[2]};break}return a},"parseData");let xt,ht,S=[];const Ut={},ss=c(function(t,s){const n={section:J,type:J,processed:!1,manualEndTime:!1,renderEndTime:null,raw:{data:s},task:t,classes:[]},r=es(ht,s);n.raw.startTime=r.startTime,n.raw.endTime=r.endTime,n.id=r.id,n.prevTaskId=ht,n.active=r.active,n.done=r.done,n.crit=r.crit,n.milestone=r.milestone,n.order=bt,bt++;const a=S.push(n);ht=n.id,Ut[n.id]=a-1},"addTask"),X=c(function(t){const s=Ut[t];return S[s]},"findTaskById"),is=c(function(t,s){const n={section:J,type:J,description:t,task:t,classes:[]},r=ts(xt,s);n.startTime=r.startTime,n.endTime=r.endTime,n.id=r.id,n.active=r.active,n.done=r.done,n.crit=r.crit,n.milestone=r.milestone,xt=n,kt.push(n)},"addTaskOrg"),Nt=c(function(){const t=c(function(n){const r=S[n];let a="";switch(S[n].raw.startTime.type){case"prevTaskEnd":{const m=X(r.prevTaskId);r.startTime=m.endTime;break}case"getStartDate":a=Tt(void 0,N,S[n].raw.startTime.startData),a&&(S[n].startTime=a);break}return S[n].startTime&&(S[n].endTime=Xt(S[n].startTime,N,S[n].raw.endTime.data,tt),S[n].endTime&&(S[n].processed=!0,S[n].manualEndTime=L(S[n].raw.endTime.data,"YYYY-MM-DD",!0).isValid(),qt(S[n],N,$,Z))),S[n].processed},"compileTask");let s=!0;for(const[n,r]of S.entries())t(n),s=s&&r.processed;return s},"compileTasks"),ns=c(function(t,s){let n=s;G().securityLevel!=="loose"&&(n=$t.sanitizeUrl(s)),t.split(",").forEach(function(r){X(r)!==void 0&&(Ht(r,()=>{window.open(n,"_self")}),Ct[r]=n)}),Gt(t,"clickable")},"setLink"),Gt=c(function(t,s){t.split(",").forEach(function(n){let r=X(n);r!==void 0&&r.classes.push(s)})},"setClass"),rs=c(function(t,s,n){if(G().securityLevel!=="loose"||s===void 0)return;let r=[];if(typeof n=="string"){r=n.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);for(let m=0;m<r.length;m++){let h=r[m].trim();h.charAt(0)==='"'&&h.charAt(h.length-1)==='"'&&(h=h.substr(1,h.length-2)),r[m]=h}}r.length===0&&r.push(t),X(t)!==void 0&&Ht(t,()=>{Ce.runFunc(s,...r)})},"setClickFun"),Ht=c(function(t,s){St.push(function(){const n=document.querySelector(`[id="${t}"]`);n!==null&&n.addEventListener("click",function(){s()})},function(){const n=document.querySelector(`[id="${t}-text"]`);n!==null&&n.addEventListener("click",function(){s()})})},"pushFun"),as=c(function(t,s,n){t.split(",").forEach(function(r){rs(r,s,n)}),Gt(t,"clickable")},"setClickEvent"),cs=c(function(t){St.forEach(function(s){s(t)})},"bindFunctions"),os={getConfig:c(()=>G().gantt,"getConfig"),clear:Se,setDateFormat:Pe,getDateFormat:ze,enableInclusiveEndDates:Oe,endDatesAreInclusive:Re,enableTopAxis:Be,topAxisEnabled:Ne,setAxisFormat:Ae,getAxisFormat:Ie,setTickInterval:Le,getTickInterval:Fe,setTodayMarker:Me,getTodayMarker:Ve,setAccTitle:xe,getAccTitle:Te,setDiagramTitle:be,getDiagramTitle:pe,setDisplayMode:We,getDisplayMode:Ye,setAccDescription:ge,getAccDescription:ye,addSection:He,getSections:Je,getTasks:Ke,addTask:ss,findTaskById:X,addTaskOrg:is,setIncludes:qe,getIncludes:je,setExcludes:Xe,getExcludes:Ue,setClickEvent:as,setLink:ns,getLinks:Ge,bindFunctions:cs,parseDuration:jt,isInvalidDate:zt,setWeekday:Qe,getWeekday:Ze};function Jt(t,s,n){let r=!0;for(;r;)r=!1,n.forEach(function(a){const m="^\\s*"+a+"\\s*$",h=new RegExp(m);t[0].match(h)&&(s[a]=!0,t.shift(1),r=!0)})}c(Jt,"getTaskTags");const ls=c(function(){mt.debug("Something is calling, setConf, remove the call")},"setConf"),Wt={monday:de,tuesday:ue,wednesday:le,thursday:oe,friday:ce,saturday:ae,sunday:re},us=c((t,s)=>{let n=[...t].map(()=>-1/0),r=[...t].sort((m,h)=>m.startTime-h.startTime||m.order-h.order),a=0;for(const m of r)for(let h=0;h<n.length;h++)if(m.startTime>=n[h]){n[h]=m.endTime,m.order=h+s,h>a&&(a=h);break}return a},"getMaxIntersections");let q;const ds=c(function(t,s,n,r){const a=G().gantt,m=G().securityLevel;let h;m==="sandbox"&&(h=dt("#i"+s));const M=m==="sandbox"?dt(h.nodes()[0].contentDocument.body):dt("body"),R=m==="sandbox"?h.nodes()[0].contentDocument:document,B=R.getElementById(s);q=B.parentElement.offsetWidth,q===void 0&&(q=1200),a.useWidth!==void 0&&(q=a.useWidth);const D=r.db.getTasks();let I=[];for(const k of D)I.push(k.type);I=ot(I);const W={};let V=2*a.topPadding;if(r.db.getDisplayMode()==="compact"||a.displayMode==="compact"){const k={};for(const b of D)k[b.section]===void 0?k[b.section]=[b]:k[b.section].push(b);let T=0;for(const b of Object.keys(k)){const p=us(k[b],T)+1;T+=p,V+=p*(a.barHeight+a.barGap),W[b]=p}}else{V+=D.length*(a.barHeight+a.barGap);for(const k of I)W[k]=D.filter(T=>T.type===k).length}B.setAttribute("viewBox","0 0 "+q+" "+V);const P=M.select(`[id="${s}"]`),_=te().domain([ee(D,function(k){return k.startTime}),se(D,function(k){return k.endTime})]).rangeRound([0,q-a.leftPadding-a.rightPadding]);function et(k,T){const b=k.startTime,p=T.startTime;let i=0;return b>p?i=1:b<p&&(i=-1),i}c(et,"taskCompare"),D.sort(et),st(D,q,V),ve(P,V,q,a.useMaxWidth),P.append("text").text(r.db.getDiagramTitle()).attr("x",q/2).attr("y",a.titleTopMargin).attr("class","titleText");function st(k,T,b){const p=a.barHeight,i=p+a.barGap,d=a.topPadding,f=a.leftPadding,o=Ee().domain([0,I.length]).range(["#00B9FA","#F95002"]).interpolate(ie);nt(i,d,f,T,b,k,r.db.getExcludes(),r.db.getIncludes()),rt(f,d,T,b),it(k,i,d,f,p,o,T),at(i,d),ct(f,d,T,b)}c(st,"makeGantt");function it(k,T,b,p,i,d,f){const y=[...new Set(k.map(l=>l.order))].map(l=>k.find(g=>g.order===l));P.append("g").selectAll("rect").data(y).enter().append("rect").attr("x",0).attr("y",function(l,g){return g=l.order,g*T+b-2}).attr("width",function(){return f-a.rightPadding/2}).attr("height",T).attr("class",function(l){for(const[g,E]of I.entries())if(l.type===E)return"section section"+g%a.numberSectionStyles;return"section section0"});const e=P.append("g").selectAll("rect").data(k).enter(),A=r.db.getLinks();if(e.append("rect").attr("id",function(l){return l.id}).attr("rx",3).attr("ry",3).attr("x",function(l){return l.milestone?_(l.startTime)+p+.5*(_(l.endTime)-_(l.startTime))-.5*i:_(l.startTime)+p}).attr("y",function(l,g){return g=l.order,g*T+b}).attr("width",function(l){return l.milestone?i:_(l.renderEndTime||l.endTime)-_(l.startTime)}).attr("height",i).attr("transform-origin",function(l,g){return g=l.order,(_(l.startTime)+p+.5*(_(l.endTime)-_(l.startTime))).toString()+"px "+(g*T+b+.5*i).toString()+"px"}).attr("class",function(l){const g="task";let E="";l.classes.length>0&&(E=l.classes.join(" "));let v=0;for(const[x,C]of I.entries())l.type===C&&(v=x%a.numberSectionStyles);let w="";return l.active?l.crit?w+=" activeCrit":w=" active":l.done?l.crit?w=" doneCrit":w=" done":l.crit&&(w+=" crit"),w.length===0&&(w=" task"),l.milestone&&(w=" milestone "+w),w+=v,w+=" "+E,g+w}),e.append("text").attr("id",function(l){return l.id+"-text"}).text(function(l){return l.task}).attr("font-size",a.fontSize).attr("x",function(l){let g=_(l.startTime),E=_(l.renderEndTime||l.endTime);l.milestone&&(g+=.5*(_(l.endTime)-_(l.startTime))-.5*i),l.milestone&&(E=g+i);const v=this.getBBox().width;return v>E-g?E+v+1.5*a.leftPadding>f?g+p-5:E+p+5:(E-g)/2+g+p}).attr("y",function(l,g){return g=l.order,g*T+a.barHeight/2+(a.fontSize/2-2)+b}).attr("text-height",i).attr("class",function(l){const g=_(l.startTime);let E=_(l.endTime);l.milestone&&(E=g+i);const v=this.getBBox().width;let w="";l.classes.length>0&&(w=l.classes.join(" "));let x=0;for(const[K,Q]of I.entries())l.type===Q&&(x=K%a.numberSectionStyles);let C="";return l.active&&(l.crit?C="activeCritText"+x:C="activeText"+x),l.done?l.crit?C=C+" doneCritText"+x:C=C+" doneText"+x:l.crit&&(C=C+" critText"+x),l.milestone&&(C+=" milestoneText"),v>E-g?E+v+1.5*a.leftPadding>f?w+" taskTextOutsideLeft taskTextOutside"+x+" "+C:w+" taskTextOutsideRight taskTextOutside"+x+" "+C+" width-"+v:w+" taskText taskText"+x+" "+C+" width-"+v}),G().securityLevel==="sandbox"){let l;l=dt("#i"+s);const g=l.nodes()[0].contentDocument;e.filter(function(E){return A[E.id]!==void 0}).each(function(E){var v=g.querySelector("#"+E.id),w=g.querySelector("#"+E.id+"-text");const x=v.parentNode;var C=g.createElement("a");C.setAttribute("xlink:href",A[E.id]),C.setAttribute("target","_top"),x.appendChild(C),C.appendChild(v),C.appendChild(w)})}}c(it,"drawRects");function nt(k,T,b,p,i,d,f,o){if(f.length===0&&o.length===0)return;let y,e;for(const{startTime:v,endTime:w}of d)(y===void 0||v<y)&&(y=v),(e===void 0||w>e)&&(e=w);if(!y||!e)return;if(L(e).diff(L(y),"year")>5){mt.warn("The difference between the min and max time is more than 5 years. This will cause performance issues. Skipping drawing exclude days.");return}const A=r.db.getDateFormat(),u=[];let l=null,g=L(y);for(;g.valueOf()<=e;)r.db.isInvalidDate(g,A,f,o)?l?l.end=g:l={start:g,end:g}:l&&(u.push(l),l=null),g=g.add(1,"d");P.append("g").selectAll("rect").data(u).enter().append("rect").attr("id",function(v){return"exclude-"+v.start.format("YYYY-MM-DD")}).attr("x",function(v){return _(v.start)+b}).attr("y",a.gridLineStartPadding).attr("width",function(v){const w=v.end.add(1,"day");return _(w)-_(v.start)}).attr("height",i-T-a.gridLineStartPadding).attr("transform-origin",function(v,w){return(_(v.start)+b+.5*(_(v.end)-_(v.start))).toString()+"px "+(w*k+.5*i).toString()+"px"}).attr("class","exclude-range")}c(nt,"drawExcludeDays");function rt(k,T,b,p){let i=ne(_).tickSize(-p+T+a.gridLineStartPadding).tickFormat(Ft(r.db.getAxisFormat()||a.axisFormat||"%Y-%m-%d"));const f=/^([1-9]\d*)(millisecond|second|minute|hour|day|week|month)$/.exec(r.db.getTickInterval()||a.tickInterval);if(f!==null){const o=f[1],y=f[2],e=r.db.getWeekday()||a.weekday;switch(y){case"millisecond":i.ticks(Bt.every(o));break;case"second":i.ticks(Rt.every(o));break;case"minute":i.ticks(Ot.every(o));break;case"hour":i.ticks(Pt.every(o));break;case"day":i.ticks(Vt.every(o));break;case"week":i.ticks(Wt[e].every(o));break;case"month":i.ticks(Mt.every(o));break}}if(P.append("g").attr("class","grid").attr("transform","translate("+k+", "+(p-50)+")").call(i).selectAll("text").style("text-anchor","middle").attr("fill","#000").attr("stroke","none").attr("font-size",10).attr("dy","1em"),r.db.topAxisEnabled()||a.topAxis){let o=fe(_).tickSize(-p+T+a.gridLineStartPadding).tickFormat(Ft(r.db.getAxisFormat()||a.axisFormat||"%Y-%m-%d"));if(f!==null){const y=f[1],e=f[2],A=r.db.getWeekday()||a.weekday;switch(e){case"millisecond":o.ticks(Bt.every(y));break;case"second":o.ticks(Rt.every(y));break;case"minute":o.ticks(Ot.every(y));break;case"hour":o.ticks(Pt.every(y));break;case"day":o.ticks(Vt.every(y));break;case"week":o.ticks(Wt[A].every(y));break;case"month":o.ticks(Mt.every(y));break}}P.append("g").attr("class","grid").attr("transform","translate("+k+", "+T+")").call(o).selectAll("text").style("text-anchor","middle").attr("fill","#000").attr("stroke","none").attr("font-size",10)}}c(rt,"makeGrid");function at(k,T){let b=0;const p=Object.keys(W).map(i=>[i,W[i]]);P.append("g").selectAll("text").data(p).enter().append(function(i){const d=i[0].split(_e.lineBreakRegex),f=-(d.length-1)/2,o=R.createElementNS("http://www.w3.org/2000/svg","text");o.setAttribute("dy",f+"em");for(const[y,e]of d.entries()){const A=R.createElementNS("http://www.w3.org/2000/svg","tspan");A.setAttribute("alignment-baseline","central"),A.setAttribute("x","10"),y>0&&A.setAttribute("dy","1em"),A.textContent=e,o.appendChild(A)}return o}).attr("x",10).attr("y",function(i,d){if(d>0)for(let f=0;f<d;f++)return b+=p[d-1][1],i[1]*k/2+b*k+T;else return i[1]*k/2+T}).attr("font-size",a.sectionFontSize).attr("class",function(i){for(const[d,f]of I.entries())if(i[0]===f)return"sectionTitle sectionTitle"+d%a.numberSectionStyles;return"sectionTitle"})}c(at,"vertLabels");function ct(k,T,b,p){const i=r.db.getTodayMarker();if(i==="off")return;const d=P.append("g").attr("class","today"),f=new Date,o=d.append("line");o.attr("x1",_(f)+k).attr("x2",_(f)+k).attr("y1",a.titleTopMargin).attr("y2",p-a.titleTopMargin).attr("class","today"),i!==""&&o.attr("style",i.replace(/,/g,";"))}c(ct,"drawToday");function ot(k){const T={},b=[];for(let p=0,i=k.length;p<i;++p)Object.prototype.hasOwnProperty.call(T,k[p])||(T[k[p]]=!0,b.push(k[p]));return b}c(ot,"checkUnique")},"draw"),fs={setConf:ls,draw:ds},hs=c(t=>`
  .mermaid-main-font {
    font-family: var(--mermaid-font-family, "trebuchet ms", verdana, arial, sans-serif);
  }

  .exclude-range {
    fill: ${t.excludeBkgColor};
  }

  .section {
    stroke: none;
    opacity: 0.2;
  }

  .section0 {
    fill: ${t.sectionBkgColor};
  }

  .section2 {
    fill: ${t.sectionBkgColor2};
  }

  .section1,
  .section3 {
    fill: ${t.altSectionBkgColor};
    opacity: 0.2;
  }

  .sectionTitle0 {
    fill: ${t.titleColor};
  }

  .sectionTitle1 {
    fill: ${t.titleColor};
  }

  .sectionTitle2 {
    fill: ${t.titleColor};
  }

  .sectionTitle3 {
    fill: ${t.titleColor};
  }

  .sectionTitle {
    text-anchor: start;
    font-family: var(--mermaid-font-family, "trebuchet ms", verdana, arial, sans-serif);
  }


  /* Grid and axis */

  .grid .tick {
    stroke: ${t.gridColor};
    opacity: 0.8;
    shape-rendering: crispEdges;
  }

  .grid .tick text {
    font-family: ${t.fontFamily};
    fill: ${t.textColor};
  }

  .grid path {
    stroke-width: 0;
  }


  /* Today line */

  .today {
    fill: none;
    stroke: ${t.todayLineColor};
    stroke-width: 2px;
  }


  /* Task styling */

  /* Default task */

  .task {
    stroke-width: 2;
  }

  .taskText {
    text-anchor: middle;
    font-family: var(--mermaid-font-family, "trebuchet ms", verdana, arial, sans-serif);
  }

  .taskTextOutsideRight {
    fill: ${t.taskTextDarkColor};
    text-anchor: start;
    font-family: var(--mermaid-font-family, "trebuchet ms", verdana, arial, sans-serif);
  }

  .taskTextOutsideLeft {
    fill: ${t.taskTextDarkColor};
    text-anchor: end;
  }


  /* Special case clickable */

  .task.clickable {
    cursor: pointer;
  }

  .taskText.clickable {
    cursor: pointer;
    fill: ${t.taskTextClickableColor} !important;
    font-weight: bold;
  }

  .taskTextOutsideLeft.clickable {
    cursor: pointer;
    fill: ${t.taskTextClickableColor} !important;
    font-weight: bold;
  }

  .taskTextOutsideRight.clickable {
    cursor: pointer;
    fill: ${t.taskTextClickableColor} !important;
    font-weight: bold;
  }


  /* Specific task settings for the sections*/

  .taskText0,
  .taskText1,
  .taskText2,
  .taskText3 {
    fill: ${t.taskTextColor};
  }

  .task0,
  .task1,
  .task2,
  .task3 {
    fill: ${t.taskBkgColor};
    stroke: ${t.taskBorderColor};
  }

  .taskTextOutside0,
  .taskTextOutside2
  {
    fill: ${t.taskTextOutsideColor};
  }

  .taskTextOutside1,
  .taskTextOutside3 {
    fill: ${t.taskTextOutsideColor};
  }


  /* Active task */

  .active0,
  .active1,
  .active2,
  .active3 {
    fill: ${t.activeTaskBkgColor};
    stroke: ${t.activeTaskBorderColor};
  }

  .activeText0,
  .activeText1,
  .activeText2,
  .activeText3 {
    fill: ${t.taskTextDarkColor} !important;
  }


  /* Completed task */

  .done0,
  .done1,
  .done2,
  .done3 {
    stroke: ${t.doneTaskBorderColor};
    fill: ${t.doneTaskBkgColor};
    stroke-width: 2;
  }

  .doneText0,
  .doneText1,
  .doneText2,
  .doneText3 {
    fill: ${t.taskTextDarkColor} !important;
  }


  /* Tasks on the critical line */

  .crit0,
  .crit1,
  .crit2,
  .crit3 {
    stroke: ${t.critBorderColor};
    fill: ${t.critBkgColor};
    stroke-width: 2;
  }

  .activeCrit0,
  .activeCrit1,
  .activeCrit2,
  .activeCrit3 {
    stroke: ${t.critBorderColor};
    fill: ${t.activeTaskBkgColor};
    stroke-width: 2;
  }

  .doneCrit0,
  .doneCrit1,
  .doneCrit2,
  .doneCrit3 {
    stroke: ${t.critBorderColor};
    fill: ${t.doneTaskBkgColor};
    stroke-width: 2;
    cursor: pointer;
    shape-rendering: crispEdges;
  }

  .milestone {
    transform: rotate(45deg) scale(0.8,0.8);
  }

  .milestoneText {
    font-style: italic;
  }
  .doneCritText0,
  .doneCritText1,
  .doneCritText2,
  .doneCritText3 {
    fill: ${t.taskTextDarkColor} !important;
  }

  .activeCritText0,
  .activeCritText1,
  .activeCritText2,
  .activeCritText3 {
    fill: ${t.taskTextDarkColor} !important;
  }

  .titleText {
    text-anchor: middle;
    font-size: 18px;
    fill: ${t.titleColor||t.textColor};
    font-family: var(--mermaid-font-family, "trebuchet ms", verdana, arial, sans-serif);
  }
`,"getStyles"),ms=hs,vs={parser:De,db:os,renderer:fs,styles:ms};export{vs as diagram};
//# sourceMappingURL=ganttDiagram-c361ad54-DTcPGoX5.js.map
