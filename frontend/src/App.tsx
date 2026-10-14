import { lazy,Suspense,type ReactNode } from 'react';
import { BrowserRouter,Routes,Route,Navigate,useLocation,Link } from 'react-router-dom';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider,useAuth } from './context/AuthContext';
import { shouldRetryQuery,queryRetryDelay } from './services/queryRetry';
import { Loading,Empty } from './components/ui';
import Header from './components/Header';
const Home=lazy(()=>import('./pages/Home'));
const Properties=lazy(()=>import('./pages/Properties'));
const PropertyDetail=lazy(()=>import('./pages/PropertyDetail'));
const Auth=lazy(()=>import('./pages/Auth'));
const Guides=lazy(()=>import('./pages/Guides'));
const DashboardLayout=lazy(()=>import('./components/DashboardLayout'));
const Dashboard=lazy(()=>import('./pages/Dashboard'));
const Records=lazy(()=>import('./pages/Records'));
const PropertyEditor=lazy(()=>import('./pages/PropertyEditor'));
const Analytics=lazy(()=>import('./pages/Analytics'));
const Notifications=lazy(()=>import('./pages/Notifications'));
const Settings=lazy(()=>import('./pages/Settings'));
const AdminOverview=lazy(()=>import('./pages/Admin').then(m=>({default:m.AdminOverview})));
const AdminManagement=lazy(()=>import('./pages/Admin').then(m=>({default:m.AdminManagement})));
const AdminActivity=lazy(()=>import('./pages/Admin').then(m=>({default:m.AdminActivity})));
const AdminAudit=lazy(()=>import('./pages/Admin').then(m=>({default:m.AdminAudit})));
const cache=new QueryClient({defaultOptions:{queries:{staleTime:30000,retry:shouldRetryQuery,retryDelay:queryRetryDelay,refetchOnWindowFocus:false}}});
function Protected({children,roles}:{children:ReactNode;roles?:string[]}){const {user,loading}=useAuth();const location=useLocation();if(loading)return <Loading/>;if(!user)return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname+location.search)}`} replace/>;if(roles&&!roles.includes(user.role))return <Empty title="This page belongs to another workspace" description="Use your dashboard to access your rental records."><Link className="btn" to="/dashboard">My dashboard</Link></Empty>;return children;}
export default function App(){return <QueryClientProvider client={cache}><BrowserRouter><AuthProvider><Suspense fallback={<Loading/>}><Routes>
  <Route path="/" element={<Home/>}/><Route path="/properties" element={<Properties/>}/><Route path="/properties/:id" element={<PropertyDetail/>}/><Route path="/saved" element={<Properties savedOnly/>}/><Route path="/guides" element={<Guides/>}/>
  <Route path="/login" element={<Auth/>}/><Route path="/register" element={<Auth mode="register"/>}/><Route path="/forgot-password" element={<Auth mode="forgot"/>}/><Route path="/reset-password" element={<Auth mode="reset"/>}/>
  <Route path="/admin" element={<Protected roles={['admin']}><DashboardLayout/></Protected>}>
    <Route index element={<AdminOverview/>}/><Route path="users" element={<AdminManagement key="users" kind="users"/>}/><Route path="properties" element={<AdminManagement key="properties" kind="properties"/>}/><Route path="activity" element={<AdminActivity/>}/><Route path="audit" element={<AdminAudit/>}/><Route path="analytics" element={<Analytics/>}/><Route path="notifications" element={<Notifications/>}/><Route path="settings" element={<Settings/>}/>
  </Route>
  <Route path="/dashboard" element={<Protected><DashboardLayout/></Protected>}>
    <Route index element={<Dashboard/>}/><Route path="properties" element={<Records kind="properties"/>}/><Route path="properties/new" element={<Protected roles={['owner']}><PropertyEditor/></Protected>}/><Route path="properties/:id/edit" element={<Protected roles={['owner']}><PropertyEditor/></Protected>}/>
    <Route path="applications" element={<Protected roles={['owner','tenant']}><Records kind="applications"/></Protected>}/><Route path="tenants" element={<Protected roles={['owner','admin']}><Records kind="tenants"/></Protected>}/><Route path="leases" element={<Protected roles={['owner','tenant']}><Records kind="leases"/></Protected>}/><Route path="payments" element={<Protected roles={['owner','tenant']}><Records kind="payments"/></Protected>}/><Route path="maintenance" element={<Protected roles={['owner','tenant']}><Records kind="maintenance"/></Protected>}/><Route path="expenses" element={<Protected roles={['owner']}><Records kind="expenses"/></Protected>}/><Route path="analytics" element={<Protected roles={['owner','admin']}><Analytics/></Protected>}/><Route path="notifications" element={<Notifications/>}/><Route path="settings" element={<Settings/>}/>
  </Route>
  <Route path="*" element={<><Header/><Empty title="This page has moved on" description="Let’s get you back to finding a home."><Link className="btn" to="/">Back to home</Link></Empty></>}/>
</Routes></Suspense><Toaster position="top-right" richColors closeButton/></AuthProvider></BrowserRouter></QueryClientProvider>;}
