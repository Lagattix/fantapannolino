import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile
} from 'firebase/auth';
import {
  collection, doc, setDoc, getDoc, onSnapshot,
  query, orderBy, updateDoc, writeBatch, arrayUnion
} from 'firebase/firestore';

function App() {
  // Auth state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login'); // login, register
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  // App state
  const [userLeagues, setUserLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [leagueData, setLeagueData] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [winner, setWinner] = useState(null);
  const [showWinner, setShowWinner] = useState(false);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTab, setAddTab] = useState('join'); // join, create
  const [modalLeagueName, setModalLeagueName] = useState('');
  const [modalLeagueCode, setModalLeagueCode] = useState('');
  const [modalError, setModalError] = useState('');
  const [modalBusy, setModalBusy] = useState(false);

  // Mobile sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ===== AUTH LISTENER =====
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // ===== LOAD USER LEAGUES =====
  useEffect(() => {
    if (!user) {
      setUserLeagues([]);
      return;
    }
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUserLeagues(data.leagues || []);
      } else {
        setUserLeagues([]);
      }
    });
    return unsub;
  }, [user]);

  // ===== LISTEN TO SELECTED LEAGUE =====
  useEffect(() => {
    if (!selectedLeague) {
      setLeagueData(null);
      setTeachers([]);
      return;
    }

    const unsubLeague = onSnapshot(doc(db, "leagues", selectedLeague), (snap) => {
      if (snap.exists()) setLeagueData({ id: snap.id, ...snap.data() });
    });

    const q = query(
      collection(db, "leagues", selectedLeague, "teachers"),
      orderBy("points", "desc")
    );
    const unsubTeachers = onSnapshot(q, (snapshot) => {
      const t = [];
      snapshot.forEach((d) => t.push({ id: d.id, ...d.data() }));
      setTeachers(t);
    });

    return () => { unsubLeague(); unsubTeachers(); };
  }, [selectedLeague]);

  // ===== AUTH FUNCTIONS =====
  const handleRegister = async () => {
    if (!authEmail || !authPassword || !authName.trim()) {
      setAuthError('Compila tutti i campi');
      return;
    }
    if (authPassword.length < 6) {
      setAuthError('La password deve avere almeno 6 caratteri');
      return;
    }
    setAuthBusy(true);
    setAuthError('');
    try {
      const cred = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      await updateProfile(cred.user, { displayName: authName.trim() });
      await setDoc(doc(db, "users", cred.user.uid), {
        name: authName.trim(),
        email: authEmail,
        leagues: []
      });
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') setAuthError('Email già in uso');
      else if (e.code === 'auth/invalid-email') setAuthError('Email non valida');
      else setAuthError('Errore: ' + e.message);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogin = async () => {
    if (!authEmail || !authPassword) {
      setAuthError('Inserisci email e password');
      return;
    }
    setAuthBusy(true);
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, authEmail, authPassword);
    } catch (e) {
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') setAuthError('Email o password errati');
      else if (e.code === 'auth/user-not-found') setAuthError('Utente non trovato');
      else setAuthError('Errore: ' + e.message);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setSelectedLeague(null);
    setLeagueData(null);
    setTeachers([]);
  };

  // ===== LEAGUE FUNCTIONS =====
  const handleCreateLeague = async () => {
    if (!modalLeagueName.trim()) {
      setModalError('Inserisci un nome per la lega');
      return;
    }
    setModalBusy(true);
    setModalError('');

    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    const displayName = user.displayName || 'Anonimo';

    try {
      await setDoc(doc(db, "leagues", code), {
        name: modalLeagueName.trim(),
        createdBy: displayName,
        createdByUid: user.uid,
        createdAt: new Date()
      });
      await setDoc(doc(db, "leagues", code, "teachers", displayName), {
        points: 0,
        uid: user.uid
      });
      // Add league to user's list
      await setDoc(doc(db, "users", user.uid), {
        leagues: arrayUnion(code)
      }, { merge: true });

      setSelectedLeague(code);
      setShowAddModal(false);
      setModalLeagueName('');
      setSidebarOpen(false);
    } catch (e) {
      setModalError('Errore: ' + e.message);
    } finally {
      setModalBusy(false);
    }
  };

  const handleJoinLeague = async () => {
    if (!modalLeagueCode.trim()) {
      setModalError('Inserisci il codice della lega');
      return;
    }
    setModalBusy(true);
    setModalError('');

    const code = modalLeagueCode.trim().toUpperCase();
    const displayName = user.displayName || 'Anonimo';

    try {
      const leagueSnap = await getDoc(doc(db, "leagues", code));
      if (!leagueSnap.exists()) {
        setModalError('Lega non trovata! Controlla il codice.');
        setModalBusy(false);
        return;
      }
      // Add teacher if not already in
      const teacherSnap = await getDoc(doc(db, "leagues", code, "teachers", displayName));
      if (!teacherSnap.exists()) {
        await setDoc(doc(db, "leagues", code, "teachers", displayName), {
          points: 0,
          uid: user.uid
        });
      }
      // Add league to user's list
      await setDoc(doc(db, "users", user.uid), {
        leagues: arrayUnion(code)
      }, { merge: true });

      setSelectedLeague(code);
      setShowAddModal(false);
      setModalLeagueCode('');
      setSidebarOpen(false);
    } catch (e) {
      setModalError('Errore: ' + e.message);
    } finally {
      setModalBusy(false);
    }
  };

  const handleAddDiaper = async () => {
    if (!user || !selectedLeague) return;
    const displayName = user.displayName || 'Anonimo';
    try {
      const ref = doc(db, "leagues", selectedLeague, "teachers", displayName);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, { points: snap.data().points + 1 });
      }
    } catch (e) {
      alert("Errore nell'aggiunta del pannolino!");
    }
  };

  const handleEndWeek = async () => {
    if (teachers.length === 0) return;
    const sorted = [...teachers].sort((a, b) => b.points - a.points);
    setWinner(sorted[0]);
    setShowWinner(true);

    try {
      const batch = writeBatch(db);
      teachers.forEach(t => {
        const ref = doc(db, "leagues", selectedLeague, "teachers", t.id);
        batch.update(ref, { points: 0 });
      });
      await batch.commit();
    } catch (e) {
      console.error(e);
    }
  };

  // ===== LOADING =====
  if (authLoading) {
    return (
      <div className="auth-wrapper">
        <div className="loader" style={{ width: 48, height: 48 }}></div>
      </div>
    );
  }

  // ===== AUTH SCREEN =====
  if (!user) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card glass-card">
          <h1 className="title">FantaPannolino 👶</h1>
          <p className="subtitle">La lega più profumata dell'asilo!</p>

          <div className="tabs">
            <button className={`tab ${authMode === 'login' ? 'active' : ''}`} onClick={() => { setAuthMode('login'); setAuthError(''); }}>Accedi</button>
            <button className={`tab ${authMode === 'register' ? 'active' : ''}`} onClick={() => { setAuthMode('register'); setAuthError(''); }}>Registrati</button>
          </div>

          {authError && <p className="error-msg">{authError}</p>}

          {authMode === 'register' && (
            <div className="input-group">
              <label>Il Tuo Nome</label>
              <input type="text" placeholder="Es. Maestra Giulia" value={authName} onChange={e => setAuthName(e.target.value)} />
            </div>
          )}

          <div className="input-group">
            <label>Email</label>
            <input type="email" placeholder="email@esempio.com" value={authEmail} onChange={e => setAuthEmail(e.target.value)} />
          </div>

          <div className="input-group">
            <label>Password</label>
            <input type="password" placeholder="La tua password" value={authPassword} onChange={e => setAuthPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') authMode === 'login' ? handleLogin() : handleRegister(); }}
            />
          </div>

          <div className="input-group" style={{ marginTop: '1rem' }}>
            <button className="btn btn-primary" onClick={authMode === 'login' ? handleLogin : handleRegister} disabled={authBusy}>
              {authBusy ? <div className="loader"></div> : (authMode === 'login' ? 'Accedi' : 'Registrati')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== MAIN APP =====
  const displayName = user.displayName || 'Utente';
  const initials = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <>
      {/* Mobile Header */}
      <div className="mobile-header">
        <button className="hamburger" onClick={() => setSidebarOpen(true)}>☰</button>
        <h2>FantaPannolino</h2>
        <div style={{ width: 24 }}></div>
      </div>

      {/* Sidebar overlay for mobile */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-user">
          <div className="user-avatar">{initials}</div>
          <div className="user-details">
            <h3>{displayName}</h3>
            <p>{user.email}</p>
          </div>
        </div>

        <div className="sidebar-nav">
          <h4>Le Tue Leghe</h4>
          <ul className="league-list">
            {userLeagues.length === 0 && (
              <li style={{ padding: '1rem', opacity: 0.5, fontSize: '0.9rem' }}>Nessuna lega ancora</li>
            )}
            {userLeagues.map((code) => (
              <li
                key={code}
                className={`league-list-item ${selectedLeague === code ? 'active' : ''}`}
                onClick={() => { setSelectedLeague(code); setSidebarOpen(false); }}
              >
                <span className="league-emoji">🏆</span>
                <span className="league-item-name">{code}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="sidebar-bottom">
          <button className="btn btn-add-league btn-small" onClick={() => { setShowAddModal(true); setModalError(''); }}>
            ➕ Aggiungi Lega
          </button>
          <button className="btn btn-logout-sidebar btn-small" onClick={handleLogout}>
            🚪 Esci
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="content-area">
        {!selectedLeague ? (
          <div className="welcome-center">
            <div className="welcome-emoji">👶</div>
            <h2>Benvenuto/a, {displayName}!</h2>
            <p>Seleziona una lega dalla barra laterale o creane una nuova.</p>
          </div>
        ) : (
          <>
            <div className="dashboard-header">
              <div className="league-info">
                <h2>{leagueData?.name || 'Caricamento...'}</h2>
                <p>Codice: {selectedLeague}</p>
              </div>
            </div>

            <div className="glass-card" style={{ textAlign: 'center' }}>
              <h3>Ciao {displayName}!</h3>
              <p style={{ color: 'var(--text-secondary)' }}>È il momento di darsi da fare!</p>

              <div className="big-btn-container">
                <button className="big-diaper-btn" onClick={handleAddDiaper}>
                  <span className="diaper-icon">🧷</span>
                  <span>+1 Cambio</span>
                </button>
              </div>
            </div>

            <div className="glass-card leaderboard">
              <h3>🏆 Classifica Settimanale</h3>

              {teachers.length === 0 && <p style={{ textAlign: 'center', opacity: 0.5 }}>Nessuna maestra registrata.</p>}

              {teachers.map((t, index) => (
                <div key={t.id} className={`teacher-item ${index === 0 && t.points > 0 ? 'first-place' : ''}`}>
                  <div className="teacher-info">
                    <span className="rank">#{index + 1}</span>
                    <span className="teacher-name">{t.id} {t.uid === user.uid ? '(Tu)' : ''}</span>
                  </div>
                  <div className="teacher-points">{t.points} pts</div>
                </div>
              ))}

              {leagueData?.createdByUid === user.uid && (
                <div style={{ marginTop: '2rem' }}>
                  <div className="divider">Area Admin</div>
                  <button className="btn btn-danger" onClick={() => {
                    if (confirm("Sei sicuro? Tutti i punti verranno azzerati.")) handleEndWeek();
                  }}>Termina Settimana</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ADD LEAGUE MODAL */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h1 className="title" style={{ fontSize: '1.8rem' }}>Aggiungi Lega</h1>

            <div className="tabs" style={{ marginTop: '1rem' }}>
              <button className={`tab ${addTab === 'join' ? 'active' : ''}`} onClick={() => { setAddTab('join'); setModalError(''); }}>Entra</button>
              <button className={`tab ${addTab === 'create' ? 'active' : ''}`} onClick={() => { setAddTab('create'); setModalError(''); }}>Crea Nuova</button>
            </div>

            {modalError && <p className="error-msg">{modalError}</p>}

            {addTab === 'join' ? (
              <>
                <div className="input-group">
                  <label>Codice Lega</label>
                  <input type="text" placeholder="Es. ABCD1" value={modalLeagueCode} onChange={e => setModalLeagueCode(e.target.value.toUpperCase())} maxLength={5} />
                </div>
                <button className="btn btn-primary" onClick={handleJoinLeague} disabled={modalBusy}>
                  {modalBusy ? <div className="loader"></div> : 'Entra nella Lega'}
                </button>
              </>
            ) : (
              <>
                <div className="input-group">
                  <label>Nome della Lega</label>
                  <input type="text" placeholder="Es. Asilo Nido Gli Sbirulini" value={modalLeagueName} onChange={e => setModalLeagueName(e.target.value)} />
                </div>
                <button className="btn btn-primary" onClick={handleCreateLeague} disabled={modalBusy}>
                  {modalBusy ? <div className="loader"></div> : 'Crea la Lega'}
                </button>
              </>
            )}

            <button className="btn btn-secondary" style={{ marginTop: '0.75rem' }} onClick={() => setShowAddModal(false)}>Annulla</button>
          </div>
        </div>
      )}

      {/* WINNER MODAL */}
      {showWinner && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="winner-icon">👑</div>
            <h1 className="title" style={{ fontSize: '2rem' }}>Settimana Conclusa!</h1>
            <p className="subtitle">Il/la vincitore/trice è:</p>

            <h2 style={{ fontSize: '2.5rem', margin: '1rem 0', color: 'var(--accent-blue)' }}>
              {winner?.id}
            </h2>
            <p style={{ marginBottom: '2rem' }}>con ben <strong>{winner?.points}</strong> cambi pannolino!</p>

            <button className="btn btn-primary" onClick={() => setShowWinner(false)}>
              Inizia Nuova Settimana!
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
