import { useEffect,useRef,type ReactNode } from 'react';
import { AlertCircle,Loader2,X,Home } from 'lucide-react';
import { Link } from 'react-router-dom';
export const money=(paise:number=0)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(paise/100);
export const indianDate=(value:string)=>new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Kolkata'}).format(new Date(value));
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date());
export function Loading({message='Loading your next chapter…'}:{message?:string}){return <div className="loading" role="status"><Loader2 className="spin" size={24}/> {message}</div>;}
export function ErrorState({message,onRetry}:{message:string;onRetry?:()=>void}){return <div className="state error-state" role="alert"><AlertCircle size={30}/><h3>We couldn’t load this</h3><p>{message}</p>{onRetry&&<button className="btn outline" onClick={onRetry}>Try again</button>}</div>;}
export function Empty({title='Nothing here yet',description='Your records will appear here as you get started.',children}:{title?:string;description?:string;children?:ReactNode}){return <div className="state"><div className="state-icon"><Home size={30}/></div><h3>{title}</h3><p>{description}</p>{children}</div>;}
export function Badge({children}:{children:ReactNode}){const s=String(children).toLowerCase().replaceAll(' ','-');return <span className={`badge ${s}`}>{children}</span>;}
export function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
  const dialog=useRef<HTMLDialogElement>(null);
  const closeHandler=useRef(onClose);closeHandler.current=onClose;
  useEffect(()=>{const d=dialog.current!;d.showModal();const cancel=(e:Event)=>{e.preventDefault();closeHandler.current();};d.addEventListener('cancel',cancel);return()=>{d.removeEventListener('cancel',cancel);d.close();};},[]);
  return <dialog ref={dialog} className="modal" onClick={e=>{if(e.target===dialog.current){const rect=dialog.current.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)onClose();}}}><div className="modal-head"><h2>{title}</h2><button className="icon-btn" aria-label="Close dialog" onClick={onClose}><X size={22}/></button></div>{children}</dialog>;
}
export function Pagination({page,total,limit=12,onChange}:{page:number;total:number;limit?:number;onChange:(n:number)=>void}){const pages=Math.ceil(total/limit);if(pages<2)return null;return <div className="pagination"><button className="btn outline" disabled={page<=1} onClick={()=>onChange(page-1)}>Previous</button><span>Page {page} of {pages}</span><button className="btn outline" disabled={page>=pages} onClick={()=>onChange(page+1)}>Next</button></div>;}
export function Logo({light=false}:{light?:boolean}){return <Link to="/" className={`logo ${light?'light':''}`} aria-label="RentEase home">rent<span>ease</span><span className="logo-dot">.</span><small>A place for every story</small></Link>;}
