import React, { useState } from 'react';
import axios from 'axios';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const response = await axios.post('http://localhost:8000/token', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      localStorage.setItem('token', response.data.access_token);
      window.location.href = '/dashboard';
    } catch (err) {
      setError('Identifiants invalides');
    }
  };

  return (
    <div className="auth-container" style={{ 
      backgroundImage: "linear-gradient(rgba(9, 9, 11, 0.4), rgba(9, 9, 11, 0.6)), url('/BG.jpg')", 
      backgroundSize: 'cover', 
      backgroundPosition: 'center', 
      backgroundRepeat: 'no-repeat' 
    }}>
      <div className="glass-panel login-card">
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '32px' }}>
          <img
            src="/LOGO.png"
            alt="Logo 1"
            style={{ width: '84px', height: '84px', objectFit: 'contain', borderRadius: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}
          />
          <img
            src="/logo2.jpg"
            alt="Logo 2"
            style={{ width: '84px', height: '84px', objectFit: 'contain', borderRadius: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}
          />
        </div>
        <h1 style={{ margin: '0 0 8px 0', textAlign: 'center', color: '#6366f1', fontSize: '32px', fontWeight: '800', letterSpacing: '-0.5px' }}>RailGuard</h1>
        {error && <div style={{ color: 'white', backgroundColor: 'rgba(239, 68, 68, 0.8)', padding: '10px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', fontWeight: '500' }}>{error}</div>}
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label>Nom d'utilisateur</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <label>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary" style={{ marginTop: '12px' }}>
            Se connecter
          </button>
        </form>
      </div>
    </div>
  );
}
