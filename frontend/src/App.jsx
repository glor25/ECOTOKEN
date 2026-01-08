import React, { useState, useEffect } from 'react';
import { Recycle, Leaf, Globe, Phone, Droplets, Gift, TreePine, TrendingUp, TrendingDown, LogIn, Lock, Mail, ArrowRight, Pickaxe, RefreshCw, Box, Layers, Hash, Clock, User, Code, UserPlus, X } from 'lucide-react';

// URL Backend
const BLOCKCHAIN_API = 'http://localhost:3001'; 
const DB_API = 'http://localhost:5000';

export default function App() {
  // --- AUTH & USER STATE (DATABASE) ---
  const [user, setUser] = useState(null); 
  const [isLoginView, setIsLoginView] = useState(true);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  // --- DASHBOARD STATE ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [wasteWeight, setWasteWeight] = useState('');
  const [wasteRate, setWasteRate] = useState(10); 
  const [calculatedEco, setCalculatedEco] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showConnectionAlert, setShowConnectionAlert] = useState(true);

  // --- BLOCKCHAIN STATE ---
  const [blockchainData, setBlockchainData] = useState(null);
  const [pendingTx, setPendingTx] = useState([]);

  const userPendingTx = (pendingTx || []).filter(tx => 
    tx && tx.sender !== "00" && user && (tx.recipient === user.email)
  );

  useEffect(() => {
    let interval = null;
    if (user) {
      fetchBlockchainData();
      refreshUserData();
      // Simpan ID interval agar bisa dibersihkan
      interval = setInterval(() => {
        fetchBlockchainData();
      }, 5000);
    }
    // CLEANUP FUNCTION: Wajib ada untuk mematikan interval saat Logout
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [user]);

  // --- LOGIKA DATABASE ---

  const refreshUserData = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${DB_API}/user/${user._id}`);
      const data = await res.json();
      if (res.ok) setUser(data); 
    } catch (err) {
      console.error("Gagal refresh user data");
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    const endpoint = isLoginView ? '/login' : '/register';
    try {
      const res = await fetch(`${DB_API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput, password: passwordInput })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setUser(data.user);
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert("Gagal koneksi ke Database API (Port 5000).");
    }
  };

  // FUNGSI LOGOUT (VERSI FIX)
  const handleLogout = (e) => {
    // Mencegah perilaku default browser
    if (e) e.preventDefault();
    
    // 1. Matikan Loading & Alert
    setIsLoading(false);
    setShowConnectionAlert(false);

    // 2. Reset Input Form
    setEmailInput('');
    setPasswordInput('');
    setWasteWeight('');
    setCalculatedEco(0);
    
    // 3. Reset Tab & View
    setActiveTab('dashboard');
    setIsLoginView(true);

    // 4. Bersihkan Data Blockchain dari Memori
    setBlockchainData(null);
    setPendingTx([]);

    // 5. Terakhir: Hapus User (Ini akan memicu render Login Screen)
    setUser(null);
  };

  const handleRedeem = async (itemName, cost) => {
    if (user.balance < cost) {
      alert("Saldo tidak cukup!");
      return;
    }
    const confirm = window.confirm(`Tukar ${cost} ECO untuk ${itemName}?`);
    if (!confirm) return;

    try {
      const res = await fetch(`${DB_API}/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user._id, itemName, cost })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        refreshUserData();
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert("Gagal redeem.");
    }
  };

  // --- LOGIKA BLOCKCHAIN ---

  const fetchBlockchainData = async () => {
    try {
      const response = await fetch(`${BLOCKCHAIN_API}/blockchain`);
      const data = await response.json();
      
      // SAFE SET: Pastikan data tidak null/undefined sebelum di-set
      setBlockchainData(data);
      setPendingTx(data.pendingTransactions || []); // Default ke array kosong jika undefined
      
      setShowConnectionAlert(false);
    } catch (error) {
      // Jangan set alert jika user sudah logout (mencegah glitch visual)
      if (user) setShowConnectionAlert(true);
    }
  };

  const handleDeposit = async () => {
    if (!wasteWeight || parseFloat(wasteWeight) <= 0) return;
    setIsLoading(true);
    
    try {
      const payload = {
        amount: calculatedEco,
        sender: "SYSTEM-REWARD", 
        recipient: user.email 
      };
      
      await fetch(`${BLOCKCHAIN_API}/transaction/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      alert(`Transaksi Masuk Pending! Saldo akan bertambah SETELAH Anda menekan tombol 'Mine Block'.`);
      setWasteWeight('');
      setCalculatedEco(0);
      fetchBlockchainData(); 

    } catch (error) {
      alert("Deposit Gagal. Pastikan server 3001 berjalan.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMine = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${BLOCKCHAIN_API}/mine`);
      const data = await res.json();
      const newBlock = data.block;

      // Safe filter untuk transaksi saya
      const myTransactions = (newBlock.transactions || []).filter(tx => tx && tx.recipient === user.email);
      const totalEarned = myTransactions.reduce((acc, curr) => acc + (curr.amount || 0), 0);

      if (totalEarned > 0) {
        await fetch(`${DB_API}/update-balance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user._id, amount: totalEarned })
        });
        alert(`Mining Sukses! ${totalEarned} ECO telah ditambahkan ke saldo Anda.`);
      } else {
        alert("Mining Sukses! Blok baru telah ditambahkan.");
      }

      fetchBlockchainData();
      refreshUserData();

    } catch (error) {
      console.error(error);
      alert("Gagal mining. Cek koneksi backend.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleWeightChange = (e) => {
    const weight = e.target.value;
    setWasteWeight(weight);
    setCalculatedEco(weight ? parseFloat(weight) * wasteRate : 0);
  };

  const handleRateChange = (e) => {
    const newRate = parseInt(e.target.value);
    setWasteRate(newRate);
    setCalculatedEco(wasteWeight ? parseFloat(wasteWeight) * newRate : 0);
  };

  // --- LOGIN SCREEN ---
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-emerald-500 p-8 text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
                    <Recycle className="w-8 h-8 text-emerald-500" />
                </div>
                <h1 className="text-3xl font-bold text-white">EcoToken</h1>
                <p className="text-emerald-100 mt-2">Recycle. Earn. Save the Planet.</p>
            </div>
            <div className="p-8">
                <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                    {isLoginView ? <LogIn className="w-5 h-5 text-emerald-500" /> : <UserPlus className="w-5 h-5 text-emerald-500" />}
                    {isLoginView ? 'Login Dashboard' : 'Daftar Akun Baru'}
                </h2>
                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                            <input 
                              type="email" 
                              required 
                              className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" 
                              placeholder="user@ecotoken.com" 
                              value={emailInput}
                              onChange={(e) => setEmailInput(e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                            <input 
                              type="password" 
                              required 
                              className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" 
                              placeholder="••••••••" 
                              value={passwordInput}
                              onChange={(e) => setPasswordInput(e.target.value)}
                            />
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-lg flex justify-center items-center gap-2 transition-colors">
                        {isLoginView ? 'Masuk' : 'Daftar Sekarang'} <ArrowRight className="w-4 h-4" />
                    </button>
                </form>
                <div className="mt-4 text-center">
                  <button onClick={() => setIsLoginView(!isLoginView)} className="text-sm text-emerald-600 font-semibold hover:underline">
                    {isLoginView ? "Belum punya akun? Daftar disini" : "Sudah punya akun? Login disini"}
                  </button>
                </div>
            </div>
        </div>
      </div>
    );
  }

  // --- MAIN DASHBOARD ---
  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className="bg-emerald-600 text-white p-4 shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
              <Recycle className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">EcoToken Dashboard</h1>
              <p className="text-xs text-emerald-100 flex items-center gap-1">
                <Globe className="w-3 h-3" /> Node: 3001 (Active) | User: {user.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-emerald-700 p-1 rounded-lg flex text-sm">
                <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-md transition-all ${activeTab === 'dashboard' ? 'bg-white text-emerald-700 font-bold shadow' : 'text-emerald-100 hover:bg-emerald-600'}`}>Dashboard</button>
                <button onClick={() => setActiveTab('explorer')} className={`px-4 py-2 rounded-md transition-all ${activeTab === 'explorer' ? 'bg-white text-emerald-700 font-bold shadow' : 'text-emerald-100 hover:bg-emerald-600'}`}>Transaction History</button>
            </div>
            <button onClick={handleMine} disabled={isLoading} className={`${userPendingTx.length > 0 ? 'bg-yellow-500 animate-pulse' : 'bg-yellow-400'} hover:bg-yellow-600 text-yellow-900 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow transition-all transform active:scale-95`}>
                <Pickaxe className={`w-4 h-4 ${isLoading ? 'animate-bounce' : ''}`} />
                {isLoading ? 'Mining...' : `Mine Block ${userPendingTx.length > 0 ? `(${userPendingTx.length})` : ''}`}
            </button>
            {/* BUTTON LOGOUT DIPERBAIKI: type='button' penting agar tidak submit form */}
            <button type="button" onClick={handleLogout} className="bg-emerald-800 hover:bg-emerald-900 text-white px-3 py-2 rounded-lg text-xs font-semibold">Logout</button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {(!blockchainData || showConnectionAlert) && (
             <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm flex items-center justify-between animate-fade-in">
                <div>
                    <strong className="font-bold">Koneksi Backend Terputus! </strong>
                    <span className="block sm:inline text-sm">Pastikan `npm run node_1` berjalan.</span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={fetchBlockchainData} className="text-red-700 underline text-sm hover:text-red-900">Coba Lagi</button>
                    <button onClick={() => setShowConnectionAlert(false)} className="bg-red-100 p-1 rounded hover:bg-red-200"><X className="w-4 h-4"/></button>
                </div>
            </div>
        )}

        {/* --- VIEW: DASHBOARD --- */}
        {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-emerald-100 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                            <div><p className="text-sm text-gray-500">My Pending</p><h3 className="text-2xl font-bold text-emerald-600">{userPendingTx.length}</h3></div>
                            <div className="p-2 bg-emerald-100 rounded-lg"><Layers className="w-5 h-5 text-emerald-600"/></div>
                        </div>
                        <p className="text-xs text-gray-400">Your deposits waiting to be mined</p>
                    </div>
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-orange-100 hover:shadow-md transition-shadow">
                         <div className="flex justify-between items-start mb-2">
                            <div><p className="text-sm text-gray-500">Total Blocks</p><h3 className="text-2xl font-bold text-orange-500">{blockchainData?.chain?.length || 0}</h3></div>
                            <div className="p-2 bg-orange-100 rounded-lg"><Box className="w-5 h-5 text-orange-600"/></div>
                        </div>
                        <p className="text-xs text-gray-400">Height of the chain</p>
                    </div>
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-blue-100 hover:shadow-md transition-shadow">
                         <div className="flex justify-between items-start mb-2">
                            <div><p className="text-sm text-gray-500">My Balance</p><h3 className="text-2xl font-bold text-blue-600">{user.balance} ECO</h3></div>
                            <div className="p-2 bg-blue-100 rounded-lg"><Gift className="w-5 h-5 text-blue-600"/></div>
                        </div>
                        <p className="text-xs text-gray-400">Stored securely in DB</p>
                    </div>
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-green-100 hover:shadow-md transition-shadow">
                         <div className="flex justify-between items-start mb-2">
                            <div><p className="text-sm text-gray-500">Market Price</p><h3 className="text-2xl font-bold text-green-600">Rp 200</h3></div>
                            <div className="p-2 bg-green-100 rounded-lg"><TrendingUp className="w-5 h-5 text-green-600"/></div>
                        </div>
                        <p className="text-xs text-gray-400">Per 1 ECO Token</p>
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-800">
                            <Recycle className="w-5 h-5 text-emerald-500" /> Deposit Waste & Earn
                        </h2>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Waste Type</label>
                                    <select className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" value={wasteRate} onChange={handleRateChange}>
                                        <option value="10">Plastic Bottles (10 ECO/kg)</option>
                                        <option value="5">Paper / Cardboard (5 ECO/kg)</option>
                                        <option value="8">Metal Cans (8 ECO/kg)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Weight (kg)</label>
                                    <div className="relative">
                                        <input type="number" value={wasteWeight} onChange={handleWeightChange} placeholder="0.0" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                                        <span className="absolute right-4 top-3 text-gray-400 text-sm">kg</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col justify-between bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                <div>
                                    <p className="text-sm text-emerald-800 font-medium">Estimated Reward</p>
                                    <p className="text-3xl font-bold text-emerald-600 mt-1">{calculatedEco} <span className="text-sm">ECO</span></p>
                                    <p className="text-xs text-emerald-600 mt-2">1 ECO = Rp 200</p>
                                </div>
                                <button onClick={handleDeposit} disabled={isLoading || !calculatedEco} className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                    {isLoading ? 'Broadcasting...' : 'Confirm Deposit'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                         <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800">
                                <Layers className="w-4 h-4 text-orange-500" /> Pending Queue
                            </h2>
                            <span className="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full font-bold">{userPendingTx.length}</span>
                        </div>
                        <div className="space-y-3 h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {userPendingTx.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 text-sm">No pending transactions for you.<br/>Start depositing waste!</div>
                            ) : (
                                userPendingTx.map((tx, idx) => (
                                    <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm">
                                        <div className="flex justify-between mb-1">
                                            <span className="font-bold text-emerald-600">+{tx.amount} ECO</span>
                                            <span className="text-xs text-gray-400">Deposit Reward</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-500">
                                            <span>To: {tx.recipient.substring(0,6)}...</span>
                                            <span className="text-xs text-gray-400">Pending</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                            <button onClick={handleMine} className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center justify-center gap-1 mx-auto">
                                <Pickaxe className="w-3 h-3"/> Mine these transactions to confirm
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800"><Gift className="w-5 h-5 text-purple-500" /> Redeem Rewards</h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div onClick={() => handleRedeem("Phone Credit", 50)} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all cursor-pointer group">
                            <div className="flex items-center gap-3"><div className="bg-blue-100 p-2 rounded-lg group-hover:bg-white transition-colors"><Phone className="w-5 h-5 text-blue-600" /></div><div><p className="font-medium group-hover:text-emerald-700">Phone Credit</p><p className="text-xs text-gray-500">Rp 10k</p></div></div>
                            <span className="text-emerald-600 font-bold bg-emerald-100 px-2 py-1 rounded text-xs">50 ECO</span>
                        </div>
                        <div onClick={() => handleRedeem("Cooking Oil", 200)} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all cursor-pointer group">
                            <div className="flex items-center gap-3"><div className="bg-orange-100 p-2 rounded-lg group-hover:bg-white transition-colors"><Droplets className="w-5 h-5 text-orange-600" /></div><div><p className="font-medium group-hover:text-emerald-700">Cooking Oil</p><p className="text-xs text-gray-500">1 Liter</p></div></div>
                            <span className="text-emerald-600 font-bold bg-emerald-100 px-2 py-1 rounded text-xs">200 ECO</span>
                        </div>
                        <div onClick={() => handleRedeem("Voucher Indomaret", 125)} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all cursor-pointer group">
                             <div className="flex items-center gap-3"><div className="bg-purple-100 p-2 rounded-lg group-hover:bg-white transition-colors"><Gift className="w-5 h-5 text-purple-600" /></div><div><p className="font-medium group-hover:text-emerald-700">Voucher</p><p className="text-xs text-gray-500">Indomaret 25k</p></div></div>
                            <span className="text-emerald-600 font-bold bg-emerald-100 px-2 py-1 rounded text-xs">125 ECO</span>
                        </div>
                        <div onClick={() => handleRedeem("Plant Tree", 500)} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all cursor-pointer group">
                             <div className="flex items-center gap-3"><div className="bg-green-100 p-2 rounded-lg group-hover:bg-white transition-colors"><TreePine className="w-5 h-5 text-green-600" /></div><div><p className="font-medium group-hover:text-emerald-700">Plant Tree</p><p className="text-xs text-gray-500">Donation</p></div></div>
                            <span className="text-emerald-600 font-bold bg-emerald-100 px-2 py-1 rounded text-xs">500 ECO</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800"><Globe className="w-5 h-5 text-yellow-500" /> Corporate Partners</h2>
                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg text-center hover:shadow-md transition-shadow"><h3 className="font-bold text-blue-900 mb-1">Unilever Indonesia</h3><p className="text-sm text-blue-700">Plastic Recycling CSR</p></div>
                        <div className="bg-green-50 p-4 rounded-lg text-center hover:shadow-md transition-shadow"><h3 className="font-bold text-green-900 mb-1">Danone Aqua</h3><p className="text-sm text-green-700">Bottle Collection Partner</p></div>
                        <div className="bg-purple-50 p-4 rounded-lg text-center hover:shadow-md transition-shadow"><h3 className="font-bold text-purple-900 mb-1">Indomaret</h3><p className="text-sm text-purple-700">Official Redemption Point</p></div>
                    </div>
                </div>

                <div className="bg-gray-900 rounded-xl shadow-lg border border-gray-700 overflow-hidden">
                    <div className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
                         <h3 className="font-mono font-bold text-green-400 flex items-center gap-2 text-sm"><Code className="w-4 h-4"/> Live Blockchain Data Node</h3>
                        <div className="flex gap-2"><span className="w-3 h-3 bg-red-500 rounded-full"></span><span className="w-3 h-3 bg-yellow-500 rounded-full"></span><span className="w-3 h-3 bg-green-500 rounded-full"></span></div>
                    </div>
                    <div className="p-4 font-mono text-xs text-green-400 h-64 overflow-y-auto custom-scrollbar">
                        {blockchainData ? <pre>{JSON.stringify(blockchainData, null, 2)}</pre> : <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2"><RefreshCw className="w-6 h-6 animate-spin"/><p>Connecting to decentralized node...</p></div>}
                    </div>
                </div>
            </div>
        )}

        {/* --- VIEW: BLOCK EXPLORER --- */}
        {activeTab === 'explorer' && (
             <div className="space-y-6 animate-fade-in">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                    <div><h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Globe className="w-6 h-6 text-blue-500"/> Transaction History</h2><p className="text-gray-500 text-sm mt-1">Real-time ledger of your personal EcoToken transactions.</p></div>
                    <button onClick={fetchBlockchainData} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"><RefreshCw className="w-5 h-5 text-gray-600"/></button>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b border-gray-100 bg-gray-50"><h3 className="font-bold text-gray-700 flex items-center gap-2"><Box className="w-4 h-4 text-emerald-600"/> Latest Blocks</h3></div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 font-medium">
                                <tr>
                                    <th className="px-6 py-3">Block Height</th><th className="px-6 py-3">Hash</th><th className="px-6 py-3">Timestamp</th><th className="px-6 py-3">Transactions</th><th className="px-6 py-3">Nonce</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {(blockchainData?.chain || []).slice().reverse().map((block) => (
                                    <tr key={block.index} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-blue-600">#{block.index}</td>
                                        <td className="px-6 py-4 font-mono text-xs text-gray-500">{block.hash === '0' ? '0 (Genesis)' : block.hash.substring(0, 20) + '...'}</td>
                                        <td className="px-6 py-4 text-gray-600"><div className="flex items-center gap-2"><Clock className="w-3 h-3 text-gray-400"/>{new Date(block.timestamp).toLocaleString()}</div></td>
                                        <td className="px-6 py-4"><span className="bg-blue-100 text-blue-700 py-1 px-2 rounded text-xs font-bold">{(block.transactions || []).length} Txs</span></td>
                                        <td className="px-6 py-4 text-gray-500">{block.nonce}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b border-gray-100 bg-gray-50"><h3 className="font-bold text-gray-700 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-600"/> My Latest Confirmed Transactions</h3></div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 font-medium">
                                <tr>
                                    <th className="px-6 py-3">Tx ID</th><th className="px-6 py-3">From</th><th className="px-6 py-3">To</th><th className="px-6 py-3 text-right">Amount (ECO)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {(blockchainData?.chain || []).slice().reverse().flatMap(block => 
                                    (block.transactions || [])
                                    // FILTER UTAMA: Hanya tampilkan jika user adalah PENGIRIM atau PENERIMA
                                    .filter(tx => tx && tx.sender !== "00" && user && (tx.recipient === user.email || tx.sender === user.email))
                                    .map(tx => (
                                        <tr key={tx.transactionId} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 font-mono text-xs text-gray-500">{tx.transactionId ? tx.transactionId.substring(0, 15) + '...' : 'Genesis/Reward'}</td>
                                            <td className="px-6 py-4"><div className="flex items-center gap-2"><div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs text-white ${tx.sender === '00' ? 'bg-yellow-400' : 'bg-blue-400'}`}>{tx.sender === '00' ? 'S' : 'U'}</div><span className={tx.sender === '00' ? 'font-bold text-gray-800' : 'text-gray-600'}>{tx.sender === '00' ? 'System Reward' : tx.sender.substring(0, 15) + '...'}</span></div></td>
                                            <td className="px-6 py-4 text-gray-600">{tx.recipient === user.email ? <span className="text-emerald-600 font-bold">Me ({user.email})</span> : tx.recipient.substring(0, 15) + '...'}</td>
                                            <td className="px-6 py-4 text-right font-bold text-emerald-600">{tx.amount} ECO</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
             </div>
        )}
      </div>
    </div>
  );
}