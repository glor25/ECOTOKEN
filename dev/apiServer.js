const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const User = require('./models/User');

const PORT = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Koneksi MongoDB (Pastikan MongoDB sudah terinstal atau ganti string koneksi)
mongoose.connect('mongodb://127.0.0.1:27017/ecotoken_db')
  .then(() => console.log('✅ Terkoneksi ke MongoDB'))
  .catch(err => console.error('❌ Gagal konek MongoDB:', err));

// --- ROUTES ---

// 1. REGISTER
app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Email sudah terdaftar!" });

    const newUser = new User({ email, password, balance: 0 }); // Saldo awal 0
    await newUser.save();
    res.json({ message: "Registrasi berhasil!", user: newUser });
  } catch (error) {
    res.status(500).json({ message: "Error server" });
  }
});

// 2. LOGIN
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || user.password !== password) {
      return res.status(400).json({ message: "Email atau password salah!" });
    }
    
    res.json({ message: "Login berhasil!", user });
  } catch (error) {
    res.status(500).json({ message: "Error server" });
  }
});

// 3. GET USER DATA (Untuk refresh saldo)
app.get('/user/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    res.json(user);
  } catch (error) {
    res.status(404).json({ message: "User tidak ditemukan" });
  }
});

// 4. DEPOSIT (Update Saldo DB)
// Dipanggil Frontend setelah kirim transaksi ke Blockchain
app.post('/update-balance', async (req, res) => {
  try {
    const { userId, amount } = req.body;
    const user = await User.findById(userId);
    user.balance += parseFloat(amount);
    await user.save();
    res.json({ message: "Saldo diupdate", balance: user.balance });
  } catch (error) {
    res.status(500).json({ message: "Gagal update saldo" });
  }
});

// 5. REDEEM REWARD
app.post('/redeem', async (req, res) => {
  try {
    const { userId, itemName, cost } = req.body;
    const user = await User.findById(userId);

    if (user.balance < cost) {
      return res.status(400).json({ message: "Saldo tidak cukup!" });
    }

    user.balance -= cost;
    user.rewardsHistory.push({ itemName, cost });
    await user.save();

    res.json({ message: `Berhasil menukar ${itemName}`, balance: user.balance });
  } catch (error) {
    res.status(500).json({ message: "Gagal redeem" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Database API Server running on port ${PORT}`);
});