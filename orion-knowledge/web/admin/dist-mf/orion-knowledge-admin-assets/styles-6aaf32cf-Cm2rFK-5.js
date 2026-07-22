var zt=Object.defineProperty;var i=(t,s)=>zt(t,"name",{value:s,configurable:!0});import{m as Mt,n as Ht,s as Xt,a as Kt,c as Wt,b as Jt,g as G,i as ht,l as C,p as qt,L as Qt}from"./index-CAEX9gTM.js";var _t=(function(){var t=i(function(L,n,a,r){for(a=a||{},r=L.length;r--;a[L[r]]=n);return a},"o"),s=[1,2],l=[1,3],u=[1,4],d=[2,4],y=[1,9],p=[1,11],E=[1,15],f=[1,16],b=[1,17],k=[1,18],w=[1,30],j=[1,19],U=[1,20],z=[1,21],M=[1,22],H=[1,23],X=[1,25],K=[1,26],W=[1,27],J=[1,28],q=[1,29],Q=[1,32],Z=[1,33],tt=[1,34],et=[1,35],$=[1,31],o=[1,4,5,15,16,18,20,21,23,24,25,26,27,28,32,34,36,37,41,44,45,46,47,50],st=[1,4,5,13,14,15,16,18,20,21,23,24,25,26,27,28,32,34,36,37,41,44,45,46,47,50],Ct=[4,5,15,16,18,20,21,23,24,25,26,27,28,32,34,36,37,41,44,45,46,47,50],ut={trace:i(function(){},"trace"),yy:{},symbols_:{error:2,start:3,SPACE:4,NL:5,SD:6,document:7,line:8,statement:9,classDefStatement:10,cssClassStatement:11,idStatement:12,DESCR:13,"-->":14,HIDE_EMPTY:15,scale:16,WIDTH:17,COMPOSIT_STATE:18,STRUCT_START:19,STRUCT_STOP:20,STATE_DESCR:21,AS:22,ID:23,FORK:24,JOIN:25,CHOICE:26,CONCURRENT:27,note:28,notePosition:29,NOTE_TEXT:30,direction:31,acc_title:32,acc_title_value:33,acc_descr:34,acc_descr_value:35,acc_descr_multiline_value:36,classDef:37,CLASSDEF_ID:38,CLASSDEF_STYLEOPTS:39,DEFAULT:40,class:41,CLASSENTITY_IDS:42,STYLECLASS:43,direction_tb:44,direction_bt:45,direction_rl:46,direction_lr:47,eol:48,";":49,EDGE_STATE:50,STYLE_SEPARATOR:51,left_of:52,right_of:53,$accept:0,$end:1},terminals_:{2:"error",4:"SPACE",5:"NL",6:"SD",13:"DESCR",14:"-->",15:"HIDE_EMPTY",16:"scale",17:"WIDTH",18:"COMPOSIT_STATE",19:"STRUCT_START",20:"STRUCT_STOP",21:"STATE_DESCR",22:"AS",23:"ID",24:"FORK",25:"JOIN",26:"CHOICE",27:"CONCURRENT",28:"note",30:"NOTE_TEXT",32:"acc_title",33:"acc_title_value",34:"acc_descr",35:"acc_descr_value",36:"acc_descr_multiline_value",37:"classDef",38:"CLASSDEF_ID",39:"CLASSDEF_STYLEOPTS",40:"DEFAULT",41:"class",42:"CLASSENTITY_IDS",43:"STYLECLASS",44:"direction_tb",45:"direction_bt",46:"direction_rl",47:"direction_lr",49:";",50:"EDGE_STATE",51:"STYLE_SEPARATOR",52:"left_of",53:"right_of"},productions_:[0,[3,2],[3,2],[3,2],[7,0],[7,2],[8,2],[8,1],[8,1],[9,1],[9,1],[9,1],[9,2],[9,3],[9,4],[9,1],[9,2],[9,1],[9,4],[9,3],[9,6],[9,1],[9,1],[9,1],[9,1],[9,4],[9,4],[9,1],[9,2],[9,2],[9,1],[10,3],[10,3],[11,3],[31,1],[31,1],[31,1],[31,1],[48,1],[48,1],[12,1],[12,1],[12,3],[12,3],[29,1],[29,1]],performAction:i(function(n,a,r,h,S,e,B){var c=e.length-1;switch(S){case 3:return h.setRootDoc(e[c]),e[c];case 4:this.$=[];break;case 5:e[c]!="nl"&&(e[c-1].push(e[c]),this.$=e[c-1]);break;case 6:case 7:this.$=e[c];break;case 8:this.$="nl";break;case 11:this.$=e[c];break;case 12:const P=e[c-1];P.description=h.trimColon(e[c]),this.$=P;break;case 13:this.$={stmt:"relation",state1:e[c-2],state2:e[c]};break;case 14:const dt=h.trimColon(e[c]);this.$={stmt:"relation",state1:e[c-3],state2:e[c-1],description:dt};break;case 18:this.$={stmt:"state",id:e[c-3],type:"default",description:"",doc:e[c-1]};break;case 19:var v=e[c],N=e[c-2].trim();if(e[c].match(":")){var it=e[c].split(":");v=it[0],N=[N,it[1]]}this.$={stmt:"state",id:v,type:"default",description:N};break;case 20:this.$={stmt:"state",id:e[c-3],type:"default",description:e[c-5],doc:e[c-1]};break;case 21:this.$={stmt:"state",id:e[c],type:"fork"};break;case 22:this.$={stmt:"state",id:e[c],type:"join"};break;case 23:this.$={stmt:"state",id:e[c],type:"choice"};break;case 24:this.$={stmt:"state",id:h.getDividerId(),type:"divider"};break;case 25:this.$={stmt:"state",id:e[c-1].trim(),note:{position:e[c-2].trim(),text:e[c].trim()}};break;case 28:this.$=e[c].trim(),h.setAccTitle(this.$);break;case 29:case 30:this.$=e[c].trim(),h.setAccDescription(this.$);break;case 31:case 32:this.$={stmt:"classDef",id:e[c-1].trim(),classes:e[c].trim()};break;case 33:this.$={stmt:"applyClass",id:e[c-1].trim(),styleClass:e[c].trim()};break;case 34:h.setDirection("TB"),this.$={stmt:"dir",value:"TB"};break;case 35:h.setDirection("BT"),this.$={stmt:"dir",value:"BT"};break;case 36:h.setDirection("RL"),this.$={stmt:"dir",value:"RL"};break;case 37:h.setDirection("LR"),this.$={stmt:"dir",value:"LR"};break;case 40:case 41:this.$={stmt:"state",id:e[c].trim(),type:"default",description:""};break;case 42:this.$={stmt:"state",id:e[c-2].trim(),classes:[e[c].trim()],type:"default",description:""};break;case 43:this.$={stmt:"state",id:e[c-2].trim(),classes:[e[c].trim()],type:"default",description:""};break}},"anonymous"),table:[{3:1,4:s,5:l,6:u},{1:[3]},{3:5,4:s,5:l,6:u},{3:6,4:s,5:l,6:u},t([1,4,5,15,16,18,21,23,24,25,26,27,28,32,34,36,37,41,44,45,46,47,50],d,{7:7}),{1:[2,1]},{1:[2,2]},{1:[2,3],4:y,5:p,8:8,9:10,10:12,11:13,12:14,15:E,16:f,18:b,21:k,23:w,24:j,25:U,26:z,27:M,28:H,31:24,32:X,34:K,36:W,37:J,41:q,44:Q,45:Z,46:tt,47:et,50:$},t(o,[2,5]),{9:36,10:12,11:13,12:14,15:E,16:f,18:b,21:k,23:w,24:j,25:U,26:z,27:M,28:H,31:24,32:X,34:K,36:W,37:J,41:q,44:Q,45:Z,46:tt,47:et,50:$},t(o,[2,7]),t(o,[2,8]),t(o,[2,9]),t(o,[2,10]),t(o,[2,11],{13:[1,37],14:[1,38]}),t(o,[2,15]),{17:[1,39]},t(o,[2,17],{19:[1,40]}),{22:[1,41]},t(o,[2,21]),t(o,[2,22]),t(o,[2,23]),t(o,[2,24]),{29:42,30:[1,43],52:[1,44],53:[1,45]},t(o,[2,27]),{33:[1,46]},{35:[1,47]},t(o,[2,30]),{38:[1,48],40:[1,49]},{42:[1,50]},t(st,[2,40],{51:[1,51]}),t(st,[2,41],{51:[1,52]}),t(o,[2,34]),t(o,[2,35]),t(o,[2,36]),t(o,[2,37]),t(o,[2,6]),t(o,[2,12]),{12:53,23:w,50:$},t(o,[2,16]),t(Ct,d,{7:54}),{23:[1,55]},{23:[1,56]},{22:[1,57]},{23:[2,44]},{23:[2,45]},t(o,[2,28]),t(o,[2,29]),{39:[1,58]},{39:[1,59]},{43:[1,60]},{23:[1,61]},{23:[1,62]},t(o,[2,13],{13:[1,63]}),{4:y,5:p,8:8,9:10,10:12,11:13,12:14,15:E,16:f,18:b,20:[1,64],21:k,23:w,24:j,25:U,26:z,27:M,28:H,31:24,32:X,34:K,36:W,37:J,41:q,44:Q,45:Z,46:tt,47:et,50:$},t(o,[2,19],{19:[1,65]}),{30:[1,66]},{23:[1,67]},t(o,[2,31]),t(o,[2,32]),t(o,[2,33]),t(st,[2,42]),t(st,[2,43]),t(o,[2,14]),t(o,[2,18]),t(Ct,d,{7:68}),t(o,[2,25]),t(o,[2,26]),{4:y,5:p,8:8,9:10,10:12,11:13,12:14,15:E,16:f,18:b,20:[1,69],21:k,23:w,24:j,25:U,26:z,27:M,28:H,31:24,32:X,34:K,36:W,37:J,41:q,44:Q,45:Z,46:tt,47:et,50:$},t(o,[2,20])],defaultActions:{5:[2,1],6:[2,2],44:[2,44],45:[2,45]},parseError:i(function(n,a){if(a.recoverable)this.trace(n);else{var r=new Error(n);throw r.hash=a,r}},"parseError"),parse:i(function(n){var a=this,r=[0],h=[],S=[null],e=[],B=this.table,c="",v=0,N=0,it=2,P=1,dt=e.slice.call(arguments,1),g=Object.create(this.lexer),A={yy:{}};for(var yt in this.yy)Object.prototype.hasOwnProperty.call(this.yy,yt)&&(A.yy[yt]=this.yy[yt]);g.setInput(n,A.yy),A.yy.lexer=g,A.yy.parser=this,typeof g.yylloc>"u"&&(g.yylloc={});var pt=g.yylloc;e.push(pt);var jt=g.options&&g.options.ranges;typeof A.yy.parseError=="function"?this.parseError=A.yy.parseError:this.parseError=Object.getPrototypeOf(this).parseError;function Ut(){var D;return D=h.pop()||g.lex()||P,typeof D!="number"&&(D instanceof Array&&(h=D,D=h.pop()),D=a.symbols_[D]||D),D}i(Ut,"lex");for(var m,I,T,St,R={},rt,x,Lt,nt;;){if(I=r[r.length-1],this.defaultActions[I]?T=this.defaultActions[I]:((m===null||typeof m>"u")&&(m=Ut()),T=B[I]&&B[I][m]),typeof T>"u"||!T.length||!T[0]){var gt="";nt=[];for(rt in B[I])this.terminals_[rt]&&rt>it&&nt.push("'"+this.terminals_[rt]+"'");g.showPosition?gt="Parse error on line "+(v+1)+`:
`+g.showPosition()+`
Expecting `+nt.join(", ")+", got '"+(this.terminals_[m]||m)+"'":gt="Parse error on line "+(v+1)+": Unexpected "+(m==P?"end of input":"'"+(this.terminals_[m]||m)+"'"),this.parseError(gt,{text:g.match,token:this.terminals_[m]||m,line:g.yylineno,loc:pt,expected:nt})}if(T[0]instanceof Array&&T.length>1)throw new Error("Parse Error: multiple actions possible at state: "+I+", token: "+m);switch(T[0]){case 1:r.push(m),S.push(g.yytext),e.push(g.yylloc),r.push(T[1]),m=null,N=g.yyleng,c=g.yytext,v=g.yylineno,pt=g.yylloc;break;case 2:if(x=this.productions_[T[1]][1],R.$=S[S.length-x],R._$={first_line:e[e.length-(x||1)].first_line,last_line:e[e.length-1].last_line,first_column:e[e.length-(x||1)].first_column,last_column:e[e.length-1].last_column},jt&&(R._$.range=[e[e.length-(x||1)].range[0],e[e.length-1].range[1]]),St=this.performAction.apply(R,[c,N,v,A.yy,T[1],S,e].concat(dt)),typeof St<"u")return St;x&&(r=r.slice(0,-1*x*2),S=S.slice(0,-1*x),e=e.slice(0,-1*x)),r.push(this.productions_[T[1]][0]),S.push(R.$),e.push(R._$),Lt=B[r[r.length-2]][r[r.length-1]],r.push(Lt);break;case 3:return!0}}return!0},"parse")},Gt=(function(){var L={EOF:1,parseError:i(function(a,r){if(this.yy.parser)this.yy.parser.parseError(a,r);else throw new Error(a)},"parseError"),setInput:i(function(n,a){return this.yy=a||this.yy||{},this._input=n,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},"setInput"),input:i(function(){var n=this._input[0];this.yytext+=n,this.yyleng++,this.offset++,this.match+=n,this.matched+=n;var a=n.match(/(?:\r\n?|\n).*/g);return a?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),n},"input"),unput:i(function(n){var a=n.length,r=n.split(/(?:\r\n?|\n)/g);this._input=n+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-a),this.offset-=a;var h=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),r.length-1&&(this.yylineno-=r.length-1);var S=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:r?(r.length===h.length?this.yylloc.first_column:0)+h[h.length-r.length].length-r[0].length:this.yylloc.first_column-a},this.options.ranges&&(this.yylloc.range=[S[0],S[0]+this.yyleng-a]),this.yyleng=this.yytext.length,this},"unput"),more:i(function(){return this._more=!0,this},"more"),reject:i(function(){if(this.options.backtrack_lexer)this._backtrack=!0;else return this.parseError("Lexical error on line "+(this.yylineno+1)+`. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
`+this.showPosition(),{text:"",token:null,line:this.yylineno});return this},"reject"),less:i(function(n){this.unput(this.match.slice(n))},"less"),pastInput:i(function(){var n=this.matched.substr(0,this.matched.length-this.match.length);return(n.length>20?"...":"")+n.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:i(function(){var n=this.match;return n.length<20&&(n+=this._input.substr(0,20-n.length)),(n.substr(0,20)+(n.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:i(function(){var n=this.pastInput(),a=new Array(n.length+1).join("-");return n+this.upcomingInput()+`
`+a+"^"},"showPosition"),test_match:i(function(n,a){var r,h,S;if(this.options.backtrack_lexer&&(S={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges&&(S.yylloc.range=this.yylloc.range.slice(0))),h=n[0].match(/(?:\r\n?|\n).*/g),h&&(this.yylineno+=h.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:h?h[h.length-1].length-h[h.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+n[0].length},this.yytext+=n[0],this.match+=n[0],this.matches=n,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._backtrack=!1,this._input=this._input.slice(n[0].length),this.matched+=n[0],r=this.performAction.call(this,this.yy,this,a,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),r)return r;if(this._backtrack){for(var e in S)this[e]=S[e];return!1}return!1},"test_match"),next:i(function(){if(this.done)return this.EOF;this._input||(this.done=!0);var n,a,r,h;this._more||(this.yytext="",this.match="");for(var S=this._currentRules(),e=0;e<S.length;e++)if(r=this._input.match(this.rules[S[e]]),r&&(!a||r[0].length>a[0].length)){if(a=r,h=e,this.options.backtrack_lexer){if(n=this.test_match(r,S[e]),n!==!1)return n;if(this._backtrack){a=!1;continue}else return!1}else if(!this.options.flex)break}return a?(n=this.test_match(a,S[h]),n!==!1?n:!1):this._input===""?this.EOF:this.parseError("Lexical error on line "+(this.yylineno+1)+`. Unrecognized text.
`+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:i(function(){var a=this.next();return a||this.lex()},"lex"),begin:i(function(a){this.conditionStack.push(a)},"begin"),popState:i(function(){var a=this.conditionStack.length-1;return a>0?this.conditionStack.pop():this.conditionStack[0]},"popState"),_currentRules:i(function(){return this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1]?this.conditions[this.conditionStack[this.conditionStack.length-1]].rules:this.conditions.INITIAL.rules},"_currentRules"),topState:i(function(a){return a=this.conditionStack.length-1-Math.abs(a||0),a>=0?this.conditionStack[a]:"INITIAL"},"topState"),pushState:i(function(a){this.begin(a)},"pushState"),stateStackSize:i(function(){return this.conditionStack.length},"stateStackSize"),options:{"case-insensitive":!0},performAction:i(function(a,r,h,S){switch(h){case 0:return 40;case 1:return 44;case 2:return 45;case 3:return 46;case 4:return 47;case 5:break;case 6:break;case 7:return 5;case 8:break;case 9:break;case 10:break;case 11:break;case 12:return this.pushState("SCALE"),16;case 13:return 17;case 14:this.popState();break;case 15:return this.begin("acc_title"),32;case 16:return this.popState(),"acc_title_value";case 17:return this.begin("acc_descr"),34;case 18:return this.popState(),"acc_descr_value";case 19:this.begin("acc_descr_multiline");break;case 20:this.popState();break;case 21:return"acc_descr_multiline_value";case 22:return this.pushState("CLASSDEF"),37;case 23:return this.popState(),this.pushState("CLASSDEFID"),"DEFAULT_CLASSDEF_ID";case 24:return this.popState(),this.pushState("CLASSDEFID"),38;case 25:return this.popState(),39;case 26:return this.pushState("CLASS"),41;case 27:return this.popState(),this.pushState("CLASS_STYLE"),42;case 28:return this.popState(),43;case 29:return this.pushState("SCALE"),16;case 30:return 17;case 31:this.popState();break;case 32:this.pushState("STATE");break;case 33:return this.popState(),r.yytext=r.yytext.slice(0,-8).trim(),24;case 34:return this.popState(),r.yytext=r.yytext.slice(0,-8).trim(),25;case 35:return this.popState(),r.yytext=r.yytext.slice(0,-10).trim(),26;case 36:return this.popState(),r.yytext=r.yytext.slice(0,-8).trim(),24;case 37:return this.popState(),r.yytext=r.yytext.slice(0,-8).trim(),25;case 38:return this.popState(),r.yytext=r.yytext.slice(0,-10).trim(),26;case 39:return 44;case 40:return 45;case 41:return 46;case 42:return 47;case 43:this.pushState("STATE_STRING");break;case 44:return this.pushState("STATE_ID"),"AS";case 45:return this.popState(),"ID";case 46:this.popState();break;case 47:return"STATE_DESCR";case 48:return 18;case 49:this.popState();break;case 50:return this.popState(),this.pushState("struct"),19;case 51:break;case 52:return this.popState(),20;case 53:break;case 54:return this.begin("NOTE"),28;case 55:return this.popState(),this.pushState("NOTE_ID"),52;case 56:return this.popState(),this.pushState("NOTE_ID"),53;case 57:this.popState(),this.pushState("FLOATING_NOTE");break;case 58:return this.popState(),this.pushState("FLOATING_NOTE_ID"),"AS";case 59:break;case 60:return"NOTE_TEXT";case 61:return this.popState(),"ID";case 62:return this.popState(),this.pushState("NOTE_TEXT"),23;case 63:return this.popState(),r.yytext=r.yytext.substr(2).trim(),30;case 64:return this.popState(),r.yytext=r.yytext.slice(0,-8).trim(),30;case 65:return 6;case 66:return 6;case 67:return 15;case 68:return 50;case 69:return 23;case 70:return r.yytext=r.yytext.trim(),13;case 71:return 14;case 72:return 27;case 73:return 51;case 74:return 5;case 75:return"INVALID"}},"anonymous"),rules:[/^(?:default\b)/i,/^(?:.*direction\s+TB[^\n]*)/i,/^(?:.*direction\s+BT[^\n]*)/i,/^(?:.*direction\s+RL[^\n]*)/i,/^(?:.*direction\s+LR[^\n]*)/i,/^(?:%%(?!\{)[^\n]*)/i,/^(?:[^\}]%%[^\n]*)/i,/^(?:[\n]+)/i,/^(?:[\s]+)/i,/^(?:((?!\n)\s)+)/i,/^(?:#[^\n]*)/i,/^(?:%[^\n]*)/i,/^(?:scale\s+)/i,/^(?:\d+)/i,/^(?:\s+width\b)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:classDef\s+)/i,/^(?:DEFAULT\s+)/i,/^(?:\w+\s+)/i,/^(?:[^\n]*)/i,/^(?:class\s+)/i,/^(?:(\w+)+((,\s*\w+)*))/i,/^(?:[^\n]*)/i,/^(?:scale\s+)/i,/^(?:\d+)/i,/^(?:\s+width\b)/i,/^(?:state\s+)/i,/^(?:.*<<fork>>)/i,/^(?:.*<<join>>)/i,/^(?:.*<<choice>>)/i,/^(?:.*\[\[fork\]\])/i,/^(?:.*\[\[join\]\])/i,/^(?:.*\[\[choice\]\])/i,/^(?:.*direction\s+TB[^\n]*)/i,/^(?:.*direction\s+BT[^\n]*)/i,/^(?:.*direction\s+RL[^\n]*)/i,/^(?:.*direction\s+LR[^\n]*)/i,/^(?:["])/i,/^(?:\s*as\s+)/i,/^(?:[^\n\{]*)/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:[^\n\s\{]+)/i,/^(?:\n)/i,/^(?:\{)/i,/^(?:%%(?!\{)[^\n]*)/i,/^(?:\})/i,/^(?:[\n])/i,/^(?:note\s+)/i,/^(?:left of\b)/i,/^(?:right of\b)/i,/^(?:")/i,/^(?:\s*as\s*)/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:[^\n]*)/i,/^(?:\s*[^:\n\s\-]+)/i,/^(?:\s*:[^:\n;]+)/i,/^(?:[\s\S]*?end note\b)/i,/^(?:stateDiagram\s+)/i,/^(?:stateDiagram-v2\s+)/i,/^(?:hide empty description\b)/i,/^(?:\[\*\])/i,/^(?:[^:\n\s\-\{]+)/i,/^(?:\s*:[^:\n;]+)/i,/^(?:-->)/i,/^(?:--)/i,/^(?::::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{LINE:{rules:[9,10],inclusive:!1},struct:{rules:[9,10,22,26,32,39,40,41,42,51,52,53,54,68,69,70,71,72],inclusive:!1},FLOATING_NOTE_ID:{rules:[61],inclusive:!1},FLOATING_NOTE:{rules:[58,59,60],inclusive:!1},NOTE_TEXT:{rules:[63,64],inclusive:!1},NOTE_ID:{rules:[62],inclusive:!1},NOTE:{rules:[55,56,57],inclusive:!1},CLASS_STYLE:{rules:[28],inclusive:!1},CLASS:{rules:[27],inclusive:!1},CLASSDEFID:{rules:[25],inclusive:!1},CLASSDEF:{rules:[23,24],inclusive:!1},acc_descr_multiline:{rules:[20,21],inclusive:!1},acc_descr:{rules:[18],inclusive:!1},acc_title:{rules:[16],inclusive:!1},SCALE:{rules:[13,14,30,31],inclusive:!1},ALIAS:{rules:[],inclusive:!1},STATE_ID:{rules:[45],inclusive:!1},STATE_STRING:{rules:[46,47],inclusive:!1},FORK_STATE:{rules:[],inclusive:!1},STATE:{rules:[9,10,33,34,35,36,37,38,43,44,48,49,50],inclusive:!1},ID:{rules:[9,10],inclusive:!1},INITIAL:{rules:[0,1,2,3,4,5,6,7,8,10,11,12,15,17,19,22,26,29,32,50,54,65,66,67,68,69,70,71,73,74,75],inclusive:!0}}};return L})();ut.lexer=Gt;function ft(){this.yy={}}return i(ft,"Parser"),ft.prototype=ut,ut.Parser=ft,new ft})();_t.parser=_t;const ve=_t,Zt="LR",Ae="TB",mt="state",Ot="relation",te="classDef",ee="applyClass",bt="default",se="divider",xt="[*]",Nt="start",Rt=xt,wt="end",vt="color",At="fill",ie="bgFill",re=",";function $t(){return{}}i($t,"newClassesList");let Bt=Zt,ct=[],F=$t();const Pt=i(()=>({relations:[],states:{},documents:{}}),"newDoc");let ot={root:Pt()},_=ot.root,V=0,It=0;const ne={LINE:0,DOTTED_LINE:1},ae={AGGREGATION:0,EXTENSION:1,COMPOSITION:2,DEPENDENCY:3},at=i(t=>JSON.parse(JSON.stringify(t)),"clone"),le=i(t=>{C.info("Setting root doc",t),ct=t},"setRootDoc"),ce=i(()=>ct,"getRootDoc"),lt=i((t,s,l)=>{if(s.stmt===Ot)lt(t,s.state1,!0),lt(t,s.state2,!1);else if(s.stmt===mt&&(s.id==="[*]"?(s.id=l?t.id+"_start":t.id+"_end",s.start=l):s.id=s.id.trim()),s.doc){const u=[];let d=[],y;for(y=0;y<s.doc.length;y++)if(s.doc[y].type===se){const p=at(s.doc[y]);p.doc=at(d),u.push(p),d=[]}else d.push(s.doc[y]);if(u.length>0&&d.length>0){const p={stmt:mt,id:Qt(),type:"divider",doc:at(d)};u.push(at(p)),s.doc=u}s.doc.forEach(p=>lt(s,p,!0))}},"docTranslator"),oe=i(()=>(lt({id:"root"},{id:"root",doc:ct},!0),{id:"root",doc:ct}),"getRootDocV2"),he=i(t=>{let s;t.doc?s=t.doc:s=t,C.info(s),Ft(!0),C.info("Extract",s),s.forEach(l=>{switch(l.stmt){case mt:O(l.id.trim(),l.type,l.doc,l.description,l.note,l.classes,l.styles,l.textStyles);break;case Ot:Vt(l.state1,l.state2,l.description);break;case te:Yt(l.id.trim(),l.classes);break;case ee:Dt(l.id.trim(),l.styleClass);break}})},"extract"),O=i(function(t,s=bt,l=null,u=null,d=null,y=null,p=null,E=null){const f=t?.trim();_.states[f]===void 0?(C.info("Adding state ",f,u),_.states[f]={id:f,descriptions:[],type:s,doc:l,note:d,classes:[],styles:[],textStyles:[]}):(_.states[f].doc||(_.states[f].doc=l),_.states[f].type||(_.states[f].type=s)),u&&(C.info("Setting state description",f,u),typeof u=="string"&&Et(f,u.trim()),typeof u=="object"&&u.forEach(b=>Et(f,b.trim()))),d&&(_.states[f].note=d,_.states[f].note.text=ht.sanitizeText(_.states[f].note.text,G())),y&&(C.info("Setting state classes",f,y),(typeof y=="string"?[y]:y).forEach(k=>Dt(f,k.trim()))),p&&(C.info("Setting state styles",f,p),(typeof p=="string"?[p]:p).forEach(k=>Te(f,k.trim()))),E&&(C.info("Setting state styles",f,p),(typeof E=="string"?[E]:E).forEach(k=>ke(f,k.trim())))},"addState"),Ft=i(function(t){ot={root:Pt()},_=ot.root,V=0,F=$t(),t||qt()},"clear"),Y=i(function(t){return _.states[t]},"getState"),ue=i(function(){return _.states},"getStates"),fe=i(function(){C.info("Documents = ",ot)},"logDocuments"),de=i(function(){return _.relations},"getRelations");function Tt(t=""){let s=t;return t===xt&&(V++,s=`${Nt}${V}`),s}i(Tt,"startIdIfNeeded");function kt(t="",s=bt){return t===xt?Nt:s}i(kt,"startTypeIfNeeded");function ye(t=""){let s=t;return t===Rt&&(V++,s=`${wt}${V}`),s}i(ye,"endIdIfNeeded");function pe(t="",s=bt){return t===Rt?wt:s}i(pe,"endTypeIfNeeded");function Se(t,s,l){let u=Tt(t.id.trim()),d=kt(t.id.trim(),t.type),y=Tt(s.id.trim()),p=kt(s.id.trim(),s.type);O(u,d,t.doc,t.description,t.note,t.classes,t.styles,t.textStyles),O(y,p,s.doc,s.description,s.note,s.classes,s.styles,s.textStyles),_.relations.push({id1:u,id2:y,relationTitle:ht.sanitizeText(l,G())})}i(Se,"addRelationObjs");const Vt=i(function(t,s,l){if(typeof t=="object")Se(t,s,l);else{const u=Tt(t.trim()),d=kt(t),y=ye(s.trim()),p=pe(s);O(u,d),O(y,p),_.relations.push({id1:u,id2:y,title:ht.sanitizeText(l,G())})}},"addRelation"),Et=i(function(t,s){const l=_.states[t],u=s.startsWith(":")?s.replace(":","").trim():s;l.descriptions.push(ht.sanitizeText(u,G()))},"addDescription"),ge=i(function(t){return t.substring(0,1)===":"?t.substr(2).trim():t.trim()},"cleanupLabel"),_e=i(()=>(It++,"divider-id-"+It),"getDividerId"),Yt=i(function(t,s=""){F[t]===void 0&&(F[t]={id:t,styles:[],textStyles:[]});const l=F[t];s?.split(re).forEach(u=>{const d=u.replace(/([^;]*);/,"$1").trim();if(u.match(vt)){const p=d.replace(At,ie).replace(vt,At);l.textStyles.push(p)}l.styles.push(d)})},"addStyleClass"),me=i(function(){return F},"getClasses"),Dt=i(function(t,s){t.split(",").forEach(function(l){let u=Y(l);if(u===void 0){const d=l.trim();O(d),u=Y(d)}u.classes.push(s)})},"setCssClass"),Te=i(function(t,s){const l=Y(t);l!==void 0&&l.textStyles.push(s)},"setStyle"),ke=i(function(t,s){const l=Y(t);l!==void 0&&l.textStyles.push(s)},"setTextStyle"),Ee=i(()=>Bt,"getDirection"),be=i(t=>{Bt=t},"setDirection"),xe=i(t=>t&&t[0]===":"?t.substr(1).trim():t.trim(),"trimColon"),Ie={getConfig:i(()=>G().state,"getConfig"),addState:O,clear:Ft,getState:Y,getStates:ue,getRelations:de,getClasses:me,getDirection:Ee,addRelation:Vt,getDividerId:_e,setDirection:be,cleanupLabel:ge,lineType:ne,relationType:ae,logDocuments:fe,getRootDoc:ce,setRootDoc:le,getRootDocV2:oe,extract:he,trimColon:xe,getAccTitle:Jt,setAccTitle:Wt,getAccDescription:Kt,setAccDescription:Xt,addStyleClass:Yt,setCssClass:Dt,addDescription:Et,setDiagramTitle:Ht,getDiagramTitle:Mt},De=i(t=>`
defs #statediagram-barbEnd {
    fill: ${t.transitionColor};
    stroke: ${t.transitionColor};
  }
g.stateGroup text {
  fill: ${t.nodeBorder};
  stroke: none;
  font-size: 10px;
}
g.stateGroup text {
  fill: ${t.textColor};
  stroke: none;
  font-size: 10px;

}
g.stateGroup .state-title {
  font-weight: bolder;
  fill: ${t.stateLabelColor};
}

g.stateGroup rect {
  fill: ${t.mainBkg};
  stroke: ${t.nodeBorder};
}

g.stateGroup line {
  stroke: ${t.lineColor};
  stroke-width: 1;
}

.transition {
  stroke: ${t.transitionColor};
  stroke-width: 1;
  fill: none;
}

.stateGroup .composit {
  fill: ${t.background};
  border-bottom: 1px
}

.stateGroup .alt-composit {
  fill: #e0e0e0;
  border-bottom: 1px
}

.state-note {
  stroke: ${t.noteBorderColor};
  fill: ${t.noteBkgColor};

  text {
    fill: ${t.noteTextColor};
    stroke: none;
    font-size: 10px;
  }
}

.stateLabel .box {
  stroke: none;
  stroke-width: 0;
  fill: ${t.mainBkg};
  opacity: 0.5;
}

.edgeLabel .label rect {
  fill: ${t.labelBackgroundColor};
  opacity: 0.5;
}
.edgeLabel .label text {
  fill: ${t.transitionLabelColor||t.tertiaryTextColor};
}
.label div .edgeLabel {
  color: ${t.transitionLabelColor||t.tertiaryTextColor};
}

.stateLabel text {
  fill: ${t.stateLabelColor};
  font-size: 10px;
  font-weight: bold;
}

.node circle.state-start {
  fill: ${t.specialStateColor};
  stroke: ${t.specialStateColor};
}

.node .fork-join {
  fill: ${t.specialStateColor};
  stroke: ${t.specialStateColor};
}

.node circle.state-end {
  fill: ${t.innerEndBackground};
  stroke: ${t.background};
  stroke-width: 1.5
}
.end-state-inner {
  fill: ${t.compositeBackground||t.background};
  // stroke: ${t.background};
  stroke-width: 1.5
}

.node rect {
  fill: ${t.stateBkg||t.mainBkg};
  stroke: ${t.stateBorder||t.nodeBorder};
  stroke-width: 1px;
}
.node polygon {
  fill: ${t.mainBkg};
  stroke: ${t.stateBorder||t.nodeBorder};;
  stroke-width: 1px;
}
#statediagram-barbEnd {
  fill: ${t.lineColor};
}

.statediagram-cluster rect {
  fill: ${t.compositeTitleBackground};
  stroke: ${t.stateBorder||t.nodeBorder};
  stroke-width: 1px;
}

.cluster-label, .nodeLabel {
  color: ${t.stateLabelColor};
}

.statediagram-cluster rect.outer {
  rx: 5px;
  ry: 5px;
}
.statediagram-state .divider {
  stroke: ${t.stateBorder||t.nodeBorder};
}

.statediagram-state .title-state {
  rx: 5px;
  ry: 5px;
}
.statediagram-cluster.statediagram-cluster .inner {
  fill: ${t.compositeBackground||t.background};
}
.statediagram-cluster.statediagram-cluster-alt .inner {
  fill: ${t.altBackground?t.altBackground:"#efefef"};
}

.statediagram-cluster .inner {
  rx:0;
  ry:0;
}

.statediagram-state rect.basic {
  rx: 5px;
  ry: 5px;
}
.statediagram-state rect.divider {
  stroke-dasharray: 10,10;
  fill: ${t.altBackground?t.altBackground:"#efefef"};
}

.note-edge {
  stroke-dasharray: 5;
}

.statediagram-note rect {
  fill: ${t.noteBkgColor};
  stroke: ${t.noteBorderColor};
  stroke-width: 1px;
  rx: 0;
  ry: 0;
}
.statediagram-note rect {
  fill: ${t.noteBkgColor};
  stroke: ${t.noteBorderColor};
  stroke-width: 1px;
  rx: 0;
  ry: 0;
}

.statediagram-note text {
  fill: ${t.noteTextColor};
}

.statediagram-note .nodeLabel {
  color: ${t.noteTextColor};
}
.statediagram .edgeLabel {
  color: red; // ${t.noteTextColor};
}

#dependencyStart, #dependencyEnd {
  fill: ${t.lineColor};
  stroke: ${t.lineColor};
  stroke-width: 1;
}

.statediagramTitleText {
  text-anchor: middle;
  font-size: 18px;
  fill: ${t.textColor};
}
`,"getStyles"),Oe=De;export{Ae as D,Ot as S,bt as a,se as b,mt as c,Ie as d,ve as p,Oe as s};
//# sourceMappingURL=styles-6aaf32cf-Cm2rFK-5.js.map
