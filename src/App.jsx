import React, { useCallback, useEffect, useMemo, useState } from 'react';
import M019City from './M019.jsx';
import OwnerDashboard from './OwnerDashboard.jsx';
import AuthPanel from './AuthPanel.jsx';
import { Activity, Bell, Building2, Compass, LayoutDashboard, MapPin, Menu, MessageCircle, Orbit, RadioTower, Satellite, ShoppingBag, Wallet, Search, Send, X, ShieldCheck, ArrowUpRight, RefreshCw, LogIn, LogOut } from 'lucide-react';
import { supabase, supabaseConfigured } from './lib/supabase';

const nav=[['Overview',LayoutDashboard],['Owner Dashboard',ShieldCheck],['M-019 City',Building2],['Land Explorer',Compass],['Marketplace',ShoppingBag],['MLC Wallet',Wallet],['Satellite Tracking',Satellite],['Communications',MessageCircle]];
const number=(v)=>new Intl.NumberFormat('en-US').format(Number(v)||0);
const pageFromUrl=()=>{const value=new URLSearchParams(window.location.search).get('page');return value==='m019'?'M-019 City':'Overview'};
const mapParcel=(row,listing)=>({
 id:row.id, name:row.id, kind:row.terrain||'Unclassified terrain', resource:row.resource||'Not surveyed',
 status:listing?.is_listed?'Listed':row.is_for_sale?'Available':'Not listed',
 listed:Boolean(listing?.is_listed), price:listing?.price_mlc??null, size:Number(row.area_sqm)||0,
 latitude:Number(row.latitude),longitude:Number(row.longitude),
 x:Math.max(2,Math.min(98,(Number(row.longitude)+180)/360*100)),
 y:Math.max(2,Math.min(98,(90-Number(row.latitude))/180*100))
});
export default function App(){
 const [page,setPage]=useState(pageFromUrl),[parcels,setParcels]=useState([]),[picked,setPicked]=useState(null),[query,setQuery]=useState(''),[mobile,setMobile]=useState(false),[notice,setNotice]=useState(''),[dbState,setDbState]=useState('connecting'),[dbError,setDbError]=useState(''),[loading,setLoading]=useState(false),[session,setSession]=useState(null),[email,setEmail]=useState(''),[authBusy,setAuthBusy]=useState(false),[messages,setMessages]=useState([]),[draft,setDraft]=useState(''),[walletBalance,setWalletBalance]=useState(null),[marketReservation,setMarketReservation]=useState(null),[marketBusy,setMarketBusy]=useState('');
 const flash=useCallback(message=>setNotice(message),[]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(t)},[notice]);
 useEffect(()=>{const syncPage=()=>setPage(pageFromUrl());window.addEventListener('popstate',syncPage);return()=>window.removeEventListener('popstate',syncPage)},[]);
 const navigatePage=useCallback(next=>{setPage(next);const url=new URL(window.location.href);if(next==='M-019 City')url.searchParams.set('page','m019');else url.searchParams.delete('page');window.history.pushState({},'',url);},[]);
 useEffect(()=>{
  if(!supabaseConfigured){setDbState('setup');return}
  let mounted=true;
  supabase.auth.getSession().then(({data})=>{if(mounted)setSession(data.session)});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next));
  return()=>{mounted=false;subscription.unsubscribe()};
 },[]);
 const loadRegistry=useCallback(async()=>{
  if(!supabaseConfigured)return;
  setLoading(true);setDbError('');
  const [land,market]=await Promise.all([
   supabase.from('world_parcels').select('id,latitude,longitude,area_sqm,terrain,resource,base_price,is_for_sale').order('id'),
   supabase.from('mars_mlc_parcel_market').select('parcel_id,price_mlc,is_listed').order('parcel_id')
  ]);
  if(land.error){setDbState('error');setDbError(land.error.message);setLoading(false);return}
  if(market.error){setDbState('partial');setDbError('Land registry loaded; marketplace data is not available under current access rules.')}
  else setDbState('connected');
  const listings=new Map((market.data||[]).map(item=>[item.parcel_id,item]));
  setParcels((land.data||[]).map(row=>mapParcel(row,listings.get(row.id))));
  setLoading(false);
 },[]);
 useEffect(()=>{loadRegistry()},[loadRegistry]);
 useEffect(()=>{
  if(!supabaseConfigured||!session){setMessages([]);setWalletBalance(null);return}
  let active=true;
  const loadMemberData=async()=>{
   const {data:chat,error:chatError}=await supabase.from('mars_chat_messages').select('id,user_id,display_name,body,created_at').order('created_at',{ascending:true}).limit(80);
   if(active&&!chatError)setMessages(chat||[]);
   if(active&&chatError)flash('Chat access is currently unavailable.');
   const {data:ledger,error:ledgerError}=await supabase.from('mars_wallet_ledger').select('amount').eq('resource','mlc').eq('user_id',session.user.id);
   if(active&&!ledgerError)setWalletBalance((ledger||[]).reduce((total,row)=>total+Number(row.amount||0),0));
   if(active&&ledgerError)setWalletBalance(null);
  };
  loadMemberData();
  const channel=supabase.channel('localmars-chat-feed').on('postgres_changes',{event:'INSERT',schema:'public',table:'mars_chat_messages'},payload=>{
   if(active)setMessages(current=>current.some(item=>item.id===payload.new.id)?current:[...current,payload.new].slice(-80));
  }).subscribe();
  return()=>{active=false;supabase.removeChannel(channel)};
 },[session,flash]);
 const sendMessage=async()=>{
  const body=draft.trim();if(!body||!session)return;
  const {error}=await supabase.from('mars_chat_messages').insert({user_id:session.user.id,display_name:session.user.email?.split('@')[0]||'Explorer',body});
  if(error){flash('Message not sent. Check member access.');return}
  setDraft('');
 };
 const signIn=async event=>{
  event.preventDefault();if(!email.trim()||!supabaseConfigured)return;
  setAuthBusy(true);
  const {error}=await supabase.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:window.location.origin}});
  setAuthBusy(false);flash(error?error.message:'Sign-in link sent. Check your email inbox.');
 };
 const signOut=async()=>{await supabase.auth.signOut();flash('Signed out.')};
 const reserveMarketParcel=async(parcel)=>{
  if(!session){flash('Sign in before reserving a parcel.');navigatePage('Communications');return}
  setMarketBusy('reserve');
  const {data,error}=await supabase.rpc('mars_mlc_reserve_parcel',{p_parcel_id:parcel.id});
  setMarketBusy('');
  if(error){flash(error.message);return}
  setPicked(parcel);
  setMarketReservation(data);
  flash('Reservation created for 15 minutes. Complete simulated checkout before it expires.');
 };
 const purchaseMarketParcel=async(parcel)=>{
  if(!session){flash('Sign in before purchasing.');setPage('Communications');return}
  if(!marketReservation||marketReservation.parcel_id!==parcel.id){flash('Reserve this parcel first.');return}
  if(!window.confirm('Confirm simulated purchase of '+parcel.id+' for '+number(parcel.price)+' MLC? Demo credits only; no real-world property rights are created.'))return;
  setMarketBusy('purchase');
  const {data,error}=await supabase.rpc('mars_mlc_purchase_parcel',{p_parcel_id:parcel.id});
  setMarketBusy('');
  if(error){flash(error.message);return}
  setMarketReservation(null);
  flash('Purchase completed in the LOCAL MARS simulation.');
  await loadRegistry();
  const {data:ledger,error:ledgerError}=await supabase.from('mars_wallet_ledger').select('amount').eq('resource','mlc').eq('user_id',session.user.id);
  if(!ledgerError)setWalletBalance((ledger||[]).reduce((sum,row)=>sum+Number(row.amount||0),0));
 };
 const listed=useMemo(()=>parcels.filter(p=>p.listed&&(p.id+' '+p.kind+' '+p.resource).toLowerCase().includes(query.toLowerCase())),[parcels,query]);
 const selected=picked?parcels.find(p=>p.id===picked.id)||picked:null;
 const countListed=parcels.filter(p=>p.listed).length;
 return <div className="app">
  <aside className={mobile?'sidebar open':'sidebar'}><div className="brand"><Orbit/><div><b>LOCAL MARS</b><small>MISSION CONTROL <i>2.1</i></small></div><button className="close" onClick={()=>setMobile(false)}><X/></button></div><label>WORKSPACE</label>{nav.map(([name,Icon])=><button className={'nav '+(page===name?'active':'')} key={name} onClick={()=>{navigatePage(name);setMobile(false)}}><Icon size={17}/>{name}</button>)}<div className="sidebottom"><span className="pulse"/>{dbState==='connected'?'DATABASE CONNECTED':dbState==='partial'?'PARTIAL CONNECTION':dbState==='error'?'CONNECTION ERROR':dbState==='setup'?'SETUP REQUIRED':'CONNECTING'}<small>{session?'Authenticated explorer':'Marslocal · Supabase'}</small></div></aside>
  {mobile&&<div className="scrim" onClick={()=>setMobile(false)}/>}
  <main><header><button className="hamb" onClick={()=>setMobile(true)}><Menu/></button><span>LOCAL MARS / <b>{page.toUpperCase()}</b></span><div className="online"><i/>{dbState==='connected'?'LIVE DATABASE':dbState==='setup'?'SETUP REQUIRED':dbState==='error'?'OFFLINE':'CONNECTING'}<button onClick={loadRegistry} title="Refresh registry"><RefreshCw size={15}/></button>{session&&<button onClick={signOut} title="Sign out"><LogOut size={16}/></button>}<button onClick={()=>flash('No new notifications.')}><Bell size={17}/></button></div></header>
  <div className="content"><div className="heading"><div><small>PLANETARY OPERATIONS · MARS REGISTRY</small><h1>{page==='Overview'?'Mission Overview':page}</h1><p>Explore, manage, and monitor your Mars territory.</p></div><span className="tag">REGISTRY · {parcels.length} PARCELS</span></div>
  {dbState==='setup'&&<div className="detail"><b>Backend setup required</b><p>Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Vercel Project Settings → Environment Variables, then redeploy.</p></div>}
  {dbState==='error'&&<div className="detail"><b>Database connection error</b><p>{dbError}</p><button className="goldbtn" onClick={loadRegistry}>Retry <RefreshCw size={14}/></button></div>}
  {dbState==='partial'&&<div className="detail"><b>Partial connection</b><p>{dbError}</p></div>}
  {page==='Overview'&&<><div className="stats">{[['Registered Land Parcels',number(parcels.length),'Live world_parcels registry',MapPin],['Marketplace Listings',number(countListed),'Active listing flags in MLC market',ShoppingBag],['MLC Wallet',walletBalance===null?'SIGN IN':number(walletBalance)+' MLC',session?'Private ledger total':'Member authentication required',Wallet],['Orbital Assets','01','Simulated telemetry only',Satellite]].map(([title,value,sub,Icon])=><section className="stat" key={title}><small>{title}</small><Icon/><strong>{value}</strong><span>{sub}</span></section>)}</div><div className="columns"><section className="panel"><div className="panelhead"><div><small>PLANETARY SURFACE</small><h2>Mars Land Explorer</h2></div><button onClick={()=>navigatePage('Land Explorer')}>Open explorer ↗</button></div><Map parcels={parcels} picked={selected} setPicked={setPicked}/><p className="legend">● Listed　 <span>● Not listed</span>　 Select a marker for details</p>{selected&&<ParcelDetail parcel={selected}/>}</section><section className="panel"><small>MISSION FEED</small><h2>System Activity</h2>{[[ShieldCheck,'Land registry connected',parcels.length+' database records'],[ShoppingBag,'MLC marketplace',countListed+' listing flags active'],[Satellite,'Orbital simulation','Not live spacecraft telemetry'],[RadioTower,'Communications',session?'Authenticated member':'Sign-in required']].map(([Icon,title,sub])=><div className="feed" key={title}><Icon/><div><b>{title}</b><small>{sub}</small></div></div>)}</section></div></>}
  {page==='Land Explorer'&&<section className="panel"><small>INTERACTIVE TERRITORY MAP</small><h2>Explore Mars Surface</h2><p>Parcel positions use latitude and longitude stored in the Marslocal registry.</p><Map parcels={parcels} picked={selected} setPicked={setPicked} large/>{selected&&<ParcelDetail parcel={selected}/ >}{parcels.map(p=><button className="parcelrow" key={p.id} onClick={()=>setPicked(p)}><b>{p.id}</b><span>{p.kind}<small>Resource: {p.resource}</small></span><em>{p.status}</em><small>{number(p.size)} m²</small></button>)}</section>}
  {page==='Marketplace'&&<section className="panel"><small>LAND LISTINGS · MLC</small><h2>Marketplace</h2><p>Browse live listings, reserve a parcel for 15 minutes, then complete a secure simulated MLC checkout. MLC has no cash value.</p><div className="search"><Search size={16}/><input placeholder="Search parcel, terrain or resource..." value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="market">{listed.map(p=><article key={p.id}><div className="landart">{p.id}<MapPin/></div><h3>{p.kind}</h3><small>{p.resource} · {number(p.size)} m²</small><div className="marketfoot"><b>{number(p.price)} MLC</b><button onClick={()=>setPicked(p)}>Select ↗</button></div><button className="goldbtn" disabled={marketBusy!==''||!p.price} onClick={()=>reserveMarketParcel(p)}>{marketBusy==='reserve'&&picked?.id===p.id?'Reserving…':'Reserve 15 min'}</button></article>)}</div>{!listed.length&&<p className="warning">{loading?'Loading market records…':'No active listings match this search.'}</p>}{selected?.listed&&<div className="detail"><small>CHECKOUT · {selected.id}</small><h3>{number(selected.price)} MLC</h3><p>{marketReservation?.parcel_id===selected.id&&marketReservation?.expires_at?'Reserved until '+new Date(marketReservation.expires_at).toLocaleString():'Select Reserve 15 min to hold this listing.'}</p><button className="goldbtn" disabled={marketBusy!==''||!marketReservation||marketReservation.parcel_id!==selected.id} onClick={()=>purchaseMarketParcel(selected)}>{marketBusy==='purchase'?'Processing…':'Complete simulated purchase'}</button><p className="warning">Your MLC balance: {walletBalance===null?'Sign in':number(walletBalance)+' MLC'}. Checkout validates balance and ownership on the database.</p></div>}</section>}
  {page==='MLC Wallet'&&<div className="columns"><section className="wallet"><small>MARS LOCAL CURRENCY</small><h2>MLC Wallet</h2><p>{session?'Authenticated private ledger':'Sign in to view your balance'}</p><strong>{walletBalance===null?'—':number(walletBalance)} <i>MLC</i></strong><p className="warning">Read-only ledger view. Transfers and balance changes require secure server-side authorization.</p>{!session&&<button className="goldbtn" onClick={()=>setPage('Communications')}>Sign in to account</button>}</section><section className="panel"><small>LEDGER SECURITY</small><h2>Protected Transactions</h2><div className="feed"><ShieldCheck/><div><b>Row-level security enabled</b><small>Ledger query scoped to your account</small></div></div><div className="feed"><Wallet/><div><b>Read-only interface</b><small>No client-side minting or transfers</small></div></div></section></div>}
  {page==='Satellite Tracking'&&<div className="columns"><section className="panel"><small>ORBITAL ASSET · SIMULATED</small><h2>Survey Satellite — LM-01</h2><div className="orbit"><div className="ring"/><div className="marsball"/><Satellite/></div><p>Illustrative orbit altitude <b>400 km</b>　 Period <b>121 min</b></p></section><section className="panel"><small>TELEMETRY STREAM</small><h2>Orbital Data</h2>{[['Latitude','18.42° N'],['Longitude','226.31° E'],['Signal strength','98.4%'],['Last packet','SIMULATED']].map(([a,b])=><div className="data" key={a}>{a}<b>{b}</b></div>)}<p className="warning">Illustrative values, not live spacecraft telemetry.</p></section></div>}
  {page==='Communications'&&<div className="columns"><AuthPanel supabase={supabase} session={session} flash={flash} signOut={signOut}/><section className="panel chat"><small>MISSION NETWORK · MEMBER CHAT</small><h2>Communications Center</h2>{!session?<p className="warning">Sign in to your explorer account to access member communications.</p>:<><div className="messages">{messages.map((m,i)=><div className="message" key={m.id||i}><small>{m.display_name||'EXPLORER'} · {new Date(m.created_at).toLocaleString()}</small><p>{m.body}</p></div>)}</div><div className="compose"><input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMessage()} placeholder="Write a message..."/><button onClick={sendMessage}><Send size={16}/></button></div></>}<p className="warning">Member chat requires authentication and the database realtime publication.</p></section></div>}
  {page==='Owner Dashboard'&&<OwnerDashboard supabase={supabase} session={session} walletBalance={walletBalance} setPage={setPage}/>}
  {page==='M-019 City'&&<M019City supabase={supabase} session={session} walletBalance={walletBalance} setWalletBalance={setWalletBalance} flash={flash} setPage={setPage} onRefresh={loadRegistry}/>}
  </div><footer>© 2026 LOCAL MARS MISSION CONTROL <span>{dbState==='connected'?'SUPABASE CONNECTED':'BACKEND STATUS · '+dbState.toUpperCase()}</span></footer></main>{notice&&<div className="toast">{notice}</div>}
 </div>
}
function ParcelDetail({parcel:p}){return <div className="detail"><small>SELECTED REGISTRY PARCEL</small><h3>{p.id}</h3><p>{p.kind} · {number(p.size)} m² · {p.status}</p><p>Resource: {p.resource}</p><p>Coordinates: {p.latitude.toFixed(2)}°, {p.longitude.toFixed(2)}°</p>{p.price!==null?<b>{number(p.price)} MLC · Listing price</b>:<b>No active MLC listing</b>}</div>}
function Map({parcels,picked,setPicked,large=false}){return <div className={'map '+(large?'large':'')}><div className="planet">{parcels.map(p=><button key={p.id} title={p.id} className={'pin '+(p.listed?'':'review')+(picked?.id===p.id?' selected':'')} style={{left:p.x+'%',top:p.y+'%'}} onClick={()=>setPicked(p)}><i/>{p.id}</button>)}</div><div className="maplabel">MARS / LIVE PARCEL REGISTRY <span>STORED COORDINATES</span></div></div>}
