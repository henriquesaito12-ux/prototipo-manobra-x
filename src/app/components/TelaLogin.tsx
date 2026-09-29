// Tela de acesso do protótipo publicado (2026-09-29, pedido explícito do usuário: "o link não pode
// ser público, então crie uma tela de login e senha").
//
// ATENÇÃO: é só uma barreira no navegador. O site é estático (GitHub Pages) e o repositório é
// público, então quem souber inspecionar o código consegue passar por ela. Serve pra evitar
// acesso casual pelo link, não protege dado sensível. Guardamos só o hash SHA-256 das
// credenciais, pra não deixar login/senha em texto puro no repositório.
import { useState, type FormEvent, type ReactNode } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import LogoVliDark from '../../imports/logo_darkmode.png';
import LogoVliLight from '../../imports/logo_lightmode.png';
import LogoManobraXDark from '../../imports/manobrax_darkmode.png';
import LogoManobraXLight from '../../imports/manobrax_lightmode.png';

const HASH_LOGIN = '441a0c4489cdf2b98980cd6b2ec15e97ca9dedf7829521003f85a02ef7ac431d';
const HASH_SENHA = '0bb73feafd3f4cb6cf7b5a3f11f73032af6a3ee7a1a4116d1852007417c86741';
const CHAVE_SESSAO = 'manobrax-acesso';

const FONT = 'Manrope, sans-serif';

async function sha256(texto: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function acessoLiberado(): boolean {
  try {
    return sessionStorage.getItem(CHAVE_SESSAO) === '1';
  } catch {
    return false;
  }
}

export function PortaoAcesso({ children }: { children: ReactNode }) {
  const [liberado, setLiberado] = useState(acessoLiberado);
  if (liberado) return <>{children}</>;
  return <TelaLogin onEntrar={() => setLiberado(true)} />;
}

function TelaLogin({ onEntrar }: { onEntrar: () => void }) {
  const { theme } = useTheme();
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState(false);
  const [verificando, setVerificando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setVerificando(true);
    const [hLogin, hSenha] = await Promise.all([sha256(login.trim().toLowerCase()), sha256(senha)]);
    setVerificando(false);
    if (hLogin === HASH_LOGIN && hSenha === HASH_SENHA) {
      try { sessionStorage.setItem(CHAVE_SESSAO, '1'); } catch { /* sem storage: vale só nesta aba */ }
      onEntrar();
      return;
    }
    setErro(true);
  }

  const campo: React.CSSProperties = {
    width: '100%',
    height: '2.5rem',
    padding: '0 0.75rem',
    borderRadius: '0.375rem',
    border: `1px solid ${erro ? 'var(--vli-danger-text)' : 'var(--vli-border)'}`,
    backgroundColor: 'var(--vli-panel-bg)',
    color: 'var(--vli-text-hi)',
    fontSize: '0.875rem',
    fontFamily: FONT,
    outline: 'none',
  };
  const rotulo: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 600, color: 'var(--vli-text-md)', fontFamily: FONT };

  return (
    <div className="flex items-center justify-center" style={{ minHeight: '100vh', padding: '1rem', backgroundColor: 'var(--vli-bg-deep, var(--vli-surface))', fontFamily: FONT }}>
      <form
        onSubmit={entrar}
        className="flex flex-col"
        style={{ width: '100%', maxWidth: '22rem', gap: '1rem', padding: '2rem', borderRadius: '0.625rem', border: '1px solid var(--vli-border)', backgroundColor: 'var(--vli-panel-bg)', boxShadow: 'var(--vli-shadow)' }}
      >
        <div className="flex items-center justify-center" style={{ gap: '0.75rem', marginBottom: '0.5rem' }}>
          <img src={theme === 'dark' ? LogoVliDark : LogoVliLight} alt="VLI" style={{ height: '1.5rem' }} />
          <div style={{ width: 1, height: '1.5rem', backgroundColor: 'var(--vli-border)' }} />
          <img src={theme === 'dark' ? LogoManobraXDark : LogoManobraXLight} alt="Manobra X" style={{ height: '1.625rem' }} />
        </div>
        <div className="flex flex-col items-center" style={{ gap: '0.25rem', textAlign: 'center' }}>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--vli-text-hi)' }}>Protótipo — acesso restrito</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--vli-text-lo)' }}>Entre com o login e a senha recebidos da equipe.</span>
        </div>

        <label className="flex flex-col" style={{ gap: '0.375rem' }}>
          <span style={rotulo}>Login</span>
          <input autoFocus autoComplete="username" value={login} onChange={(e) => { setLogin(e.target.value); setErro(false); }} style={campo} />
        </label>

        <label className="flex flex-col" style={{ gap: '0.375rem' }}>
          <span style={rotulo}>Senha</span>
          <span style={{ position: 'relative', display: 'block' }}>
            <input
              type={mostrarSenha ? 'text' : 'password'}
              autoComplete="current-password"
              value={senha}
              onChange={(e) => { setSenha(e.target.value); setErro(false); }}
              style={{ ...campo, paddingRight: '2.5rem' }}
            />
            <button
              type="button"
              onClick={() => setMostrarSenha((m) => !m)}
              aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              className="flex items-center justify-center"
              style={{ position: 'absolute', top: 0, right: 0, width: '2.5rem', height: '2.5rem', border: 'none', background: 'transparent', color: 'var(--vli-text-lo)', cursor: 'pointer' }}
            >
              {mostrarSenha ? <EyeOff size="1rem" /> : <Eye size="1rem" />}
            </button>
          </span>
        </label>

        {erro && <span role="alert" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--vli-danger-text)' }}>Login ou senha incorretos.</span>}

        <button
          type="submit"
          disabled={verificando || !login || !senha}
          className="flex items-center justify-center"
          style={{
            gap: '0.375rem',
            height: '2.5rem',
            border: 'none',
            borderRadius: '0.375rem',
            backgroundColor: 'var(--vli-primary)',
            color: '#fff',
            fontSize: '0.875rem',
            fontWeight: 700,
            fontFamily: FONT,
            cursor: verificando || !login || !senha ? 'not-allowed' : 'pointer',
            opacity: verificando || !login || !senha ? 0.6 : 1,
          }}
        >
          <Lock size="0.875rem" /> Entrar
        </button>
      </form>
    </div>
  );
}
