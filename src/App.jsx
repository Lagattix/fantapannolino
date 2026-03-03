import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, doc, setDoc, getDoc, onSnapshot, query, orderBy, updateDoc, writeBatch } from 'firebase/firestore';

function App() {
  const [view, setView] = useState('home');
  const [leagueCode, setLeagueCode] = useState('');
  const [userName, setUserName] = useState('');
  const [leagueName, setLeagueName] = useState('');
  const [leagueData, setLeagueData] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [winner, setWinner] = useState(null);

  // Auto-login: se l'utente ha già una sessione salvata, entra direttamente
  useEffect(() => {
    const savedCode = localStorage.getItem('fp_leagueCode');
    const savedUser = localStorage.getItem('fp_userName');
    if (savedCode && savedUser) {
      setLeagueCode(savedCode);
      setUserName(savedUser);
      setView('dashboard');
    }
  }, []);

  // Create League
  const handleCreateLeague = async () => {
    if (!leagueName.trim() || !userName.trim()) {
      setError('Inserisci il tuo nome e il nome della lega');
      return;
    }
    setLoading(true);
    setError('');

    const code = Math.random().toString(36).substring(2, 7).toUpperCase();

    try {
      await setDoc(doc(db, "leagues", code), {
        name: leagueName.trim(),
        createdBy: userName.trim(),
        createdAt: new Date()
      });
      await setDoc(doc(db, "leagues", code, "teachers", userName.trim()), {
        points: 0
      });
      setLeagueCode(code);
      setUserName(userName.trim());
      localStorage.setItem('fp_leagueCode', code);
      localStorage.setItem('fp_userName', userName.trim());
      setView('dashboard');
    } catch (e) {
      console.error(e);
      setError('Errore di connessione a Firebase: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Join League
  const handleJoinLeague = async () => {
    if (!leagueCode.trim() || !userName.trim()) {
      setError('Inserisci il tuo nome e il codice della lega');
      return;
    }
    setLoading(true);
    setError('');
    const code = leagueCode.trim().toUpperCase();
    const name = userName.trim();

    try {
      const leagueSnap = await getDoc(doc(db, "leagues", code));
      if (leagueSnap.exists()) {
        // La lega esiste! Aggiungi la maestra se non c'è già
        const tDoc = await getDoc(doc(db, "leagues", code, "teachers", name));
        if (!tDoc.exists()) {
          await setDoc(doc(db, "leagues", code, "teachers", name), { points: 0 });
        }
        setLeagueCode(code);
        setUserName(name);
        localStorage.setItem('fp_leagueCode', code);
        localStorage.setItem('fp_userName', name);
        setView('dashboard');
      } else {
        setError('Lega non trovata! Controlla il codice e riprova.');
      }
    } catch (e) {
      console.error(e);
      setError('Errore di connessione: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Realtime updates when in dashboard
  useEffect(() => {
    if (view === 'dashboard' && leagueCode) {
      const unsubLeague = onSnapshot(doc(db, "leagues", leagueCode), (docSnap) => {
        if (docSnap.exists()) setLeagueData({ id: docSnap.id, ...docSnap.data() });
      });

      const q = query(collection(db, "leagues", leagueCode, "teachers"), orderBy("points", "desc"));
      const unsubTeachers = onSnapshot(q, (snapshot) => {
        const t = [];
        snapshot.forEach((docSnap) => t.push({ id: docSnap.id, ...docSnap.data() }));
        setTeachers(t);
      });

      return () => { unsubLeague(); unsubTeachers(); };
    }
  }, [view, leagueCode]);

  // Add Point (Diaper changed!)
  const handleAddDiaper = async () => {
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

  // Reset Week
  const handleEndWeek = async () => {
    if (teachers.length === 0) return;

    const sorted = [...teachers].sort((a, b) => b.points - a.points);
    const weeklyWinner = sorted[0];

    setWinner(weeklyWinner);
    setView('winner');

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
    localStorage.removeItem('fp_leagueCode');
    localStorage.removeItem('fp_userName');
  };

  // --- RENDERS ---

  if (view === 'home') {
    return (
      <div className="app-container">
        <div className="glass-card">
          <h1 className="title">FantaPannolino 👶</h1>
          <p className="subtitle">La lega più profumata dell'asilo!</p>

          <div className="input-group">
            <button className="btn btn-primary" onClick={() => { setError(''); setView('join'); }}>Entra in una Lega</button>
            <div className="divider">oppure</div>
            <button className="btn btn-secondary" onClick={() => { setError(''); setView('create'); }}>Crea Nuova Lega</button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div className="app-container">
        <div className="glass-card">
          <h1 className="title">Nuova Lega</h1>
          <p className="subtitle">Maestri di pannolini, unitevi!</p>

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
            <button className="btn btn-secondary" onClick={() => { setError(''); setView('home'); }}>Indietro</button>
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
            <button className="btn btn-secondary" onClick={() => { setError(''); setView('home'); }}>Indietro</button>
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
