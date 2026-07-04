/* ============================================================
   DKUT HOSTELS — SECURITY.JS
   XSS protection, rate limiting, input validation, sanitization
   ============================================================ */

(function (global) {
  'use strict';

  /* ── HTML Escape / XSS Prevention ── */
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#039;')
      .replace(/\//g, '&#x2F;');
  }

  function unescapeHtml(str) {
    const el = document.createElement('div');
    el.innerHTML = str;
    return el.textContent || el.innerText || '';
  }

  /* ── Sanitize URL (allow only safe schemes) ── */
  function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return '#';
    const trimmed = url.trim();
    if (/^(javascript|data|vbscript):/i.test(trimmed)) return '#';
    return trimmed;
  }

  /* ── Sanitize text input (strip HTML, trim) ── */
  function sanitizeInput(val, maxLength = 500) {
    if (val == null) return '';
    return String(val)
      .replace(/<[^>]*>/g, '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .trim()
      .slice(0, maxLength);
  }

  /* ── Validation Helpers ── */
  function isValidEmail(email) {
    if (!email) return false;
    const re = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    return re.test(String(email).toLowerCase());
  }

  function isValidPhone(phone) {
    if (!phone) return false;
    // Accept formats: 07xx, +2547xx, 2547xx, 01xx
    const cleaned = String(phone).replace(/[\s\-().]/g, '');
    return /^(\+254|254|0)[17]\d{8}$/.test(cleaned) ||
           /^(\+254|254|0)[0-9]{9,10}$/.test(cleaned);
  }

  function normalizePhone(phone) {
    if (!phone) return '';
    const cleaned = String(phone).replace(/[\s\-().]/g, '');
    if (cleaned.startsWith('+254')) return cleaned.slice(1);       // remove +
    if (cleaned.startsWith('0'))   return '254' + cleaned.slice(1);
    if (cleaned.startsWith('254')) return cleaned;
    return cleaned;
  }

  function isValidName(name, { min = 2, max = 100 } = {}) {
    if (!name) return false;
    const n = String(name).trim();
    return n.length >= min && n.length <= max && /^[a-zA-Z\s'\-\.]+$/.test(n);
  }

  /* ── Password Strength ── */
  function getPasswordStrength(pw) {
    if (!pw) return { score: 0, label: 'none', color: 'transparent' };
    let score = 0;
    if (pw.length >= 8)  score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    const map = [
      { score: 0, label: 'Too short',  color: '#ef4444' },
      { score: 1, label: 'Weak',       color: '#f97316' },
      { score: 2, label: 'Fair',       color: '#f59e0b' },
      { score: 3, label: 'Good',       color: '#3b82f6' },
      { score: 4, label: 'Strong',     color: '#0d9948' },
      { score: 5, label: 'Very Strong',color: '#059669' },
    ];
    return map[Math.min(score, map.length - 1)];
  }

  /* ── Rate Limiter ── */
  function createRateLimiter({ maxRequests = 5, windowMs = 60000, key = 'default' } = {}) {
    const storageKey = `dkut_rl_${key}`;

    return {
      check() {
        try {
          const now = Date.now();
          const raw = sessionStorage.getItem(storageKey);
          const data = raw ? JSON.parse(raw) : { count: 0, reset: now + windowMs };

          if (now > data.reset) {
            data.count = 0;
            data.reset = now + windowMs;
          }

          if (data.count >= maxRequests) {
            const wait = Math.ceil((data.reset - now) / 1000);
            return { allowed: false, retryAfter: wait };
          }

          data.count++;
          sessionStorage.setItem(storageKey, JSON.stringify(data));
          return { allowed: true, remaining: maxRequests - data.count };
        } catch {
          return { allowed: true };
        }
      },
      reset() {
        try { sessionStorage.removeItem(storageKey); } catch {}
      }
    };
  }

  /* ── CSRF Token (for form submissions) ── */
  function getCsrfToken() {
    const key = 'dkut_csrf';
    let token = sessionStorage.getItem(key);
    if (!token) {
      token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      sessionStorage.setItem(key, token);
    }
    return token;
  }

  /* ── Cookie helpers (read-only on client) ── */
  function getCookie(name) {
    const cookies = document.cookie.split(';');
    for (const c of cookies) {
      const [k, v] = c.trim().split('=');
      if (k === name) return decodeURIComponent(v || '');
    }
    return null;
  }

  /* ── Content Security Policy nonce getter ── */
  function getNonce() {
    const meta = document.querySelector('meta[name="csp-nonce"]');
    return meta ? meta.content : '';
  }

  // DisableDevtool library IIFE (minified version)
  ((e,t)=>{"object"==typeof exports&&"undefined"!=typeof module?module.exports=t():"function"==typeof define&&define.amd?define(t):(e="undefined"!=typeof globalThis?globalThis:e||self).DisableDevtool=t()})(this,function(){function a(e,t){(null==t||t>e.length)&&(t=e.length);for(var n=0,o=Array(t);n<t;n++)o[n]=e[n];return o}function n(e,t,n){t=u(t);var o=e,t=l()?Reflect.construct(t,n||[],u(e).constructor):t.apply(e,n);if(!t||"object"!=typeof t&&"function"!=typeof t){if(void 0!==t)throw new TypeError("Derived constructors may only return object or undefined");if(void 0===(t=o))throw new ReferenceError("this hasn't been initialised - super() hasn't been called")}return t}function o(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function i(e,t){for(var n=0;n<t.length;n++){var o=t[n];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),Object.defineProperty(e,H(o.key),o)}}function r(e,t,n){return t&&i(e.prototype,t),n&&i(e,n),Object.defineProperty(e,"prototype",{writable:!1}),e}function f(e,t){var n,o,i,r,u="undefined"!=typeof Symbol&&e[Symbol.iterator]||e["@@iterator"];if(u)return i=!(o=!0),{s:function(){u=u.call(e)},n:function(){var e=u.next();return o=e.done,e},e:function(e){i=!0,n=e},f:function(){try{o||null==u.return||u.return()}finally{if(i)throw n}}};if(Array.isArray(e)||(u=((e,t)=>{var n;if(e)return"string"==typeof e?a(e,t):"Map"===(n="Object"===(n={}.toString.call(e).slice(8,-1))&&e.constructor?e.constructor.name:n)||"Set"===n?Array.from(e):"Arguments"===n||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?a(e,t):void 0})(e))||t&&e&&"number"==typeof e.length)return u&&(e=u),r=0,{s:t=function(){},n:function(){return r>=e.length?{done:!0}:{done:!1,value:e[r++]}},e:function(e){throw e},f:t};throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}function e(e,t,n){return(t=H(t))in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function u(e){return(u=Object.setPrototypeOf?Object.getPrototypeOf.bind():function(e){return e.__proto__||Object.getPrototypeOf(e)})(e)}function c(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),Object.defineProperty(e,"prototype",{writable:!1}),t&&U(e,t)}function l(){try{var e=!Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],function(){}))}catch(e){}return(l=function(){return!!e})()}function U(e,t){return(U=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(e,t){return e.__proto__=t,e})(e,t)}function H(e){e=((e,t)=>{if("object"!=typeof e||!e)return e;var n=e[Symbol.toPrimitive];if(void 0===n)return("string"===t?String:Number)(e);if("object"!=typeof(n=n.call(e,t||"default")))return n;throw new TypeError("@@toPrimitive must return a primitive value.")})(e,"string");return"symbol"==typeof e?e:e+""}function s(e){return(s="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}function q(){if(d.url)window.location.href=d.url;else if(d.rewriteHTML)try{document.documentElement.innerHTML=d.rewriteHTML}catch(e){document.documentElement.innerText=d.rewriteHTML}else{try{window.opener=null,window.open("","_self"),window.close(),window.history.back()}catch(e){console.log(e)}setTimeout(function(){window.location.href=d.timeOutUrl||"https://theajack.github.io/disable-devtool/404.html?h=".concat(encodeURIComponent(location.host))},500)}}var d={md5:"",ondevtoolopen:q,ondevtoolclose:null,url:"",timeOutUrl:"",tkName:"ddtk",interval:500,disableMenu:!0,stopIntervalTime:5e3,clearIntervalWhenDevOpenTrigger:!1,detectors:[1,3,4,5,6,7],clearLog:!0,disableSelect:!1,disableInputSelect:!1,disableCopy:!1,disableCut:!1,disablePaste:!1,ignore:null,disableIframeParents:!0,seo:!0,rewriteHTML:""},z=["detectors","ondevtoolclose","ignore"];function B(e){var t,n=0<arguments.length&&void 0!==e?e:{};for(t in n.onDevtoolOpen&&(n.ondevtoolopen=n.onDevtoolOpen),n.onDevtoolClose&&(n.ondevtoolclose=n.onDevtoolClose),d){var o=t;void 0===n[o]||s(d[o])!==s(n[o])&&-1===z.indexOf(o)||(d[o]=n[o])}"function"==typeof d.ondevtoolclose&&!0===d.clearIntervalWhenDevOpenTrigger&&(d.clearIntervalWhenDevOpenTrigger=!1,console.warn("【DISABLE-DEVTOOL】clearIntervalWhenDevOpenTrigger 在使用 ondevtoolclose 时无效"))}function v(){return(new Date).getTime()}function W(e){var t=v();return e(),v()-t}function M(n,o){function e(t){return function(){n&&n();var e=t.apply(void 0,arguments);return o&&o(),e}}var t=window.alert,i=window.confirm,r=window.prompt;try{window.alert=e(t),window.confirm=e(i),window.prompt=e(r)}catch(e){}}var p,h,K,y={iframe:!1,pc:!1,qqBrowser:!1,firefox:!1,macos:!1,edge:!1,oldEdge:!1,ie:!1,iosChrome:!1,iosEdge:!1,chrome:!1,seoBot:!1,mobile:!1};function N(){function e(e){return-1!==t.indexOf(e)}var t=navigator.userAgent.toLowerCase(),n=(()=>{var e=navigator,t=e.platform;if("number"==typeof(e=e.maxTouchPoints))return 1<e;if("string"==typeof t){e=t.toLowerCase();if(/(mac|win)/i.test(e))return!1;if(/(android|iphone|ipad|ipod|arch)/i.test(e))return!0}return/(iphone|ipad|ipod|ios|android)/i.test(navigator.userAgent.toLowerCase())})(),o=!!window.top&&window!==window.top,i=!n,r=e("qqbrowser"),u=e("firefox"),a=e("macintosh"),c=e("edge"),l=c&&!e("chrome"),s=l||e("trident")||e("msie"),f=e("crios"),d=e("edgios"),v=e("chrome")||f,p=!n&&/(googlebot|baiduspider|bingbot|applebot|petalbot|yandexbot|bytespider|chrome\-lighthouse|moto g power)/i.test(t);Object.assign(y,{iframe:o,pc:i,qqBrowser:r,firefox:u,macos:a,edge:c,oldEdge:l,ie:s,iosChrome:f,iosEdge:d,chrome:v,seoBot:p,mobile:n})}function V(){for(var e=(()=>{for(var e={},t=0;t<500;t++)e["".concat(t)]="".concat(t);return e})(),t=[],n=0;n<50;n++)t.push(e);return t}function b(){d.clearLog&&K()}var X="",F=!1;function $(){var e=d.ignore;if(e){if("function"==typeof e)return e();if(0!==e.length){var t=location.href;if(X===t)return F;X=t;var n,o=!1,i=f(e);try{for(i.s();!(n=i.n()).done;){var r=n.value;if("string"==typeof r){if(-1!==t.indexOf(r)){o=!0;break}}else if(r.test(t)){o=!0;break}}}catch(e){i.e(e)}finally{i.f()}return F=o}}}var G=function(){return!1};function g(n){var t,e,o=74,i=73,r=85,u=83,a=123,c=y.macos?function(e,t){return e.metaKey&&e.altKey&&(t===i||t===o)}:function(e,t){return e.ctrlKey&&e.shiftKey&&(t===i||t===o)},l=y.macos?function(e,t){return e.metaKey&&e.altKey&&t===r||e.metaKey&&t===u}:function(e,t){return e.ctrlKey&&(t===u||t===r)};n.addEventListener("keydown",function(e){var t=(e=e||n.event).keyCode||e.which;if(t===a||c(e,t)||l(e,t))return w(n,e)},!0),t=n,d.disableMenu&&t.addEventListener("contextmenu",function(e){if("touch"!==e.pointerType)return w(t,e)},!0),e=n,(d.disableSelect||d.disableInputSelect)&&m(e,"selectstart"),e=n,d.disableCopy&&m(e,"copy"),e=n,d.disableCut&&m(e,"cut"),e=n,d.disablePaste&&m(e,"paste")}function m(o,e){o.addEventListener(e,function(e){if(!(t=e.target)||"INPUT"!==t.tagName&&"TEXTAREA"!==t.tagName&&"true"!==(null==(n=t.getAttribute)?void 0:n.call(t,"contenteditable"))){if(d.disableSelect)return w(o,e)}else if(d.disableInputSelect)return w(o,e);var t,n},!0)}function w(e,t){if(!$()&&!G())return(t=t||e.event).returnValue=!1,t.preventDefault(),!1}var T,O=!1,t={};function Y(e){t[e]=!1}function J(){for(var e in t)if(t[e])return O=!0;return O=!1}(L=T=T||{})[L.Unknown=-1]="Unknown",L[L.RegToString=0]="RegToString",L[L.DefineId=1]="DefineId",L[L.Size=2]="Size",L[L.DateToString=3]="DateToString",L[L.FuncToString=4]="FuncToString",L[L.Debugger=5]="Debugger",L[L.Performance=6]="Performance",L[L.DebugLib=7]="DebugLib";var D=(()=>r(function e(t){var n=t.type,t=t.enabled,t=void 0===t||t;o(this,e),this.type=T.Unknown,this.enabled=!0,this.type=n,this.enabled=t,this.enabled&&(te.push(this),this.init())},[{key:"onDevToolOpen",value:function(){var e;console.warn("You don't have permission to use DEVTOOL!【type = ".concat(this.type,"】")),d.clearIntervalWhenDevOpenTrigger&&ie(),window.clearTimeout(ee),d.ondevtoolopen(this.type,q),e=this.type,t[e]=!0}},{key:"init",value:function(){}}]))(),Q=(()=>{function e(){return o(this,e),n(this,e,[{type:T.DebugLib}])}return c(e,D),r(e,[{key:"init",value:function(){}},{key:"detect",value:function(){var e;(!0===(null==(e=null==(e=window.eruda)?void 0:e._devTools)?void 0:e._isShow)||window._vcOrigConsole&&window.document.querySelector("#__vconsole.vc-toggle"))&&this.onDevToolOpen()}}],[{key:"isUsing",value:function(){return!!window.eruda||!!window._vcOrigConsole}}])})(),Z=0,ee=0,te=[],ne=0;function oe(i){function e(){l=!0}function t(){l=!1}var n,o,r,u,a,c,l=!1;function s(){(c[u]===r?o:n)()}M(e,t),n=t,o=e,void 0!==(c=document).hidden?(r="hidden",a="visibilitychange",u="visibilityState"):void 0!==c.mozHidden?(r="mozHidden",a="mozvisibilitychange",u="mozVisibilityState"):void 0!==c.msHidden?(r="msHidden",a="msvisibilitychange",u="msVisibilityState"):void 0!==c.webkitHidden&&(r="webkitHidden",a="webkitvisibilitychange",u="webkitVisibilityState"),c.removeEventListener(a,s,!1),c.addEventListener(a,s,!1),Z=window.setInterval(function(){if(!(i.isSuspend||l||$())){debugger;var e,t,n=f(te);try{for(n.s();!(e=n.n()).done;){var o=e.value;Y(o.type),o.detect(ne++)}}catch(e){n.e(e)}finally{n.f()}b(),"function"==typeof d.ondevtoolclose&&(t=O,!J())&&t&&d.ondevtoolclose()}},d.interval),ee=setTimeout(function(){y.pc||Q.isUsing()||ie()},d.stopIntervalTime)}function ie(){window.clearInterval(Z)}var S=8;function re(e){for(var t=((e,t)=>{e[t>>5]|=128<<t%32,e[14+(t+64>>>9<<4)]=t;for(var n=1732584193,o=-271733879,i=-1732584194,r=271733878,u=0;u<e.length;u+=16){var a=n,c=o,l=i,s=r;n=P(n,o,i,r,e[u+0],7,-680876936),r=P(r,n,o,i,e[u+1],12,-389564586),i=P(i,r,n,o,e[u+2],17,606105819),o=P(o,i,r,n,e[u+3],22,-1044525330),n=P(n,o,i,r,e[u+4],7,-176418897),r=P(r,n,o,i,e[u+5],12,1200080426),i=P(i,r,n,o,e[u+6],17,-1473231341),o=P(o,i,r,n,e[u+7],22,-45705983),n=P(n,o,i,r,e[u+8],7,1770035416),r=P(r,n,o,i,e[u+9],12,-1958414417),i=I(i,r,n,o,e[u+10],17,-42063),o=I(o,i,r,n,e[u+11],22,-1990404162),n=P(n,o,i,r,e[u+12],7,1804603682),r=P(r,n,o,i,e[u+13],12,-40341101),i=P(i,r,n,o,e[u+14],17,-1502002290),o=P(o,i,r,n,e[u+15],22,1236535329),n=E(n,o,i,r,e[u+1],5,-165796510),r=E(r,n,o,i,e[u+6],9,-1069501632),i=E(i,r,n,o,e[u+11],14,643717713),o=E(o,i,r,n,e[u+0],20,-373897302),n=E(n,o,i,r,e[u+5],5,-701558691),r=E(r,n,o,i,e[u+10],9,38016083),i=E(i,r,n,o,e[u+15],14,-660478335),o=E(o,i,r,n,e[u+4],20,-405537848),n=E(n,o,i,r,e[u+9],5,568446438),r=E(r,n,o,i,e[u+14],9,-1019803690),i=E(i,r,n,o,e[u+3],14,-187363961),o=E(o,i,r,n,e[u+8],20,1163531501),n=E(n,o,i,r,e[u+13],5,-1444681467),r=E(r,n,o,i,e[u+2],9,-51403784),i=E(i,r,n,o,e[u+7],14,1735328473),o=E(o,i,r,n,e[u+12],20,-1926607734),n=I(n,o,i,r,e[u+5],4,-378558),r=I(r,n,o,i,e[u+8],11,-2022574463),i=I(i,r,n,o,e[u+11],16,1839030562),o=I(o,i,r,n,e[u+14],23,-35309556),n=I(n,o,i,r,e[u+1],4,-1530992060),r=I(r,n,o,i,e[u+4],11,1272893353),i=I(i,r,n,o,e[u+7],16,-155497632),o=I(o,i,r,n,e[u+10],23,-1094730640),n=I(n,o,i,r,e[u+13],4,681279174),r=I(r,n,o,i,e[u+0],11,-358537222),i=I(i,r,n,o,e[u+3],16,-722521979),o=I(o,i,r,n,e[u+6],23,76029189),n=I(n,o,i,r,e[u+9],4,-640364487),r=I(r,n,o,i,e[u+12],11,-421815835),i=I(i,r,n,o,e[u+15],16,530742520),o=I(o,i,r,n,e[u+2],23,-995338651),n=x(n,o,i,r,e[u+0],6,-198630844),r=x(r,n,o,i,e[u+7],10,1126891415),i=x(i,r,n,o,e[u+14],15,-1416354905),o=x(o,i,r,n,e[u+5],21,-57434055),n=x(n,o,i,r,e[u+12],6,1700485571),r=x(r,n,o,i,e[u+3],10,-1894986606),i=x(i,r,n,o,e[u+10],15,-1051523),o=x(o,i,r,n,e[u+1],21,-2054922799),n=x(n,o,i,r,e[u+8],6,1873313359),r=x(r,n,o,i,e[u+15],10,-30611744),i=x(i,r,n,o,e[u+6],15,-1560198380),o=x(o,i,r,n,e[u+13],21,1309151649),n=x(n,o,i,r,e[u+4],6,-145523070),r=x(r,n,o,i,e[u+11],10,-1120210379),i=x(i,r,n,o,e[u+2],15,718787259),o=x(o,i,r,n,e[u+9],21,-343485551),n=j(n,a),o=j(o,c),i=j(i,l),r=j(r,s)}return Array(n,o,i,r)})((e=>{for(var t=Array(),n=(1<<S)-1,o=0;o<e.length*S;o+=S)t[o>>5]|=(e.charCodeAt(o/S)&n)<<o%32;return t})(e),e.length*S),n="0123456789abcdef",o="",i=0;i<4*t.length;i++)o+=n.charAt(t[i>>2]>>i%4*8+4&15)+n.charAt(t[i>>2]>>i%4*8&15);return o}function k(e,t,n,o,i,r){return j((t=j(j(t,e),j(o,r)))<<i|t>>>32-i,n)}function P(e,t,n,o,i,r,u){return k(t&n|~t&o,e,t,i,r,u)}function E(e,t,n,o,i,r,u){return k(t&o|n&~o,e,t,i,r,u)}function I(e,t,n,o,i,r,u){return k(t^n^o,e,t,i,r,u)}function x(e,t,n,o,i,r,u){return k(n^(t|~o),e,t,i,r,u)}function j(e,t){var n=(65535&e)+(65535&t);return(e>>16)+(t>>16)+(n>>16)<<16|65535&n}var L=(()=>{function e(){return o(this,e),n(this,e,[{type:T.RegToString,enabled:y.qqBrowser||y.firefox}])}return c(e,D),r(e,[{key:"init",value:function(){var t=this;this.lastTime=0,this.reg=/./,p(this.reg),this.reg.toString=function(){var e;return y.qqBrowser?(e=(new Date).getTime(),t.lastTime&&e-t.lastTime<100?t.onDevToolOpen():t.lastTime=e):y.firefox&&t.onDevToolOpen(),""}}},{key:"detect",value:function(){p(this.reg)}}])})(),ue=(()=>{function e(){return o(this,e),n(this,e,[{type:T.DefineId}])}return c(e,D),r(e,[{key:"init",value:function(){var e=this;this.div=document.createElement("div"),this.div.__defineGetter__("id",function(){e.onDevToolOpen()}),Object.defineProperty(this.div,"id",{get:function(){e.onDevToolOpen()}})}},{key:"detect",value:function(){p(this.div)}}])})(),ae=(()=>{function e(){return o(this,e),n(this,e,[{type:T.Size,enabled:!y.iframe&&!y.edge}])}return c(e,D),r(e,[{key:"init",value:function(){var e=this;this.checkWindowSizeUneven(),window.addEventListener("resize",function(){setTimeout(function(){e.checkWindowSizeUneven()},100)},!0)}},{key:"detect",value:function(){}},{key:"checkWindowSizeUneven",value:function(){var e=(()=>{var e;return ce(window.devicePixelRatio)?window.devicePixelRatio:!!(ce(e=window.screen)&&e.deviceXDPI&&e.logicalXDPI)&&e.deviceXDPI/e.logicalXDPI})();if(!1!==e){if(200<window.outerWidth-window.innerWidth*e||300<window.outerHeight-window.innerHeight*e)return this.onDevToolOpen(),!1;Y(this.type)}return!0}}])})();function ce(e){return null!=e}var le=(()=>{function e(){return o(this,e),n(this,e,[{type:T.DateToString,enabled:!y.iosChrome&&!y.iosEdge}])}return c(e,D),r(e,[{key:"init",value:function(){var e=this;this.count=0,this.date=new Date,this.date.toString=function(){return e.count++,""}}},{key:"detect",value:function(){this.count=0,p(this.date),b(),2<=this.count&&this.onDevToolOpen()}}])})(),se=(()=>{function e(){return o(this,e),n(this,e,[{type:T.FuncToString,enabled:!y.iosChrome&&!y.iosEdge}])}return c(e,D),r(e,[{key:"init",value:function(){var e=this;this.count=0,this.func=function(){},this.func.toString=function(){return e.count++,""}}},{key:"detect",value:function(){this.count=0,p(this.func),b(),2<=this.count&&this.onDevToolOpen()}}])})(),fe=(()=>{function e(){return o(this,e),n(this,e,[{type:T.Debugger,enabled:y.iosChrome||y.iosEdge}])}return c(e,D),r(e,[{key:"detect",value:function(){var e=v();100<v()-e&&this.onDevToolOpen()}}])})(),de=(()=>{function t(){var e;return o(this,t),(e=n(this,t,[{type:T.Performance,enabled:y.chrome||!y.mobile}])).count=0,e}return c(t,D),r(t,[{key:"init",value:function(){this.maxPrintTime=0,this.largeObjectArray=V()}},{key:"detect",value:function(){var e=this,t=W(function(){h(e.largeObjectArray)}),n=W(function(){p(e.largeObjectArray)});if(this.maxPrintTime=Math.max(this.maxPrintTime,n),b(),0===t||0===this.maxPrintTime)return!1;t>10*this.maxPrintTime&&(2<=this.count?this.onDevToolOpen():(this.count++,this.detect()))}}])})(),ve=e(e(e(e(e(e(e(e({},T.RegToString,L),T.DefineId,ue),T.Size,ae),T.DateToString,le),T.FuncToString,se),T.Debugger,fe),T.Performance,de),T.DebugLib,Q);var C=Object.assign(function(e){function t(){var e=0<arguments.length&&void 0!==arguments[0]?arguments[0]:"";return{success:!e,reason:e}}var n;if(C.isRunning)return t("already running");if(N(),n=window.console||{log:function(){},table:function(){},clear:function(){}},K=y.ie?(p=function(){return n.log.apply(n,arguments)},h=function(){return n.table.apply(n,arguments)},function(){return n.clear()}):(p=n.log,h=n.table,n.clear),B(e),d.md5&&re((e=>{var t=window.location.search,n=window.location.hash;if(""!==(t=""===t&&""!==n?"?".concat(n.split("?")[1]):t)&&void 0!==t){n=new RegExp("(^|&)"+e+"=([^&]*)(&|$)","i"),e=t.substr(1).match(n);if(null!=e)return unescape(e[2])}return""})(d.tkName))===d.md5)return t("token passed");if(d.seo&&y.seoBot)return t("seobot");C.isRunning=!0,oe(C);var o=C,i=(G=function(){return o.isSuspend},window.top),r=window.parent;if(g(window),d.disableIframeParents&&i&&r&&i!==window){for(;r!==i;)g(r),r=r.parent;g(i)}return("all"===d.detectors?Object.keys(ve):d.detectors).forEach(function(e){new ve[e]}),t()},{isRunning:!1,isSuspend:!1,md5:re,version:"0.3.9",DetectorType:T,isDevToolOpened:J});var pe,A,_,R,L="undefined"!=typeof window&&window.document&&(pe=document.querySelector("[disable-devtool-auto]"))?(A=["disable-menu","disable-select","disable-copy","disable-cut","disable-paste","clear-log"],_=["interval"],R={},["md5","url","tk-name","detectors"].concat(A,_).forEach(function(e){var t=pe.getAttribute(e);null!==t&&(-1!==_.indexOf(e)?t=parseInt(t):-1!==A.indexOf(e)?t="false"!==t:"detector"===e&&"all"!==t&&(t=t.split(" ")),R[(e=>{var t;return-1===e.indexOf("-")?e:(t=!1,e.split("").map(function(e){return"-"===e?(t=!0,""):t?(t=!1,e.toUpperCase()):e}).join(""))})(e)]=t)}),R):null;return L&&C(L),C});window.DisableDevtool=C;

  // ── DRM & Web Decryption Protection Module ──
  const DRMProtector = (function() {
    const PASSPHRASE = 'dkut_drm_secret_key_2026';

    // Derive CryptoKey from string using SHA-256
    async function getCryptoKey(passphrase) {
      const encoder = new TextEncoder();
      const rawKey = encoder.encode(passphrase);
      const hash = await window.crypto.subtle.digest('SHA-256', rawKey);
      return window.crypto.subtle.importKey(
        'raw',
        hash,
        { name: 'AES-GCM' },
        false,
        ['decrypt', 'encrypt']
      );
    }

    // Decrypts encrypted image array buffer [12 bytes IV][Ciphertext]
    async function decryptBuffer(encryptedBuffer, passphrase) {
      const iv = encryptedBuffer.slice(0, 12);
      const ciphertext = encryptedBuffer.slice(12);
      const key = await getCryptoKey(passphrase);
      
      return window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        ciphertext
      );
    }

    // Encrypts raw image array buffer to combined buffer [12 bytes IV][Ciphertext]
    async function encryptBuffer(rawBuffer, passphrase) {
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const key = await getCryptoKey(passphrase);
      const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        rawBuffer
      );
      
      const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
      combined.set(new Uint8Array(iv), 0);
      combined.set(new Uint8Array(ciphertext), iv.byteLength);
      return combined.buffer;
    }

    // Block Canvas data extraction methods (anti-screenshot/theft via dev console)
    function blockCanvasExtraction() {
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(type, encoderOptions) {
        if (this.classList.contains('secure-canvas')) {
          console.warn('DRM Block: Canvas data extraction (toDataURL) is disabled.');
          return '';
        }
        return originalToDataURL.call(this, type, encoderOptions);
      };

      const originalToBlob = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function(callback, type, encoderOptions) {
        if (this.classList.contains('secure-canvas')) {
          console.warn('DRM Block: Canvas data extraction (toBlob) is disabled.');
          if (callback) callback(null);
          return;
        }
        return originalToBlob.call(this, callback, type, encoderOptions);
      };

      const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
        if (this.canvas.classList.contains('secure-canvas')) {
          console.warn('DRM Block: Pixel data extraction (getImageData) is disabled.');
          return new ImageData(sw, sh);
        }
        return originalGetImageData.call(this, sx, sy, sw, sh);
      };
    }

    // Get dynamic user context for watermarking
    function getWatermarkText() {
      try {
        const auth = window.DKUT && window.DKUT.auth;
        if (auth && auth.currentUser && auth.currentUser.email) {
          return `${auth.currentUser.email} (hostel.dekut.site)`;
        }
      } catch (e) {}
      return "hostel.dekut.site";
    }

    // Draw semi-transparent repeating grid watermarks
    function drawWatermark(canvas, ctx) {
      const text = getWatermarkText();
      ctx.save();
      
      const fontSize = Math.max(11, Math.floor(Math.min(canvas.width, canvas.height) * 0.045));
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
      ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
      ctx.lineWidth = 1;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
      ctx.shadowBlur = 3;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      
      const angle = -30 * Math.PI / 180;
      ctx.rotate(angle);
      
      const stepX = fontSize * 12;
      const stepY = fontSize * 5;
      const limit = Math.max(canvas.width, canvas.height) * 2;
      
      for (let x = -limit; x < limit; x += stepX) {
        for (let y = -limit; y < limit; y += stepY) {
          ctx.fillText(text, x, y);
          ctx.strokeText(text, x, y);
        }
      }
      
      ctx.restore();
    }

    // Main Image Decryption & Rendering pipeline
    async function loadSecureImage(canvas, src, passphrase = PASSPHRASE) {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error('Fetch failed');
        const arrayBuffer = await res.arrayBuffer();
        
        let decryptedBuffer;
        try {
          decryptedBuffer = await decryptBuffer(arrayBuffer, passphrase);
        } catch (e) {
          decryptedBuffer = arrayBuffer; // Fallback to raw buffer if unencrypted
        }
        
        const blob = new Blob([decryptedBuffer]);
        const blobUrl = URL.createObjectURL(blob);
        
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = function() {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            try {
              drawWatermark(canvas, ctx);
            } catch (e) {
              console.error('Failed to draw watermark:', e);
            }
            
            URL.revokeObjectURL(blobUrl); // Instantly revoke blob URL from memory
            canvas.classList.add('loaded');
            canvas.style.opacity = '1'; // Ensure canvas is visible
            resolve();
          };
          img.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            reject(new Error('Image decode error'));
          };
          img.src = blobUrl;
        });
      } catch (err) {
        // Fallback: If network or encryption fails, load standard image directly onto canvas
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = function() {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            try {
              drawWatermark(canvas, ctx);
            } catch (e) {
              console.error('Failed to draw watermark:', e);
            }
            
            canvas.classList.add('loaded');
            canvas.style.opacity = '1'; // Ensure canvas is visible
            resolve();
          };
          img.onerror = () => {
            canvas.width = 400;
            canvas.height = 250;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#1f2937';
            ctx.fillRect(0, 0, 400, 250);
            ctx.fillStyle = '#ef4444';
            ctx.font = '14px sans-serif';
            ctx.fillText('Image protection loading failed', 20, 125);
            canvas.classList.add('loaded');
            canvas.style.opacity = '1'; // Ensure canvas is visible
            resolve();
          };
          img.src = src;
        });
      }
    }

    // Setup Lazy loading observer for Canvas DRM images
    const lazyObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const canvas = entry.target;
          const src = canvas.getAttribute('data-secure-src');
          if (src) {
            loadSecureImage(canvas, src);
            canvas.removeAttribute('data-secure-src');
          }
          lazyObserver.unobserve(canvas);
        }
      });
    }, { rootMargin: '120px' });

    // Debounce scanAndObserve so MutationObserver doesn't thrash on heavy DOM updates
    let _scanTimer = null;
    function scanAndObserve() {
      clearTimeout(_scanTimer);
      _scanTimer = setTimeout(_doScan, 80);
    }

    function _doScan() {
      // 1. Process custom secure canvas elements
      document.querySelectorAll('canvas.secure-canvas[data-secure-src]').forEach(canvas => {
        lazyObserver.observe(canvas);
      });

      // 2. Scan and dynamically convert standard images to secure watermarked canvases
      document.querySelectorAll('img:not(.secure-protected-img):not(.logo-img):not(.icon-img)').forEach(img => {
        if (img.getAttribute('data-no-drm') === 'true' || img.classList.contains('no-drm')) return;
        
        // Skip small layout icons/logos
        if (img.naturalWidth > 0 && img.naturalWidth < 40) return;
        if (img.width > 0 && img.width < 40) return;
        
        // Skip standard font-awesome/favicon/marker graphics
        const src = img.src || '';
        if (!src || src.includes('data:image/svg+xml') || src.endsWith('.svg') || src.includes('favicon')) return;

        syncImageToCanvas(img);
      });
    }

    function syncImageToCanvas(img) {
      if (img.classList.contains('secure-protected-img')) return;

      // Block drag on the source img directly
      img.setAttribute('draggable', 'false');
      img.addEventListener('dragstart', e => e.preventDefault(), true);
      img.addEventListener('contextmenu', e => e.preventDefault(), true);

      let canvas = img.nextElementSibling;
      if (!canvas || !canvas.classList.contains('secure-canvas-sync')) {
        canvas = document.createElement('canvas');
        canvas.className = img.className + ' secure-canvas secure-canvas-sync';
        
        // Copy styles
        canvas.style.cssText = img.style.cssText;
        
        // Copy attributes
        for (let attr of img.attributes) {
          if (attr.name !== 'src' && attr.name !== 'class' && attr.name !== 'style' && attr.name !== 'id') {
            canvas.setAttribute(attr.name, attr.value);
          }
        }
        
        // Prevent drag / right-click on the canvas too
        canvas.setAttribute('draggable', 'false');
        canvas.addEventListener('dragstart', e => e.preventDefault(), true);
        canvas.addEventListener('contextmenu', e => e.preventDefault(), true);

        // Hide the original image visually but keep it in flow
        img.style.setProperty('display', 'none', 'important');
        img.classList.add('secure-protected-img');
        
        // Insert canvas after image
        img.parentNode.insertBefore(canvas, img.nextSibling);
      }
      
      const draw = () => {
        if (!img.naturalWidth || !img.naturalHeight) return;
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        try {
          ctx.drawImage(img, 0, 0);
          drawWatermark(canvas, ctx);
        } catch (e) {
          // Tainted canvas (cross-origin) — just show the image without extractable pixel data
        }
        canvas.style.display = ''; // Ensure canvas is visible
      };
      
      // Always rely on the load event first — covers lazy-loaded and dynamic images
      if (img.complete && img.naturalWidth) {
        // Already loaded: draw immediately but also queue a microtask in case
        // naturalWidth is briefly reported before decode completes
        draw();
      } else {
        img.addEventListener('load', draw, { once: true });
      }

      // Handle image decode errors gracefully
      img.addEventListener('error', () => {
        canvas.width = 400;
        canvas.height = 250;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(0, 0, 400, 250);
        canvas.style.display = '';
      }, { once: true });
      
      // Observe src changes so re-assigned images get re-watermarked
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'src') {
            if (img.complete && img.naturalWidth) {
              draw();
            } else {
              img.addEventListener('load', draw, { once: true });
            }
          }
        });
      });
      observer.observe(img, { attributes: true, attributeFilter: ['src'] });
    }

    function deployProtectionShields() {
      const targets = document.querySelectorAll('.card-hero-wrap, .carousel-card, .lightbox, .location-photo-wrap, .service-card-wrap');
      targets.forEach(wrap => {
        if (wrap.querySelector('.protection-shield')) return;

        if (window.getComputedStyle(wrap).position === 'static') {
          wrap.style.position = 'relative';
        }

        const shield = document.createElement('div');
        shield.className = 'protection-shield';
        shield.style.position = 'absolute';
        shield.style.top = '0';
        shield.style.left = '0';
        shield.style.right = '0';
        shield.style.bottom = '0';
        shield.style.background = 'transparent';
        shield.style.zIndex = '5';
        shield.setAttribute('oncontextmenu', 'return false;');
        
        shield.addEventListener('contextmenu', e => e.preventDefault());
        shield.addEventListener('dragstart', e => e.preventDefault());
        shield.addEventListener('selectstart', e => e.preventDefault());
        
        wrap.appendChild(shield);
      });
    }

    function applyGeneralProtections() {
      // 1. Inject global protection CSS rules
      const style = document.createElement('style');
      style.id = 'sec-styles';
      style.innerHTML = `
        .card-hero-img, .location-photo-img, .service-card-img, #lightbox-img, .secure-img, .protection-shield, .secure-canvas, .secure-canvas-sync {
          -webkit-touch-callout: none !important;
          -webkit-user-select: none !important;
          -khtml-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          user-select: none !important;
          -webkit-user-drag: none !important;
          user-drag: none !important;
          pointer-events: none !important;
        }
        .carousel-card canvas {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: filter 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          pointer-events: none;
          will-change: filter;
        }
        .carousel-card.pos-center canvas {
          filter: none;
        }
        .carousel-card.pos-left-1 canvas,
        .carousel-card.pos-left-2 canvas,
        .carousel-card.pos-right-1 canvas,
        .carousel-card.pos-right-2 canvas {
          filter: grayscale(100%);
        }
        .lightbox canvas {
          max-width: 90vw;
          max-height: 85vh;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.8);
          transition: transform 0.3s ease;
          display: block;
          margin: auto;
        }
        @media print {
          body { display: none !important; }
          img, canvas, picture { display: none !important; }
        }
      `;
      (document.head || document.getElementsByTagName('head')[0] || document.documentElement).appendChild(style);
    }

    function freezeTab() {
      try {
        localStorage.clear();
        sessionStorage.clear();
        document.documentElement.innerHTML = `
          <div style="background:#111827;color:#ef4444;height:100vh;width:100vw;display:flex;align-items:center;justify-content:center;font-family:sans-serif;font-size:20px;font-weight:bold;flex-direction:column;gap:12px;">
            <span>⚠️ Access Denied: Developer Tools Detected</span>
            <span style="font-size:14px;color:#9ca3af;font-weight:normal;">Page execution suspended for safety.</span>
          </div>
        `;
      } catch(e) {}
      setTimeout(() => {
        window.location.replace("about:blank");
      }, 100);
      while(true) {
        debugger;
      }
    }

    function stubConsole() {
      try {
        const noop = function() {};
        const methods = ['log', 'warn', 'error', 'info', 'table', 'dir', 'clear', 'trace', 'assert', 'count', 'debug', 'group', 'groupCollapsed', 'groupEnd', 'time', 'timeEnd'];
        if (window.console) {
          methods.forEach(method => {
            if (window.console[method]) {
              window.console[method] = noop;
            }
          });
        }
      } catch(e) {}
    }

    function setupKeyboardAndMouseBlockers() {
      window.addEventListener('keydown', function(e) {
        const keyCode = e.keyCode || e.which;
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
        const shift = e.shiftKey;
        const alt = e.altKey;
        
        let block = false;
        
        if (keyCode === 123) {
          block = true;
        }
        if (cmdOrCtrl && shift && (keyCode === 73 || keyCode === 74 || keyCode === 67 || keyCode === 75 || keyCode === 69)) {
          block = true;
        }
        if (isMac && cmdOrCtrl && alt && (keyCode === 73 || keyCode === 74 || keyCode === 67 || keyCode === 75 || keyCode === 69 || keyCode === 85)) {
          block = true;
        }
        if (cmdOrCtrl && keyCode === 85) {
          block = true;
        }
        if (cmdOrCtrl && keyCode === 83) {
          block = true;
        }
        if (cmdOrCtrl && keyCode === 80) {
          block = true;
        }
        if (keyCode === 44 || e.key === 'PrintScreen') {
          block = true;
          triggerBlackout();
          try {
            navigator.clipboard.writeText('⚠️ Protected Content - Screenshot Blocked').catch(() => {});
          } catch(err) {}
        }
        
        if (block) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }, true);

      window.addEventListener('keyup', function(e) {
        const keyCode = e.keyCode || e.which;
        if (keyCode === 44 || e.key === 'PrintScreen') {
          triggerBlackout();
          try {
            navigator.clipboard.writeText('⚠️ Protected Content - Screenshot Blocked').catch(() => {});
          } catch(err) {}
        }
      }, true);
      
      window.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }, true);
      
      window.addEventListener('selectstart', function(e) {
        const target = e.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.getAttribute('contenteditable') === 'true')) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        return false;
      }, true);
      
      const blockClipboard = function(e) {
        const target = e.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.getAttribute('contenteditable') === 'true')) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        return false;
      };
      
      window.addEventListener('copy', blockClipboard, true);
      window.addEventListener('cut', blockClipboard, true);
      window.addEventListener('paste', blockClipboard, true);
    }

    function setupDOMProtections() {
      if (!document.body) return;
      deployProtectionShields();
      const DOMObserver = new MutationObserver(deployProtectionShields);
      DOMObserver.observe(document.body, { childList: true, subtree: true });

      scanAndObserve();
      const watchObserver = new MutationObserver(scanAndObserve);
      watchObserver.observe(document.body, { childList: true, subtree: true });
    }

    let blackoutActive = false;

    function triggerBlackout() {
      if (blackoutActive) return;
      blackoutActive = true;
      
      let overlay = document.getElementById('screenshot-blackout-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'screenshot-blackout-overlay';
        overlay.innerHTML = `
          <div style="text-align:center;color:#ef4444;font-family:system-ui,-apple-system,sans-serif;">
            <div style="font-size:48px;margin-bottom:12px;">⚠️</div>
            <div style="font-size:22px;font-weight:bold;letter-spacing:1px;margin-bottom:8px;">SCREEN CAPTURE BLOCKED</div>
            <div style="font-size:14px;color:#9ca3af;">Images are protected. Screenshots and screen recording are disabled on this portal.</div>
          </div>
        `;
        document.body.appendChild(overlay);
      }
      
      overlay.style.display = 'flex';
      
      // Blur all protected assets
      document.querySelectorAll('canvas.secure-canvas, canvas.secure-canvas-sync, img, .card-hero-wrap, .carousel-card, .lightbox').forEach(el => {
        el.classList.add('screenshot-blurred');
      });
      
      setTimeout(() => {
        overlay.style.display = 'none';
        blackoutActive = false;
        if (document.hasFocus()) {
          document.querySelectorAll('canvas.secure-canvas, canvas.secure-canvas-sync, img, .card-hero-wrap, .carousel-card, .lightbox').forEach(el => {
            el.classList.remove('screenshot-blurred');
          });
        }
      }, 1200);
    }

    function setupScreenshotProtection() {
      // 1. Inject CSS for blur and blackout overlay
      const style = document.createElement('style');
      style.id = 'screenshot-sec-styles';
      style.innerHTML = `
        .screenshot-blurred {
          filter: blur(40px) !important;
          transition: filter 0.1s ease-in-out !important;
        }
        #screenshot-blackout-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(17, 24, 39, 0.99) !important;
          z-index: 2147483647 !important;
          display: none;
          align-items: center;
          justify-content: center;
        }
      `;
      (document.head || document.documentElement).appendChild(style);

      const blurAssets = () => {
        document.querySelectorAll('canvas.secure-canvas, canvas.secure-canvas-sync, img, .card-hero-wrap, .carousel-card, .lightbox').forEach(el => {
          el.classList.add('screenshot-blurred');
        });
      };

      const unblurAssets = () => {
        if (!blackoutActive) {
          document.querySelectorAll('canvas.secure-canvas, canvas.secure-canvas-sync, img, .card-hero-wrap, .carousel-card, .lightbox').forEach(el => {
            el.classList.remove('screenshot-blurred');
          });
        }
      };

      window.addEventListener('blur', blurAssets);
      window.addEventListener('focus', unblurAssets);

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          blurAssets();
        } else {
          unblurAssets();
        }
      });

      // Mouse leave detection to protect assets when cursor is outside viewport (desktop only)
      if (window.matchMedia("(hover: hover)").matches) {
        document.addEventListener('mouseleave', blurAssets);
        document.addEventListener('mouseenter', unblurAssets);
      }
    }

    function setupAuthListener() {
      const attach = () => {
        try {
          const auth = window.DKUT && window.DKUT.auth;
          if (auth && typeof auth.onAuthStateChanged === 'function') {
            auth.onAuthStateChanged(() => {
              // Re-draw all secure canvases with the new watermark (email is now resolved)
              document.querySelectorAll('canvas.secure-canvas-sync').forEach(canvas => {
                const img = canvas.previousElementSibling;
                if (img && img.tagName === 'IMG' && img.complete && img.naturalWidth) {
                  const ctx = canvas.getContext('2d');
                  canvas.width = img.naturalWidth;
                  canvas.height = img.naturalHeight;
                  ctx.drawImage(img, 0, 0);
                  drawWatermark(canvas, ctx);
                }
              });
            });
            return true;
          }
        } catch (e) {}
        return false;
      };

      if (!attach()) {
        let count = 0;
        const interval = setInterval(() => {
          count++;
          if (attach() || count > 10) {
            clearInterval(interval);
          }
        }, 500);
      }
    }

    function init() {
      blockCanvasExtraction();
      
      applyGeneralProtections();
      setupScreenshotProtection();
      setupKeyboardAndMouseBlockers();
      setupAuthListener();
      
      // Initialize DevTools Block
      if (typeof window.DisableDevtool !== 'undefined') {
        window.DisableDevtool({
          url: 'about:blank',
          disableMenu: true,
          disableSelect: true,
          disableCopy: true,
          disableCut: true,
          disablePaste: true,
          disableIframeParents: true,
          interval: 250,
          detectors: 'all',
          ondevtoolopen: function(type, next) {
            console.warn('Developer tools detected! Intercept type:', type);
            freezeTab();
            next();
          }
        });
      }

      stubConsole();

      if (document.body) {
        setupDOMProtections();
      } else {
        document.addEventListener('DOMContentLoaded', setupDOMProtections);
      }
    }

    // Expose API
    return {
      init: init,
      loadSecureImage: loadSecureImage,
      encryptImage: async function(file, passphrase = PASSPHRASE) {
        const arrayBuffer = await file.arrayBuffer();
        return encryptBuffer(arrayBuffer, passphrase);
      }
    };
  })();

  // Auto-run when module is loaded
  DRMProtector.init();

  // Export to window
  window.DRMProtector = DRMProtector;

  /* ── Clickjacking, Input, & URL Query Parameter Shields ── */
  function preventClickjacking() {
    if (window.self !== window.top) {
      try {
        if (!window.parent.location.hostname.endsWith('dekut.site') && !window.parent.location.hostname.endsWith('localhost') && window.parent.location.hostname !== '127.0.0.1') {
          window.top.location.replace(window.location.href);
        }
      } catch (e) {
        window.top.location.replace(window.location.href);
      }
    }
  }

  function sanitizeQueryParameters() {
    const params = new URLSearchParams(window.location.search);
    let dirty = false;
    // Detect actual attack patterns — more specific than broad keyword matching
    const pattern = /(<script|<\/script|script\s*:|javascript\s*:|data\s*:[^,]*base64|onload\s*=|onerror\s*=|onmouseover\s*=|eval\s*\(|document\s*\.\s*cookie|window\s*\.\s*location|<iframe|<object|UNION\s+SELECT|INSERT\s+INTO|DROP\s+TABLE|UPDATE\s+\w+\s+SET|DELETE\s+FROM|--|;\s*(SELECT|INSERT|UPDATE|DELETE))/i;
    
    for (const [key, value] of params.entries()) {
      // Skip the hostel ID param — it is always a numeric string (safe)
      if (key === 'h' && /^\d+$/.test(value)) continue;

      if (pattern.test(key) || pattern.test(value)) {
        params.delete(key);
        dirty = true;
      }
    }
    
    if (dirty) {
      const newSearch = params.toString();
      const cleanUrl = window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash;
      window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
    }
  }

  function setupFormSanitizer() {
    document.addEventListener('submit', function(e) {
      const form = e.target;
      if (form && form.tagName === 'FORM') {
        form.querySelectorAll('input[type="text"], textarea').forEach(input => {
          if (!input.classList.contains('no-sanitize')) {
            input.value = sanitizeInput(input.value);
          }
        });
      }
    }, true);
  }

  // Run general shields
  preventClickjacking();
  sanitizeQueryParameters();
  if (document.body) {
    setupFormSanitizer();
  } else {
    document.addEventListener('DOMContentLoaded', setupFormSanitizer);
  }

  /* ── Expose ── */
  global.DKUT = global.DKUT || {};
  global.DKUT.security = {
    escapeHtml,
    unescapeHtml,
    sanitizeUrl,
    sanitizeInput,
    isValidEmail,
    isValidPhone,
    normalizePhone,
    isValidName,
    getPasswordStrength,
    createRateLimiter,
    getCsrfToken,
    getCookie,
    getNonce,
    DRMProtector,
    preventClickjacking,
    sanitizeQueryParameters
  };

})(window);
