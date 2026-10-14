import axios from 'axios';
import type { User } from '../types';
export const api=axios.create({baseURL:import.meta.env.VITE_API_URL||'/api/v1',withCredentials:true});
let accessToken='';let refreshing:Promise<{user:User;accessToken:string}>|null=null;
export const setAccessToken=(value:string)=>{accessToken=value;};
api.interceptors.request.use(c=>{if(accessToken)c.headers.Authorization=`Bearer ${accessToken}`;return c;});
export async function refreshSession(){
  if(!refreshing)refreshing=api.post('/auth/refresh',{}).then(r=>{setAccessToken(r.data.data.accessToken);return r.data.data;}).finally(()=>{refreshing=null;});
  return refreshing;
}
api.interceptors.response.use(r=>r,async error=>{
  const c=error.config;
  if(error.response?.status===401&&accessToken&&c&&!c._retried&&!c.url?.startsWith('/auth')){
    c._retried=true;try{await refreshSession();return api(c);}catch{setAccessToken('');window.dispatchEvent(new Event('rentease:signedout'));}
  }return Promise.reject(error);
});
export async function get<T>(path:string){return (await api.get<{data:T}>(path)).data.data;}
export async function post<T=unknown>(path:string,body:unknown){return (await api.post<{data:T}>(path,body)).data.data;}
export async function patch<T=unknown>(path:string,body:unknown){return (await api.patch<{data:T}>(path,body)).data.data;}
export const errorMessage=(error:unknown)=>axios.isAxiosError(error)?error.response?.data?.message||'Cannot reach RentEase. Please try again.':error instanceof Error?error.message:'Something went wrong.';
