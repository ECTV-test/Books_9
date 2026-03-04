(function(){
  function showCrash(title, msg, stack){ try{ var el=document.getElementById('app'); if(el){ el.innerHTML='<div style="padding:24px;font-family:sans-serif"><h2 style="color:#c0392b">'+title+'</h2><pre style="white-space:pre-wrap;font-size:13px">'+msg+'</pre>'+(stack?'<pre style="color:#888;font-size:11px">'+stack+'</pre>':'')+"</div>"; } }catch(e){} }
  window.addEventListener('error', function(e){ showCrash('Runtime Error', e.message || String(e), e.error && e.error.stack); });
  window.addEventListener('unhandledrejection', function(e){ showCrash('Unhandled Promise', String(e.reason), e.reason && e.reason.stack); });
})();

// pageBg placeholder - full file pushed via separate process
console.error('app.js not fully loaded - please check deployment');
