import { useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { io } from 'socket.io-client';

type Seat = { id: string; code: string; color: 'green' | 'red' | 'yellow'; state: string };

type Store = { id: string; name: string; congestionRate: number };

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

function useSocket() {
  useEffect(() => {
    const socket = io(API);
    return () => {
      socket.disconnect();
    };
  }, []);
}

function App() {
  useSocket();

  return (
    <main>
      <h1>タリーズ座席管理</h1>
      <nav>
        <Link to="/">ホーム</Link>
        <Link to="/collection">スタンプ</Link>
        <Link to="/history">履歴</Link>
        <Link to="/staff">店員</Link>
        <Link to="/admin">管理者</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/collection" element={<Placeholder title="スタンプコレクション" />} />
        <Route path="/history" element={<Placeholder title="利用履歴" />} />
        <Route path="/staff" element={<Placeholder title="店員ダッシュボード" />} />
        <Route path="/admin" element={<Placeholder title="管理者コンソール" />} />
      </Routes>
    </main>
  );
}

function Home() {
  const [token, setToken] = useState('');
  const [stores, setStores] = useState<Store[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [currentStore, setCurrentStore] = useState<string>('');

  async function loginDemo() {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'user@tullys.local', password: 'password123' }),
    });
    const body = await res.json();
    setToken(body.token);
  }

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/stores`, { headers: { authorization: 'Bearer ' + token } })
      .then((res) => res.json())
      .then((items: Store[]) => {
        setStores(items);
        if (items[0]) setCurrentStore(items[0].id);
      });
  }, [token]);

  useEffect(() => {
    if (!token || !currentStore) return;
    fetch(`${API}/api/stores/${currentStore}/seats`, { headers: { authorization: 'Bearer ' + token } })
      .then((res) => res.json())
      .then((items: Seat[]) => setSeats(items));
  }, [token, currentStore]);

  const store = useMemo(() => stores.find((x) => x.id === currentStore), [stores, currentStore]);

  return (
    <>
      <div className="card">
        {!token ? <button onClick={loginDemo}>デモログイン</button> : <span className="tag">ログイン済み</span>}
      </div>

      {store ? (
        <>
          <div className="card">
            <h2>{store.name}</h2>
            <p>混雑率: {store.congestionRate}%</p>
          </div>
          <div className="grid">
            {seats.map((seat) => (
              <button key={seat.id} className="seat" style={{ background: seat.color }}>
                {seat.code}
                <br />
                {seat.state}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <p>スマートフォン優先UIで段階的に実装できる構成です。</p>
    </div>
  );
}

export default App;
