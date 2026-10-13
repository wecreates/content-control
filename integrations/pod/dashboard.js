document.getElementById('form').addEventListener('submit',async event=>{
 event.preventDefault();const output=document.getElementById('result');output.textContent='Loading…';
 try{const r=await fetch('/api/print/metrics',{headers:{Authorization:`Bearer ${document.getElementById('key').value}`},cache:'no-store'});
  if(!r.ok)throw Error(r.status===401?'Authentication failed.':'POD storage is not available.');
  output.textContent=JSON.stringify(await r.json(),null,2);
 }catch(e){output.textContent=e.message;}
});
