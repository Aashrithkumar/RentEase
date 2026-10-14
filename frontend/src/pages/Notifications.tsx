import { useState } from 'react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { Bell,CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { get,patch,errorMessage } from '../services/api';
import { Loading,ErrorState,Empty,Pagination,indianDate } from '../components/ui';
import type { List,Notice } from '../types';
export default function Notifications(){
  const [page,setPage]=useState(1);const cache=useQueryClient();const list=useQuery({queryKey:['notifications',page],queryFn:()=>get<List<Notice>>(`/notifications?page=${page}`)});
  async function read(id?:string){try{await patch(id?`/notifications/${id}/read`:'/notifications/read-all',{});cache.invalidateQueries({queryKey:['notifications']});cache.invalidateQueries({queryKey:['notification-count']});}catch(e){toast.error(errorMessage(e));}}
  return <><div className="dash-title"><div><span className="eyebrow">KEEPING YOU IN THE LOOP</span><h1>Your notifications</h1><p>{list.data?.unread||0} unread updates from your rental journey.</p></div><button className="btn outline" onClick={()=>read()}><CheckCheck size={17}/>Mark all as read</button></div><section className="panel notifications-panel">{list.isPending?<Loading/>:list.isError?<ErrorState message={errorMessage(list.error)} onRetry={()=>list.refetch()}/>:list.data.items.length?list.data.items.map(n=><article className={`notice ${n.read?'':'unread'}`} key={n._id}><span className="activity-icon"><Bell size={19}/></span><div><h3>{n.title}</h3><p>{n.message}</p><small>{indianDate(n.createdAt)}</small></div>{!n.read&&<button className="text-btn" onClick={()=>read(n._id)}>Mark read</button>}</article>):<Empty title="You’re all caught up" description="New applications, rent records and maintenance updates will appear here."/>}<Pagination page={page} total={list.data?.total||0} onChange={setPage}/></section></>;
}
