
const CHAVE_TOKEN = "nexo_token";
const CHAVE_USUARIO = "nexo_usuario";
const CHAVE_BANCO = "nexo_banco_local";

// Cores usadas só para desenhar categorias/prioridades no front
const CORES = {
  ember: "#E3A23C",
  moss: "#4FA79E",
  honey: "#C9A24E",
  indigo: "#8B8FC4",
  plum: "#C97B95",
};
const CORES_PRIORIDADE = { alta: "#D97B4F", media: "#E3A23C", baixa: "#6E8F8B" };
const NOMES_PRIORIDADE = { alta: "Alta", media: "Média", baixa: "Baixa" };

// Dia sendo visualizado na aba Tarefas (começa em hoje)
let dataSelecionadaTarefas = dataDeHoje();

/* --------------------------------------------------- */
/* "API" local (sem back-end por enquanto)               */
/* --------------------------------------------------- */

// Mantém a mesma assinatura de antes (caminho + opções com
// method/body), só que resolve tudo localmente, sem rede.
async function chamarApi(caminho, opcoes = {}) {
  await esperarUmPouco(120); // simula uma latência de rede pequena

  const metodo = (opcoes.method || "GET").toUpperCase();
  const corpo = opcoes.body ? JSON.parse(opcoes.body) : null;
  const token = localStorage.getItem(CHAVE_TOKEN);

  try {
    return processarRotaLocal(metodo, caminho, corpo, token);
  } catch (erro) {
    if (erro.status === 401) {
      sair();
      throw new Error("Sessão expirada. Faça login novamente.");
    }
    throw new Error(erro.message || "Erro ao comunicar com o servidor.");
  }
}

function esperarUmPouco(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function salvarSessao(token, usuario) {
  localStorage.setItem(CHAVE_TOKEN, token);
  localStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
}

/* --------------------------------------------------- */
/* Banco de dados falso (guardado no localStorage)       */
/* --------------------------------------------------- */
function carregarBanco() {
  const bruto = localStorage.getItem(CHAVE_BANCO);
  if (!bruto) return { usuarios: [], tarefas: [], habitos: [], proximoId: 1 };
  return JSON.parse(bruto);
}
function salvarBanco(banco) {
  localStorage.setItem(CHAVE_BANCO, JSON.stringify(banco));
}
function erroApi(status, mensagem) {
  const erro = new Error(mensagem);
  erro.status = status;
  return erro;
}
function obterUsuarioLogado(banco, token) {
  if (!token) throw erroApi(401, "Não autenticado.");
  const usuario = banco.usuarios.find((u) => u.token === token);
  if (!usuario) throw erroApi(401, "Sessão inválida.");
  return usuario;
}
function calcularStreak(marcacoes) {
  let streak = 0;
  let cursor = dataDeHoje();
  const marcadas = new Set(marcacoes);
  while (marcadas.has(cursor)) {
    streak++;
    cursor = deslocarData(cursor, -1);
  }
  return streak;
}

function processarRotaLocal(metodo, caminhoCompleto, corpo, token) {
  const [rota, querystring] = caminhoCompleto.split("?");
  const parametros = new URLSearchParams(querystring || "");
  const banco = carregarBanco();

  /* ---------- AUTENTICAÇÃO ---------- */
  if (rota === "/auth/registrar" && metodo === "POST") {
    if (banco.usuarios.some((u) => u.email === corpo.email)) {
      throw erroApi(400, "Já existe uma conta com este e-mail.");
    }
    const usuario = {
      id: banco.proximoId++,
      nome: corpo.nome,
      email: corpo.email,
      senha: corpo.senha,
      token: "local-" + Math.random().toString(36).slice(2),
    };
    banco.usuarios.push(usuario);
    salvarBanco(banco);
    return { token: usuario.token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } };
  }

  if (rota === "/auth/login" && metodo === "POST") {
    const usuario = banco.usuarios.find((u) => u.email === corpo.email && u.senha === corpo.senha);
    if (!usuario) throw erroApi(400, "E-mail ou senha incorretos.");
    usuario.token = "local-" + Math.random().toString(36).slice(2);
    salvarBanco(banco);
    return { token: usuario.token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } };
  }

  // Todas as rotas abaixo exigem estar logado
  const usuarioAtual = obterUsuarioLogado(banco, token);

  /* ---------- TAREFAS ---------- */
  if (rota === "/tarefas" && metodo === "GET") {
    const data = parametros.get("data");
    return banco.tarefas
      .filter((t) => t.usuarioId === usuarioAtual.id && (t.fixa || t.data === data))
      .map((t) => ({
        id: t.id, titulo: t.titulo, data: t.data, hora: t.hora,
        categoria: t.categoria, prioridade: t.prioridade, fixa: t.fixa,
        concluida: t.concluidasEm.includes(data),
      }));
  }

  if (rota === "/tarefas" && metodo === "POST") {
    const tarefa = {
      id: banco.proximoId++,
      usuarioId: usuarioAtual.id,
      titulo: corpo.titulo,
      data: corpo.data,
      hora: corpo.hora,
      categoria: corpo.categoria,
      prioridade: corpo.prioridade,
      fixa: !!corpo.fixa,
      concluidasEm: [],
    };
    banco.tarefas.push(tarefa);
    salvarBanco(banco);
    return tarefa;
  }

  let combinacao = rota.match(/^\/tarefas\/(\d+)\/concluir$/);
  if (combinacao && metodo === "PATCH") {
    const id = Number(combinacao[1]);
    const data = parametros.get("data");
    const tarefa = banco.tarefas.find((t) => t.id === id && t.usuarioId === usuarioAtual.id);
    if (!tarefa) throw erroApi(404, "Tarefa não encontrada.");
    const indice = tarefa.concluidasEm.indexOf(data);
    if (indice >= 0) tarefa.concluidasEm.splice(indice, 1);
    else tarefa.concluidasEm.push(data);
    salvarBanco(banco);
    return null;
  }

  combinacao = rota.match(/^\/tarefas\/(\d+)$/);
  if (combinacao && metodo === "DELETE") {
    const id = Number(combinacao[1]);
    banco.tarefas = banco.tarefas.filter((t) => !(t.id === id && t.usuarioId === usuarioAtual.id));
    salvarBanco(banco);
    return null;
  }

  /* ---------- HÁBITOS ---------- */
  if (rota === "/habitos" && metodo === "GET") {
    const hoje = dataDeHoje();
    return banco.habitos
      .filter((h) => h.usuarioId === usuarioAtual.id)
      .map((h) => ({
        id: h.id, nome: h.nome, cor: h.cor,
        feitoHoje: h.marcacoes.includes(hoje),
        streak: calcularStreak(h.marcacoes),
      }));
  }

  if (rota === "/habitos" && metodo === "POST") {
    const habito = {
      id: banco.proximoId++,
      usuarioId: usuarioAtual.id,
      nome: corpo.nome,
      cor: corpo.cor,
      marcacoes: [],
    };
    banco.habitos.push(habito);
    salvarBanco(banco);
    return habito;
  }

  combinacao = rota.match(/^\/habitos\/(\d+)\/marcar$/);
  if (combinacao && metodo === "POST") {
    const id = Number(combinacao[1]);
    const habito = banco.habitos.find((h) => h.id === id && h.usuarioId === usuarioAtual.id);
    if (!habito) throw erroApi(404, "Hábito não encontrado.");
    const hoje = dataDeHoje();
    const indice = habito.marcacoes.indexOf(hoje);
    if (indice >= 0) habito.marcacoes.splice(indice, 1);
    else habito.marcacoes.push(hoje);
    salvarBanco(banco);
    return null;
  }

  combinacao = rota.match(/^\/habitos\/(\d+)$/);
  if (combinacao && metodo === "DELETE") {
    const id = Number(combinacao[1]);
    banco.habitos = banco.habitos.filter((h) => !(h.id === id && h.usuarioId === usuarioAtual.id));
    salvarBanco(banco);
    return null;
  }

  /* ---------- DASHBOARD ---------- */
  if (rota === "/dashboard" && metodo === "GET") {
    const hoje = dataDeHoje();
    const tarefasHoje = banco.tarefas
      .filter((t) => t.usuarioId === usuarioAtual.id && (t.fixa || t.data === hoje))
      .map((t) => ({
        id: t.id, titulo: t.titulo, data: t.data, hora: t.hora,
        categoria: t.categoria, prioridade: t.prioridade, fixa: t.fixa,
        concluida: t.concluidasEm.includes(hoje),
      }));
    const concluidasHoje = tarefasHoje.filter((t) => t.concluida).length;
    const totalTarefasHoje = tarefasHoje.length;
    const totalHabitos = banco.habitos.filter((h) => h.usuarioId === usuarioAtual.id).length;
    const porcentagem = totalTarefasHoje === 0 ? 0 : Math.round((concluidasHoje / totalTarefasHoje) * 100);
    return { resumo: { porcentagem, concluidasHoje, totalTarefasHoje, totalHabitos }, tarefasHoje };
  }

  throw erroApi(404, "Rota não encontrada: " + metodo + " " + rota);
}

/* --------------------------------------------------- */
/* Funções utilitárias de data                        */
/* --------------------------------------------------- */
function dataDeHoje() {
  return formatarData(new Date());
}
function formatarData(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}
function deslocarData(dataTexto, dias) {
  const data = new Date(dataTexto + "T00:00:00");
  data.setDate(data.getDate() + dias);
  return formatarData(data);
}
function formatarRotuloData(dataTexto) {
  const hoje = dataDeHoje();
  if (dataTexto === hoje) return "Hoje";
  if (dataTexto === deslocarData(hoje, 1)) return "Amanhã";
  if (dataTexto === deslocarData(hoje, -1)) return "Ontem";
  const [ano, mes, dia] = dataTexto.split("-");
  return `${dia}/${mes}`;
}

/* --------------------------------------------------- */
/* Navegação entre telas (login / cadastro / app)        */
/* --------------------------------------------------- */
function mostrarTela(idTela) {
  document.querySelectorAll(".tela").forEach((tela) => tela.classList.add("hidden"));
  document.getElementById(idTela).classList.remove("hidden");
}

document.getElementById("btn-ir-cadastro").addEventListener("click", () => mostrarTela("tela-cadastro"));
document.getElementById("btn-ir-login").addEventListener("click", () => mostrarTela("tela-login"));

document.getElementById("form-login").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const email = document.getElementById("login-email").value;
  const senha = document.getElementById("login-senha").value;
  try {
    const resposta = await chamarApi("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, senha }),
    });
    salvarSessao(resposta.token, resposta.usuario);
    await entrarNoApp(resposta.usuario.nome);
  } catch (erro) {
    alert(erro.message);
  }
});

document.getElementById("form-cadastro").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const nome = document.getElementById("cadastro-nome").value || "Você";
  const email = document.getElementById("cadastro-email").value;
  const senha = document.getElementById("cadastro-senha").value;
  try {
    const resposta = await chamarApi("/auth/registrar", {
      method: "POST",
      body: JSON.stringify({ nome, email, senha }),
    });
    salvarSessao(resposta.token, resposta.usuario);
    await entrarNoApp(resposta.usuario.nome);
  } catch (erro) {
    alert(erro.message);
  }
});

document.getElementById("btn-sair").addEventListener("click", sair);

function sair() {
  localStorage.removeItem(CHAVE_TOKEN);
  localStorage.removeItem(CHAVE_USUARIO);
  mostrarTela("tela-login");
}

async function entrarNoApp(nome) {
  document.getElementById("perfil-nome").value = nome;
  document.getElementById("saudacao").textContent = "Olá, " + nome.split(" ")[0] + "!";
  mostrarTela("tela-app");
  await atualizarTudo();
}

/* --------------------------------------------------- */
/* Navegação entre abas do app                          */
/* --------------------------------------------------- */
document.querySelectorAll(".menu-item").forEach((botao) => {
  botao.addEventListener("click", () => {
    document.querySelectorAll(".menu-item").forEach((b) => b.classList.remove("ativo"));
    botao.classList.add("ativo");

    const aba = botao.dataset.aba;
    document.querySelectorAll(".aba").forEach((secao) => secao.classList.add("hidden"));
    document.getElementById("aba-" + aba).classList.remove("hidden");
  });
});

/* --------------------------------------------------- */
/* Navegador de dia (aba Tarefas)                        */
/* --------------------------------------------------- */
async function irParaDia(deltaDias) {
  const novaData = deslocarData(dataSelecionadaTarefas, deltaDias);
  if (novaData < dataDeHoje()) return; // dias passados não ficam salvos
  dataSelecionadaTarefas = novaData;
  document.getElementById("tarefa-data").value = dataSelecionadaTarefas;
  atualizarNavegadorData();
  await renderizarListaDeTarefas();
}

function atualizarNavegadorData() {
  document.getElementById("rotulo-dia-tarefas").textContent = formatarRotuloData(dataSelecionadaTarefas);
  document.getElementById("btn-dia-anterior").disabled = dataSelecionadaTarefas <= dataDeHoje();
}

document.getElementById("btn-dia-anterior").addEventListener("click", () => irParaDia(-1));
document.getElementById("btn-dia-proximo").addEventListener("click", () => irParaDia(1));

/* --------------------------------------------------- */
/* TAREFAS                                               */
/* --------------------------------------------------- */
document.getElementById("tarefa-data").value = dataSelecionadaTarefas;

document.getElementById("form-nova-tarefa").addEventListener("submit", async (evento) => {
  evento.preventDefault();

  const novaTarefa = {
    titulo: document.getElementById("tarefa-titulo").value,
    data: document.getElementById("tarefa-data").value,
    hora: document.getElementById("tarefa-hora").value,
    categoria: document.getElementById("tarefa-categoria").value,
    prioridade: document.getElementById("tarefa-prioridade").value,
    fixa: document.getElementById("tarefa-fixa").checked,
  };

  try {
    await chamarApi("/tarefas", { method: "POST", body: JSON.stringify(novaTarefa) });
    evento.target.reset();
    document.getElementById("tarefa-data").value = dataSelecionadaTarefas;
    document.getElementById("tarefa-hora").value = "09:00";
    await atualizarTudo();
  } catch (erro) {
    alert(erro.message);
  }
});

async function alternarConclusaoTarefa(id, dataContexto) {
  try {
    await chamarApi(`/tarefas/${id}/concluir?data=${dataContexto}`, { method: "PATCH" });
    await atualizarTudo();
  } catch (erro) {
    alert(erro.message);
    await atualizarTudo(); // desfaz o clique visualmente
  }
}

async function excluirTarefa(id) {
  try {
    await chamarApi(`/tarefas/${id}`, { method: "DELETE" });
    await atualizarTudo();
  } catch (erro) {
    alert(erro.message);
  }
}

// dataContexto = dia sendo exibido (importante para tarefas fixas,
// já que a API resolve "concluída" por dia).
function criarItemTarefa(tarefa, dataContexto) {
  const item = document.createElement("li");
  item.className = "item-tarefa" + (tarefa.concluida ? " concluida" : "");
  item.style.setProperty("--cor-cat", CORES[tarefa.categoria] || CORES.ember);

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = tarefa.concluida;
  checkbox.addEventListener("change", () => alternarConclusaoTarefa(tarefa.id, dataContexto));

  const corpo = document.createElement("div");
  corpo.className = "corpo-tarefa";
  corpo.innerHTML = `
    <div class="titulo-tarefa">${escaparTexto(tarefa.titulo)}</div>
    <div class="meta-tarefa">
      <span>${tarefa.fixa ? "Todos os dias" : tarefa.data} às ${tarefa.hora}</span>
      <span class="selo-prioridade" style="color:${CORES_PRIORIDADE[tarefa.prioridade]};background:${CORES_PRIORIDADE[tarefa.prioridade]}22">${NOMES_PRIORIDADE[tarefa.prioridade]}</span>
      ${tarefa.fixa ? '<span class="selo-fixa">Fixa</span>' : ""}
    </div>
  `;

  const botaoExcluir = document.createElement("button");
  botaoExcluir.className = "btn-excluir";
  botaoExcluir.textContent = "Excluir";
  botaoExcluir.addEventListener("click", () => excluirTarefa(tarefa.id));

  item.appendChild(checkbox);
  item.appendChild(corpo);
  item.appendChild(botaoExcluir);
  return item;
}

async function renderizarListaDeTarefas() {
  const lista = document.getElementById("lista-todas-tarefas");
  try {
    const tarefasDoDia = await chamarApi(`/tarefas?data=${dataSelecionadaTarefas}`);
    tarefasDoDia.sort((a, b) => a.hora.localeCompare(b.hora));

    lista.innerHTML = "";
    if (tarefasDoDia.length === 0) {
      lista.innerHTML = `<p class="texto-suave">Nenhuma tarefa para este dia ainda.</p>`;
      return;
    }
    tarefasDoDia.forEach((tarefa) => lista.appendChild(criarItemTarefa(tarefa, dataSelecionadaTarefas)));
  } catch (erro) {
    lista.innerHTML = `<p class="texto-suave">${escaparTexto(erro.message)}</p>`;
  }
}

/* --------------------------------------------------- */
/* HÁBITOS                                               */
/* --------------------------------------------------- */
document.getElementById("form-novo-habito").addEventListener("submit", async (evento) => {
  evento.preventDefault();

  const novoHabito = {
    nome: document.getElementById("habito-nome").value,
    cor: document.getElementById("habito-cor").value,
  };

  try {
    await chamarApi("/habitos", { method: "POST", body: JSON.stringify(novoHabito) });
    evento.target.reset();
    await atualizarTudo();
  } catch (erro) {
    alert(erro.message);
  }
});

async function marcarHabitoHoje(id) {
  try {
    await chamarApi(`/habitos/${id}/marcar`, { method: "POST" });
    await atualizarTudo();
  } catch (erro) {
    alert(erro.message);
  }
}

async function excluirHabito(id) {
  try {
    await chamarApi(`/habitos/${id}`, { method: "DELETE" });
    await atualizarTudo();
  } catch (erro) {
    alert(erro.message);
  }
}

// A API já devolve feitoHoje e streak calculados — o front só desenha.
function criarCartaoHabito(habito) {
  const cartao = document.createElement("div");
  cartao.className = "cartao-habito";
  cartao.innerHTML = `
    <div class="cabecalho-habito">
      <span class="nome-habito">
        <span class="bolinha-cor" style="background:${CORES[habito.cor]}"></span>
        ${escaparTexto(habito.nome)}
      </span>
      <button class="btn-excluir" data-acao="excluir-habito">Excluir</button>
    </div>
    <div class="linha-acoes-habito">
      <button class="btn-marcar ${habito.feitoHoje ? "feito" : ""}" data-acao="marcar-habito">
        ${habito.feitoHoje ? "✓ Feito hoje" : "Marcar hoje"}
      </button>
      <span class="streak-texto">🔥 ${habito.streak} dia${habito.streak === 1 ? "" : "s"} seguidos</span>
    </div>
  `;

  cartao.querySelector("[data-acao='marcar-habito']").addEventListener("click", () => marcarHabitoHoje(habito.id));
  cartao.querySelector("[data-acao='excluir-habito']").addEventListener("click", () => excluirHabito(habito.id));

  return cartao;
}

async function renderizarHabitos() {
  const lista = document.getElementById("lista-habitos");
  try {
    const habitos = await chamarApi("/habitos");
    lista.innerHTML = "";
    if (habitos.length === 0) {
      lista.innerHTML = `<p class="texto-suave">Nenhum hábito cadastrado ainda.</p>`;
      return;
    }
    habitos.forEach((habito) => lista.appendChild(criarCartaoHabito(habito)));
  } catch (erro) {
    lista.innerHTML = `<p class="texto-suave">${escaparTexto(erro.message)}</p>`;
  }
}

/* --------------------------------------------------- */
/* DASHBOARD (resumo)                                    */
/* --------------------------------------------------- */
async function renderizarDashboard() {
  const lista = document.getElementById("lista-tarefas-hoje");
  try {
    const { resumo, tarefasHoje } = await chamarApi("/dashboard");

    document.getElementById("resumo-tarefas-hoje").textContent = resumo.porcentagem + "%";
    document.getElementById("resumo-tarefas-detalhe").textContent = `${resumo.concluidasHoje}/${resumo.totalTarefasHoje} concluídas`;
    document.getElementById("resumo-total-habitos").textContent = resumo.totalHabitos;

    lista.innerHTML = "";
    if (tarefasHoje.length === 0) {
      lista.innerHTML = `<p class="texto-suave">Nenhuma tarefa para hoje. Vá até a aba Tarefas para adicionar.</p>`;
    } else {
      tarefasHoje.forEach((tarefa) => lista.appendChild(criarItemTarefa(tarefa, dataDeHoje())));
    }
  } catch (erro) {
    lista.innerHTML = `<p class="texto-suave">${escaparTexto(erro.message)}</p>`;
  }
}

/* --------------------------------------------------- */
/* PERFIL                                                */
/* --------------------------------------------------- */
document.getElementById("form-perfil").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const nome = document.getElementById("perfil-nome").value || "Você";
  document.getElementById("saudacao").textContent = "Olá, " + nome.split(" ")[0] + "!";
  alert("A edição de perfil ainda não é salva no servidor — isso fica pra uma próxima etapa.");
});

/* --------------------------------------------------- */
/* Função auxiliar: evitar HTML malicioso em textos      */
/* --------------------------------------------------- */
function escaparTexto(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

/* --------------------------------------------------- */
/* Atualiza todas as telas que dependem dos dados        */
/* --------------------------------------------------- */
async function atualizarTudo() {
  await Promise.all([renderizarDashboard(), renderizarListaDeTarefas(), renderizarHabitos()]);
  atualizarNavegadorData();
}

/* --------------------------------------------------- */
/* Inicialização — reaproveita sessão salva, se houver    */
/* --------------------------------------------------- */
atualizarNavegadorData();

(async function iniciar() {
  const tokenSalvo = localStorage.getItem(CHAVE_TOKEN);
  const usuarioSalvo = localStorage.getItem(CHAVE_USUARIO);
  if (!tokenSalvo || !usuarioSalvo) return;

  try {
    const usuario = JSON.parse(usuarioSalvo);
    await entrarNoApp(usuario.nome);
  } catch {
    sair();
  }
})();