var re=Object.defineProperty;var C=(t,s)=>re(t,"name",{value:s,configurable:!0});import{_ as c,g as ne,s as ce,t as le,q as oe,a as ue,b as de,c as Q,d as kt,e as fe,l as G,k as he,j as ke,z as me,u as ye}from"./index-CWZ_FNac.js";import{d as F,t as ge}from"./__federation_expose_Index-Blki2IV6.js";import{t as pe,m as ve,a as Te,i as be,b as xe,c as Rt,d as Yt,e as we,f as _e,g as De,h as Ce,j as Ee,k as Se,l as Ie,n as Bt,o as zt,p as qt,s as jt,q as Xt,r as Ae,u as Fe,v as Le,w as Me}from"./advancedFormat-DO6ifB_3.js";import{l as Ve}from"./linear-CrYHcbjr.js";var wt=(function(){var t=c(function(k,l,o,d){for(o=o||{},d=k.length;d--;o[k[d]]=l);return o},"o"),s=[6,8,10,12,13,14,15,16,17,18,20,21,22,23,24,25,26,27,28,29,30,31,33,35,36,38,40],a=[1,26],n=[1,27],r=[1,28],f=[1,29],g=[1,30],S=[1,31],M=[1,32],B=[1,33],E=[1,34],V=[1,9],z=[1,10],P=[1,11],N=[1,12],_=[1,13],tt=[1,14],et=[1,15],it=[1,16],st=[1,19],K=[1,20],at=[1,21],rt=[1,22],nt=[1,23],ct=[1,25],m=[1,35],T={trace:c(C(function(){},"trace"),"trace"),yy:{},symbols_:{error:2,start:3,gantt:4,document:5,EOF:6,line:7,SPACE:8,statement:9,NL:10,weekday:11,weekday_monday:12,weekday_tuesday:13,weekday_wednesday:14,weekday_thursday:15,weekday_friday:16,weekday_saturday:17,weekday_sunday:18,weekend:19,weekend_friday:20,weekend_saturday:21,dateFormat:22,inclusiveEndDates:23,topAxis:24,axisFormat:25,tickInterval:26,excludes:27,includes:28,todayMarker:29,title:30,acc_title:31,acc_title_value:32,acc_descr:33,acc_descr_value:34,acc_descr_multiline_value:35,section:36,clickStatement:37,taskTxt:38,taskData:39,click:40,callbackname:41,callbackargs:42,href:43,clickStatementDebug:44,$accept:0,$end:1},terminals_:{2:"error",4:"gantt",6:"EOF",8:"SPACE",10:"NL",12:"weekday_monday",13:"weekday_tuesday",14:"weekday_wednesday",15:"weekday_thursday",16:"weekday_friday",17:"weekday_saturday",18:"weekday_sunday",20:"weekend_friday",21:"weekend_saturday",22:"dateFormat",23:"inclusiveEndDates",24:"topAxis",25:"axisFormat",26:"tickInterval",27:"excludes",28:"includes",29:"todayMarker",30:"title",31:"acc_title",32:"acc_title_value",33:"acc_descr",34:"acc_descr_value",35:"acc_descr_multiline_value",36:"section",38:"taskTxt",39:"taskData",40:"click",41:"callbackname",42:"callbackargs",43:"href"},productions_:[0,[3,3],[5,0],[5,2],[7,2],[7,1],[7,1],[7,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[19,1],[19,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,2],[9,2],[9,1],[9,1],[9,1],[9,2],[37,2],[37,3],[37,3],[37,4],[37,3],[37,4],[37,2],[44,2],[44,3],[44,3],[44,4],[44,3],[44,4],[44,2]],performAction:c(C(function(l,o,d,u,y,i,I){var e=i.length-1;switch(y){case 1:return i[e-1];case 2:this.$=[];break;case 3:i[e-1].push(i[e]),this.$=i[e-1];break;case 4:case 5:this.$=i[e];break;case 6:case 7:this.$=[];break;case 8:u.setWeekday("monday");break;case 9:u.setWeekday("tuesday");break;case 10:u.setWeekday("wednesday");break;case 11:u.setWeekday("thursday");break;case 12:u.setWeekday("friday");break;case 13:u.setWeekday("saturday");break;case 14:u.setWeekday("sunday");break;case 15:u.setWeekend("friday");break;case 16:u.setWeekend("saturday");break;case 17:u.setDateFormat(i[e].substr(11)),this.$=i[e].substr(11);break;case 18:u.enableInclusiveEndDates(),this.$=i[e].substr(18);break;case 19:u.TopAxis(),this.$=i[e].substr(8);break;case 20:u.setAxisFormat(i[e].substr(11)),this.$=i[e].substr(11);break;case 21:u.setTickInterval(i[e].substr(13)),this.$=i[e].substr(13);break;case 22:u.setExcludes(i[e].substr(9)),this.$=i[e].substr(9);break;case 23:u.setIncludes(i[e].substr(9)),this.$=i[e].substr(9);break;case 24:u.setTodayMarker(i[e].substr(12)),this.$=i[e].substr(12);break;case 27:u.setDiagramTitle(i[e].substr(6)),this.$=i[e].substr(6);break;case 28:this.$=i[e].trim(),u.setAccTitle(this.$);break;case 29:case 30:this.$=i[e].trim(),u.setAccDescription(this.$);break;case 31:u.addSection(i[e].substr(8)),this.$=i[e].substr(8);break;case 33:u.addTask(i[e-1],i[e]),this.$="task";break;case 34:this.$=i[e-1],u.setClickEvent(i[e-1],i[e],null);break;case 35:this.$=i[e-2],u.setClickEvent(i[e-2],i[e-1],i[e]);break;case 36:this.$=i[e-2],u.setClickEvent(i[e-2],i[e-1],null),u.setLink(i[e-2],i[e]);break;case 37:this.$=i[e-3],u.setClickEvent(i[e-3],i[e-2],i[e-1]),u.setLink(i[e-3],i[e]);break;case 38:this.$=i[e-2],u.setClickEvent(i[e-2],i[e],null),u.setLink(i[e-2],i[e-1]);break;case 39:this.$=i[e-3],u.setClickEvent(i[e-3],i[e-1],i[e]),u.setLink(i[e-3],i[e-2]);break;case 40:this.$=i[e-1],u.setLink(i[e-1],i[e]);break;case 41:case 47:this.$=i[e-1]+" "+i[e];break;case 42:case 43:case 45:this.$=i[e-2]+" "+i[e-1]+" "+i[e];break;case 44:case 46:this.$=i[e-3]+" "+i[e-2]+" "+i[e-1]+" "+i[e];break}},"anonymous"),"anonymous"),table:[{3:1,4:[1,2]},{1:[3]},t(s,[2,2],{5:3}),{6:[1,4],7:5,8:[1,6],9:7,10:[1,8],11:17,12:a,13:n,14:r,15:f,16:g,17:S,18:M,19:18,20:B,21:E,22:V,23:z,24:P,25:N,26:_,27:tt,28:et,29:it,30:st,31:K,33:at,35:rt,36:nt,37:24,38:ct,40:m},t(s,[2,7],{1:[2,1]}),t(s,[2,3]),{9:36,11:17,12:a,13:n,14:r,15:f,16:g,17:S,18:M,19:18,20:B,21:E,22:V,23:z,24:P,25:N,26:_,27:tt,28:et,29:it,30:st,31:K,33:at,35:rt,36:nt,37:24,38:ct,40:m},t(s,[2,5]),t(s,[2,6]),t(s,[2,17]),t(s,[2,18]),t(s,[2,19]),t(s,[2,20]),t(s,[2,21]),t(s,[2,22]),t(s,[2,23]),t(s,[2,24]),t(s,[2,25]),t(s,[2,26]),t(s,[2,27]),{32:[1,37]},{34:[1,38]},t(s,[2,30]),t(s,[2,31]),t(s,[2,32]),{39:[1,39]},t(s,[2,8]),t(s,[2,9]),t(s,[2,10]),t(s,[2,11]),t(s,[2,12]),t(s,[2,13]),t(s,[2,14]),t(s,[2,15]),t(s,[2,16]),{41:[1,40],43:[1,41]},t(s,[2,4]),t(s,[2,28]),t(s,[2,29]),t(s,[2,33]),t(s,[2,34],{42:[1,42],43:[1,43]}),t(s,[2,40],{41:[1,44]}),t(s,[2,35],{43:[1,45]}),t(s,[2,36]),t(s,[2,38],{42:[1,46]}),t(s,[2,37]),t(s,[2,39])],defaultActions:{},parseError:c(C(function(l,o){if(o.recoverable)this.trace(l);else{var d=new Error(l);throw d.hash=o,d}},"parseError"),"parseError"),parse:c(C(function(l){var o=this,d=[0],u=[],y=[null],i=[],I=this.table,e="",h=0,D=0,w=2,x=1,L=i.slice.call(arguments,1),v=Object.create(this.lexer),q={yy:{}};for(var lt in this.yy)Object.prototype.hasOwnProperty.call(this.yy,lt)&&(q.yy[lt]=this.yy[lt]);v.setInput(l,q.yy),q.yy.lexer=v,q.yy.parser=this,typeof v.yylloc>"u"&&(v.yylloc={});var vt=v.yylloc;i.push(vt);var se=v.options&&v.options.ranges;typeof q.yy.parseError=="function"?this.parseError=q.yy.parseError:this.parseError=Object.getPrototypeOf(this).parseError;function ae(O){d.length=d.length-2*O,y.length=y.length-O,i.length=i.length-O}C(ae,"popStack"),c(ae,"popStack");function Pt(){var O;return O=u.pop()||v.lex()||x,typeof O!="number"&&(O instanceof Array&&(u=O,O=u.pop()),O=o.symbols_[O]||O),O}C(Pt,"lex"),c(Pt,"lex");for(var W,U,R,Tt,J={},ft,j,Nt,ht;;){if(U=d[d.length-1],this.defaultActions[U]?R=this.defaultActions[U]:((W===null||typeof W>"u")&&(W=Pt()),R=I[U]&&I[U][W]),typeof R>"u"||!R.length||!R[0]){var bt="";ht=[];for(ft in I[U])this.terminals_[ft]&&ft>w&&ht.push("'"+this.terminals_[ft]+"'");v.showPosition?bt="Parse error on line "+(h+1)+`:
`+v.showPosition()+`
Expecting `+ht.join(", ")+", got '"+(this.terminals_[W]||W)+"'":bt="Parse error on line "+(h+1)+": Unexpected "+(W==x?"end of input":"'"+(this.terminals_[W]||W)+"'"),this.parseError(bt,{text:v.match,token:this.terminals_[W]||W,line:v.yylineno,loc:vt,expected:ht})}if(R[0]instanceof Array&&R.length>1)throw new Error("Parse Error: multiple actions possible at state: "+U+", token: "+W);switch(R[0]){case 1:d.push(W),y.push(v.yytext),i.push(v.yylloc),d.push(R[1]),W=null,D=v.yyleng,e=v.yytext,h=v.yylineno,vt=v.yylloc;break;case 2:if(j=this.productions_[R[1]][1],J.$=y[y.length-j],J._$={first_line:i[i.length-(j||1)].first_line,last_line:i[i.length-1].last_line,first_column:i[i.length-(j||1)].first_column,last_column:i[i.length-1].last_column},se&&(J._$.range=[i[i.length-(j||1)].range[0],i[i.length-1].range[1]]),Tt=this.performAction.apply(J,[e,D,h,q.yy,R[1],y,i].concat(L)),typeof Tt<"u")return Tt;j&&(d=d.slice(0,-1*j*2),y=y.slice(0,-1*j),i=i.slice(0,-1*j)),d.push(this.productions_[R[1]][0]),y.push(J.$),i.push(J._$),Nt=I[d[d.length-2]][d[d.length-1]],d.push(Nt);break;case 3:return!0}}return!0},"parse"),"parse")},b=(function(){var k={EOF:1,parseError:c(C(function(o,d){if(this.yy.parser)this.yy.parser.parseError(o,d);else throw new Error(o)},"parseError"),"parseError"),setInput:c(function(l,o){return this.yy=o||this.yy||{},this._input=l,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},"setInput"),input:c(function(){var l=this._input[0];this.yytext+=l,this.yyleng++,this.offset++,this.match+=l,this.matched+=l;var o=l.match(/(?:\r\n?|\n).*/g);return o?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),l},"input"),unput:c(function(l){var o=l.length,d=l.split(/(?:\r\n?|\n)/g);this._input=l+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-o),this.offset-=o;var u=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),d.length-1&&(this.yylineno-=d.length-1);var y=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:d?(d.length===u.length?this.yylloc.first_column:0)+u[u.length-d.length].length-d[0].length:this.yylloc.first_column-o},this.options.ranges&&(this.yylloc.range=[y[0],y[0]+this.yyleng-o]),this.yyleng=this.yytext.length,this},"unput"),more:c(function(){return this._more=!0,this},"more"),reject:c(function(){if(this.options.backtrack_lexer)this._backtrack=!0;else return this.parseError("Lexical error on line "+(this.yylineno+1)+`. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
`+this.showPosition(),{text:"",token:null,line:this.yylineno});return this},"reject"),less:c(function(l){this.unput(this.match.slice(l))},"less"),pastInput:c(function(){var l=this.matched.substr(0,this.matched.length-this.match.length);return(l.length>20?"...":"")+l.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:c(function(){var l=this.match;return l.length<20&&(l+=this._input.substr(0,20-l.length)),(l.substr(0,20)+(l.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:c(function(){var l=this.pastInput(),o=new Array(l.length+1).join("-");return l+this.upcomingInput()+`
`+o+"^"},"showPosition"),test_match:c(function(l,o){var d,u,y;if(this.options.backtrack_lexer&&(y={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges&&(y.yylloc.range=this.yylloc.range.slice(0))),u=l[0].match(/(?:\r\n?|\n).*/g),u&&(this.yylineno+=u.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:u?u[u.length-1].length-u[u.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+l[0].length},this.yytext+=l[0],this.match+=l[0],this.matches=l,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._backtrack=!1,this._input=this._input.slice(l[0].length),this.matched+=l[0],d=this.performAction.call(this,this.yy,this,o,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),d)return d;if(this._backtrack){for(var i in y)this[i]=y[i];return!1}return!1},"test_match"),next:c(function(){if(this.done)return this.EOF;this._input||(this.done=!0);var l,o,d,u;this._more||(this.yytext="",this.match="");for(var y=this._currentRules(),i=0;i<y.length;i++)if(d=this._input.match(this.rules[y[i]]),d&&(!o||d[0].length>o[0].length)){if(o=d,u=i,this.options.backtrack_lexer){if(l=this.test_match(d,y[i]),l!==!1)return l;if(this._backtrack){o=!1;continue}else return!1}else if(!this.options.flex)break}return o?(l=this.test_match(o,y[u]),l!==!1?l:!1):this._input===""?this.EOF:this.parseError("Lexical error on line "+(this.yylineno+1)+`. Unrecognized text.
`+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:c(C(function(){var o=this.next();return o||this.lex()},"lex"),"lex"),begin:c(C(function(o){this.conditionStack.push(o)},"begin"),"begin"),popState:c(C(function(){var o=this.conditionStack.length-1;return o>0?this.conditionStack.pop():this.conditionStack[0]},"popState"),"popState"),_currentRules:c(C(function(){return this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1]?this.conditions[this.conditionStack[this.conditionStack.length-1]].rules:this.conditions.INITIAL.rules},"_currentRules"),"_currentRules"),topState:c(C(function(o){return o=this.conditionStack.length-1-Math.abs(o||0),o>=0?this.conditionStack[o]:"INITIAL"},"topState"),"topState"),pushState:c(C(function(o){this.begin(o)},"pushState"),"pushState"),stateStackSize:c(C(function(){return this.conditionStack.length},"stateStackSize"),"stateStackSize"),options:{"case-insensitive":!0},performAction:c(C(function(o,d,u,y){switch(u){case 0:return this.begin("open_directive"),"open_directive";case 1:return this.begin("acc_title"),31;case 2:return this.popState(),"acc_title_value";case 3:return this.begin("acc_descr"),33;case 4:return this.popState(),"acc_descr_value";case 5:this.begin("acc_descr_multiline");break;case 6:this.popState();break;case 7:return"acc_descr_multiline_value";case 8:break;case 9:break;case 10:break;case 11:return 10;case 12:break;case 13:break;case 14:this.begin("href");break;case 15:this.popState();break;case 16:return 43;case 17:this.begin("callbackname");break;case 18:this.popState();break;case 19:this.popState(),this.begin("callbackargs");break;case 20:return 41;case 21:this.popState();break;case 22:return 42;case 23:this.begin("click");break;case 24:this.popState();break;case 25:return 40;case 26:return 4;case 27:return 22;case 28:return 23;case 29:return 24;case 30:return 25;case 31:return 26;case 32:return 28;case 33:return 27;case 34:return 29;case 35:return 12;case 36:return 13;case 37:return 14;case 38:return 15;case 39:return 16;case 40:return 17;case 41:return 18;case 42:return 20;case 43:return 21;case 44:return"date";case 45:return 30;case 46:return"accDescription";case 47:return 36;case 48:return 38;case 49:return 39;case 50:return":";case 51:return 6;case 52:return"INVALID"}},"anonymous"),"anonymous"),rules:[/^(?:%%\{)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:%%(?!\{)*[^\n]*)/i,/^(?:[^\}]%%*[^\n]*)/i,/^(?:%%*[^\n]*[\n]*)/i,/^(?:[\n]+)/i,/^(?:\s+)/i,/^(?:%[^\n]*)/i,/^(?:href[\s]+["])/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:call[\s]+)/i,/^(?:\([\s]*\))/i,/^(?:\()/i,/^(?:[^(]*)/i,/^(?:\))/i,/^(?:[^)]*)/i,/^(?:click[\s]+)/i,/^(?:[\s\n])/i,/^(?:[^\s\n]*)/i,/^(?:gantt\b)/i,/^(?:dateFormat\s[^#\n;]+)/i,/^(?:inclusiveEndDates\b)/i,/^(?:topAxis\b)/i,/^(?:axisFormat\s[^#\n;]+)/i,/^(?:tickInterval\s[^#\n;]+)/i,/^(?:includes\s[^#\n;]+)/i,/^(?:excludes\s[^#\n;]+)/i,/^(?:todayMarker\s[^\n;]+)/i,/^(?:weekday\s+monday\b)/i,/^(?:weekday\s+tuesday\b)/i,/^(?:weekday\s+wednesday\b)/i,/^(?:weekday\s+thursday\b)/i,/^(?:weekday\s+friday\b)/i,/^(?:weekday\s+saturday\b)/i,/^(?:weekday\s+sunday\b)/i,/^(?:weekend\s+friday\b)/i,/^(?:weekend\s+saturday\b)/i,/^(?:\d\d\d\d-\d\d-\d\d\b)/i,/^(?:title\s[^\n]+)/i,/^(?:accDescription\s[^#\n;]+)/i,/^(?:section\s[^\n]+)/i,/^(?:[^:\n]+)/i,/^(?::[^#\n;]+)/i,/^(?::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{acc_descr_multiline:{rules:[6,7],inclusive:!1},acc_descr:{rules:[4],inclusive:!1},acc_title:{rules:[2],inclusive:!1},callbackargs:{rules:[21,22],inclusive:!1},callbackname:{rules:[18,19,20],inclusive:!1},href:{rules:[15,16],inclusive:!1},click:{rules:[24,25],inclusive:!1},INITIAL:{rules:[0,1,3,5,8,9,10,11,12,13,14,17,23,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52],inclusive:!0}}};return k})();T.lexer=b;function p(){this.yy={}}return C(p,"Parser"),c(p,"Parser"),p.prototype=T,T.Parser=p,new p})();wt.parser=wt;var We=wt;F.extend(Fe);F.extend(Le);F.extend(Me);var Ut={friday:5,saturday:6},Y="",Et="",St=void 0,It="",ot=[],ut=[],At=new Map,Ft=[],gt=[],$="",Lt="",Kt=["active","done","crit","milestone","vert"],Mt=[],dt=!1,Vt=!1,Wt="sunday",pt="saturday",_t=0,Oe=c(function(){Ft=[],gt=[],$="",Mt=[],mt=0,Ct=void 0,yt=void 0,A=[],Y="",Et="",Lt="",St=void 0,It="",ot=[],ut=[],dt=!1,Vt=!1,_t=0,At=new Map,me(),Wt="sunday",pt="saturday"},"clear"),Pe=c(function(t){Et=t},"setAxisFormat"),Ne=c(function(){return Et},"getAxisFormat"),Re=c(function(t){St=t},"setTickInterval"),Ye=c(function(){return St},"getTickInterval"),Be=c(function(t){It=t},"setTodayMarker"),ze=c(function(){return It},"getTodayMarker"),qe=c(function(t){Y=t},"setDateFormat"),je=c(function(){dt=!0},"enableInclusiveEndDates"),Xe=c(function(){return dt},"endDatesAreInclusive"),Ue=c(function(){Vt=!0},"enableTopAxis"),Ge=c(function(){return Vt},"topAxisEnabled"),He=c(function(t){Lt=t},"setDisplayMode"),Ke=c(function(){return Lt},"getDisplayMode"),Je=c(function(){return Y},"getDateFormat"),Qe=c(function(t){ot=t.toLowerCase().split(/[\s,]+/)},"setIncludes"),Ze=c(function(){return ot},"getIncludes"),$e=c(function(t){ut=t.toLowerCase().split(/[\s,]+/)},"setExcludes"),ti=c(function(){return ut},"getExcludes"),ei=c(function(){return At},"getLinks"),ii=c(function(t){$=t,Ft.push(t)},"addSection"),si=c(function(){return Ft},"getSections"),ai=c(function(){let t=Gt();const s=10;let a=0;for(;!t&&a<s;)t=Gt(),a++;return gt=A,gt},"getTasks"),Jt=c(function(t,s,a,n){const r=t.format(s.trim()),f=t.format("YYYY-MM-DD");return n.includes(r)||n.includes(f)?!1:a.includes("weekends")&&(t.isoWeekday()===Ut[pt]||t.isoWeekday()===Ut[pt]+1)||a.includes(t.format("dddd").toLowerCase())?!0:a.includes(r)||a.includes(f)},"isInvalidDate"),ri=c(function(t){Wt=t},"setWeekday"),ni=c(function(){return Wt},"getWeekday"),ci=c(function(t){pt=t},"setWeekend"),Qt=c(function(t,s,a,n){if(!a.length||t.manualEndTime)return;let r;t.startTime instanceof Date?r=F(t.startTime):r=F(t.startTime,s,!0),r=r.add(1,"d");let f;t.endTime instanceof Date?f=F(t.endTime):f=F(t.endTime,s,!0);const[g,S]=li(r,f,s,a,n);t.endTime=g.toDate(),t.renderEndTime=S},"checkTaskDates"),li=c(function(t,s,a,n,r){let f=!1,g=null;for(;t<=s;)f||(g=s.toDate()),f=Jt(t,a,n,r),f&&(s=s.add(1,"d")),t=t.add(1,"d");return[s,g]},"fixTaskDates"),Dt=c(function(t,s,a){if(a=a.trim(),c(S=>{const M=S.trim();return M==="x"||M==="X"},"isTimestampFormat")(s)&&/^\d+$/.test(a))return new Date(Number(a));const f=/^after\s+(?<ids>[\d\w- ]+)/.exec(a);if(f!==null){let S=null;for(const B of f.groups.ids.split(" ")){let E=H(B);E!==void 0&&(!S||E.endTime>S.endTime)&&(S=E)}if(S)return S.endTime;const M=new Date;return M.setHours(0,0,0,0),M}let g=F(a,s.trim(),!0);if(g.isValid())return g.toDate();{G.debug("Invalid date:"+a),G.debug("With date format:"+s.trim());const S=new Date(a);if(S===void 0||isNaN(S.getTime())||S.getFullYear()<-1e4||S.getFullYear()>1e4)throw new Error("Invalid date:"+a);return S}},"getStartDate"),Zt=c(function(t){const s=/^(\d+(?:\.\d+)?)([Mdhmswy]|ms)$/.exec(t.trim());return s!==null?[Number.parseFloat(s[1]),s[2]]:[NaN,"ms"]},"parseDuration"),$t=c(function(t,s,a,n=!1){a=a.trim();const f=/^until\s+(?<ids>[\d\w- ]+)/.exec(a);if(f!==null){let E=null;for(const z of f.groups.ids.split(" ")){let P=H(z);P!==void 0&&(!E||P.startTime<E.startTime)&&(E=P)}if(E)return E.startTime;const V=new Date;return V.setHours(0,0,0,0),V}let g=F(a,s.trim(),!0);if(g.isValid())return n&&(g=g.add(1,"d")),g.toDate();let S=F(t);const[M,B]=Zt(a);if(!Number.isNaN(M)){const E=S.add(M,B);E.isValid()&&(S=E)}return S.toDate()},"getEndDate"),mt=0,Z=c(function(t){return t===void 0?(mt=mt+1,"task"+mt):t},"parseId"),oi=c(function(t,s){let a;s.substr(0,1)===":"?a=s.substr(1,s.length):a=s;const n=a.split(","),r={};Ot(n,r,Kt);for(let g=0;g<n.length;g++)n[g]=n[g].trim();let f="";switch(n.length){case 1:r.id=Z(),r.startTime=t.endTime,f=n[0];break;case 2:r.id=Z(),r.startTime=Dt(void 0,Y,n[0]),f=n[1];break;case 3:r.id=Z(n[0]),r.startTime=Dt(void 0,Y,n[1]),f=n[2];break}return f&&(r.endTime=$t(r.startTime,Y,f,dt),r.manualEndTime=F(f,"YYYY-MM-DD",!0).isValid(),Qt(r,Y,ut,ot)),r},"compileData"),ui=c(function(t,s){let a;s.substr(0,1)===":"?a=s.substr(1,s.length):a=s;const n=a.split(","),r={};Ot(n,r,Kt);for(let f=0;f<n.length;f++)n[f]=n[f].trim();switch(n.length){case 1:r.id=Z(),r.startTime={type:"prevTaskEnd",id:t},r.endTime={data:n[0]};break;case 2:r.id=Z(),r.startTime={type:"getStartDate",startData:n[0]},r.endTime={data:n[1]};break;case 3:r.id=Z(n[0]),r.startTime={type:"getStartDate",startData:n[1]},r.endTime={data:n[2]};break}return r},"parseData"),Ct,yt,A=[],te={},di=c(function(t,s){const a={section:$,type:$,processed:!1,manualEndTime:!1,renderEndTime:null,raw:{data:s},task:t,classes:[]},n=ui(yt,s);a.raw.startTime=n.startTime,a.raw.endTime=n.endTime,a.id=n.id,a.prevTaskId=yt,a.active=n.active,a.done=n.done,a.crit=n.crit,a.milestone=n.milestone,a.vert=n.vert,a.order=_t,_t++;const r=A.push(a);yt=a.id,te[a.id]=r-1},"addTask"),H=c(function(t){const s=te[t];return A[s]},"findTaskById"),fi=c(function(t,s){const a={section:$,type:$,description:t,task:t,classes:[]},n=oi(Ct,s);a.startTime=n.startTime,a.endTime=n.endTime,a.id=n.id,a.active=n.active,a.done=n.done,a.crit=n.crit,a.milestone=n.milestone,a.vert=n.vert,Ct=a,gt.push(a)},"addTaskOrg"),Gt=c(function(){const t=c(function(a){const n=A[a];let r="";switch(A[a].raw.startTime.type){case"prevTaskEnd":{const f=H(n.prevTaskId);n.startTime=f.endTime;break}case"getStartDate":r=Dt(void 0,Y,A[a].raw.startTime.startData),r&&(A[a].startTime=r);break}return A[a].startTime&&(A[a].endTime=$t(A[a].startTime,Y,A[a].raw.endTime.data,dt),A[a].endTime&&(A[a].processed=!0,A[a].manualEndTime=F(A[a].raw.endTime.data,"YYYY-MM-DD",!0).isValid(),Qt(A[a],Y,ut,ot))),A[a].processed},"compileTask");let s=!0;for(const[a,n]of A.entries())t(a),s=s&&n.processed;return s},"compileTasks"),hi=c(function(t,s){let a=s;Q().securityLevel!=="loose"&&(a=ke.sanitizeUrl(s)),t.split(",").forEach(function(n){H(n)!==void 0&&(ie(n,()=>{window.open(a,"_self")}),At.set(n,a))}),ee(t,"clickable")},"setLink"),ee=c(function(t,s){t.split(",").forEach(function(a){let n=H(a);n!==void 0&&n.classes.push(s)})},"setClass"),ki=c(function(t,s,a){if(Q().securityLevel!=="loose"||s===void 0)return;let n=[];if(typeof a=="string"){n=a.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);for(let f=0;f<n.length;f++){let g=n[f].trim();g.startsWith('"')&&g.endsWith('"')&&(g=g.substr(1,g.length-2)),n[f]=g}}n.length===0&&n.push(t),H(t)!==void 0&&ie(t,()=>{ye.runFunc(s,...n)})},"setClickFun"),ie=c(function(t,s){Mt.push(function(){const a=document.querySelector(`[id="${t}"]`);a!==null&&a.addEventListener("click",function(){s()})},function(){const a=document.querySelector(`[id="${t}-text"]`);a!==null&&a.addEventListener("click",function(){s()})})},"pushFun"),mi=c(function(t,s,a){t.split(",").forEach(function(n){ki(n,s,a)}),ee(t,"clickable")},"setClickEvent"),yi=c(function(t){Mt.forEach(function(s){s(t)})},"bindFunctions"),gi={getConfig:c(()=>Q().gantt,"getConfig"),clear:Oe,setDateFormat:qe,getDateFormat:Je,enableInclusiveEndDates:je,endDatesAreInclusive:Xe,enableTopAxis:Ue,topAxisEnabled:Ge,setAxisFormat:Pe,getAxisFormat:Ne,setTickInterval:Re,getTickInterval:Ye,setTodayMarker:Be,getTodayMarker:ze,setAccTitle:de,getAccTitle:ue,setDiagramTitle:oe,getDiagramTitle:le,setDisplayMode:He,getDisplayMode:Ke,setAccDescription:ce,getAccDescription:ne,addSection:ii,getSections:si,getTasks:ai,addTask:di,findTaskById:H,addTaskOrg:fi,setIncludes:Qe,getIncludes:Ze,setExcludes:$e,getExcludes:ti,setClickEvent:mi,setLink:hi,getLinks:ei,bindFunctions:yi,parseDuration:Zt,isInvalidDate:Jt,setWeekday:ri,getWeekday:ni,setWeekend:ci};function Ot(t,s,a){let n=!0;for(;n;)n=!1,a.forEach(function(r){const f="^\\s*"+r+"\\s*$",g=new RegExp(f);t[0].match(g)&&(s[r]=!0,t.shift(1),n=!0)})}C(Ot,"getTaskTags");c(Ot,"getTaskTags");F.extend(ge);var pi=c(function(){G.debug("Something is calling, setConf, remove the call")},"setConf"),Ht={monday:Ie,tuesday:Se,wednesday:Ee,thursday:Ce,friday:De,saturday:_e,sunday:we},vi=c((t,s)=>{let a=[...t].map(()=>-1/0),n=[...t].sort((f,g)=>f.startTime-g.startTime||f.order-g.order),r=0;for(const f of n)for(let g=0;g<a.length;g++)if(f.startTime>=a[g]){a[g]=f.endTime,f.order=g+s,g>r&&(r=g);break}return r},"getMaxIntersections"),X,xt=1e4,Ti=c(function(t,s,a,n){const r=Q().gantt,f=Q().securityLevel;let g;f==="sandbox"&&(g=kt("#i"+s));const S=f==="sandbox"?kt(g.nodes()[0].contentDocument.body):kt("body"),M=f==="sandbox"?g.nodes()[0].contentDocument:document,B=M.getElementById(s);X=B.parentElement.offsetWidth,X===void 0&&(X=1200),r.useWidth!==void 0&&(X=r.useWidth);const E=n.db.getTasks();let V=[];for(const m of E)V.push(m.type);V=ct(V);const z={};let P=2*r.topPadding;if(n.db.getDisplayMode()==="compact"||r.displayMode==="compact"){const m={};for(const b of E)m[b.section]===void 0?m[b.section]=[b]:m[b.section].push(b);let T=0;for(const b of Object.keys(m)){const p=vi(m[b],T)+1;T+=p,P+=p*(r.barHeight+r.barGap),z[b]=p}}else{P+=E.length*(r.barHeight+r.barGap);for(const m of V)z[m]=E.filter(T=>T.type===m).length}B.setAttribute("viewBox","0 0 "+X+" "+P);const N=S.select(`[id="${s}"]`),_=pe().domain([ve(E,function(m){return m.startTime}),Te(E,function(m){return m.endTime})]).rangeRound([0,X-r.leftPadding-r.rightPadding]);function tt(m,T){const b=m.startTime,p=T.startTime;let k=0;return b>p?k=1:b<p&&(k=-1),k}C(tt,"taskCompare"),c(tt,"taskCompare"),E.sort(tt),et(E,X,P),fe(N,P,X,r.useMaxWidth),N.append("text").text(n.db.getDiagramTitle()).attr("x",X/2).attr("y",r.titleTopMargin).attr("class","titleText");function et(m,T,b){const p=r.barHeight,k=p+r.barGap,l=r.topPadding,o=r.leftPadding,d=Ve().domain([0,V.length]).range(["#00B9FA","#F95002"]).interpolate(be);st(k,l,o,T,b,m,n.db.getExcludes(),n.db.getIncludes()),at(o,l,T,b),it(m,k,l,o,p,d,T),rt(k,l),nt(o,l,T,b)}C(et,"makeGantt"),c(et,"makeGantt");function it(m,T,b,p,k,l,o){m.sort((e,h)=>e.vert===h.vert?0:e.vert?1:-1);const u=[...new Set(m.map(e=>e.order))].map(e=>m.find(h=>h.order===e));N.append("g").selectAll("rect").data(u).enter().append("rect").attr("x",0).attr("y",function(e,h){return h=e.order,h*T+b-2}).attr("width",function(){return o-r.rightPadding/2}).attr("height",T).attr("class",function(e){for(const[h,D]of V.entries())if(e.type===D)return"section section"+h%r.numberSectionStyles;return"section section0"}).enter();const y=N.append("g").selectAll("rect").data(m).enter(),i=n.db.getLinks();if(y.append("rect").attr("id",function(e){return e.id}).attr("rx",3).attr("ry",3).attr("x",function(e){return e.milestone?_(e.startTime)+p+.5*(_(e.endTime)-_(e.startTime))-.5*k:_(e.startTime)+p}).attr("y",function(e,h){return h=e.order,e.vert?r.gridLineStartPadding:h*T+b}).attr("width",function(e){return e.milestone?k:e.vert?.08*k:_(e.renderEndTime||e.endTime)-_(e.startTime)}).attr("height",function(e){return e.vert?E.length*(r.barHeight+r.barGap)+r.barHeight*2:k}).attr("transform-origin",function(e,h){return h=e.order,(_(e.startTime)+p+.5*(_(e.endTime)-_(e.startTime))).toString()+"px "+(h*T+b+.5*k).toString()+"px"}).attr("class",function(e){const h="task";let D="";e.classes.length>0&&(D=e.classes.join(" "));let w=0;for(const[L,v]of V.entries())e.type===v&&(w=L%r.numberSectionStyles);let x="";return e.active?e.crit?x+=" activeCrit":x=" active":e.done?e.crit?x=" doneCrit":x=" done":e.crit&&(x+=" crit"),x.length===0&&(x=" task"),e.milestone&&(x=" milestone "+x),e.vert&&(x=" vert "+x),x+=w,x+=" "+D,h+x}),y.append("text").attr("id",function(e){return e.id+"-text"}).text(function(e){return e.task}).attr("font-size",r.fontSize).attr("x",function(e){let h=_(e.startTime),D=_(e.renderEndTime||e.endTime);if(e.milestone&&(h+=.5*(_(e.endTime)-_(e.startTime))-.5*k,D=h+k),e.vert)return _(e.startTime)+p;const w=this.getBBox().width;return w>D-h?D+w+1.5*r.leftPadding>o?h+p-5:D+p+5:(D-h)/2+h+p}).attr("y",function(e,h){return e.vert?r.gridLineStartPadding+E.length*(r.barHeight+r.barGap)+60:(h=e.order,h*T+r.barHeight/2+(r.fontSize/2-2)+b)}).attr("text-height",k).attr("class",function(e){const h=_(e.startTime);let D=_(e.endTime);e.milestone&&(D=h+k);const w=this.getBBox().width;let x="";e.classes.length>0&&(x=e.classes.join(" "));let L=0;for(const[q,lt]of V.entries())e.type===lt&&(L=q%r.numberSectionStyles);let v="";return e.active&&(e.crit?v="activeCritText"+L:v="activeText"+L),e.done?e.crit?v=v+" doneCritText"+L:v=v+" doneText"+L:e.crit&&(v=v+" critText"+L),e.milestone&&(v+=" milestoneText"),e.vert&&(v+=" vertText"),w>D-h?D+w+1.5*r.leftPadding>o?x+" taskTextOutsideLeft taskTextOutside"+L+" "+v:x+" taskTextOutsideRight taskTextOutside"+L+" "+v+" width-"+w:x+" taskText taskText"+L+" "+v+" width-"+w}),Q().securityLevel==="sandbox"){let e;e=kt("#i"+s);const h=e.nodes()[0].contentDocument;y.filter(function(D){return i.has(D.id)}).each(function(D){var w=h.querySelector("#"+D.id),x=h.querySelector("#"+D.id+"-text");const L=w.parentNode;var v=h.createElement("a");v.setAttribute("xlink:href",i.get(D.id)),v.setAttribute("target","_top"),L.appendChild(v),v.appendChild(w),v.appendChild(x)})}}C(it,"drawRects"),c(it,"drawRects");function st(m,T,b,p,k,l,o,d){if(o.length===0&&d.length===0)return;let u,y;for(const{startTime:w,endTime:x}of l)(u===void 0||w<u)&&(u=w),(y===void 0||x>y)&&(y=x);if(!u||!y)return;if(F(y).diff(F(u),"year")>5){G.warn("The difference between the min and max time is more than 5 years. This will cause performance issues. Skipping drawing exclude days.");return}const i=n.db.getDateFormat(),I=[];let e=null,h=F(u);for(;h.valueOf()<=y;)n.db.isInvalidDate(h,i,o,d)?e?e.end=h:e={start:h,end:h}:e&&(I.push(e),e=null),h=h.add(1,"d");N.append("g").selectAll("rect").data(I).enter().append("rect").attr("id",w=>"exclude-"+w.start.format("YYYY-MM-DD")).attr("x",w=>_(w.start.startOf("day"))+b).attr("y",r.gridLineStartPadding).attr("width",w=>_(w.end.endOf("day"))-_(w.start.startOf("day"))).attr("height",k-T-r.gridLineStartPadding).attr("transform-origin",function(w,x){return(_(w.start)+b+.5*(_(w.end)-_(w.start))).toString()+"px "+(x*m+.5*k).toString()+"px"}).attr("class","exclude-range")}C(st,"drawExcludeDays"),c(st,"drawExcludeDays");function K(m,T,b,p){if(b<=0||m>T)return 1/0;const k=T-m,l=F.duration({[p??"day"]:b}).asMilliseconds();return l<=0?1/0:Math.ceil(k/l)}C(K,"getEstimatedTickCount"),c(K,"getEstimatedTickCount");function at(m,T,b,p){const k=n.db.getDateFormat(),l=n.db.getAxisFormat();let o;l?o=l:k==="D"?o="%d":o=r.axisFormat??"%Y-%m-%d";let d=xe(_).tickSize(-p+T+r.gridLineStartPadding).tickFormat(Rt(o));const y=/^([1-9]\d*)(millisecond|second|minute|hour|day|week|month)$/.exec(n.db.getTickInterval()||r.tickInterval);if(y!==null){const i=parseInt(y[1],10);if(isNaN(i)||i<=0)G.warn(`Invalid tick interval value: "${y[1]}". Skipping custom tick interval.`);else{const I=y[2],e=n.db.getWeekday()||r.weekday,h=_.domain(),D=h[0],w=h[1],x=K(D,w,i,I);if(x>xt)G.warn(`The tick interval "${i}${I}" would generate ${x} ticks, which exceeds the maximum allowed (${xt}). This may indicate an invalid date or time range. Skipping custom tick interval.`);else switch(I){case"millisecond":d.ticks(Xt.every(i));break;case"second":d.ticks(jt.every(i));break;case"minute":d.ticks(qt.every(i));break;case"hour":d.ticks(zt.every(i));break;case"day":d.ticks(Bt.every(i));break;case"week":d.ticks(Ht[e].every(i));break;case"month":d.ticks(Yt.every(i));break}}}if(N.append("g").attr("class","grid").attr("transform","translate("+m+", "+(p-50)+")").call(d).selectAll("text").style("text-anchor","middle").attr("fill","#000").attr("stroke","none").attr("font-size",10).attr("dy","1em"),n.db.topAxisEnabled()||r.topAxis){let i=Ae(_).tickSize(-p+T+r.gridLineStartPadding).tickFormat(Rt(o));if(y!==null){const I=parseInt(y[1],10);if(isNaN(I)||I<=0)G.warn(`Invalid tick interval value: "${y[1]}". Skipping custom tick interval.`);else{const e=y[2],h=n.db.getWeekday()||r.weekday,D=_.domain(),w=D[0],x=D[1];if(K(w,x,I,e)<=xt)switch(e){case"millisecond":i.ticks(Xt.every(I));break;case"second":i.ticks(jt.every(I));break;case"minute":i.ticks(qt.every(I));break;case"hour":i.ticks(zt.every(I));break;case"day":i.ticks(Bt.every(I));break;case"week":i.ticks(Ht[h].every(I));break;case"month":i.ticks(Yt.every(I));break}}}N.append("g").attr("class","grid").attr("transform","translate("+m+", "+T+")").call(i).selectAll("text").style("text-anchor","middle").attr("fill","#000").attr("stroke","none").attr("font-size",10)}}C(at,"makeGrid"),c(at,"makeGrid");function rt(m,T){let b=0;const p=Object.keys(z).map(k=>[k,z[k]]);N.append("g").selectAll("text").data(p).enter().append(function(k){const l=k[0].split(he.lineBreakRegex),o=-(l.length-1)/2,d=M.createElementNS("http://www.w3.org/2000/svg","text");d.setAttribute("dy",o+"em");for(const[u,y]of l.entries()){const i=M.createElementNS("http://www.w3.org/2000/svg","tspan");i.setAttribute("alignment-baseline","central"),i.setAttribute("x","10"),u>0&&i.setAttribute("dy","1em"),i.textContent=y,d.appendChild(i)}return d}).attr("x",10).attr("y",function(k,l){if(l>0)for(let o=0;o<l;o++)return b+=p[l-1][1],k[1]*m/2+b*m+T;else return k[1]*m/2+T}).attr("font-size",r.sectionFontSize).attr("class",function(k){for(const[l,o]of V.entries())if(k[0]===o)return"sectionTitle sectionTitle"+l%r.numberSectionStyles;return"sectionTitle"})}C(rt,"vertLabels"),c(rt,"vertLabels");function nt(m,T,b,p){const k=n.db.getTodayMarker();if(k==="off")return;const l=N.append("g").attr("class","today"),o=new Date,d=l.append("line");d.attr("x1",_(o)+m).attr("x2",_(o)+m).attr("y1",r.titleTopMargin).attr("y2",p-r.titleTopMargin).attr("class","today"),k!==""&&d.attr("style",k.replace(/,/g,";"))}C(nt,"drawToday"),c(nt,"drawToday");function ct(m){const T={},b=[];for(let p=0,k=m.length;p<k;++p)Object.prototype.hasOwnProperty.call(T,m[p])||(T[m[p]]=!0,b.push(m[p]));return b}C(ct,"checkUnique"),c(ct,"checkUnique")},"draw"),bi={setConf:pi,draw:Ti},xi=c(t=>`
  .mermaid-main-font {
        font-family: ${t.fontFamily};
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
    font-family: ${t.fontFamily};
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
    font-family: ${t.fontFamily};
  }

  .taskTextOutsideRight {
    fill: ${t.taskTextDarkColor};
    text-anchor: start;
    font-family: ${t.fontFamily};
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

  .vert {
    stroke: ${t.vertLineColor};
  }

  .vertText {
    font-size: 15px;
    text-anchor: middle;
    fill: ${t.vertLineColor} !important;
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
    font-family: ${t.fontFamily};
  }
`,"getStyles"),wi=xi,Ii={parser:We,db:gi,renderer:bi,styles:wi};export{Ii as diagram};
//# sourceMappingURL=ganttDiagram-JELNMOA3-DfK_R-Z4.js.map
