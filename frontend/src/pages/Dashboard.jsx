import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetinaUrl,
  iconUrl: iconUrl,
  shadowUrl: shadowUrl,
});

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [fixedDefects, setFixedDefects] = useState([]);
  const [unseenReportCount, setUnseenReportCount] = useState(0);
  const [newEmployee, setNewEmployee] = useState({ username: '', password: '', region: '' });
  const [editingEmployeeId, setEditingEmployeeId] = useState(null);
  const [editEmployeeForm, setEditEmployeeForm] = useState({ username: '', password: '', region: '' });
  const [distributeMsg, setDistributeMsg] = useState('');
  const [defects, setDefects] = useState([]);
  const [stats, setStats] = useState([]);
  const [fixedStats, setFixedStats] = useState([]);
  const [activeTab, setActiveTab] = useState('map');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState(null);
  const [detectionError, setDetectionError] = useState(null);
  const [repairForms, setRepairForms] = useState({});
  const [repairMessage, setRepairMessage] = useState('');
  const [showSettingsHistory, setShowSettingsHistory] = useState(false);
  const [filters, setFilters] = useState({
    crack: true,
    squat: true,
    spalling: true,
    joint: true
  });
  const [period, setPeriod] = useState('mensuel');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [zoomedImage, setZoomedImage] = useState(null);


  const fetchUser = async () => {
    try {
      const { data } = await axios.get('http://localhost:8000/api/me', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setUser(data);
      if (data.role === 'admin') {
        fetchEmployees();
        fetchFixedDefects();
        fetchUnseenReportCount();
      }
    } catch (error) {
      if (error.response?.status === 401) window.location.href = '/login';
    }
  };

  const fetchEmployees = async () => {
    try {
      const { data } = await axios.get('http://localhost:8000/api/users', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setEmployees(data);
    } catch (err) { }
  };

  const fetchDefects = async () => {
    try {
      const { data } = await axios.get('http://localhost:8000/api/defects', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setDefects(data);
    } catch (error) {
      if (error.response?.status === 401) window.location.href = '/login';
    }
  };

  const fetchStats = async (month = null, year = null) => {
    try {
      const params = {};
      if (month) params.month = month;
      if (year) params.year = year;
      const { data } = await axios.get('http://localhost:8000/api/stats/defects', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params
      });
      setStats(data);
    } catch (err) { }
  };

  const fetchFixedStats = async (month = null, year = null) => {
    try {
      const params = {};
      if (month) params.month = month;
      if (year) params.year = year;
      const { data } = await axios.get('http://localhost:8000/api/stats/fixed', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params
      });
      setFixedStats(data);
    } catch (err) { }
  };

  const fetchFixedDefects = async () => {
    try {
      const { data } = await axios.get('http://localhost:8000/api/fixed-defects', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setFixedDefects(data);
    } catch (err) { }
  };

  const fetchUnseenReportCount = async () => {
    try {
      const { data } = await axios.get('http://localhost:8000/api/fixed-defects/unseen-count', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setUnseenReportCount(data.count || 0);
    } catch (err) { }
  };

  const markReportsAsSeen = async () => {
    try {
      await axios.post('http://localhost:8000/api/fixed-defects/mark-seen', {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setUnseenReportCount(0);
      fetchFixedDefects();
    } catch (err) { }
  };

  useEffect(() => {
    fetchUser();
    fetchDefects();
  }, []);

  useEffect(() => {
    if (period === 'mensuel') {
      fetchStats(selectedMonth, selectedYear);
      fetchFixedStats(selectedMonth, selectedYear);
    } else {
      fetchStats(null, selectedYear);
      fetchFixedStats(null, selectedYear);
    }
  }, [period, selectedMonth, selectedYear, activeTab]);

  const handleFilterChange = (cls) => {
    setFilters(prev => ({ ...prev, [cls]: !prev[cls] }));
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setDetectionResult(null);
      setDetectionError(null);
    }
  };

  const runDetection = async () => {
    if (!selectedFile) return;
    setIsDetecting(true);
    setDetectionError(null);
    setDetectionResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('is_test', 'true');

    try {
      const response = await axios.post('http://localhost:8000/api/detect', formData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setDetectionResult(response.data);
    } catch (error) {
      console.error(error);
      setDetectionError(error.response?.data?.detail || "An error occurred during detection.");
    } finally {
      setIsDetecting(false);
    }
  };

  const getColor = (cls) => {
    switch (cls) {
      case 'crack': return '#FF0000';
      case 'squat': return '#ff7000';
      case 'spalling': return '#ffff00';
      case 'joint':
      case 'joints': return '#0000FF';
      default: return '#FF0000';
    }
  };

  const translateDefect = (cls) => {
    switch (cls.toLowerCase()) {
      case 'crack': return 'fissure';
      case 'squat': return 'squat';
      case 'spalling': return 'écaillage';
      case 'joint':
      case 'joints': return 'joint';
      default: return cls;
    }
  };

  const getOriginalImageName = (imagePath) => {
    if (!imagePath) return '';
    if (imagePath.startsWith('result_')) return imagePath.slice(7);
    return imagePath;
  };

  const updateRepairForm = (defectId, updates) => {
    setRepairForms(prev => ({
      ...prev,
      [defectId]: {
        ...prev[defectId],
        ...updates
      }
    }));
  };

  const handleRepairFileChange = (defectId, event) => {
    const file = event.target.files[0];
    updateRepairForm(defectId, { file });
  };

  const submitRepairReport = async (defectId) => {
    const form = repairForms[defectId] || {};
    if (!form.file) {
      setRepairMessage("Veuillez ajouter une image du défaut réparé avant d'envoyer le rapport.");
      return;
    }

    const formData = new FormData();
    formData.append('defect_id', defectId);
    formData.append('file', form.file);
    formData.append('report_text', form.reportText || '');

    try {
      await axios.post(`http://localhost:8000/api/repair`, formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setRepairMessage('Rapport envoyé à l’administrateur. Le défaut a été déplacé vers l’historique.');
      setRepairForms(prev => {
        const next = { ...prev };
        delete next[defectId];
        return next;
      });
      fetchDefects();
      fetchStats();
      fetchFixedStats();
    } catch (error) {
      setRepairMessage(error.response?.data?.detail || "Impossible d'envoyer le rapport.");
    }
  };

  const startEditingEmployee = (employee) => {
    setEditingEmployeeId(employee.id);
    setEditEmployeeForm({
      username: employee.username || '',
      password: '',
      region: employee.region || '',
    });
  };

  const cancelEditingEmployee = () => {
    setEditingEmployeeId(null);
    setEditEmployeeForm({ username: '', password: '', region: '' });
  };

  const saveEmployeeChanges = async (employeeId) => {
    try {
      const payload = {
        username: editEmployeeForm.username,
        region: editEmployeeForm.region,
      };

      if (editEmployeeForm.password.trim()) {
        payload.password = editEmployeeForm.password;
      }

      await axios.put(`http://localhost:8000/api/users/${employeeId}`, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      cancelEditingEmployee();
      fetchEmployees();
    } catch (err) {
      alert(err.response?.data?.detail || "Erreur lors de la modification de l'employé");
    }
  };

  const filteredDefects = defects.filter(d => {
    if (d.defect_class === 'joints') return filters.joint;
    return filters[d.defect_class];
  });

  const mapCenter = (user?.role === 'employee' && filteredDefects.length > 0) 
    ? [filteredDefects[0].lat, filteredDefects[0].lon] 
    : [36.57, 3.47];
  
  const mapZoom = (user?.role === 'employee' && filteredDefects.length > 0) ? 18 : 8;

  const translatedStats = stats.map(s => ({
    ...s,
    name: translateDefect(s.name)
  }));

  const translatedFixedStats = fixedStats.map(s => ({
    ...s,
    name: translateDefect(s.name)
  }));

  const handleLogout = () => {
    if (window.confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  };

  return (
    <div className="dashboard-layout">
      <div className="sidebar glass-panel" style={{ margin: '16px', padding: '24px', height: 'calc(100vh - 32px)', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', paddingBottom: '16px' }}>
            <img src="/LOGO.png" alt="Logo 1" style={{ height: '45px', objectFit: 'contain' }} />
            <img src="/logo2.jpg" alt="Logo 2" style={{ height: '45px', objectFit: 'contain', borderRadius: '4px' }} />
          </div>
          <h1 style={{ margin: 0, paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#6366f1', fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px' }}>RailGuard</h1>
        </div>

        <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            className={`sidebar-btn ${activeTab === 'map' ? 'active' : ''}`}
            onClick={() => setActiveTab('map')}
          >
             Vue Carte Interactive
          </button>
          <button
            className={`sidebar-btn ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
             Statistiques & Analytique
          </button>
          {user?.role === 'admin' && (
            <button
              className={`sidebar-btn ${activeTab === 'employees' ? 'active' : ''}`}
              onClick={() => setActiveTab('employees')}
            >
              Gestion Équipe
            </button>
          )}
          {user?.role === 'employee' && (
            <button
              className={`sidebar-btn ${activeTab === 'report' ? 'active' : ''}`}
              onClick={() => setActiveTab('report')}
            >
              🔧 Mes Réparations
            </button>
          )}
          {user?.role === 'admin' && (
            <button
              className={`sidebar-btn ${activeTab === 'fixed' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('fixed');
                fetchFixedDefects();
                markReportsAsSeen();
              }}
            >
              Maintenance effectuée
              {unseenReportCount > 0 && (
                <span className="badge">{unseenReportCount}</span>
              )}
            </button>
          )}
        </div>

        {activeTab === 'map' && (
          <div style={{ marginTop: '30px' }}>
            <h3 style={{ fontSize: '14px', marginBottom: '16px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Filtres de Classes</h3>
            <div className="filter-group">
              {Object.keys(filters).map(cls => (
                <label key={cls} className="filter-item">
                  <input
                    type="checkbox"
                    checked={filters[cls]}
                    onChange={() => handleFilterChange(cls)}
                  />
                  <span style={{ textTransform: 'capitalize', fontWeight: '500' }}>{translateDefect(cls)}</span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      width: '12px', height: '12px',
                      borderRadius: '50%',
                      backgroundColor: `var(--accent-${cls})`,
                      boxShadow: `0 0 8px var(--accent-${cls})`
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            className={`sidebar-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('settings');
              setShowSettingsHistory(false);
              if (user?.role === 'admin') fetchFixedDefects();
            }}
          >
            ⚙️ Paramètres
          </button>
        </div>
      </div>

      <div className="main-content" style={{ padding: '16px 16px 16px 0', gap: '16px' }}>

        {activeTab === 'map' && (
          <>
            <div className="header glass-panel" style={{ padding: '20px' }}>
              <div>
                <h2 style={{ margin: 0 }}>Vue Carte Interactive</h2>
                <p className="label" style={{ margin: '4px 0 0 0' }}>Affichage de {filteredDefects.length} points détectés</p>
              </div>
            </div>

            <div className="map-container glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1 }}>
                <MapContainer key={`${mapCenter[0]}-${mapZoom}`} center={mapCenter} zoom={mapZoom} scrollWheelZoom={true} style={{ height: '100%', width: '100%', borderRadius: '16px' }}>
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {filteredDefects.map(defect => {
                    const color = getColor(defect.defect_class);
                    const isDanger = defect.defect_class === 'crack';
                    
                    const customIcon = L.divIcon({
                      className: 'custom-div-icon',
                      html: `<div class="custom-pin ${isDanger ? 'danger-pulse' : ''}" style="background-color: ${color};"></div>`,
                      iconSize: [30, 30],
                      iconAnchor: [15, 30],
                      popupAnchor: [0, -30]
                    });

                    return (
                      <Marker
                        key={defect.id}
                        position={[defect.lat, defect.lon]}
                        icon={customIcon}
                      >
                        <Popup>
                          <div style={{ padding: '0px', width: '180px', textAlign: 'center' }}>
                            <h4 style={{ margin: '0 0 4px 0', textTransform: 'capitalize', color: `var(--accent-${defect.defect_class})` }}>
                              {translateDefect(defect.defect_class)}
                            </h4>
                            <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#cbd5e1', lineHeight: '1.4' }}>
                              Confiance : {(defect.confidence * 100).toFixed(2)}%<br />
                              Lat: {defect.lat.toFixed(6)}<br />
                              Lon: {defect.lon.toFixed(6)}
                            </p>
                            {defect.image_path && (
                              <img
                                src={`http://localhost:8000/images/${defect.image_path}`}
                                alt={defect.defect_class}
                                style={{ width: '100%', borderRadius: '4px', objectFit: 'cover', height: '120px', cursor: 'pointer' }}
                                onClick={() => setZoomedImage(`http://localhost:8000/images/${defect.image_path}`)}
                                onError={e => e.target.style.display = 'none'}
                              />
                            )}
                            <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>
                              {new Date(defect.date_detected).toLocaleDateString()}
                            </p>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              </div>
            </div>
          </>
        )}

        {activeTab === 'stats' && (
          <div className="glass-panel" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', backgroundColor: '#0a0c14' }}>
            {/* EN-TÊTE STATS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '28px', fontWeights: '800', letterSpacing: '-0.5px' }}>Tableau de Bord Analytique</h1>
                <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#64748b', marginTop: '4px' }}>/ stats / vue comparative</div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setPeriod('mensuel')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 20px', borderRadius: '12px', border: '1px solid #1e293b',
                    backgroundColor: period === 'mensuel' ? '#1e293b' : 'transparent',
                    color: period === 'mensuel' ? '#fff' : '#94a3b8', cursor: 'pointer', transition: '0.2s', boxShadow: period === 'mensuel' ? '0 4px 12px rgba(0,0,0,0.2)' : 'none'
                  }}
                >
                  <span style={{ fontSize: '16px' }}>🗓️</span>
                  <span style={{ fontWeight: '600' }}>Mensuel</span>
                </button>
                <button
                  onClick={() => setPeriod('annuel')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 20px', borderRadius: '12px', border: '1px solid #1e293b',
                    backgroundColor: period === 'annuel' ? '#1e293b' : 'transparent',
                    color: period === 'annuel' ? '#fff' : '#94a3b8', cursor: 'pointer', transition: '0.2s', boxShadow: period === 'annuel' ? '0 4px 12px rgba(0,0,0,0.2)' : 'none'
                  }}
                >
                  <span style={{ fontSize: '16px' }}>🗓️</span>
                  <span style={{ fontWeight: '600' }}>Annuelle</span>
                </button>
              </div>
            </div>

            {/* SÉLÉCTEUR DE MOIS/ANNÉE */}
            <div style={{ marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'flex-end', padding: '0 4px' }}>
              {period === 'mensuel' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Sélectionner le Mois :</span>
                  <select
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(parseInt(e.target.value))}
                    style={{
                      backgroundColor: '#0f172a', color: '#fff', border: '1px solid #1e293b', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer', outline: 'none'
                    }}
                  >
                    {['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'].map((m, i) => (
                      <option key={m} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Sélectionner l'Année :</span>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(parseInt(e.target.value))}
                  style={{
                    backgroundColor: '#0f172a', color: '#fff', border: '1px solid #1e293b', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer', outline: 'none'
                  }}
                >
                  {[2023, 2024, 2025, 2026].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* GRILLE TOP: BARS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: '20px' }}>
              <div style={{ backgroundColor: '#0f111a', border: '1px solid #1e293b', borderRadius: '16px', padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#6366f1' }}></div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700' }}>Défauts Détectés</h3>
                </div>
                <div style={{ width: '100%', height: '300px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={translatedStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" stroke="#334155" tick={{ fill: '#94a3b8', fontSize: 13 }} axisLine={false} tickLine={false} />
                      <YAxis stroke="#334155" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 3]} ticks={[0, 0.75, 1.5, 2.25, 3]} />
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', boxShadow: '0 10px 20px rgba(0,0,0,0.3)' }}
                      />
                      <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{ backgroundColor: '#0f111a', border: '1px solid #1e293b', borderRadius: '16px', padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700' }}>Défauts Réparés</h3>
                </div>
                <div style={{ width: '100%', height: '300px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={translatedFixedStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" stroke="#334155" tick={{ fill: '#94a3b8', fontSize: 13 }} axisLine={false} tickLine={false} />
                      <YAxis stroke="#334155" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} />
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', boxShadow: '0 10px 20px rgba(0,0,0,0.3)' }}
                      />
                      <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* DISTRIBUTION ANOMALIES SECTION (CUMULATIVE VIEW - BEST CHOICE) */}
            <div style={{ backgroundColor: '#0f111a', border: '1px solid #1e293b', borderRadius: '16px', padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#00e5ff' }}></div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700' }}>Distribution Globale des Anomalies (%)</h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '60px' }}>
                {/* Donut Chart (Cumulative) */}
                <div style={{ width: '220px', height: '220px', position: 'relative' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={translatedStats.map(s => {
                          const fixed = translatedFixedStats.find(fs => fs.name === s.name)?.value || 0;
                          return { ...s, value: s.value + fixed };
                        })}
                        innerRadius={75}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {translatedStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={
                            entry.name === 'joint' ? '#00e5ff' :
                              entry.name === 'écaillage' ? '#ff9100' :
                                entry.name === 'fissure' ? '#ff5252' :
                                  entry.name === 'squat' ? '#d500f9' : '#fff'
                          } />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '32px', fontWeight: '800', lineHeight: '1' }}>
                      {translatedStats.reduce((a, b) => a + b.value, 0) + translatedFixedStats.reduce((a, b) => a + b.value, 0)}
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginTop: '4px', letterSpacing: '1px' }}>TOTAL</div>
                  </div>
                </div>

                {/* Legend List (Cumulative) */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {translatedStats.map((stat, idx) => {
                    const fixedVal = translatedFixedStats.find(fs => fs.name === stat.name)?.value || 0;
                    const cumulativeVal = stat.value + fixedVal;
                    const grandTotal = translatedStats.reduce((a, b) => a + b.value, 0) + translatedFixedStats.reduce((a, b) => a + b.value, 0);
                    const pct = grandTotal > 0 ? ((cumulativeVal / grandTotal) * 100).toFixed(1) : 0;
                    const color =
                      stat.name === 'joint' ? '#00e5ff' :
                        stat.name === 'écaillage' ? '#ff9100' :
                          stat.name === 'fissure' ? '#ff5252' :
                            stat.name === 'squat' ? '#d500f9' : '#fff';

                    return (
                      <div key={stat.name} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: color }}></div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#cbd5e1', textTransform: 'capitalize', width: '120px' }}>{stat.name}</div>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '24px', alignItems: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '80px' }}>
                            <span style={{ fontSize: '15px', fontWeight: '800', color: '#fff' }}>{cumulativeVal}</span>
                            <span style={{ fontSize: '10px', color: '#64748b' }}>({stat.value} actifs)</span>
                          </div>
                          <span style={{ fontSize: '12px', color: '#475569', width: '45px', textAlign: 'right' }}>{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'test' && user?.role === 'admin' && (
          <div className="glass-panel" style={{ padding: '32px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ marginTop: 0, marginBottom: '8px' }}>Interface de Détection de Défauts YOLOv8</h2>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '300px' }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  style={{ display: 'block', marginBottom: '16px', color: '#f8fafc', padding: '10px', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', width: '100%' }}
                />

                {previewUrl && (
                  <div style={{ marginBottom: '16px' }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#cbd5e1' }}>Image Originale (Avant) :</p>
                    <img src={previewUrl} alt="Preview" style={{ width: '100%', borderRadius: '8px', border: '1px solid #334155' }} />
                  </div>
                )}

                <button
                  className="btn-primary"
                  onClick={runDetection}
                  disabled={!selectedFile || isDetecting}
                  style={{ width: '100%', backgroundColor: isDetecting ? '#334155' : '#10b981', opacity: (!selectedFile || isDetecting) ? 0.5 : 1 }}
                >
                  {isDetecting ? 'Exécution de la Détection...' : '🔍 Lancer la détection'}
                </button>
                {detectionError && (
                  <p style={{ color: '#ef4444', marginTop: '12px', fontSize: '14px', fontWeight: 'bold' }}>{detectionError}</p>
                )}
              </div>

              <div style={{ flex: 1, minWidth: '300px' }}>
                <div style={{ backgroundColor: '#0b1121', border: '2px dashed #475569', borderRadius: '12px', height: '100%', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', flexDirection: 'column' }}>
                  {detectionResult ? (
                    <>
                      <img
                        src={`http://localhost:8000/images/${detectionResult.image_path}`}
                        alt="Result"
                        style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '8px' }}
                      />
                      <div style={{ marginTop: '16px', textAlign: 'center' }}>
                        <h3 style={{ margin: '0 0 4px 0', color: '#10b981', textTransform: 'capitalize' }}>{translateDefect(detectionResult.defect_class)} Détecté</h3>
                        <p style={{ margin: 0, color: '#94a3b8' }}>Confiance : {(detectionResult.confidence * 100).toFixed(1)}%</p>
                      </div>
                    </>
                  ) : (
                    <p style={{ color: '#475569', fontWeight: 'bold', fontSize: '16px' }}>Résultat de la Détection (Après)</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'employees' && user?.role === 'admin' && (
          <div className="glass-panel" style={{ padding: '32px', flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <h2 style={{ marginTop: 0, marginBottom: '8px' }}>Gestion des Employés</h2>

            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '300px', backgroundColor: '#0b1121', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b' }}>
                <h3 style={{ marginTop: 0, color: '#3b82f6' }}>Créer un Employé</h3>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await axios.post('http://localhost:8000/api/users', newEmployee, {
                      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                    });
                    setNewEmployee({ username: '', password: '', region: '' });
                    fetchEmployees();
                  } catch (err) {
                    alert(err.response?.data?.detail || 'Erreur');
                  }
                }}>
                  <input placeholder="Nom d'utilisateur" required value={newEmployee.username} onChange={e => setNewEmployee({ ...newEmployee, username: e.target.value })} style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '8px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc' }} />
                  <input placeholder="Mot de passe" type="password" required value={newEmployee.password} onChange={e => setNewEmployee({ ...newEmployee, password: e.target.value })} style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '8px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc' }} />
                  <select 
                    value={newEmployee.region} 
                    onChange={e => setNewEmployee({ ...newEmployee, region: e.target.value })} 
                    style={{ display: 'block', width: '100%', marginBottom: '16px', padding: '8px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc' }}
                  >
                    <option value="">Sélectionner une Région</option>
                    <option value="Alger">Alger</option>
                    <option value="Bouira">Bouira</option>
                  </select>
                  <button className="btn-primary" type="submit" style={{ width: '100%', backgroundColor: '#3b82f6' }}>Ajouter l'employé</button>
                </form>
              </div>

              <div style={{ flex: 1, minWidth: '300px', backgroundColor: '#0b1121', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b' }}>
                <h3 style={{ marginTop: 0, color: '#10b981' }}>Distribution Automatique</h3>
                <button
                  className="btn-primary"
                  style={{ width: '100%', backgroundColor: '#10b981' }}
                  onClick={async () => {
                    setDistributeMsg('');
                    try {
                      const { data } = await axios.post('http://localhost:8000/api/admin/distribute-defects', {}, {
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                      });
                      setDistributeMsg(data.detail);
                      fetchDefects();
                      fetchStats();
                    } catch (err) {
                      setDistributeMsg(err.response?.data?.detail || 'Erreur de distribution');
                    }
                  }}
                >
                  Distribuer les défauts équitablement
                </button>
                {distributeMsg && <p style={{ marginTop: '12px', fontSize: '14px', color: '#34d399', fontWeight: 'bold' }}>{distributeMsg}</p>}
              </div>
            </div>

            <div style={{ marginTop: '32px' }}>
              <h3 style={{ color: '#f8fafc' }}>Liste des employés</h3>
              {employees.length === 0 ? <p style={{ color: '#94a3b8' }}>Aucun employé trouvé.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155', textAlign: 'left', color: '#94a3b8' }}>
                      <th style={{ padding: '8px' }}>ID</th>
                      <th style={{ padding: '8px' }}>Nom d'utilisateur</th>
                      <th style={{ padding: '8px' }}>Région</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => (
                      <tr key={emp.id} style={{ borderBottom: '1px solid #1e293b' }}>
                        <td style={{ padding: '8px' }}>{emp.id}</td>
                        <td style={{ padding: '8px' }}>
                          {editingEmployeeId === emp.id ? (
                            <input
                              value={editEmployeeForm.username}
                              onChange={e => setEditEmployeeForm({ ...editEmployeeForm, username: e.target.value })}
                              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', boxSizing: 'border-box' }}
                            />
                          ) : (
                            emp.username
                          )}
                        </td>
                        <td style={{ padding: '8px' }}>
                          {editingEmployeeId === emp.id ? (
                            <select
                              value={editEmployeeForm.region}
                              onChange={e => setEditEmployeeForm({ ...editEmployeeForm, region: e.target.value })}
                              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', boxSizing: 'border-box' }}
                            >
                              <option value="Alger">Alger</option>
                              <option value="Bouira">Bouira</option>
                            </select>
                          ) : (
                            emp.role === 'admin' ? (
                              <span style={{ color: '#818cf8', fontWeight: 'bold' }}>Toutes les régions (Global)</span>
                            ) : (
                              emp.region || '-'
                            )
                          )}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            {editingEmployeeId === emp.id ? (
                              <>
                                <input
                                  type="password"
                                  placeholder="Nouveau mot de passe"
                                  value={editEmployeeForm.password}
                                  onChange={e => setEditEmployeeForm({ ...editEmployeeForm, password: e.target.value })}
                                  style={{ width: '180px', padding: '8px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', boxSizing: 'border-box' }}
                                />
                                <button
                                  className="btn-primary"
                                  style={{ backgroundColor: '#10b981', padding: '4px 12px' }}
                                  onClick={() => saveEmployeeChanges(emp.id)}
                                >
                                  Enregistrer
                                </button>
                                <button
                                  className="btn-primary"
                                  style={{ backgroundColor: 'transparent', border: '1px solid #94a3b8', color: '#94a3b8', padding: '4px 12px' }}
                                  onClick={cancelEditingEmployee}
                                >
                                  Annuler
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  className="btn-primary"
                                  style={{ backgroundColor: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6', padding: '4px 12px' }}
                                  onClick={() => startEditingEmployee(emp)}
                                >
                                  Modifier
                                </button>
                                {emp.id !== user.id && (
                                  <button
                                    className="btn-primary"
                                    style={{ backgroundColor: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '4px 12px' }}
                                    onClick={async () => {
                                      if (window.confirm('Voulez-vous vraiment supprimer cet employé ?')) {
                                        try {
                                          await axios.delete(`http://localhost:8000/api/users/${emp.id}`, {
                                            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                                          });
                                          fetchEmployees();
                                        } catch (err) {
                                          alert('Erreur lors de la suppression');
                                        }
                                      }
                                    }}
                                  >
                                    Supprimer
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'report' && user?.role === 'employee' && (
          <div className="glass-panel" style={{ padding: '32px', flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <h2 style={{ marginTop: 0, marginBottom: '8px' }}>Interface des Rapports de Réparation</h2>


            {repairMessage && (
              <p style={{ marginTop: 0, marginBottom: '16px', color: '#f8fafc', backgroundColor: '#1e293b', padding: '12px 16px', borderRadius: '10px' }}>
                {repairMessage}
              </p>
            )}

            {defects.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>Aucun défaut actif ne vous est actuellement assigné.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                {defects.map(defect => {
                  const repairForm = repairForms[defect.id] || {};
                  return (
                    <div key={defect.id} style={{ backgroundColor: '#0b1121', border: '1px solid #1e293b', borderRadius: '14px', padding: '18px' }}>
                      <h3 style={{ marginTop: 0, marginBottom: '8px', textTransform: 'capitalize' }}>{translateDefect(defect.defect_class)}</h3>
                      <p style={{ marginTop: 0, color: '#94a3b8', fontSize: '14px' }}>
                        Position: {defect.lat.toFixed(6)}, {defect.lon.toFixed(6)}
                      </p>
                      {defect.image_path && (
                        <img
                          src={`http://localhost:8000/images/${defect.image_path}`}
                          alt={defect.defect_class}
                          style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '10px', marginBottom: '14px', cursor: 'pointer' }}
                          onClick={() => setZoomedImage(`http://localhost:8000/images/${defect.image_path}`)}
                          onError={e => e.target.style.display = 'none'}
                        />
                      )}
                      <textarea
                        placeholder="Décrivez rapidement la réparation effectuée..."
                        value={repairForm.reportText || ''}
                        onChange={e => updateRepairForm(defect.id, { reportText: e.target.value })}
                        style={{ width: '100%', minHeight: '100px', resize: 'vertical', marginBottom: '12px', padding: '12px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', boxSizing: 'border-box' }}
                      />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => handleRepairFileChange(defect.id, e)}
                        style={{ display: 'block', width: '100%', marginBottom: '12px', color: '#f8fafc' }}
                      />
                      <button
                        className="btn-primary"
                        style={{ backgroundColor: '#f59e0b' }}
                        onClick={() => submitRepairReport(defect.id)}
                      >
                        Envoyer le rapport à l'admin
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'fixed' && user?.role === 'admin' && (
          <div className="glass-panel" style={{ padding: '32px', flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <div>
                <h2 style={{ marginTop: 0, marginBottom: '8px' }}>Interface des Rapports Reçus</h2>

              </div>
              <button
                className="btn-primary"
                style={{ width: 'auto', padding: '10px 18px', backgroundColor: '#8b5cf6' }}
                onClick={() => {
                  fetchFixedDefects();
                  fetchUnseenReportCount();
                }}
              >
                Rafraîchir
              </button>
            </div>

            {fixedDefects.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>Aucun rapport de réparation n'a encore été reçu.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
                {fixedDefects.map(defect => (
                  <div key={defect.id} style={{ backgroundColor: '#0b1121', border: '1px solid #1e293b', borderRadius: '14px', padding: '18px' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '8px', textTransform: 'capitalize' }}>
                      {translateDefect(defect.defect_class)} réparé
                    </h3>
                    <p style={{ margin: '0 0 8px 0', color: '#f8fafc', fontSize: '14px', fontWeight: '600' }}>
                      Employé : {defect.repaired_by_username || `ID ${defect.repaired_by}`}
                    </p>
                    <p style={{ marginTop: 0, color: '#94a3b8', fontSize: '14px' }}>
                      Réparé le : {new Date(defect.repaired_at).toLocaleString()}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#cbd5e1' }}>Avant</p>
                        {defect.original_image_path ? (
                          <img
                            src={`http://localhost:8000/images/${defect.original_image_path}`}
                            alt="Avant réparation"
                            style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '10px', cursor: 'pointer' }}
                            onClick={() => setZoomedImage(`http://localhost:8000/images/${defect.original_image_path}`)}
                            onError={e => e.target.style.display = 'none'}
                          />
                        ) : (
                          <div style={{ height: '150px', borderRadius: '10px', backgroundColor: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                            Image indisponible
                          </div>
                        )}
                      </div>
                      <div>
                        <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#cbd5e1' }}>Après</p>
                        <img
                          src={`http://localhost:8000/images/${defect.repaired_image_path}`}
                          alt="Après réparation"
                          style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '10px', cursor: 'pointer' }}
                          onClick={() => setZoomedImage(`http://localhost:8000/images/${defect.repaired_image_path}`)}
                        />
                      </div>
                    </div>
                    <p style={{ margin: '0 0 6px 0', color: '#e2e8f0', fontSize: '14px' }}>
                      Position : lat : {defect.lat.toFixed(6)}, lon : {defect.lon.toFixed(6)}
                    </p>
                    <p style={{ margin: 0, color: '#cbd5e1', fontSize: '14px', lineHeight: '1.5' }}>
                     Commentaire : {defect.report_text || "Aucun commentaire fourni."}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && user && (
          <div className="glass-panel" style={{ padding: '40px', flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', boxSizing: 'border-box' }}>
            <h2 style={{ marginTop: 0, marginBottom: '8px', fontSize: '28px' }}>Paramètres</h2>


            {!showSettingsHistory && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '800px' }}>


                {/* --- Section: Admin Historique --- */}
                {user.role === 'admin' && (
                  <div>
                    <h3 className="settings-section-title">Administration des rapports</h3>
                    <div className="settings-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '15px' }}>Archive des réparations</div>
                        <div style={{ color: 'var(--text-subtle)', fontSize: '13px', marginTop: '4px' }}>Consulter tous les rapports historisés et validés.</div>
                      </div>
                      <button
                        className="btn-primary"
                        style={{ width: 'auto', padding: '10px 20px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)' }}
                        onClick={() => {
                          fetchFixedDefects();
                          setShowSettingsHistory(true);
                        }}
                      >
                        Voir l'historique
                      </button>
                    </div>
                  </div>
                )}

                {/* --- Section: Compte --- */}
                <div>
                  <h3 className="settings-section-title">Gestion du Compte</h3>
                  <div className="settings-card">
                    <div className="settings-item">
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '15px' }}>Utilisateur : <span className="text-gradient" style={{ fontSize: '16px' }}>{user.username}</span></div>
                        <div style={{ color: 'var(--text-subtle)', fontSize: '13px', marginTop: '4px' }}>Statut : {user.role === 'admin' ? 'Administrateur' : 'Employé Régional'}</div>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="btn-primary"
                        style={{ width: 'auto', padding: '10px 20px', backgroundColor: 'var(--danger)', border: 'none', boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)' }}
                      >
                        Se déconnecter
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {user.role === 'admin' && showSettingsHistory && (
              <div style={{ maxWidth: '800px', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border-light)' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '20px' }}>Historique des réparations</h3>
                    <div style={{ color: 'var(--text-subtle)', fontSize: '14px' }}>Archive complète des interventions.</div>
                  </div>
                  <button
                    className="btn-primary"
                    style={{ width: 'auto', padding: '8px 16px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)' }}
                    onClick={() => setShowSettingsHistory(false)}
                  >
                    ← Retour
                  </button>
                </div>

                {fixedDefects.length === 0 ? (
                  <p style={{ color: 'var(--text-subtle)', textAlign: 'center', padding: '40px 0' }}>Aucun élément dans l'historique pour le moment.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {fixedDefects.map(defect => (
                      <div key={`history-${defect.id}`} className="settings-card" style={{ marginBottom: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <h3 style={{ marginTop: 0, marginBottom: '6px', textTransform: 'capitalize', color: 'var(--primary-hover)', fontSize: '18px' }}>
                              Défaut : {translateDefect(defect.defect_class)}
                            </h3>
                            <p style={{ margin: '0 0 12px 0', color: 'var(--text-main)', fontSize: '14px', fontWeight: '500' }}>
                              Réparé par l'agent : {defect.repaired_by_username || `ID ${defect.repaired_by}`}
                            </p>
                            <p style={{ margin: '0 0 6px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                              <span style={{ color: 'var(--text-subtle)' }}>Archivé le :</span> {new Date(defect.repaired_at).toLocaleString()}
                            </p>
                            <p style={{ margin: '0 0 16px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                              <span style={{ color: 'var(--text-subtle)' }}>Coordonnées :</span> Lat {defect.lat.toFixed(6)}, Lon {defect.lon.toFixed(6)}
                            </p>
                          </div>
                          <div style={{ padding: '6px 12px', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', borderRadius: '20px', fontSize: '12px', fontWeight: '600', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                            Validé
                          </div>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                          <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '14px', lineHeight: '1.6', fontStyle: 'italic' }}>
                            "{defect.report_text || "Aucun commentaire supplémentaire fourni par l'agent lors de la réparation."}"
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Modal de Zoom */}
        {zoomedImage && (
          <div 
            style={{
              position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
              backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out'
            }}
            onClick={() => setZoomedImage(null)}
          >
            <img 
              src={zoomedImage} 
              style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '12px', boxShadow: '0 0 50px rgba(0,0,0,0.5)' }}
              alt="Zoom"
            />
            <button 
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'white', fontSize: '30px', cursor: 'pointer' }}
              onClick={() => setZoomedImage(null)}
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
