import React, { useCallback, useEffect, useState } from 'react';
import { Mail, ShieldCheck, UserRound, LogOut, Save } from 'lucide-react';
import './auth-panel.css';

export default function AuthPanel({ supabase, session, flash, signOut }) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileExists, setProfileExists] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    if (!session?.user?.id) return;
    setProfileLoading(true); setError('');
    const { data, error: readError } = await supabase.from('mars_profiles').select('user_id,display_name,avatar_url,bio,updated_at').eq('user_id', session.user.id).maybeSingle();
    if (readError) setError(readError.message);
    else if (data) { setProfileExists(true); setDisplayName(data.display_name || 'Explorer'); setBio(data.bio || ''); }
    else {
      const initialName = session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Explorer';
      const { error: insertError } = await supabase.from('mars_profiles').insert({ user_id: session.user.id, display_name: initialName.slice(0, 40), bio: '' });
      if (insertError) setError(insertError.message);
      else { setProfileExists(true); setDisplayName(initialName.slice(0, 40)); }
    }
    setProfileLoading(false);
  }, [supabase, session]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const requestLink = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setSent(false);
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin, data: { display_name: displayName.trim() } },
    });
    setBusy(false);
    if (authError) setError(authError.message); else setSent(true);
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!session?.user?.id) return;
    const cleanName = displayName.trim();
    if (cleanName.length < 2 || cleanName.length > 40) { setError('Display name must contain 2–40 characters.'); return; }
    setBusy(true); setError('');
    const { error: saveError } = await supabase.from('mars_profiles').upsert({ user_id: session.user.id, display_name: cleanName, bio: bio.trim().slice(0, 240), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    setBusy(false);
    if (saveError) setError(saveError.message); else flash('Account profile saved.');
  };

  if (!session) return <section className="auth-panel">
    <div className="auth-panel-head"><div className="auth-symbol"><ShieldCheck/></div><small>SECURE MEMBER ACCESS</small><h2>Join LOCAL MARS</h2><p>Create your explorer account or sign in using a one-time email link.</p></div>
    <form className="auth-form" onSubmit={requestLink}>
      <label>Explorer display name<input value={displayName} onChange={e => setDisplayName(e.target.value)} minLength={2} maxLength={40} required placeholder="e.g. Mars Explorer"/></label>
      <label>Email address<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com"/></label>
      <button className="goldbtn" type="submit" disabled={busy}><Mail size={15}/>{busy ? 'Sending secure link…' : 'Send sign-in link'}</button>
      {sent && <p className="auth-success">A secure sign-in link has been sent. Open the email on this device to complete login.</p>}
      {error && <p className="auth-error">{error}</p>}
    </form>
    <div className="auth-security"><ShieldCheck size={15}/><span>Passwordless authentication. LOCAL MARS never asks you to share your email password.</span></div>
  </section>;

  return <section className="auth-panel">
    <div className="auth-panel-head"><div className="auth-symbol"><UserRound/></div><small>VERIFIED MEMBER SESSION</small><h2>Explorer Account</h2><p>{session.user.email}</p></div>
    {profileLoading ? <p className="auth-muted">Loading your account profile…</p> : <form className="auth-form" onSubmit={saveProfile}>
      <label>Display name<input value={displayName} onChange={e => setDisplayName(e.target.value)} minLength={2} maxLength={40} required/></label>
      <label>About your mission<textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={240} rows={3} placeholder="A short introduction (optional)"/></label>
      <button className="goldbtn" type="submit" disabled={busy || !profileExists}><Save size={15}/>{busy ? 'Saving…' : 'Save account profile'}</button>
      {error && <p className="auth-error">{error}</p>}
    </form>}
    <div className="auth-security"><ShieldCheck size={15}/><span>Profile records are stored in mars_profiles and protected by row-level security. Only this account can read or update its profile.</span></div>
    <button className="auth-signout" onClick={signOut}><LogOut size={15}/> Sign out of this device</button>
  </section>;
}
