import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { FirebaseProvider } from './contexts/FirebaseContext';
import Layout from './components/Layout';
import Hoje from './pages/Hoje';
import Dashboard from './pages/Dashboard';
import Obras from './pages/Obras';
import Trabalhadores from './pages/Trabalhadores';
import Presenca from './pages/Presenca';
import Tarefas from './pages/Tarefas';
import Estoque from './pages/Estoque';
import Financeiro from './pages/Financeiro';
import Console from './pages/Console';

function EmConstrucao() {
  return (
    <div style={{ color: '#c8d0db', padding: 20 }}>
      <h2>🚧 Página em Construção</h2>
      <p style={{ color: '#4a5568', marginTop: 10 }}>Este módulo ainda está sendo migrado para React ou não possui rota configurada.</p>
    </div>
  );
}

export default function App() {
  return (
    <FirebaseProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Hoje />} />
            <Route path="/hoje" element={<Hoje />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/obras" element={<Obras />} />
            <Route path="/trabalhadores" element={<Trabalhadores />} />
            <Route path="/presenca" element={<Presenca />} />
            <Route path="/tarefas" element={<Tarefas />} />
            <Route path="/estoque" element={<Estoque />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/console" element={<Console />} />
            <Route path="*" element={<EmConstrucao />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </FirebaseProvider>
  );
}