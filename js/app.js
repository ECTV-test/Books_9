(function(){
  function showCrash(title, msg, stack){
    try{
      var el=document.getElementById('app_crash_overlay');
      if(!el){
        el=document.createElement('div');
        el.id='app_crash_overlay';
        el.style.cssText='position:fixed;inset:0;z-index:999999;background:#0b0b0f;color:#fff;padding:16px;overflow:auto;font:14px/1.35 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;';
        document.body.appendChild(el);
      }
      el.innerHTML='';
      var h=document.createElement('div');
      h.style.cssText='font-size:16px;font-weight:700;margin-bottom:10px;';
      h.textContent=title||'App crashed';
      var p=document.createElement('pre');
      p.style.cssText='white-space:pre-wrap;word-break:break-word;background:rgba(255,255,255,.06);padding:12px;border-radius:10px;';
      p.textContent=(msg||'') + (stack?"\n\n"+stack:'');
      el.appendChild(h);
      el.appendChild(p);
    }catch(e){}
  }
  window.addEventListener('error', function(ev){
    try{ showCrash('JS Error', String(ev.message||ev.error||'Unknown error'), ev.error && ev.error.stack ? String(ev.error.stack) : ''); }catch(e){}
  });
  window.addEventListener('unhandledrejection', function(ev){
    try{ var r=ev.reason; showCrash('Unhandled Promise Rejection', String(r && (r.message||r) || 'Unknown rejection'), r && r.stack ? String(r.stack) : ''); }catch(e){}
  });
})();

/* ===========================
   LibreTranslate (public)
=========================== */
const LIBRETRANSLATE_URL = "https://libretranslate.com/translate";
/* Если у тебя будет ключ — вставишь сюда. Иначе оставь "" */
const LIBRETRANSLATE_API_KEY = "";

/* ===========================
   Cloudflare Worker endpoints
   (keep OpenAI key ONLY in Worker secrets)
=========================== */
// Example: "https://your-worker.your-subdomain.workers.dev/translate"
const WORKER_TRANSLATE_URL = "https://books-git-hab.englishclubsales.workers.dev/translate";
// Example: "https://your-worker.your-subdomain.workers.dev/tts"
const WORKER_TTS_URL = "https://books-git-hab.englishclubsales.workers.dev/tts";