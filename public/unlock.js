(() => {
  const form=document.querySelector('#unlock-form'),button=document.querySelector('#unlock-button'),error=document.querySelector('#unlock-error'),input=document.querySelector('#password');
  const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
  form.addEventListener('submit',async event=>{
    event.preventDefault();error.textContent='';button.disabled=true;button.textContent='Unlocking…';
    try{
      if(!crypto.subtle)throw Error('Open this site over HTTPS, or use localhost for local play.');
      const configResponse=await fetch('unlock.json');if(!configResponse.ok)throw Error('Game configuration could not be loaded.');
      const config=await configResponse.json(),payloadResponse=await fetch(config.payload);if(!payloadResponse.ok)throw Error('The game files could not be loaded. Please reload.');
      const payload=await payloadResponse.arrayBuffer();
      const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(input.value),'PBKDF2',false,['deriveKey']);
      const key=await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:bytes(config.salt),iterations:config.iterations},material,{name:'AES-GCM',length:256},false,['decrypt']);
      let plaintext;try{plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(config.iv)},key,payload)}catch{throw Error('That password did not unlock this game. Try again.')}
      const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input.value));window.__CHROMRHYTHIA_AUTH__=Array.from(new Uint8Array(hash)).map(n=>n.toString(16).padStart(2,'0')).join('');
      if(config.compression==='gzip')plaintext=await new Response(new Blob([plaintext]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      input.value='';const script=document.createElement('script'),url=URL.createObjectURL(new Blob([plaintext],{type:'text/javascript'}));script.src=url;script.onload=()=>URL.revokeObjectURL(url);script.onerror=()=>{URL.revokeObjectURL(url);error.textContent='The browser could not start the game. Reload and try again.'};document.head.appendChild(script);
    }catch(e){error.textContent=e.message||'Could not unlock the game.';button.disabled=false;button.textContent='Unlock & play →';input.focus()}
  });
})();
