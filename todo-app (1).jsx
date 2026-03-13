import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "todo_app_v1";
const HISTORY_KEY = "todo_history_v1";

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getDefaultData() {
  return {
    lists: [
      { id: "default", name: "Günlük Görevler", color: "#6EE7B7" }
    ],
    activeListId: "default",
    items: {},
    lastReset: getTodayKey()
  };
}

function shouldReset(lastReset) {
  const today = new Date();
  const [y, m, d] = lastReset.split('-').map(Number);
  const last = new Date(y, m-1, d);
  const todayStr = getTodayKey();
  if (lastReset === todayStr) return false;
  const resetHour = 6;
  if (today.getHours() >= resetHour) return true;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
  return lastReset !== yKey && lastReset !== todayStr;
}

export default function TodoApp() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState({});
  const [view, setView] = useState("main"); // main | stats | addList | addItem
  const [newItemText, setNewItemText] = useState("");
  const [newListName, setNewListName] = useState("");
  const [newListColor, setNewListColor] = useState("#6EE7B7");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [statsView, setStatsView] = useState("monthly"); // monthly | yearly
  const [showListDropdown, setShowListDropdown] = useState(false);

  useEffect(() => {
    let d = loadData();
    const h = loadHistory();
    if (!d) d = getDefaultData();

    if (shouldReset(d.lastReset)) {
      // Archive today's stats before reset
      const todayKey = getTodayKey();
      const newHistory = { ...h };
      Object.keys(d.items).forEach(listId => {
        const items = d.items[listId] || [];
        if (items.length > 0) {
          if (!newHistory[listId]) newHistory[listId] = {};
          const completed = items.filter(i => i.done).length;
          newHistory[listId][todayKey] = { total: items.length, completed };
        }
      });
      // Reset all items
      const resetItems = {};
      Object.keys(d.items).forEach(listId => {
        resetItems[listId] = (d.items[listId] || []).map(item => ({ ...item, done: false }));
      });
      d = { ...d, items: resetItems, lastReset: todayKey };
      saveData(d);
      saveHistory(newHistory);
      setHistory(newHistory);
    } else {
      setHistory(h);
    }
    setData(d);
  }, []);

  const persist = useCallback((newData) => {
    setData(newData);
    saveData(newData);
  }, []);

  const activeList = data?.lists?.find(l => l.id === data.activeListId);
  const activeItems = data?.items?.[data?.activeListId] || [];

  function toggleItem(id) {
    const items = activeItems.map(i => i.id === id ? { ...i, done: !i.done } : i);
    persist({ ...data, items: { ...data.items, [data.activeListId]: items } });
  }

  function addItem() {
    if (!newItemText.trim()) return;
    const item = { id: Date.now().toString(), text: newItemText.trim(), done: false, count: 1 };
    const items = [...activeItems, item];
    persist({ ...data, items: { ...data.items, [data.activeListId]: items } });
    setNewItemText("");
    setView("main");
  }

  function deleteItem(id) {
    const items = activeItems.filter(i => i.id !== id);
    persist({ ...data, items: { ...data.items, [data.activeListId]: items } });
  }

  function changeCount(id, delta) {
    const items = activeItems.map(i => i.id === id ? { ...i, count: Math.max(1, (i.count || 1) + delta) } : i);
    persist({ ...data, items: { ...data.items, [data.activeListId]: items } });
  }

  function addList() {
    if (!newListName.trim()) return;
    const id = Date.now().toString();
    const list = { id, name: newListName.trim(), color: newListColor };
    const lists = [...data.lists, list];
    persist({ ...data, lists, items: { ...data.items, [id]: [] }, activeListId: id });
    setNewListName("");
    setNewListColor("#6EE7B7");
    setView("main");
  }

  function deleteList(id) {
    if (data.lists.length <= 1) return;
    const lists = data.lists.filter(l => l.id !== id);
    const items = { ...data.items };
    delete items[id];
    const activeListId = data.activeListId === id ? lists[0].id : data.activeListId;
    persist({ ...data, lists, items, activeListId });
  }

  function saveEdit(id) {
    if (!editText.trim()) return;
    const items = activeItems.map(i => i.id === id ? { ...i, text: editText.trim() } : i);
    persist({ ...data, items: { ...data.items, [data.activeListId]: items } });
    setEditingId(null);
  }

  // Stats calculation
  function getStatsData() {
    const allHistory = { ...history };
    // Add today's current data
    const todayKey = getTodayKey();
    if (data) {
      Object.keys(data.items).forEach(listId => {
        const items = data.items[listId] || [];
        if (items.length > 0) {
          if (!allHistory[listId]) allHistory[listId] = {};
          allHistory[listId][todayKey] = {
            total: items.length,
            completed: items.filter(i => i.done).length
          };
        }
      });
    }

    const now = new Date();
    const results = {};

    if (statsView === "monthly") {
      // Last 6 months
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const label = d.toLocaleString('tr-TR', { month: 'short', year: '2-digit' });
        let total = 0, completed = 0;
        Object.keys(allHistory).forEach(listId => {
          Object.keys(allHistory[listId] || {}).forEach(dateKey => {
            if (dateKey.startsWith(monthKey)) {
              total += allHistory[listId][dateKey].total || 0;
              completed += allHistory[listId][dateKey].completed || 0;
            }
          });
        });
        results[label] = { total, completed, pct: total > 0 ? Math.round((completed/total)*100) : 0 };
      }
    } else {
      // Last 3 years
      for (let i = 2; i >= 0; i--) {
        const year = now.getFullYear() - i;
        const label = String(year);
        let total = 0, completed = 0;
        Object.keys(allHistory).forEach(listId => {
          Object.keys(allHistory[listId] || {}).forEach(dateKey => {
            if (dateKey.startsWith(label)) {
              total += allHistory[listId][dateKey].total || 0;
              completed += allHistory[listId][dateKey].completed || 0;
            }
          });
        });
        results[label] = { total, completed, pct: total > 0 ? Math.round((completed/total)*100) : 0 };
      }
    }
    return results;
  }

  if (!data) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0f0f0f', color:'#fff', fontFamily:'monospace' }}>
      Yükleniyor...
    </div>
  );

  const completedCount = activeItems.filter(i => i.done).length;
  const totalCount = activeItems.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const statsData = view === "stats" ? getStatsData() : {};
  const statsEntries = Object.entries(statsData);
  const maxPct = Math.max(...statsEntries.map(([,v]) => v.pct), 1);

  const colors = ["#6EE7B7","#93C5FD","#FCA5A5","#FDE68A","#C4B5FD","#FB923C","#F9A8D4","#6EE7B7"];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #111827 50%, #0a0a0a 100%)',
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      color: '#f0f0f0',
      maxWidth: '430px',
      margin: '0 auto',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '48px 24px 24px',
        background: 'linear-gradient(180deg, rgba(110,231,183,0.08) 0%, transparent 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)'
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ fontSize:'11px', letterSpacing:'3px', color:'#6EE7B7', textTransform:'uppercase', marginBottom:'6px', fontWeight:600 }}>
              GÖREV TAKİPÇİSİ
            </div>
            <div style={{ fontSize:'28px', fontWeight:700, lineHeight:1.2 }}>
              {new Date().toLocaleDateString('tr-TR', { weekday:'long' })},
            </div>
            <div style={{ fontSize:'16px', color:'rgba(255,255,255,0.4)', marginTop:'2px' }}>
              {new Date().toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' })}
            </div>
          </div>
          <button
            onClick={() => setView(view === "stats" ? "main" : "stats")}
            style={{
              background: view === "stats" ? '#6EE7B7' : 'rgba(110,231,183,0.1)',
              border: '1px solid rgba(110,231,183,0.3)',
              color: view === "stats" ? '#0a0a0a' : '#6EE7B7',
              borderRadius: '12px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '1px'
            }}
          >
            📊 DURUM
          </button>
        </div>

        {/* Progress bar */}
        {view === "main" && (
          <div style={{ marginTop:'20px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'8px' }}>
              <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.5)' }}>Bugünkü İlerleme</span>
              <span style={{ fontSize:'12px', fontWeight:700, color:'#6EE7B7' }}>{completedCount}/{totalCount} · %{pct}</span>
            </div>
            <div style={{ height:'6px', background:'rgba(255,255,255,0.08)', borderRadius:'3px', overflow:'hidden' }}>
              <div style={{
                height:'100%',
                width:`${pct}%`,
                background:'linear-gradient(90deg, #6EE7B7, #93C5FD)',
                borderRadius:'3px',
                transition:'width 0.5s ease'
              }} />
            </div>
          </div>
        )}
      </div>

      {/* STATS VIEW */}
      {view === "stats" && (
        <div style={{ padding:'24px' }}>
          <div style={{ display:'flex', gap:'8px', marginBottom:'24px' }}>
            {["monthly","yearly"].map(v => (
              <button key={v} onClick={() => setStatsView(v)} style={{
                flex:1, padding:'10px', borderRadius:'10px', cursor:'pointer', fontSize:'13px', fontWeight:600,
                background: statsView===v ? '#6EE7B7' : 'rgba(255,255,255,0.06)',
                color: statsView===v ? '#0a0a0a' : 'rgba(255,255,255,0.6)',
                border: '1px solid ' + (statsView===v ? '#6EE7B7' : 'rgba(255,255,255,0.1)')
              }}>
                {v === "monthly" ? "📅 Aylık" : "📆 Yıllık"}
              </button>
            ))}
          </div>

          {/* Today summary */}
          <div style={{
            background:'rgba(110,231,183,0.08)', border:'1px solid rgba(110,231,183,0.2)',
            borderRadius:'16px', padding:'20px', marginBottom:'20px'
          }}>
            <div style={{ fontSize:'11px', letterSpacing:'2px', color:'#6EE7B7', marginBottom:'12px' }}>BUGÜN</div>
            <div style={{ display:'flex', gap:'16px' }}>
              <div style={{ flex:1, textAlign:'center' }}>
                <div style={{ fontSize:'32px', fontWeight:800, color:'#6EE7B7' }}>{pct}%</div>
                <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)' }}>Tamamlama</div>
              </div>
              <div style={{ flex:1, textAlign:'center' }}>
                <div style={{ fontSize:'32px', fontWeight:800 }}>{completedCount}</div>
                <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)' }}>Tamamlanan</div>
              </div>
              <div style={{ flex:1, textAlign:'center' }}>
                <div style={{ fontSize:'32px', fontWeight:800 }}>{totalCount}</div>
                <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)' }}>Toplam</div>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'16px', padding:'20px' }}>
            <div style={{ fontSize:'11px', letterSpacing:'2px', color:'rgba(255,255,255,0.4)', marginBottom:'16px' }}>
              {statsView === "monthly" ? "SON 6 AY" : "SON 3 YIL"}
            </div>
            <div style={{ display:'flex', gap:'8px', alignItems:'flex-end', height:'120px', marginBottom:'8px' }}>
              {statsEntries.map(([label, val], i) => (
                <div key={label} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', height:'100%', justifyContent:'flex-end' }}>
                  <div style={{ fontSize:'10px', fontWeight:700, color:'#6EE7B7' }}>{val.pct > 0 ? `%${val.pct}` : ''}</div>
                  <div style={{
                    width:'100%', borderRadius:'6px 6px 0 0',
                    height:`${Math.max((val.pct/100)*90, val.total > 0 ? 4 : 0)}px`,
                    background:`linear-gradient(180deg, #6EE7B7, #059669)`,
                    transition:'height 0.5s ease',
                    opacity: val.total > 0 ? 1 : 0.2
                  }} />
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              {statsEntries.map(([label]) => (
                <div key={label} style={{ flex:1, textAlign:'center', fontSize:'9px', color:'rgba(255,255,255,0.3)' }}>{label}</div>
              ))}
            </div>
          </div>

          {/* Detail table */}
          <div style={{ marginTop:'16px', display:'flex', flexDirection:'column', gap:'8px' }}>
            {statsEntries.map(([label, val]) => (
              <div key={label} style={{
                display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'12px 16px', background:'rgba(255,255,255,0.03)',
                borderRadius:'10px', border:'1px solid rgba(255,255,255,0.06)'
              }}>
                <span style={{ fontSize:'13px', fontWeight:600 }}>{label}</span>
                <div style={{ display:'flex', gap:'16px', fontSize:'12px' }}>
                  <span style={{ color:'rgba(255,255,255,0.4)' }}>{val.completed}/{val.total} görev</span>
                  <span style={{ color:'#6EE7B7', fontWeight:700 }}>%{val.pct}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MAIN VIEW */}
      {view === "main" && (
        <div style={{ padding:'0 0 100px' }}>
          {/* List selector */}
          <div style={{ padding:'16px 24px', borderBottom:'1px solid rgba(255,255,255,0.06)', position:'relative' }}>
            <button
              onClick={() => setShowListDropdown(!showListDropdown)}
              style={{
                display:'flex', alignItems:'center', gap:'10px', width:'100%',
                background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
                borderRadius:'12px', padding:'12px 16px', cursor:'pointer', color:'#f0f0f0',
                justifyContent:'space-between'
              }}
            >
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <div style={{ width:'10px', height:'10px', borderRadius:'50%', background: activeList?.color || '#6EE7B7' }} />
                <span style={{ fontWeight:600, fontSize:'15px' }}>{activeList?.name || 'Liste'}</span>
              </div>
              <span style={{ color:'rgba(255,255,255,0.3)', fontSize:'12px' }}>{showListDropdown ? '▲' : '▼'}</span>
            </button>

            {showListDropdown && (
              <div style={{
                position:'absolute', top:'calc(100% - 4px)', left:'24px', right:'24px', zIndex:100,
                background:'#1a1a2e', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'12px',
                overflow:'hidden', boxShadow:'0 20px 40px rgba(0,0,0,0.5)'
              }}>
                {data.lists.map(list => (
                  <div key={list.id} style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'12px 16px', cursor:'pointer',
                    background: list.id === data.activeListId ? 'rgba(110,231,183,0.1)' : 'transparent',
                    borderBottom:'1px solid rgba(255,255,255,0.05)'
                  }}
                    onClick={() => { persist({ ...data, activeListId: list.id }); setShowListDropdown(false); }}
                  >
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <div style={{ width:'10px', height:'10px', borderRadius:'50%', background: list.color }} />
                      <span style={{ fontSize:'14px', fontWeight: list.id === data.activeListId ? 700 : 400 }}>{list.name}</span>
                      <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.3)' }}>
                        {(data.items[list.id]||[]).length} madde
                      </span>
                    </div>
                    {data.lists.length > 1 && (
                      <button onClick={(e) => { e.stopPropagation(); deleteList(list.id); }} style={{
                        background:'transparent', border:'none', color:'rgba(255,100,100,0.5)', cursor:'pointer', fontSize:'16px', padding:'0 4px'
                      }}>×</button>
                    )}
                  </div>
                ))}
                <div
                  onClick={() => { setShowListDropdown(false); setView("addList"); }}
                  style={{ padding:'12px 16px', cursor:'pointer', color:'#6EE7B7', fontSize:'13px', fontWeight:600, display:'flex', alignItems:'center', gap:'8px' }}
                >
                  <span>＋</span> Yeni Liste Oluştur
                </div>
              </div>
            )}
          </div>

          {/* Items */}
          <div style={{ padding:'16px 24px', display:'flex', flexDirection:'column', gap:'10px' }}>
            {activeItems.length === 0 && (
              <div style={{ textAlign:'center', padding:'48px 0', color:'rgba(255,255,255,0.2)' }}>
                <div style={{ fontSize:'48px', marginBottom:'12px' }}>✓</div>
                <div style={{ fontSize:'14px' }}>Henüz görev yok</div>
                <div style={{ fontSize:'12px', marginTop:'4px' }}>Aşağıdaki + butonuna basarak ekle</div>
              </div>
            )}

            {activeItems.map(item => (
              <div key={item.id} style={{
                display:'flex', alignItems:'center', gap:'12px',
                padding:'14px 16px',
                background: item.done ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                border: '1px solid ' + (item.done ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)'),
                borderRadius:'14px',
                opacity: item.done ? 0.45 : 1,
                transition:'all 0.3s ease'
              }}>
                {/* Checkbox */}
                <button onClick={() => toggleItem(item.id)} style={{
                  width:'24px', height:'24px', borderRadius:'50%', flexShrink:0,
                  background: item.done ? '#6EE7B7' : 'transparent',
                  border: '2px solid ' + (item.done ? '#6EE7B7' : 'rgba(255,255,255,0.2)'),
                  cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                  color:'#0a0a0a', fontSize:'13px', fontWeight:800, transition:'all 0.2s'
                }}>
                  {item.done ? '✓' : ''}
                </button>

                {/* Text */}
                <div style={{ flex:1 }}>
                  {editingId === item.id ? (
                    <input
                      autoFocus
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      onBlur={() => saveEdit(item.id)}
                      onKeyDown={e => { if(e.key==='Enter') saveEdit(item.id); if(e.key==='Escape') setEditingId(null); }}
                      style={{
                        background:'transparent', border:'none', outline:'1px solid #6EE7B7',
                        color:'#f0f0f0', fontSize:'14px', width:'100%', borderRadius:'4px', padding:'2px 6px'
                      }}
                    />
                  ) : (
                    <span
                      onDoubleClick={() => { setEditingId(item.id); setEditText(item.text); }}
                      style={{
                        fontSize:'14px', fontWeight:500,
                        textDecoration: item.done ? 'line-through' : 'none',
                        color: item.done ? 'rgba(255,255,255,0.3)' : '#f0f0f0',
                        cursor:'text'
                      }}
                    >
                      {item.text}
                    </span>
                  )}
                </div>

                {/* Delete */}
                <button onClick={() => deleteItem(item.id)} style={{
                  background:'transparent', border:'none', color:'rgba(255,80,80,0.3)', cursor:'pointer',
                  fontSize:'18px', padding:'0 2px', lineHeight:1
                }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADD ITEM VIEW */}
      {view === "addItem" && (
        <div style={{ padding:'32px 24px' }}>
          <div style={{ fontSize:'20px', fontWeight:700, marginBottom:'24px' }}>Yeni Görev Ekle</div>
          <div style={{ fontSize:'12px', color:'rgba(255,255,255,0.4)', marginBottom:'8px', letterSpacing:'1px' }}>GÖREV ADI</div>
          <input
            autoFocus
            value={newItemText}
            onChange={e => setNewItemText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
            placeholder="Görevi buraya yaz..."
            style={{
              width:'100%', padding:'14px 16px', background:'rgba(255,255,255,0.06)',
              border:'1px solid rgba(255,255,255,0.12)', borderRadius:'12px',
              color:'#f0f0f0', fontSize:'15px', outline:'none', boxSizing:'border-box',
              marginBottom:'24px'
            }}
          />
          <div style={{ display:'flex', gap:'10px' }}>
            <button onClick={() => setView("main")} style={{
              flex:1, padding:'14px', borderRadius:'12px', border:'1px solid rgba(255,255,255,0.1)',
              background:'transparent', color:'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:'14px'
            }}>İptal</button>
            <button onClick={addItem} style={{
              flex:2, padding:'14px', borderRadius:'12px', border:'none',
              background:'linear-gradient(135deg, #6EE7B7, #059669)', color:'#0a0a0a',
              cursor:'pointer', fontSize:'14px', fontWeight:700
            }}>Ekle</button>
          </div>
        </div>
      )}

      {/* ADD LIST VIEW */}
      {view === "addList" && (
        <div style={{ padding:'32px 24px' }}>
          <div style={{ fontSize:'20px', fontWeight:700, marginBottom:'24px' }}>Yeni Liste Oluştur</div>
          <div style={{ fontSize:'12px', color:'rgba(255,255,255,0.4)', marginBottom:'8px', letterSpacing:'1px' }}>LİSTE ADI</div>
          <input
            autoFocus
            value={newListName}
            onChange={e => setNewListName(e.target.value)}
            placeholder="Liste adı..."
            style={{
              width:'100%', padding:'14px 16px', background:'rgba(255,255,255,0.06)',
              border:'1px solid rgba(255,255,255,0.12)', borderRadius:'12px',
              color:'#f0f0f0', fontSize:'15px', outline:'none', boxSizing:'border-box',
              marginBottom:'20px'
            }}
          />
          <div style={{ fontSize:'12px', color:'rgba(255,255,255,0.4)', marginBottom:'12px', letterSpacing:'1px' }}>RENK SEÇ</div>
          <div style={{ display:'flex', gap:'10px', marginBottom:'24px', flexWrap:'wrap' }}>
            {colors.map(c => (
              <button key={c} onClick={() => setNewListColor(c)} style={{
                width:'32px', height:'32px', borderRadius:'50%', background:c, border:'none',
                cursor:'pointer', outline: newListColor === c ? `3px solid white` : 'none',
                outlineOffset:'2px'
              }} />
            ))}
          </div>
          <div style={{ display:'flex', gap:'10px' }}>
            <button onClick={() => setView("main")} style={{
              flex:1, padding:'14px', borderRadius:'12px', border:'1px solid rgba(255,255,255,0.1)',
              background:'transparent', color:'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:'14px'
            }}>İptal</button>
            <button onClick={addList} style={{
              flex:2, padding:'14px', borderRadius:'12px', border:'none',
              background:`linear-gradient(135deg, ${newListColor}, ${newListColor}99)`, color:'#0a0a0a',
              cursor:'pointer', fontSize:'14px', fontWeight:700
            }}>Oluştur</button>
          </div>
        </div>
      )}

      {/* FAB */}
      {view === "main" && (
        <button
          onClick={() => setView("addItem")}
          style={{
            position:'fixed', bottom:'32px', right:'50%', transform:'translateX(50%)',
            width:'56px', height:'56px', borderRadius:'50%', border:'none',
            background:'linear-gradient(135deg, #6EE7B7, #059669)',
            color:'#0a0a0a', fontSize:'28px', fontWeight:300, cursor:'pointer',
            boxShadow:'0 8px 32px rgba(110,231,183,0.4)',
            display:'flex', alignItems:'center', justifyContent:'center',
            transition:'transform 0.2s',
            zIndex:50
          }}
        >
          +
        </button>
      )}

      {/* Daily reset notice */}
      <div style={{
        position:'fixed', bottom:'0', left:'50%', transform:'translateX(-50%)',
        fontSize:'10px', color:'rgba(255,255,255,0.12)', padding:'8px', letterSpacing:'1px',
        width:'100%', textAlign:'center', background:'transparent'
      }}>
        Her gün 06:00'da sıfırlanır
      </div>
    </div>
  );
}
