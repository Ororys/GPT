import {createHmac,timingSafeEqual} from 'node:crypto';
function decode(s){if(!/^[A-Za-z0-9_-]+$/.test(s)) throw Error('UNAUTHENTICATED'); return Buffer.from(s,'base64url');}
function parseJson(buf){try{const v=JSON.parse(buf.toString('utf8'));if(!v||typeof v!=='object'||Array.isArray(v))throw 0;return v;}catch{throw Error('UNAUTHENTICATED');}}
export function verifyDemoToken(raw,{secret,issuer='hc-demo',audience='hc-synthetic-api',now=Math.floor(Date.now()/1000)}={}){
 if(typeof secret!=='string'||Buffer.byteLength(secret)<32)throw Error('SERVER_MISCONFIGURED');
 if(typeof raw!=='string'||raw.length>4096)throw Error('UNAUTHENTICATED');
 const p=raw.split('.');if(p.length!==3)throw Error('UNAUTHENTICATED');
 const h=parseJson(decode(p[0]));
 if(h.alg!=='HS256'||h.typ!=='JWT')throw Error('UNAUTHENTICATED');
 const expected=createHmac('sha256',secret).update(p[0]+'.'+p[1]).digest();const sig=decode(p[2]);
 if(sig.length!==expected.length||!timingSafeEqual(sig,expected))throw Error('UNAUTHENTICATED');
 const payload=parseJson(decode(p[1]));
 if(payload.iss!==issuer||payload.aud!==audience||typeof payload.sub!=='string'||payload.sub.length<3||payload.sub.length>180||
 !Number.isSafeInteger(payload.exp)||payload.exp<=now||!Number.isSafeInteger(payload.iat)||payload.iat>now+30||payload.exp-payload.iat>3600||payload.exp<=payload.iat)throw Error('UNAUTHENTICATED');
 // Ignore ANY role/person/grants claims. All authorization MUST be from PostgreSQL.
 return Object.freeze({subject:payload.sub});
}
export function mintDemoToken(subject,{secret,now=Math.floor(Date.now()/1000)}={}){
 if(!secret||Buffer.byteLength(secret)<32||!subject)throw Error('BAD_CONFIG');
 const h=Buffer.from(JSON.stringify({typ:'JWT',alg:'HS256'})).toString('base64url');
 const p=Buffer.from(JSON.stringify({sub:subject,iss:'hc-demo',aud:'hc-synthetic-api',iat:now,exp:now+900})).toString('base64url');
 const sig=createHmac('sha256',secret).update(h+'.'+p).digest('base64url');return [h,p,sig].join('.');
}
