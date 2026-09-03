// Cores disponíveis para categorias e hábitos
const CORES = {
  ember: "#E3A23C",
  moss: "#4FA79E",
  honey: "#C9A24E",
  indigo: "#8B8FC4",
  plum: "#C97B95",
};

// Cor de cada nível de prioridade
const CORES_PRIORIDADE = { alta: "#D97B4F", media: "#E3A23C", baixa: "#6E8F8B" };
const NOMES_PRIORIDADE = { alta: "Alta", media: "Média", baixa: "Baixa" };

// "Banco de dados" em memória
let tarefas = [
  { id: 1, titulo: "Reunião de alinhamento", data: dataDeHoje(), hora: "09:00", categoria: "indigo", prioridade: "alta", concluida: false },
  { id: 2, titulo: "Corrida no parque", data: dataDeHoje(), hora: "18:00", categoria: "moss", prioridade: "media", concluida: false },
  { id: 3, titulo: "Pagar contas", data: dataDeHoje(), hora: "20:00", categoria: "honey", prioridade: "media", concluida: false },
];

let habitos = [
  { id: 1, nome: "Beber 2L de água", cor: "moss", historico: {} },
  { id: 2, nome: "Ler 20 minutos", cor: "indigo", historico: {} },
];

let proximoIdTarefa = 4;
let proximoIdHabito = 3;


/* Funções utilitárias de data                        */
function dataDeHoje() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}


/* Navegação entre telas (login / cadastro / app)        */
function mostrarTela(idTela) {
  document.querySelectorAll(".tela").forEach((tela) => tela.classList.add("hidden"));
  document.getElementById(idTela).classList.remove("hidden");
}

document.getElementById("btn-ir-cadastro").addEventListener("click", () => mostrarTela("tela-cadastro"));
document.getElementById("btn-ir-login").addEventListener("click", () => mostrarTela("tela-login"));

document.getElementById("form-login").addEventListener("submit", (evento) => {
  evento.preventDefault();
  entrarNoApp("Você");
});

document.getElementById("form-cadastro").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const nome = document.getElementById("cadastro-nome").value || "Você";
  entrarNoApp(nome);
});

document.getElementById("btn-sair").addEventListener("click", () => {
  mostrarTela("tela-login");
});

function entrarNoApp(nome) {
  document.getElementById("perfil-nome").value = nome;
  document.getElementById("saudacao").textContent = "Olá, " + nome.split(" ")[0] + "!";
  mostrarTela("tela-app");
  atualizarTudo();
}


/* Navegação entre abas do app                          */
document.querySelectorAll(".menu-item").forEach((botao) => {
  botao.addEventListener("click", () => {
    // marca o botão clicado como ativo
    document.querySelectorAll(".menu-item").forEach((b) => b.classList.remove("ativo"));
    botao.classList.add("ativo");

    // mostra só a aba correspondente
    const aba = botao.dataset.aba;
    document.querySelectorAll(".aba").forEach((secao) => secao.classList.add("hidden"));
    document.getElementById("aba-" + aba).classList.remove("hidden");
  });
});


/* TAREFAS                                               */
document.getElementById("tarefa-data").value = dataDeHoje();

document.getElementById("form-nova-tarefa").addEventListener("submit", (evento) => {
  evento.preventDefault();

  const novaTarefa = {
    id: proximoIdTarefa++,
    titulo: document.getElementById("tarefa-titulo").value,
    data: document.getElementById("tarefa-data").value,
    hora: document.getElementById("tarefa-hora").value,
    categoria: document.getElementById("tarefa-categoria").value,
    prioridade: document.getElementById("tarefa-prioridade").value,
    concluida: false,
  };
  tarefas.push(novaTarefa);

  evento.target.reset();
  document.getElementById("tarefa-data").value = dataDeHoje();

  atualizarTudo();
});

function alternarConclusaoTarefa(id) {
  const tarefa = tarefas.find((t) => t.id === id);
  if (tarefa) tarefa.concluida = !tarefa.concluida;
  atualizarTudo();
}

function excluirTarefa(id) {
  tarefas = tarefas.filter((t) => t.id !== id);
  atualizarTudo();
}

// Cria o elemento <li> de uma tarefa
function criarItemTarefa(tarefa) {
  const item = document.createElement("li");
  item.className = "item-tarefa" + (tarefa.concluida ? " concluida" : "");
  item.style.setProperty("--cor-cat", CORES[tarefa.categoria] || CORES.ember);

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = tarefa.concluida;
  checkbox.addEventListener("change", () => alternarConclusaoTarefa(tarefa.id));

  const corpo = document.createElement("div");
  corpo.className = "corpo-tarefa";
  corpo.innerHTML = `
    <div class="titulo-tarefa">${escaparTexto(tarefa.titulo)}</div>
    <div class="meta-tarefa">
      <span>${tarefa.data} às ${tarefa.hora}</span>
      <span class="selo-prioridade" style="color:${CORES_PRIORIDADE[tarefa.prioridade]};background:${CORES_PRIORIDADE[tarefa.prioridade]}22">${NOMES_PRIORIDADE[tarefa.prioridade]}</span>
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

function renderizarListaDeTarefas() {
  const lista = document.getElementById("lista-todas-tarefas");
  lista.innerHTML = "";

  const tarefasOrdenadas = [...tarefas].sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));

  if (tarefasOrdenadas.length === 0) {
    lista.innerHTML = `<p class="texto-suave">Nenhuma tarefa cadastrada ainda.</p>`;
    return;
  }
  tarefasOrdenadas.forEach((tarefa) => lista.appendChild(criarItemTarefa(tarefa)));
}


/* HÁBITOS                                               */
document.getElementById("form-novo-habito").addEventListener("submit", (evento) => {
  evento.preventDefault();

  const novoHabito = {
    id: proximoIdHabito++,
    nome: document.getElementById("habito-nome").value,
    cor: document.getElementById("habito-cor").value,
    historico: {},
  };
  habitos.push(novoHabito);

  evento.target.reset();
  atualizarTudo();
});

function marcarHabitoHoje(id) {
  const habito = habitos.find((h) => h.id === id);
  if (!habito) return;
  const hoje = dataDeHoje();
  habito.historico[hoje] = !habito.historico[hoje];
  atualizarTudo();
}

function excluirHabito(id) {
  habitos = habitos.filter((h) => h.id !== id);
  atualizarTudo();
}

// Calcula quantos dias seguidos (até hoje) o hábito foi cumprido
function calcularStreak(habito) {
  let streak = 0;
  let dataAtual = new Date();
  while (true) {
    const ano = dataAtual.getFullYear();
    const mes = String(dataAtual.getMonth() + 1).padStart(2, "0");
    const dia = String(dataAtual.getDate()).padStart(2, "0");
    const chave = `${ano}-${mes}-${dia}`;
    if (habito.historico[chave]) {
      streak++;
      dataAtual.setDate(dataAtual.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function criarCartaoHabito(habito) {
  const hoje = dataDeHoje();
  const feitoHoje = !!habito.historico[hoje];
  const streak = calcularStreak(habito);

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
      <button class="btn-marcar ${feitoHoje ? "feito" : ""}" data-acao="marcar-habito">
        ${feitoHoje ? "✓ Feito hoje" : "Marcar hoje"}
      </button>
      <span class="streak-texto">🔥 ${streak} dia${streak === 1 ? "" : "s"} seguidos</span>
    </div>
  `;

  cartao.querySelector("[data-acao='marcar-habito']").addEventListener("click", () => marcarHabitoHoje(habito.id));
  cartao.querySelector("[data-acao='excluir-habito']").addEventListener("click", () => excluirHabito(habito.id));

  return cartao;
}

function renderizarHabitos() {
  const lista = document.getElementById("lista-habitos");
  lista.innerHTML = "";

  if (habitos.length === 0) {
    lista.innerHTML = `<p class="texto-suave">Nenhum hábito cadastrado ainda.</p>`;
    return;
  }
  habitos.forEach((habito) => lista.appendChild(criarCartaoHabito(habito)));
}


/* DASHBOARD (resumo)                                    */
function renderizarDashboard() {
  const hoje = dataDeHoje();
  const tarefasHoje = tarefas.filter((t) => t.data === hoje);
  const concluidasHoje = tarefasHoje.filter((t) => t.concluida).length;
  const porcentagem = tarefasHoje.length ? Math.round((concluidasHoje / tarefasHoje.length) * 100) : 0;

  document.getElementById("resumo-tarefas-hoje").textContent = porcentagem + "%";
  document.getElementById("resumo-tarefas-detalhe").textContent = `${concluidasHoje}/${tarefasHoje.length} concluídas`;
  document.getElementById("resumo-total-habitos").textContent = habitos.length;

  const lista = document.getElementById("lista-tarefas-hoje");
  lista.innerHTML = "";
  if (tarefasHoje.length === 0) {
    lista.innerHTML = `<p class="texto-suave">Nenhuma tarefa para hoje. Aproveite o dia livre.</p>`;
  } else {
    tarefasHoje.forEach((tarefa) => lista.appendChild(criarItemTarefa(tarefa)));
  }
}


/* PERFIL                                                */
document.getElementById("form-perfil").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const nome = document.getElementById("perfil-nome").value || "Você";
  document.getElementById("saudacao").textContent = "Olá, " + nome.split(" ")[0] + "!";
  alert("Perfil atualizado!");
});

/* Função auxiliar: evitar HTML malicioso em textos      */
function escaparTexto(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}


/* Atualiza todas as telas que dependem dos dados        */
function atualizarTudo() {
  renderizarDashboard();
  renderizarListaDeTarefas();
  renderizarHabitos();
}