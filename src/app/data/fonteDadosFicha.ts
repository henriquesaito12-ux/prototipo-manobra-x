// Fonte ÚNICA dos dados de leitura da Ficha Operacional (Ficha do Trem, Visão Pátio, Situação
// Vagões). A tela chama `useDadosFicha(ficha)` / `fetchDadosFicha(ficha)` e recebe um
// `DadosFichaLeitura` pronto — sem saber se veio de upload, cadastro manual ou API.
//
// Hoje: `fonteLocal` — repositório em memória alimentado pelo parser do upload
// (`fichaImport.ts`), pelo cadastro manual e pelos mocks.
// Amanhã: `fonteUnilog` — mesma interface, implementada com chamada HTTP. Trocar
// `fonteAtiva` é a única mudança; nenhum componente de exibição muda.
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { DadosFichaLeitura } from './fichaModelo';

/** O que identifica uma ficha para a fonte — o UNILOG consultaria por trem + OS + data. */
export interface ReferenciaFicha {
  id: string;
  trem: string;
  os: string;
  data: string;
  patioNome: string;
}

export interface FonteDadosFicha {
  /** Rótulo exibido como procedência ("Fonte: …"). */
  readonly nome: string;
  buscar(ref: ReferenciaFicha): Promise<DadosFichaLeitura | null>;
  /** Leitura síncrona opcional (cache local) — evita estado de carregamento quando o dado já está em memória. */
  lerCache?(ref: ReferenciaFicha): DadosFichaLeitura | null | undefined;
}

// ---------------------------------------------------------------------------------------
// Fonte local (hoje)
// ---------------------------------------------------------------------------------------

const repositorio = new Map<string, DadosFichaLeitura>();
const ouvintes = new Set<() => void>();
let versao = 0;

function notificar() {
  versao++;
  ouvintes.forEach((o) => o());
}

/** Grava os dados lidos de uma ficha (upload/cadastro manual/mock) no repositório local. */
export function registrarDadosFicha(fichaId: string, dados: DadosFichaLeitura): void {
  repositorio.set(fichaId, dados);
  notificar();
}

export const fonteLocal: FonteDadosFicha = {
  nome: 'Planilha importada',
  async buscar(ref) {
    return repositorio.get(ref.id) ?? null;
  },
  lerCache(ref) {
    return repositorio.get(ref.id) ?? null;
  },
};

// ---------------------------------------------------------------------------------------
// Fonte UNILOG (futuro) — contrato já definido, implementação pendente da API.
// ---------------------------------------------------------------------------------------

export const fonteUnilog: FonteDadosFicha = {
  nome: 'UNILOG',
  async buscar(ref) {
    // Esperado: GET /unilog/fichas?trem={trem}&os={os}&data={data} → DTO convertido para
    // `DadosFichaLeitura` por um adaptador próprio (equivalente ao `fichaImport.ts` de hoje).
    throw new Error(`Integração UNILOG ainda não disponível (trem ${ref.trem}, OS ${ref.os}).`);
  },
};

let fonteAtiva: FonteDadosFicha = fonteLocal;

export function definirFonteDadosFicha(fonte: FonteDadosFicha): void {
  fonteAtiva = fonte;
  notificar();
}

export function nomeFonteAtiva(): string {
  return fonteAtiva.nome;
}

export function fetchDadosFicha(ref: ReferenciaFicha): Promise<DadosFichaLeitura | null> {
  return fonteAtiva.buscar(ref);
}

// ---------------------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------------------

export type EstadoDadosFicha =
  | { estado: 'carregando' }
  | { estado: 'indisponivel' }
  | { estado: 'erro'; mensagem: string }
  | { estado: 'pronto'; dados: DadosFichaLeitura; fonte: string };

function inscrever(o: () => void) {
  ouvintes.add(o);
  return () => ouvintes.delete(o);
}

function doCache(ref: ReferenciaFicha): EstadoDadosFicha | null {
  const c = fonteAtiva.lerCache?.(ref);
  if (c === undefined) return null;
  return c ? { estado: 'pronto', dados: c, fonte: fonteAtiva.nome } : { estado: 'indisponivel' };
}

export function useDadosFicha(ref: ReferenciaFicha | null): EstadoDadosFicha {
  const v = useSyncExternalStore(inscrever, () => versao);
  const [assincrono, setAssincrono] = useState<{ chave: string; resultado: EstadoDadosFicha } | null>(null);
  const chave = ref ? `${ref.id}#${v}` : '';
  const cache = ref ? doCache(ref) : null;

  useEffect(() => {
    if (!ref || cache) return;
    let ativo = true;
    fetchDadosFicha(ref)
      .then((dados) => {
        if (ativo) setAssincrono({ chave, resultado: dados ? { estado: 'pronto', dados, fonte: fonteAtiva.nome } : { estado: 'indisponivel' } });
      })
      .catch((e: unknown) => {
        if (ativo) setAssincrono({ chave, resultado: { estado: 'erro', mensagem: e instanceof Error ? e.message : 'Falha ao buscar dados da ficha.' } });
      });
    return () => { ativo = false; };
    // `chave` já cobre id + versão da fonte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, !!cache]);

  if (!ref) return { estado: 'indisponivel' };
  if (cache) return cache;
  return assincrono?.chave === chave ? assincrono.resultado : { estado: 'carregando' };
}
