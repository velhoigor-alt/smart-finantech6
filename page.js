"use client";

import { useState, useEffect, useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { 
  Trash2, PlusCircle, User, Calendar, RefreshCw, Edit3, CheckCircle2, Circle, TrendingUp, TrendingDown, DollarSign, Clock
} from "lucide-react";

// --- Funções Utilitárias ---
const formatarMoeda = (valor) => {
  if (typeof valor !== 'number') return "R$ 0,00";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const diffMeses = (inicio, fim) => {
  if (!inicio || !fim) return 0;
  const dateInicio = new Date(inicio + "-01");
  const dateFim = new Date(fim + "-01");
  return (dateFim.getFullYear() - dateInicio.getFullYear()) * 12 + (dateFim.getMonth() - dateInicio.getMonth());
};

export default function Home() {
  const [isClient, setIsClient] = useState(false);
  const [aba, setAba] = useState("inicio");
  const [usuario, setUsuario] = useState(null);
  const [mesSelecionado, setMesSelecionado] = useState(new Date().toISOString().slice(0, 7));
  
  const [isRegistrando, setIsRegistrando] = useState(false);
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");

  const [tipo, setTipo] = useState("receita");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [parcelas, setParcelas] = useState(1);
  
  const [dados, setDados] = useState({ 
    receitas: [], 
    despesas: [], 
    parcelamentos: [],
    pagamentosParcelas: {},
    pagamentosFixos: {}
  });

  const [editando, setEditando] = useState(null);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");

  // --- Persistência e Proteção de Hidratação ---
  useEffect(() => {
    setIsClient(true);
    const user = localStorage.getItem("usuarioLogado");
    if (user) {
      setUsuario(user);
      const salvos = localStorage.getItem(`dados_${user}`);
      if (salvos) {
        try {
            setDados(JSON.parse(salvos));
        } catch (e) {
            console.error("Erro ao carregar dados", e);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (usuario && isClient) {
      localStorage.setItem(`dados_${usuario}`, JSON.stringify(dados));
    }
  }, [dados, usuario, isClient]);

  // --- Lógica de Cálculos ---
  const { receitasExibicao, despesasExibicao, totalReceitas, totalDespesasPagas, totalDespesasPendentes, totalParcelasMes, saldo } = useMemo(() => {
    const rMes = (dados.receitas || []).filter(r => r.mes <= mesSelecionado);
    
    const dFixas = (dados.despesas || []).filter(d => d.mes <= mesSelecionado).map(d => ({
      ...d,
      paga: !!dados.pagamentosFixos?.[`${d.id}-${mesSelecionado}`],
      isParcela: false
    }));

    const pAtivas = (dados.parcelamentos || []).filter(p => {
      const diff = diffMeses(p.mesInicio, mesSelecionado);
      return diff >= 0 && diff < p.parcelasTotais;
    });

    const pComoDespesas = pAtivas.map(p => {
      const n = diffMeses(p.mesInicio, mesSelecionado) + 1;
      return {
        id: `parc-${p.id}`,
        idOriginal: p.id,
        descricao: `${p.descricao} (${n}/${p.parcelasTotais})`,
        valor: p.valorParcela,
        paga: !!dados.pagamentosParcelas?.[`${p.id}-${mesSelecionado}`],
        isParcela: true
      };
    });

    const todasDespesas = [...dFixas, ...pComoDespesas];
    const tReceitas = rMes.reduce((a, b) => a + b.valor, 0);
    const tPagas = todasDespesas.filter(d => d.paga).reduce((a, b) => a + b.valor, 0);
    const tPendentes = todasDespesas.filter(d => !d.paga).reduce((a, b) => a + b.valor, 0);
    const tParcelas = pAtivas.reduce((a, b) => a + b.valorParcela, 0);

    return {
      receitasExibicao: rMes,
      despesasExibicao: todasDespesas,
      totalReceitas: tReceitas,
      totalDespesasPagas: tPagas,
      totalDespesasPendentes: tPendentes,
      totalParcelasMes: tParcelas,
      saldo: tReceitas - tPagas
    };
  }, [dados, mesSelecionado]);

  // --- Ações ---
  const tratarAutenticacao = () => {
    const usuarios = JSON.parse(localStorage.getItem("usuarios_db")) || {};
    if (isRegistrando) {
      usuarios[login] = senha;
      localStorage.setItem("usuarios_db", JSON.stringify(usuarios));
      alert("Conta criada!");
      setIsRegistrando(false);
    } else {
      if (usuarios[login] === senha) {
        localStorage.setItem("usuarioLogado", login);
        window.location.reload();
      } else alert("Credenciais inválidas");
    }
  };

  const alterarSenha = () => {
    const usuarios = JSON.parse(localStorage.getItem("usuarios_db")) || {};
    if (usuarios[usuario] !== senhaAtual) {
      alert("Senha atual incorreta!");
      return;
    }
    if (senhaNova.length < 3) {
      alert("A nova senha é muito curta!");
      return;
    }
    usuarios[usuario] = senhaNova;
    localStorage.setItem("usuarios_db", JSON.stringify(usuarios));
    alert("Senha alterada com sucesso!");
    setSenhaAtual(""); setSenhaNova("");
  };

  const adicionar = (e) => {
    e.preventDefault();
    const v = parseFloat(valor.toString().replace(",", "."));
    if (!descricao || isNaN(v)) return;

    if (tipo === "parcelamento") {
      const pCount = parseInt(parcelas);
      const novo = { id: Date.now(), descricao, valorTotal: v, valorParcela: v / pCount, parcelasTotais: pCount, mesInicio: mesSelecionado };
      setDados(prev => ({ ...prev, parcelamentos: [...prev.parcelamentos, novo] }));
    } else {
      const nova = { id: Date.now(), descricao, valor: v, mes: mesSelecionado };
      const campo = tipo === "receita" ? "receitas" : "despesas";
      setDados(prev => ({ ...prev, [campo]: [...prev[campo], nova] }));
    }
    setDescricao(""); setValor(""); setParcelas(1);
  };

  const salvarEdicao = () => {
    const v = parseFloat(editando.valorNovo.toString().replace(",", "."));
    if (isNaN(v)) return;
    setDados(prev => ({
      ...prev,
      receitas: prev.receitas.map(r => r.id === editando.id ? { ...r, valor: v } : r),
      despesas: prev.despesas.map(d => d.id === editando.id ? { ...d, valor: v } : d)
    }));
    setEditando(null);
  };

  const alternarStatus = (id, isParcela) => {
    const idOriginal = isParcela ? id.replace('parc-', '') : id;
    const chave = `${idOriginal}-${mesSelecionado}`;
    const campo = isParcela ? "pagamentosParcelas" : "pagamentosFixos";
    setDados(prev => ({
      ...prev,
      [campo]: { ...prev[campo], [chave]: !prev[campo]?.[chave] }
    }));
  };

  const excluirItem = (id) => {
    if (!confirm("Isso removerá o item de todos os meses. Confirmar?")) return;
    const idLimpo = typeof id === 'string' ? id.replace('parc-', '') : id;
    setDados(prev => ({
      ...prev,
      receitas: prev.receitas.filter(r => r.id.toString() !== idLimpo.toString()),
      despesas: prev.despesas.filter(d => d.id.toString() !== idLimpo.toString()),
      parcelamentos: prev.parcelamentos.filter(p => p.id.toString() !== idLimpo.toString())
    }));
  };

  // Se não estiver no cliente ainda, retorna vazio para evitar erro de hidratação
  if (!isClient) return <div className="min-h-screen bg-black" />;

  if (!usuario) {
    return (
      <div className="min-h-screen bg-black flex justify-center items-center text-white p-4 font-sans relative overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-green-900/20 rounded-full blur-[100px]" />
        <div className="bg-zinc-900/80 backdrop-blur-xl p-8 rounded-3xl w-full max-w-md border border-white/5 relative z-10">
          <h1 className="text-green-500 text-3xl font-black mb-6 text-center tracking-tighter uppercase">Smart Finantech</h1>
          <div className="space-y-4">
            <input placeholder="Usuário" className="w-full p-4 bg-zinc-800/50 rounded-2xl border border-white/5 outline-none focus:ring-2 ring-green-500" value={login} onChange={(e) => setLogin(e.target.value)} />
            <input type="password" placeholder="Senha" className="w-full p-4 bg-zinc-800/50 rounded-2xl border border-white/5 outline-none focus:ring-2 ring-green-500" value={senha} onChange={(e) => setSenha(e.target.value)} />
            <button onClick={tratarAutenticacao} className="w-full bg-green-600 p-4 rounded-2xl font-bold hover:bg-green-500 transition-all shadow-lg uppercase tracking-widest">Entrar</button>
            <button onClick={() => setIsRegistrando(!isRegistrando)} className="w-full text-zinc-500 text-xs font-bold uppercase pt-2 hover:text-white transition-colors">{isRegistrando ? "Voltar" : "Criar Conta"}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-8 font-sans relative overflow-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />

      <div className="max-w-6xl mx-auto relative z-10">
        <nav className="flex justify-between items-center mb-8 bg-zinc-900/60 backdrop-blur-md p-2 rounded-2xl border border-white/5 shadow-2xl">
          <div className="flex gap-1">
            {["inicio", "relatorios", "conta"].map(t => (
              <button key={t} onClick={() => setAba(t)} className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${aba === t ? "bg-green-600 text-white shadow-lg shadow-green-900/30" : "text-zinc-500 hover:text-white"}`}>
                {t === "inicio" ? "Dashboard" : t === "relatorios" ? "Relatórios" : "Minha Conta"}
              </button>
            ))}
          </div>
          <button onClick={() => { localStorage.removeItem("usuarioLogado"); window.location.reload(); }} className="px-4 text-zinc-500 text-xs font-bold hover:text-red-500 uppercase tracking-widest transition-colors">Sair</button>
        </nav>

        {aba === "inicio" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <form onSubmit={adicionar} className="bg-zinc-900/40 backdrop-blur-sm p-6 rounded-3xl border border-white/5 flex flex-wrap gap-4 items-end mb-8 shadow-2xl">
              <div className="flex-1 min-w-[200px]">
                <label className="text-[10px] text-zinc-500 uppercase font-black block mb-2">Descrição</label>
                <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Salário, Aluguel..." className="w-full bg-black/40 p-3 rounded-xl border border-white/5 outline-none focus:ring-1 ring-green-500" />
              </div>
              <div className="w-32">
                <label className="text-[10px] text-zinc-500 uppercase font-black block mb-2">Valor</label>
                <input type="text" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" className="w-full bg-black/40 p-3 rounded-xl border border-white/5 outline-none" />
              </div>
              <div className="w-32">
                <label className="text-[10px] text-zinc-500 uppercase font-black block mb-2">Tipo</label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full bg-black/40 p-3 rounded-xl border border-white/5 outline-none cursor-pointer">
                  <option value="receita">Receita</option>
                  <option value="despesa">Despesa Fixa</option>
                  <option value="parcelamento">Parcelamento</option>
                </select>
              </div>
              {tipo === "parcelamento" && (
                <div className="w-20">
                  <label className="text-[10px] text-zinc-500 uppercase font-black block mb-2">Meses</label>
                  <input type="number" min="1" value={parcelas} onChange={(e) => setParcelas(e.target.value)} className="w-full bg-black/40 p-3 rounded-xl border border-white/5 outline-none" />
                </div>
              )}
              <button type="submit" className="bg-green-600 text-white p-3 rounded-xl hover:bg-green-500 transition-all shadow-lg"><PlusCircle size={24} /></button>
            </form>

            <div className="grid md:grid-cols-4 gap-4 mb-8">
              <div className="bg-zinc-900/40 p-4 rounded-2xl border border-white/5 flex flex-col justify-center">
                <label className="text-[10px] text-zinc-500 block mb-1 uppercase font-black">Mês Atual</label>
                <input type="month" value={mesSelecionado} onChange={(e) => setMesSelecionado(e.target.value)} className="bg-transparent text-xl font-bold outline-none w-full text-green-500 cursor-pointer" />
              </div>
              <CardResumo title="Saldo Livre" value={saldo} color="text-white" bg="bg-green-600" />
              <CardResumo title="Entradas" value={totalReceitas} color="text-green-500" bg="bg-zinc-900/40" />
              <CardResumo title="Saídas Pagas" value={totalDespesasPagas} color="text-red-500" bg="bg-zinc-900/40" />
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-zinc-900/20 p-6 rounded-[32px] border border-white/5">
                <h3 className="text-sm font-black uppercase tracking-[2px] mb-6 text-zinc-600">Receitas do Mês</h3>
                <div className="space-y-3">
                  {receitasExibicao.map(r => (
                    <div key={r.id} className="flex justify-between items-center bg-black/20 p-4 rounded-2xl group border border-transparent hover:border-white/5 transition-all">
                      <div>
                        <p className="text-sm font-bold">{r.descricao}</p>
                        {editando?.id === r.id ? (
                          <input autoFocus className="bg-zinc-800 rounded px-2 text-green-500 text-xs mt-1 outline-none border border-green-500" value={editando.valorNovo} onChange={(e) => setEditando({...editando, valorNovo: e.target.value})} onBlur={salvarEdicao} onKeyDown={(e) => e.key === 'Enter' && salvarEdicao()} />
                        ) : (
                          <p className="text-xs text-zinc-500 font-mono cursor-pointer" onClick={() => setEditando({id: r.id, valorNovo: r.valor})}>{formatarMoeda(r.valor)}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditando({id: r.id, valorNovo: r.valor})} className="text-zinc-700 hover:text-white transition-all"><Edit3 size={14}/></button>
                        <button onClick={() => excluirItem(r.id)} className="text-zinc-700 hover:text-red-500 transition-all"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-zinc-900/20 p-6 rounded-[32px] border border-white/5">
                <h3 className="text-sm font-black uppercase tracking-[2px] mb-6 text-zinc-600">Despesas e Parcelas</h3>
                <div className="space-y-3">
                  {despesasExibicao.map(d => (
                    <div key={d.id} className="flex justify-between items-center bg-black/20 p-4 rounded-2xl group border border-transparent hover:border-white/5 transition-all">
                      <div>
                        <p className={`text-sm font-bold ${d.isParcela ? 'text-orange-400' : ''}`}>{d.descricao}</p>
                        {editando?.id === d.id && !d.isParcela ? (
                          <input autoFocus className="bg-zinc-800 rounded px-2 text-red-500 text-xs mt-1 outline-none border border-red-500" value={editando.valorNovo} onChange={(e) => setEditando({...editando, valorNovo: e.target.value})} onBlur={salvarEdicao} onKeyDown={(e) => e.key === 'Enter' && salvarEdicao()} />
                        ) : (
                          <p className={`text-xs text-zinc-500 font-mono ${!d.isParcela ? 'cursor-pointer' : ''}`} onClick={() => !d.isParcela && setEditando({id: d.id, valorNovo: d.valor})}>{formatarMoeda(d.valor)}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => alternarStatus(d.id, d.isParcela)} className={`text-[10px] font-black px-3 py-1.5 rounded-lg transition-all border ${d.paga ? "bg-green-600/10 border-green-500 text-green-500" : "bg-zinc-800 border-zinc-700 text-zinc-500"}`}>
                          {d.paga ? "PAGO" : "PENDENTE"}
                        </button>
                        <div className="flex gap-2">
                            {!d.isParcela && <button onClick={() => setEditando({id: d.id, valorNovo: d.valor})} className="text-zinc-700 hover:text-white transition-all"><Edit3 size={14}/></button>}
                            <button onClick={() => excluirItem(d.id)} className="text-zinc-700 hover:text-red-500 transition-all"><Trash2 size={16}/></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {aba === "relatorios" && (
          <div className="space-y-8 animate-in fade-in duration-500">
             <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-zinc-900/40 p-6 rounded-[32px] border border-white/5 flex items-center gap-4">
                  <div className="p-3 bg-green-500/10 rounded-2xl text-green-500"><TrendingUp /></div>
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase font-black">Receitas Ativas</p>
                    <p className="text-xl font-bold">{formatarMoeda(totalReceitas)}</p>
                  </div>
                </div>
                <div className="bg-zinc-900/40 p-6 rounded-[32px] border border-white/5 flex items-center gap-4">
                  <div className="p-3 bg-red-500/10 rounded-2xl text-red-500"><TrendingDown /></div>
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase font-black">Saídas Pendentes</p>
                    <p className="text-xl font-bold">{formatarMoeda(totalDespesasPendentes)}</p>
                  </div>
                </div>
                <div className="bg-zinc-900/40 p-6 rounded-[32px] border border-white/5 flex items-center gap-4">
                  <div className="p-3 bg-orange-500/10 rounded-2xl text-orange-500"><DollarSign /></div>
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase font-black">Total em Parcelas</p>
                    <p className="text-xl font-bold">{formatarMoeda(totalParcelasMes)}</p>
                  </div>
                </div>
             </div>

             <div className="bg-zinc-900/40 p-8 rounded-[32px] border border-white/5">
                <h3 className="text-lg font-bold mb-8 flex items-center gap-2 uppercase tracking-tighter"><Calendar className="text-green-500" /> Detalhes de Parcelamentos</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {dados.parcelamentos.length === 0 && <p className="text-zinc-600 italic text-sm">Nenhum parcelamento ativo.</p>}
                  {dados.parcelamentos.map(p => {
                    const mesesPassados = diffMeses(p.mesInicio, mesSelecionado);
                    const parcelasRestantes = p.parcelasTotais - mesesPassados - 1;
                    return (
                      <div key={p.id} className="bg-black/20 p-6 rounded-3xl border border-white/5 group relative">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-[10px] text-zinc-500 uppercase font-black">{p.parcelasTotais} Parcelas no Total</p>
                          <span className="flex items-center gap-1 text-[10px] font-black text-orange-500 bg-orange-500/10 px-2 py-1 rounded-full">
                            <Clock size={10} /> FALTAM {parcelasRestantes > 0 ? parcelasRestantes : 0}
                          </span>
                        </div>
                        <h4 className="font-bold text-xl text-orange-500 mb-4">{p.descricao}</h4>
                        <div className="flex justify-between text-sm">
                          <div>
                            <p className="text-[10px] text-zinc-600 uppercase font-bold">Valor Mensal</p>
                            <span className="font-mono">{formatarMoeda(p.valorParcela)}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-zinc-600 uppercase font-bold">Total do Contrato</p>
                            <span className="text-zinc-400 font-mono">{formatarMoeda(p.valorTotal)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
             </div>

             <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-zinc-900/40 p-8 rounded-[32px] border border-white/5">
                <h3 className="text-lg font-bold mb-8 uppercase tracking-widest text-zinc-500">Saúde Financeira</h3>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[
                          {name: 'Saldo Livre', value: saldo > 0 ? saldo : 0}, 
                          {name: 'Parcelas', value: totalParcelasMes}, 
                          {name: 'Fixas Pagas', value: (totalDespesasPagas - totalParcelasMes) > 0 ? (totalDespesasPagas - totalParcelasMes) : 0}
                        ]} dataKey="value" innerRadius={70} outerRadius={100} paddingAngle={8}>
                        <Cell fill="#22c55e" stroke="none" />
                        <Cell fill="#f97316" stroke="none" />
                        <Cell fill="#ef4444" stroke="none" />
                      </Pie>
                      <Tooltip contentStyle={{backgroundColor: '#111', border: 'none', borderRadius: '12px', color: '#fff'}} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-zinc-900/40 p-8 rounded-[32px] border border-white/5 flex flex-col justify-center text-center">
                <p className="text-zinc-500 uppercase text-[10px] font-black mb-2 tracking-widest">Dívida Contratada Total</p>
                <h2 className="text-4xl font-black text-orange-500">{formatarMoeda(dados.parcelamentos.reduce((a, b) => a + b.valorTotal, 0))}</h2>
                <p className="text-[10px] text-zinc-600 mt-4 uppercase font-black">Soma de todos os contratos parcelados</p>
              </div>
            </div>
          </div>
        )}

        {aba === "conta" && (
          <div className="max-w-2xl mx-auto bg-zinc-900/40 p-8 rounded-[32px] border border-white/5 animate-in zoom-in-95">
             <div className="flex items-center gap-4 mb-10 border-b border-white/5 pb-10">
                <div className="bg-green-600 p-4 rounded-2xl shadow-lg shadow-green-900/40">
                    <User size={32} className="text-black" />
                </div>
                <div>
                    <h2 className="text-2xl font-black uppercase tracking-tighter">{usuario}</h2>
                    <p className="text-zinc-500 text-[10px] font-black tracking-[4px]">SISTEMA FINANCEIRO SMART FINANTECH</p>
                </div>
            </div>

            <div className="space-y-4 mb-10">
                <h3 className="text-xs font-black uppercase text-zinc-500 mb-4 tracking-widest">Segurança da Conta</h3>
                
                <div>
                    <label className="text-[10px] text-zinc-500 uppercase font-black block mb-2">Senha Atual</label>
                    <input 
                        type="password" 
                        value={senhaAtual}
                        onChange={(e) => setSenhaAtual(e.target.value)}
                        className="w-full bg-black/40 p-3 rounded-xl border border-white/5 outline-none focus:ring-1 ring-green-500" 
                        placeholder="Digite a senha atual"
                    />
                </div>

                <div>
                    <label className="text-[10px] text-zinc-500 uppercase font-black block mb-2">Nova Senha</label>
                    <input 
                        type="password" 
                        value={senhaNova}
                        onChange={(e) => setSenhaNova(e.target.value)}
                        className="w-full bg-black/40 p-3 rounded-xl border border-white/5 outline-none focus:ring-1 ring-green-500" 
                        placeholder="Digite a nova senha"
                    />
                </div>

                <button 
                    onClick={alterarSenha}
                    className="w-full bg-green-600 p-3 rounded-xl font-bold text-xs uppercase hover:bg-green-500 transition-all shadow-lg"
                >
                    Redefinir Senha de Acesso
                </button>
            </div>

            <div className="border-t border-white/5 pt-6">
                <button onClick={() => {
                    const idExist = (dados.parcelamentos || []).map(p => p.id.toString());
                    const novosPag = {...dados.pagamentosParcelas};
                    Object.keys(novosPag).forEach(k => { if(!idExist.includes(k.split('-')[0])) delete novosPag[k] });
                    setDados(prev => ({...prev, pagamentosParcelas: novosPag}));
                    alert("Dados sincronizados com sucesso!");
                }} className="w-full bg-zinc-800 p-4 rounded-2xl font-bold text-xs uppercase hover:bg-zinc-700 transition-all flex items-center justify-center gap-2">
                    <RefreshCw size={14}/> Reparar Histórico de Parcelas
                </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const CardResumo = ({ title, value, color, bg }) => (
  <div className={`${bg} p-6 rounded-3xl border border-white/5 shadow-xl transition-all hover:scale-[1.02]`}>
    <p className="text-[10px] uppercase font-black opacity-60 mb-1 tracking-tight">{title}</p>
    <h2 className={`text-xl md:text-2xl font-black ${color}`}>{formatarMoeda(value)}</h2>
  </div>
);