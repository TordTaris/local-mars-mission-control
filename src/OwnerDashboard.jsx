import React, { useCallback, useEffect, useState } from 'react';
import { Building2, MapPin, Wallet, Clock3, RefreshCw, ShieldCheck, Store, ArrowUpRight } from 'lucide-react';

const number = value => new Intl.NumberFormat('en-US').format(Number(value) || 0);

export default function OwnerDashboard({ supabase, session, walletBalance, setPage }) {
  const [claims, setClaims] = useState([]);
  const [parcels, setParcels] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session?.user?.id) { setClaims([]); setParcels([]); setBusinesses([]); setReservations([]); setLedger([]); setLoading(false); return; }
    setLoading(true); setError('');
    const userId = session.user.id;
    const [claimResult, businessResult, reservationResult, ledgerResult] = await Promise.all([
      supabase.from('world_claims').select('parcel_id,claimed_at').eq('owner_id', userId).order('claimed_at', { ascending: false }),
      supabase.from('mars_m019_businesses').select('id,site_id,parcel_id,name,category,description,status,created_at').eq('owner_id', userId).order('created_at', { ascending: false }),
      supabase.from('mars_mlc_parcel_reservations').select('parcel_id,expires_at,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
      supabase.from('mars_wallet_ledger').select('id,resource,amount,reason,created_at').eq('user_id', userId).eq('resource', 'mlc').order('created_at', { ascending: false }).limit(10),
    ]);
    const errors = [claimResult.error,businessResult.error,reservationResult.error,ledgerResult.error].filter(Boolean);
    if (errors.length) setError(errors.map(item => item.message).join(' · '));
    const owned = claimResult.data || [];
    setClaims(owned);
    setBusinesses(businessResult.data || []);
    setReservations(reservationResult.data || []);
    setLedger(ledgerResult.data || []);
    if (owned.length) {
      const parcelResult = await supabase.from('world_parcels').select('id,terrain,resource,area_sqm,latitude,longitude').in('id', owned.map(item => item.parcel_id));
      if (parcelResult.error) setError(current => current ? current + ' · ' + parcelResult.error.message : parcelResult.error.message);
      setParcels(parcelResult.data || []);
    } else setParcels([]);
    setLoading(false);
  }, [supabase, session]);

  useEffect(() => { load(); }, [load]);

  if (!session) return <section className="panel owner-empty"><ShieldCheck size={28}/><h2>Member sign-in required</h2><p>Sign in to see your private land, registered virtual businesses, MLC ledger and reservation history.</p><button className="goldbtn" onClick={() => setPage('Communications')}>Sign in to account</button></section>;

  return <section className="owner-dashboard">
    <div className="owner-toolbar"><div><small>PRIVATE MEMBER AREA · {session.user.email || 'AUTHENTICATED EXPLORER'}</small><h2>Owner Dashboard</h2><p>Your personal LOCAL MARS assets and activity.</p></div><button className="goldbtn" onClick={load} disabled={loading}><RefreshCw size={14}/>{loading ? 'Refreshing…' : 'Refresh data'}</button></div>
    {error && <div className="m019-error">Some account records could not be loaded: {error}</div>}
    <div className="owner-stats">
      <article><MapPin/><small>OWNED PARCELS</small><strong>{loading ? '—' : number(claims.length)}</strong><span>Registered to this account</span></article>
      <article><Building2/><small>VIRTUAL BUSINESSES</small><strong>{loading ? '—' : number(businesses.length)}</strong><span>All registered statuses</span></article>
      <article><Wallet/><small>MLC WALLET</small><strong>{walletBalance === null ? '—' : number(walletBalance)}</strong><span>Demo credits · no cash value</span></article>
      <article><Clock3/><small>RESERVATIONS</small><strong>{loading ? '—' : number(reservations.filter(item => new Date(item.expires_at) > new Date()).length)}</strong><span>Currently unexpired holds</span></article>
    </div>
    <div className="owner-grid">
      <section className="panel"><div className="panelhead"><div><small>LAND REGISTRY</small><h2>My Parcels</h2></div><button onClick={() => setPage('Land Explorer')}>Explore ↗</button></div>
        {loading ? <p className="owner-muted">Loading account assets…</p> : parcels.length ? parcels.map(parcel => <div className="owner-row" key={parcel.id}><MapPin/><div><b>{parcel.id}</b><small>{parcel.terrain || 'Unclassified'} · {number(parcel.area_sqm)} m²</small></div><span>OWNED</span></div>) : <p className="owner-muted">No parcels are currently registered to this account.</p>}
      </section>
      <section className="panel"><div className="panelhead"><div><small>BUSINESS REGISTRY</small><h2>My Virtual Businesses</h2></div><button onClick={() => setPage('M-019 City')}>M-019 City ↗</button></div>
        {loading ? <p className="owner-muted">Loading businesses…</p> : businesses.length ? businesses.map(item => <div className="owner-row" key={item.id}><Store/><div><b>{item.name}</b><small>{item.parcel_id} · {item.category} · {item.site_id}</small></div><span>{item.status?.toUpperCase()}</span></div>) : <p className="owner-muted">No virtual businesses registered to this account yet.</p>}
      </section>
      <section className="panel"><div className="panelhead"><div><small>MARKET ACTIVITY</small><h2>Recent Reservations</h2></div><button onClick={() => setPage('Marketplace')}>Marketplace ↗</button></div>
        {loading ? <p className="owner-muted">Loading reservations…</p> : reservations.length ? reservations.map((item,index) => <div className="owner-row" key={item.parcel_id + item.created_at + index}><Clock3/><div><b>{item.parcel_id}</b><small>Created {new Date(item.created_at).toLocaleString()}</small></div><span>{new Date(item.expires_at) > new Date() ? 'ACTIVE' : 'EXPIRED'}</span></div>) : <p className="owner-muted">No reservation history is available for this account.</p>}
      </section>
      <section className="panel"><div className="panelhead"><div><small>PRIVATE LEDGER</small><h2>Recent MLC Activity</h2></div><button onClick={() => setPage('MLC Wallet')}>Wallet ↗</button></div>
        {loading ? <p className="owner-muted">Loading ledger…</p> : ledger.length ? ledger.map(item => <div className="owner-row" key={item.id}><Wallet/><div><b>{item.reason || 'MLC transaction'}</b><small>{new Date(item.created_at).toLocaleString()}</small></div><strong className={Number(item.amount) < 0 ? 'negative' : 'positive'}>{Number(item.amount) > 0 ? '+' : ''}{number(item.amount)} MLC</strong></div>) : <p className="owner-muted">No MLC ledger entries found.</p>}
      </section>
    </div>
    <p className="owner-disclaimer"><ShieldCheck size={14}/> Private records are requested using your signed-in account ID and remain subject to Supabase row-level security. MLC is simulated and has no cash value; parcel records are virtual assets only.</p>
  </section>;
}
