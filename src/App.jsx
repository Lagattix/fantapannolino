import React, { useState, useEffect } from 'react';
import { db, isFirebaseConfigured } from './firebase';
import { collection, doc, setDoc, getDoc, onSnapshot, query, orderBy, updateDoc, writeBatch } from 'firebase/firestore';

function App() {
  const [view, setView] = useState('home'); // home, create, join, dashboard, winner
  const [leagueCode, setLeagueCode] = useState('');
  const [userName, setUserName] = useState('');
  const [leagueName, setLeagueName] = useState('');
  const [leagueData, setLeagueData] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [winner, setWinner] = useState(null);

  // Local state for DEMO Mode
  const isDemo = !isFirebaseConfigured();

  // Try to load from localStorage if in DEMO
  useEffect(() => {
    if (isDemo) {
      const savedCode = localStorage.getItem('fp_leagueCode');
      const savedUser = localStorage.getItem('fp_userName');
      if (savedCode && savedUser) {
        setLeagueCode(savedCode);
        setUserName(savedUser);
        loadDemoLeague(savedCode);
        setView('dashboard');
      }
    }
  }, [isDemo]);

  // Demo functions
  const loadDemoLeague = (code) => {
    const data = JSON.parse(localStorage.getItem(`fp_league_${code}`) || 'null');
    if (data) {
      setLeagueData({ id: code, name: data.name, createdBy: data.createdBy });
      const sortedTeachers = Object.keys(data.teachers).map(name => ({
        id: name,
        points: data.teachers[name]
      })).sort((a, b) => b.points - a.points);
      setTeachers(sortedTeachers);
      return true;
    }
    return false;
  };

  const saveDemoLeague = (code, name, createdBy, teachersMap = {}) => {
    localStorage.setItem(`fp_league_${code}`, JSON.stringify({ name, createdBy, teachers: teachersMap }));
    loadDemoLeague(code);
  };

  // Create League
  const handleCreateLeague = async () => {
    if (!leagueName || !userName) {
      setError('Inserisci il tuo nome e il nome della lega');
      return;
    }
    setLoading(true);
    setError('');

    // Generate a simple 5-char code
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();

    if (isDemo) {
      saveDemoLeague(code, leagueName, userName, { [userName]: 0 });
      setLeagueCode(code);
      localStorage.setItem('fp_leagueCode', code);
      localStorage.setItem('fp_userName', userName);
      setView('dashboard');
      setLoading(false);
      return;
    }

    try {
      await setDoc(doc(db, "leagues", code), {
        name: leagueName,
        createdBy: userName,
        createdAt: new Date()
      });
      await setDoc(doc(db, "leagues", code, "teachers", userName), {
        points: 0
      });
      setLeagueCode(code);
      setView('dashboard');
    } catch (e) {
      setError('Errore di connessione a Firebase.');
    } finally {
      setLoading(false);
    }
  };

  // Join League
  const handleJoinLeague = async () => {
    if (!leagueCode || !userName) {
      setError('Inserisci il tuo nome e il codice della lega');
      return;
    }
    setLoading(true);
    setError('');
    const code = leagueCode.toUpperCase();
    setLeagueCode(code);

    if (isDemo) {
      const exists = loadDemoLeague(code);
      if (exists) {
        const data = JSON.parse(localStorage.getItem(`fp_league_${code}`));
        if (data.teachers[userName] === undefined) {
          data.teachers[userName] = 0;
          localStorage.setItem(`fp_league_${code}`, JSON.stringify(data));
          loadDemoLeague(code);
        }
        localStorage.setItem('fp_leagueCode', code);
        localStorage.setItem('fp_userName', userName);
        setView('dashboard');
      } else {
        setError('Lega non trovata');
      }
      setLoading(false);
      return;
    }

    try {
      const leagueSnap = await getDoc(doc(db, "leagues", code));
      if (leagueSnap.exists()) {
        const tDoc = await getDoc(doc(db, "leagues", code, "teachers", userName));
        if (!tDoc.exists()) {
          await setDoc(doc(db, "leagues", code, "teachers", userName), { points: 0 });
        }
        setView('dashboard');
      } else {
        setError('Lega non trovata in Firebase');
      }
    } catch (e) {
      setError('Errore. Controlla il codice.');
    } finally {
      setLoading(false);
    }
  };

  // Realtime updates when in dashboard
  useEffect(() => {
    if (view === 'dashboard' && !isDemo) {
      // Listen to league info
      const unsubLeague = onSnapshot(doc(db, "leagues", leagueCode), (doc) => {
        if (doc.exists()) setLeagueData({ id: doc.id, ...doc.data() });
      });

      // Listen to teachers
      const q = query(collection(db, "leagues", leagueCode, "teachers"), orderBy("points", "desc"));
      const unsubTeachers = onSnapshot(q, (snapshot) => {
        const t = [];
        snapshot.forEach((doc) => t.push({ id: doc.id, ...doc.data() }));
        setTeachers(t);
      });

      return () => { unsubLeague(); unsubTeachers(); };
    }
  }, [view, leagueCode, isDemo]);

  // Add Point (Diaper changed!)
  const handleAddDiaper = async () => {
    if (isDemo) {
      const data = JSON.parse(localStorage.getItem(`fp_league_${leagueCode}`));
      data.teachers[userName] += 1;
      localStorage.setItem(`fp_league_${leagueCode}`, JSON.stringify(data));
      loadDemoLeague(leagueCode);
      return;
    }

    try {
      const userRef = doc(db, "leagues", leagueCode, "teachers", userName);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await updateDoc(userRef, { points: userSnap.data().points + 1 });
      }
    } catch (e) {
      alert("Errore nell'aggiunta del pannolino!");
    }
  };

  // Reset Week (Announce winner and set points to zero)
  const handleEndWeek = async () => {
    if (teachers.length === 0) return;

    // Sort just in case
    const sorted = [...teachers].sort((a, b) => b.points - a.points);
    const weeklyWinner = sorted[0];

    setWinner(weeklyWinner);
    setView('winner');

    // Reset points
    if (isDemo) {
      const data = JSON.parse(localStorage.getItem(`fp_league_${leagueCode}`));
      Object.keys(data.teachers).forEach(k => data.teachers[k] = 0);
      localStorage.setItem(`fp_league_${leagueCode}`, JSON.stringify(data));
      loadDemoLeague(leagueCode);
      return;
    }

    try {
      const batch = writeBatch(db);
      teachers.forEach(t => {
        const ref = doc(db, "leagues", leagueCode, "teachers", t.id);
        batch.update(ref, { points: 0 });
      });
      await batch.commit();
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    setLeagueCode('');
    setUserName('');
    setLeagueData(null);
    setTeachers([]);
    setView('home');
    if (isDemo) {
      localStorage.removeItem('fp_leagueCode');
      localStorage.removeItem('fp_userName');
    }
  };


  // --- RENDERS ---

  if (view === 'home') {
    return (
      <div className="app-container">
        <div className="glass-card">
          <h1 className="title">FantaPannolino 👶</h1>
          <p className="subtitle">La lega più profumata dell'asilo!</p>

          <div className="input-group">
            <button className="btn btn-primary" onClick={() => setView('join')}>Entra in una Lega</button>
            <div className="divider">oppure</div>
            <button className="btn btn-secondary" onClick={() => setView('create')}>Crea Nuova Lega</button>
          </div>
          {isDemo && <p style={{ textAlign: 'center', fontSize: '0.8rem', opacity: 0.5 }}>Modalità Demo Locale Attiva</p>}
        </div>
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div className="app-container">
        <div className="glass-card">
          <h1 className="title">Nuova Lega</h1>
          <p className="subtitle">Mastri di pannolini, unitevi!</p>

          {error && <p className="error-msg">{error}</p>}

          <div className="input-group">
            <label>Nome della Lega</label>
            <input type="text" placeholder="Es. Asilo Nido Gli Sbirulini" value={leagueName} onChange={e => setLeagueName(e.target.value)} />
          </div>
          <div className="input-group">
            <label>Il Tuo Nome (Maestro/a)</label>
            <input type="text" placeholder="Es. Maestra Giulia" value={userName} onChange={e => setUserName(e.target.value)} />
          </div>

          <div className="input-group" style={{ marginTop: '2rem' }}>
            <button className="btn btn-primary" onClick={handleCreateLeague} disabled={loading}>
              {loading ? <div className="loader"></div> : 'Fonda la Lega'}
            </button>
            <button className="btn btn-secondary" onClick={() => setView('home')}>Indietro</button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'join') {
    return (
      <div className="app-container">
        <div className="glass-card">
          <h1 className="title">Entra in Lega</h1>
          <p className="subtitle">Preparati a cambiare pannolini!</p>

          {error && <p className="error-msg">{error}</p>}

          <div className="input-group">
            <label>Codice Lega (5 Lettere)</label>
            <input type="text" placeholder="Es. ABCD1" value={leagueCode} onChange={e => setLeagueCode(e.target.value.toUpperCase())} maxLength={5} />
          </div>
          <div className="input-group">
            <label>Il Tuo Nome (Maestro/a)</label>
            <input type="text" placeholder="Es. Maestra Giulia" value={userName} onChange={e => setUserName(e.target.value)} />
          </div>

          <div className="input-group" style={{ marginTop: '2rem' }}>
            <button className="btn btn-primary" onClick={handleJoinLeague} disabled={loading}>
              {loading ? <div className="loader"></div> : 'Entra Subito'}
            </button>
            <button className="btn btn-secondary" onClick={() => setView('home')}>Indietro</button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'dashboard') {
    return (
      <div className="app-container">
        <div className="dashboard-header">
          <div className="league-info">
            <h2>{leagueData?.name || 'Lega FantaPannolino'}</h2>
            <p>Codice Lega: {leagueCode}</p>
          </div>
          <button className="btn btn-secondary btn-logout" onClick={handleLogout}>Esci</button>
        </div>

        <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <h3>Ciao {userName}!</h3>
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
                <span className="teacher-name">{t.id} {t.id === userName ? '(Tu)' : ''}</span>
              </div>
              <div className="teacher-points">{t.points} pts</div>
            </div>
          ))}

          {leagueData?.createdBy === userName && (
            <div style={{ marginTop: '2rem' }}>
              <div className="divider">Area Admin</div>
              <button className="btn btn-danger" onClick={() => {
                if (confirm("Sei sicuro di voler terminare la settimana? Tutti i punti verranno azzerati.")) {
                  handleEndWeek();
                }
              }}>Termina Settimana</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'winner') {
    return (
      <div className="app-container">
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="winner-icon">👑</div>
            <h1 className="title" style={{ fontSize: '2rem' }}>Settimana Conclusa!</h1>
            <p className="subtitle">Il/la vincitore/trice è:</p>

            <h2 style={{ fontSize: '2.5rem', margin: '1rem 0', color: 'var(--accent-blue)' }}>
              {winner?.id}
            </h2>
            <p style={{ marginBottom: '2rem' }}>con ben <strong>{winner?.points}</strong> cambi pannolino!</p>

            <button className="btn btn-primary" onClick={() => setView('dashboard')}>
              Inizia Nuova Settimana!
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default App;
