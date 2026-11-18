import {handle} from './app';
import {JAVASCRIPT,STYLES} from './assets.generated';
export default {async fetch(request:Request){const path=new URL(request.url).pathname;if((path==='/app.js'||path==='/app.css')&&request.method==='GET')return new Response(path.endsWith('.js')?JAVASCRIPT:STYLES,{headers:{'content-type':path.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8','x-content-type-options':'nosniff','cache-control':'no-store'}});return handle(request);}};
