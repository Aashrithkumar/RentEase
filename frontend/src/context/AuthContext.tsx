import { createContext,useContext,useEffect,useState,type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { post,refreshSession,setAccessToken } from '../services/api';
import type { User } from '../types';
interface Auth {user:User|null;loading:boolean;signIn:(path:string,body:unknown)=>Promise<User>;signOut:()=>Promise<void>;updateUser:(user:User)=>void}
const Context=createContext<Auth>(null!);
export function AuthProvider({children}:{children:ReactNode}){
  const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true);const cache=useQueryClient();
  useEffect(()=>{let mounted=true;refreshSession().then(s=>{if(mounted)setUser(s.user);}).catch(()=>{}).finally(()=>{if(mounted)setLoading(false);});const clear=()=>{setUser(null);cache.clear();};window.addEventListener('rentease:signedout',clear);return()=>{mounted=false;window.removeEventListener('rentease:signedout',clear);};},[cache]);
  async function signIn(path:string,body:unknown){const s=await post<{user:User;accessToken:string}>(path,body);cache.clear();setAccessToken(s.accessToken);setUser(s.user);return s.user;}
  async function signOut(){await post('/auth/logout',{});setAccessToken('');setUser(null);cache.clear();}
  return <Context.Provider value={{user,loading,signIn,signOut,updateUser:setUser}}>{children}</Context.Provider>;
}
export const useAuth=()=>useContext(Context);
