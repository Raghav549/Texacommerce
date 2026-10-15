'use client';
import {useState} from 'react';
export async function requestApi(path,method='GET',body) {
 const response=await fetch(`/api/${path}`,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Request failed.');return data;
}
export function ReportControl({kind,targetId,user,onSignIn}){
 const [open,setOpen]=useState(false),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 return <div className="report-control"><button className="safety-text" onClick={()=>{if(!user){onSignIn();return;}setOpen(!open);setNotice('');}} aria-expanded={open}>Report {kind==='account'?'person':kind}</button>{open&&<div className="report-fields"><label>Why are you reporting this?<textarea minLength={5} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Tell the moderation team what happened…"/></label><button className="secondary" disabled={busy||reason.trim().length<5} onClick={async()=>{setBusy(true);setNotice('');try{await requestApi('safety/reports','POST',{kind,targetId:String(targetId),reason});setNotice('Report sent to the moderation team.');setOpen(false);setReason('');}catch(e){setNotice(e.message);}finally{setBusy(false);}}}>{busy?'Sending…':'Send report'}</button></div>}{notice&&<p className="safety-notice" role="status">{notice}</p>}</div>;
}
