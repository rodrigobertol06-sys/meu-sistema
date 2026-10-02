// Interface do sistema: desenha as abas, liga os campos aos dados e salva.
import { calcular, somarDias, TIPOS_INVESTIMENTO } from "./calc.js";
import { dadosPadrao, migrar, novoId } from "./dados.js";
import * as mercadoApi from "./mercado.js";

const CHAVE_LOCAL = "meu-sistema:dados";

const conteudo = document.getElementById("conteudo");
const seletorCenario = document.getElementById("cenarioAtivo");
const statusEl = document.getElementById("status");

let dados = migrar(lerLocal() || dadosPadrao());
let abaAtual = "painel";
let nuvem = null; // módulo js/nuvem.js, carregado se o Firebase estiver disponível
let usuario = null;
let timerNuvem = null;
const mercado = { taxas: null, marcas: null, modelos: null, anos: null, sel: {}, preco: null, erro: "" };

// ---------- Formatação ----------

const fmtMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

const brl = (v) => fmtMoeda.format(Number(v) || 0);
const pct = (v) => fmtPct.format(Number(v) || 0);
const num = (v) => fmtNum.format(Number(v) || 0);
const sinal = (v) => (v < 0 ? "negativo" : "positivo");
const dataBR = (iso) => (iso ? iso.split("-").reverse().join("/") : "");

function esc(texto) {
    return String(texto ?? "").replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// ---------- Dados ----------

function lerLocal() {
    try {
        const texto = localStorage.getItem(CHAVE_LOCAL);
        return texto ? JSON.parse(texto) : null;
    } catch {
        return null;
    }
}

const cenario = () => dados.cenarios.find((c) => c.id === dados.cenarioAtivo) || dados.cenarios[0];

function salvar() {
    dados.atualizadoEm = Date.now();
    try {
        localStorage.setItem(CHAVE_LOCAL, JSON.stringify(dados));
    } catch {
        // Sem espaço ou navegação privada: segue só com a nuvem.
    }
    if (!nuvem || !usuario) return;
    clearTimeout(timerNuvem);
    mostrarStatus("Salvando…");
    timerNuvem = setTimeout(async () => {
        try {
            await nuvem.salvarNuvem(dados);
            mostrarStatus("Salvo na nuvem");
        } catch (erro) {
            console.error(erro);
            mostrarStatus("Erro na nuvem — salvo no aparelho", true);
        }
    }, 1200);
}

function mostrarStatus(texto, erro = false) {
    statusEl.textContent = texto;
    statusEl.classList.toggle("erro", erro);
}

// Caminho como "gastos.ab12cd.valor": em listas, o trecho é o id (ou o nome) do item.
function acharNoCaminho(raiz, partes) {
    let atual = raiz;
    for (const parte of partes) {
        if (atual == null) return undefined;
        atual = Array.isArray(atual) ? atual.find((x) => x.id === parte || x.nome === parte) : atual[parte];
    }
    return atual;
}

function definir(raiz, caminho, valor) {
    const partes = caminho.split(".");
    const campo = partes.pop();
    const alvo = acharNoCaminho(raiz, partes);
    if (alvo) alvo[campo] = valor;
}

// ---------- Componentes de HTML ----------

function campo({ rotulo, caminho, valor, tipo = "num", raiz = "c", passo = "any", extra = "" }) {
    const attr = `data-${raiz}="${caminho}" data-tipo="${tipo}" ${extra}`;
    let input;
    if (tipo === "bool") {
        return `<label class="check"><input type="checkbox" ${attr} ${valor ? "checked" : ""}> ${rotulo}</label>`;
    } else if (tipo === "num") {
        input = `<input type="number" inputmode="decimal" step="${passo}" value="${valor ?? ""}" ${attr}>`;
    } else if (tipo === "data") {
        input = `<input type="date" value="${esc(valor)}" ${attr}>`;
    } else {
        input = `<input type="text" value="${esc(valor)}" ${attr}>`;
    }
    return rotulo ? `<label class="campo"><span>${rotulo}</span>${input}</label>` : input;
}

function selecao({ rotulo, caminho, valor, opcoes, raiz = "c", extra = "" }) {
    const ops = opcoes.map((o) => `<option ${o === valor ? "selected" : ""}>${esc(o)}</option>`).join("");
    const sel = `<select data-${raiz}="${caminho}" data-tipo="texto" ${extra}>${ops}</select>`;
    return rotulo ? `<label class="campo"><span>${rotulo}</span>${sel}</label>` : sel;
}

const botao = (texto, acao, params = "", classe = "") =>
    `<button type="button" class="${classe}" data-acao="${acao}" ${params}>${texto}</button>`;

const remover = (colecao, id) =>
    botao("✕", "remover", `data-colecao="${colecao}" data-id="${id}" aria-label="Remover" title="Remover"`, "remover");

function bloco(rotulo, valor, { destaque = false, tom = "", nota = "" } = {}) {
    return `<div class="bloco ${destaque ? "destaque" : ""} ${tom}">
        <span class="bloco-rotulo">${rotulo}</span>
        <strong class="bloco-valor">${valor}</strong>
        ${nota ? `<span class="bloco-nota">${nota}</span>` : ""}
    </div>`;
}

const cartao = (titulo, corpo, acoes = "") =>
    `<section class="cartao"><div class="cartao-topo"><h2>${titulo}</h2>${acoes}</div>${corpo}</section>`;

const tabela = (cabecalho, linhas, rodape = "") => `<div class="tabela-scroll"><table>
    <thead><tr>${cabecalho.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${linhas.join("")}</tbody>${rodape ? `<tfoot>${rodape}</tfoot>` : ""}</table></div>`;

// Lista editável de { nome, valor } (renda, gastos, itens de aquisição)
function listaNomeValor(colecao, itens) {
    if (!itens.length) return `<p class="vazio">Nenhum item ainda.</p>`;
    return `<div class="lista">${itens.map((i) => `<div class="lista-linha">
        ${campo({ caminho: `${colecao}.${i.id}.nome`, valor: i.nome, tipo: "texto" })}
        ${campo({ caminho: `${colecao}.${i.id}.valor`, valor: i.valor })}
        ${remover(colecao, i.id)}
    </div>`).join("")}</div>`;
}

// ---------- Abas ----------

function abaPainel(c, r) {
    const alertas = [];
    if (r.saldoDisponivel < 0) alertas.push(`As aquisições passam o valor para consumo em <b>${brl(-r.saldoDisponivel)}</b>.`);
    if (Math.abs(r.invest.naoAlocado) > 0.5) alertas.push(`${r.invest.naoAlocado > 0 ? "Sobram" : "Faltam"} <b>${brl(Math.abs(r.invest.naoAlocado))}</b> do saldo aplicável para distribuir nos investimentos.`);
    r.invest.linhas.filter((l) => l.ajustarRetirada).forEach((l) =>
        alertas.push(`O salário tirado de <b>${esc(l.nome)}</b> (${brl(l.retirada)}/mês) é maior que o rendimento (${brl(l.rendimentoMensal)}/mês). Ajuste a retirada.`));
    if (r.fluxo.saldo < 0) alertas.push(`Os gastos mensais passam as entradas em <b>${brl(-r.fluxo.saldo)}</b>/mês.`);

    const grupos = r.aquisicoes.grupos.filter((g) => g.total > 0).sort((a, b) => b.total - a.total);
    const maior = grupos[0]?.total || 1;
    const barras = grupos.map((g) => `<div class="barra-linha" title="${esc(g.nome)}: ${brl(g.total)} (${pct(g.total / r.aquisicoes.total)})">
        <span class="barra-nome">${esc(g.nome)}</span>
        <span class="barra-trilho"><span class="barra" style="width:${(g.total / maior) * 100}%"></span></span>
        <span class="barra-valor">${brl(g.total)}</span>
    </div>`).join("");

    return `
    ${alertas.length ? `<section class="alertas">${alertas.map((a) => `<p>⚠️ ${a}</p>`).join("")}</section>` : ""}
    ${cartao("Valores", `<div class="blocos">
        ${bloco("À receber", brl(r.valores.aReceber))}
        ${bloco(`Para consumo (${num(c.valores.pctConsumir)}%)`, brl(r.valores.paraConsumo))}
        ${bloco("Saldo aplicável", brl(r.valores.aplicavel))}
        ${bloco("Saldo consumido", brl(r.saldoConsumido), { nota: "total das aquisições" })}
        ${bloco("Saldo disponível", brl(r.saldoDisponivel), { destaque: true, tom: sinal(r.saldoDisponivel) })}
    </div>`)}
    ${cartao("Fluxo mensal", `<div class="blocos">
        ${bloco("Entradas", brl(r.fluxo.entradas), { nota: "renda + retiradas dos investimentos" })}
        ${bloco("Saídas", brl(r.fluxo.saidas), { nota: "gastos fixos + carros" })}
        ${bloco("Saldo do mês", brl(r.fluxo.saldo), { destaque: true, tom: sinal(r.fluxo.saldo) })}
    </div>`)}
    ${cartao("Projeção dos investimentos", tabela(["", "Lucro", "Lucro %", "Saldo final"], [
        `<tr><th>Esperado <small>(no vencimento)</small></th><td>${brl(r.invest.esperado.lucro)}</td><td>${pct(r.invest.esperado.pct)}</td><td>${brl(r.invest.esperado.saldo)}</td></tr>`,
        `<tr><th>Real <small>(lucro − salário)</small></th><td>${brl(r.invest.real.lucro)}</td><td>${pct(r.invest.real.pct)}</td><td>${brl(r.invest.real.saldo)}</td></tr>`,
        ...(r.invest.renovacoes ? [`<tr><th>Após renovações <small>(até ${dataBR(r.invest.renovacoes.ultimoVencimento)})</small></th><td colspan="2">salários separados: ${brl(r.invest.renovacoes.salarioReservado)}</td><td>${brl(r.invest.renovacoes.saldoFinal)}</td></tr>`] : []),
    ]))}
    ${cartao("Para onde vai o dinheiro (aquisições)", grupos.length ? `<div class="barras">${barras}</div>
        <p class="total-linha">Total: <b>${brl(r.aquisicoes.total)}</b></p>` : `<p class="vazio">Nenhuma aquisição cadastrada.</p>`)}
    `;
}

function abaRenda(c, r) {
    const gastosCarro = r.fluxo.gastosCarro.map((g) =>
        `<div class="lista-linha auto"><span>${g.nome}</span><span>${brl(g.valor)}</span><span class="dica">auto</span></div>`).join("");
    return `
    ${cartao("Valores a receber", `<div class="grade">
        ${campo({ rotulo: "Valor a receber (R$)", caminho: "valores.aReceber", valor: c.valores.aReceber })}
        ${campo({ rotulo: "% para consumir", caminho: "valores.pctConsumir", valor: c.valores.pctConsumir })}
    </div>
    <div class="blocos">
        ${bloco("Para consumo", brl(r.valores.paraConsumo))}
        ${bloco("Saldo aplicável", brl(r.valores.aplicavel))}
    </div>`)}
    ${cartao("Renda mensal", `
        <div class="grade">${campo({ rotulo: "Salário base (R$) — usado nos multiplicadores de retirada", caminho: "renda.salarioBase", valor: c.renda.salarioBase })}</div>
        ${listaNomeValor("renda.itens", c.renda.itens)}
        <div class="lista-linha auto"><span>Retiradas dos investimentos</span><span>${brl(r.invest.retiradaMensal)}</span><span class="dica">auto</span></div>
        <p class="total-linha">Entradas: <b>${brl(r.fluxo.entradas)}</b></p>`,
        botao("+ Renda", "adicionar", `data-colecao="renda.itens"`))}
    ${cartao("Gastos mensais", `
        ${listaNomeValor("gastos", c.gastos)}
        ${gastosCarro}
        <p class="total-linha">Saídas: <b>${brl(r.fluxo.saidas)}</b> · Saldo do mês: <b class="${sinal(r.fluxo.saldo)}">${brl(r.fluxo.saldo)}</b></p>`,
        botao("+ Gasto", "adicionar", `data-colecao="gastos"`))}
    `;
}

function abaAquisicoes(c, r) {
    const cartoes = r.aquisicoes.grupos.map((g) => {
        if (g.automatico) {
            const nota = g.nome === "Carros"
                ? `Soma do valor de compra dos carros da aba <b>Carros</b>.`
                : `Total que será retirado dos investimentos para renda até o fim das aplicações (aba <b>Investimentos</b>).`;
            return cartao(`${g.nome} <span class="valor-titulo">${brl(g.total)}</span>`, `<p class="dica">${nota}</p>`);
        }
        const taxa = g.nome === "Imóveis" ? `<div class="grade">
            ${campo({ rotulo: "Taxas de compra (ITBI, escritura…) %", caminho: "taxaImoveis", valor: c.taxaImoveis })}
            </div><p class="dica">Taxas: ${brl(g.extra)}</p>` : "";
        return cartao(`${g.nome} <span class="valor-titulo">${brl(g.total)}</span>`,
            listaNomeValor("aquisicoes", g.itens) + taxa,
            botao("+ Item", "adicionar", `data-colecao="aquisicoes" data-grupo="${g.nome}"`));
    }).join("");
    return `<div class="blocos fixo">
        ${bloco("Total das aquisições", brl(r.aquisicoes.total))}
        ${bloco("Disponível para consumo", brl(r.saldoDisponivel), { destaque: true, tom: sinal(r.saldoDisponivel) })}
    </div>${cartoes}`;
}

function abaInvestimentos(c, r) {
    const modos = [["fixo", "Valor fixo (R$)"], ["pct", "% do saldo aplicável"], ["restante", "O que sobrar do saldo"]];

    const cartoes = r.invest.linhas.map((l) => {
        const base = `investimentos.${l.id}`;
        const campoValor = l.modo === "fixo"
            ? campo({ rotulo: "Valor aplicado (R$)", caminho: `${base}.valor`, valor: l.valor })
            : l.modo === "pct"
                ? campo({ rotulo: `% do saldo aplicável (= ${brl(l.valor)})`, caminho: `${base}.pct`, valor: l.pct })
                : `<label class="campo"><span>Valor aplicado</span><input type="text" value="${brl(l.valor)}" disabled></label>`;
        const form = `<div class="grade">
            ${campo({ rotulo: "Nome (ex.: Poupança Caixa)", caminho: `${base}.nome`, valor: l.nome, tipo: "texto" })}
            ${selecao({ rotulo: "Tipo", caminho: `${base}.tipo`, valor: l.tipo, opcoes: TIPOS_INVESTIMENTO.map((t) => t.nome), extra: `data-preset="${l.id}"` })}
            ${campo({ rotulo: "Início", caminho: `${base}.inicio`, valor: l.inicio, tipo: "data" })}
            ${campo({ rotulo: "Vencimento", caminho: `${base}.fim`, valor: l.fim, tipo: "data" })}
            ${campo({ rotulo: "Rentabilidade (% ao ano)", caminho: `${base}.taxa`, valor: l.taxa })}
            ${campo({ rotulo: "Taxa de custódia (% ao ano)", caminho: `${base}.custodia`, valor: l.custodia })}
            <label class="campo"><span>Como definir o valor</span><select data-c="${base}.modo" data-tipo="texto">
                ${modos.map(([v, t]) => `<option value="${v}" ${v === l.modo ? "selected" : ""}>${t}</option>`).join("")}
            </select></label>
            ${campoValor}
            ${campo({ rotulo: `Salário: quantos × salário base (${brl(c.renda.salarioBase)})`, caminho: `${base}.multiplicador`, valor: l.multiplicador })}
        </div>
        <div class="checks">
            ${campo({ rotulo: "Isento de IR (poupança, LCI, LCA)", caminho: `${base}.isento`, valor: l.isento, tipo: "bool" })}
        </div>`;

        const detalhes = tabela(["Item", "Valor"], [
            ["Parte do saldo aplicável", pct(l.divisor)],
            ["Duração", `${l.dias} dias · ${num(l.meses)} meses · ${num(l.anos)} anos`],
            ["Lucro bruto", brl(l.lucroBruto)],
            [`Imposto de renda (${num(l.ir)}%)`, brl(-l.imposto)],
            ["Custódia", brl(-l.valorCustodia)],
            ["Lucro líquido", `<b>${brl(l.lucroLiquido)}</b> (${pct(l.lucroPct)})`],
            ["Saldo no vencimento", `<b>${brl(l.saldoFinal)}</b>`],
            ["Salário do período (separado antes)", brl(l.totalRetirado)],
            ["Lucro real (lucro − salário)", `<span class="${sinal(l.lucroReaplicar)}">${brl(l.lucroReaplicar)}</span> (${pct(l.pctReaplicado)} do lucro)`],
        ].map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`));

        const renovacoes = l.ciclos.slice(1).map((ci) => {
            const rb = `${base}.renovacoes.${ci.id}`;
            const ren = l.renovacoes.find((x) => x.id === ci.id);
            return `<div class="ciclo">
                <div class="cartao-topo"><h3>${ci.numero}º período · ${dataBR(ci.inicio)} → ${dataBR(ci.fim)}</h3>
                    ${remover(`${base}.renovacoes`, ci.id)}</div>
                <div class="grade">
                    ${campo({ rotulo: "Novo vencimento", caminho: `${rb}.fim`, valor: ren.fim, tipo: "data" })}
                    ${campo({ rotulo: "Rentabilidade (% ao ano)", caminho: `${rb}.taxa`, valor: ren.taxa })}
                    ${campo({ rotulo: "Salário (× salário base)", caminho: `${rb}.multiplicador`, valor: ren.multiplicador })}
                    ${campo({ rotulo: "Aporte (+) ou resgate (−) extra", caminho: `${rb}.aporte`, valor: ren.aporte })}
                </div>
                <p class="conta">Resgatado ${brl(ci.resgatado)} − salário do período ${brl(ci.reservaSalario)}${ci.aporte ? ` ${ci.aporte > 0 ? "+" : "−"} ${brl(Math.abs(ci.aporte))}` : ""}
                    = <b>reaplicar ${brl(ci.valor)}</b></p>
                ${ci.faltaParaSalario ? `<p class="negativo">⚠️ O saldo não cobre o salário do período: faltam ${brl(ci.faltaParaSalario)}.</p>` : ""}
                ${resumoMes(ci)}
                <p class="dica">${ci.dias} dias · IR ${num(ci.ir)}% · saldo no vencimento <b>${brl(ci.saldoFinal)}</b></p>
            </div>`;
        }).join("");

        return cartao(`${esc(l.nome)} <span class="valor-titulo">${esc(l.tipo)} · ${brl(l.valor)}</span>`, `
            ${form}
            ${resumoMes(l)}
            <details><summary>Detalhes do período (${dataBR(l.inicio)} → ${dataBR(l.fim)})</summary>${detalhes}</details>
            ${renovacoes ? `<h3 class="subtitulo">Renovações</h3>${renovacoes}` : ""}
            <div class="acoes-fim">${botao("↻ Renovar no vencimento", "renovar", `data-id="${l.id}"`)}</div>`,
            remover("investimentos", l.id));
    }).join("");

    const ren = r.invest.renovacoes;
    return `<div class="blocos fixo">
        ${bloco("Saldo aplicável", brl(r.valores.aplicavel))}
        ${bloco("Aplicado", brl(r.invest.totalAplicado), { tom: Math.abs(r.invest.naoAlocado) > 0.5 ? "negativo" : "", nota: Math.abs(r.invest.naoAlocado) > 0.5 ? `${r.invest.naoAlocado > 0 ? "sobram" : "faltam"} ${brl(Math.abs(r.invest.naoAlocado))}` : "" })}
        ${bloco("Rende por mês", brl(r.invest.rendimentoMensal))}
        ${bloco("Salário por mês", brl(r.invest.retiradaMensal))}
        ${bloco("Sobra por mês", brl(r.invest.rendimentoMensal - r.invest.retiradaMensal), { destaque: true, tom: sinal(r.invest.rendimentoMensal - r.invest.retiradaMensal) })}
        ${ren ? bloco(`Saldo após renovações (${dataBR(ren.ultimoVencimento)})`, brl(ren.saldoFinal), { destaque: true }) : ""}
    </div>
    ${cartoes}
    <div class="acoes-fim">${botao("+ Novo investimento", "adicionar", `data-colecao="investimentos"`, "primario")}</div>
    <p class="dica">Como funciona: o salário do período inteiro é separado antes (sai do valor para consumo, em Aquisições),
    e o valor aplicado rende sem retiradas. A "sobra" é quanto o rendimento passa do salário, ou seja, o seu lucro real.
    Ao renovar, o saldo do vencimento é resgatado, o salário do novo período é separado e o restante é reaplicado.
    Juros compostos: valor × ((1 + taxa)<sup>anos</sup> − 1). IR pela tabela regressiva (22,5% até 180 dias, 20% até 360,
    17,5% até 720, 15% acima). Custódia descontada proporcional ao tempo.</p>`;
}

// "Rende X → salário Y → sobra Z" de um período.
function resumoMes(ci) {
    return `<div class="blocos resumo-mes">
        ${bloco("Rende por mês", brl(ci.rendimentoMensal))}
        ${bloco("Salário por mês", brl(ci.retirada))}
        ${bloco("Sobra por mês", brl(ci.reaplicar), { destaque: true, tom: sinal(ci.reaplicar), nota: ci.ajustarRetirada ? "⚠️ salário maior que o rendimento" : "" })}
    </div>`;
}

function abaCarros(c, r) {
    const cat = dados.catalogo;
    const tipos = cat.tipos.map((t) => t.nome);
    const marcas = [...new Set(cat.modelos.map((m) => m.marca))].sort();
    const datalists = `<datalist id="lista-marcas">${marcas.map((m) => `<option value="${esc(m)}">`).join("")}</datalist>
        <datalist id="lista-modelos">${cat.modelos.map((m) => `<option value="${esc(m.modelo)}">${esc(m.marca)}</option>`).join("")}</datalist>`;

    const garagem = r.carros.linhas.map((l) => {
        const base = `carros.${l.id}`;
        return `<div class="carro">
            <div class="grade">
                ${campo({ rotulo: "Marca", caminho: `${base}.marca`, valor: l.marca, tipo: "texto", extra: `list="lista-marcas"` })}
                ${campo({ rotulo: "Modelo", caminho: `${base}.modelo`, valor: l.modelo, tipo: "texto", extra: `list="lista-modelos" data-auto-tipo="${l.id}"` })}
                ${selecao({ rotulo: "Tipo", caminho: `${base}.tipo`, valor: l.tipo, opcoes: tipos })}
                ${campo({ rotulo: "Ano", caminho: `${base}.ano`, valor: l.ano, passo: "1" })}
                ${campo({ rotulo: "Valor FIPE (R$)", caminho: `${base}.fipe`, valor: l.fipe })}
                ${campo({ rotulo: "Valor de compra (R$)", caminho: `${base}.compra`, valor: l.compra })}
            </div>
            <div class="carro-custos">
                <span>Combustível ${brl(l.combustivelMes)}/mês</span>
                <span>IPVA ${brl(l.ipvaAno)}/ano</span>
                <span>Seguro ${brl(l.seguroAno)}/ano</span>
                <span>Manutenção ${brl(l.manutencaoAno)}/ano</span>
                <b>Custo médio ${brl(l.custoMes)}/mês</b>
                ${remover("carros", l.id)}
            </div>
        </div>`;
    }).join("") || `<p class="vazio">Nenhum carro cadastrado.</p>`;

    const trajetos = c.trajetos.map((t) => `<div class="lista-linha trajeto">
        ${campo({ caminho: `trajetos.${t.id}.saida`, valor: t.saida, tipo: "texto", extra: `placeholder="Saída"` })}
        ${campo({ caminho: `trajetos.${t.id}.destino`, valor: t.destino, tipo: "texto", extra: `placeholder="Destino"` })}
        ${campo({ caminho: `trajetos.${t.id}.km`, valor: t.km, extra: `aria-label="km" placeholder="km"` })}
        ${campo({ caminho: `trajetos.${t.id}.vezes`, valor: t.vezes, extra: `aria-label="vezes por dia" placeholder="× dia"` })}
        ${remover("trajetos", t.id)}
    </div>`).join("");

    const catalogoTipos = cat.tipos.map((t) => `<div class="lista-linha tipo">
        <span><b>${esc(t.nome)}</b></span>
        <label class="mini">Consumo km/l ${campo({ caminho: `tipos.${t.nome}.consumo`, valor: t.consumo, raiz: "k" })}</label>
        <label class="mini">Manutenção %/ano ${campo({ caminho: `tipos.${t.nome}.manutencao`, valor: t.manutencao, raiz: "k" })}</label>
    </div>`).join("");

    const catalogoModelos = tabela(["Marca", "Modelo", "Tipo", ""], cat.modelos.map((m) => `<tr>
        <td>${campo({ caminho: `modelos.${m.id}.marca`, valor: m.marca, tipo: "texto", raiz: "k" })}</td>
        <td>${campo({ caminho: `modelos.${m.id}.modelo`, valor: m.modelo, tipo: "texto", raiz: "k" })}</td>
        <td>${selecao({ caminho: `modelos.${m.id}.tipo`, valor: m.tipo, opcoes: tipos, raiz: "k" })}</td>
        <td>${botao("✕", "removerModelo", `data-id="${m.id}" aria-label="Remover"`, "remover")}</td>
    </tr>`));

    return `${datalists}
    <div class="blocos fixo">
        ${bloco("Valor em carros (compra)", brl(r.carros.totalCompra))}
        ${bloco("Valor FIPE", brl(r.carros.totalFipe))}
        ${bloco("Custo mensal", brl(Object.values(r.carros.mensal).reduce((a, b) => a + b, 0)), { destaque: true })}
    </div>
    ${cartao("Garagem", garagem, botao("+ Carro", "adicionar", `data-colecao="carros"`))}
    ${cartao("Custos", `<div class="grade">
        ${campo({ rotulo: "Preço do combustível (R$/litro)", caminho: "carrosCfg.precoCombustivel", valor: c.carrosCfg.precoCombustivel })}
        ${campo({ rotulo: "IPVA (% da FIPE por ano)", caminho: "carrosCfg.ipva", valor: c.carrosCfg.ipva })}
        ${campo({ rotulo: "Seguro (% da FIPE por ano)", caminho: "carrosCfg.seguro", valor: c.carrosCfg.seguro })}
        ${campo({ rotulo: "Dias rodados por mês", caminho: "carrosCfg.diasMes", valor: c.carrosCfg.diasMes })}
    </div>
    <div class="blocos">
        ${bloco("Combustível", brl(r.carros.mensal.combustivel) + "/mês")}
        ${bloco("Manutenção", brl(r.carros.mensal.manutencao) + "/mês")}
        ${bloco("IPVA", brl(r.carros.mensal.ipva) + "/mês")}
        ${bloco("Seguro", brl(r.carros.mensal.seguro) + "/mês")}
    </div>`)}
    ${cartao("Estimativa de km", `<div class="lista-linha trajeto cabecalho"><span>Saída</span><span>Destino</span><span>km</span><span>× dia</span><span></span></div>
        ${trajetos}
        <p class="total-linha">${num(r.carros.kmDia)} km/dia · <b>${num(r.carros.kmMes)} km/mês</b> · ${num(r.carros.kmPorCarro)} km/mês por carro</p>`,
        botao("+ Trajeto", "adicionar", `data-colecao="trajetos"`))}
    ${cartao("Lista de carros (catálogo)", `<p class="dica">O tipo define o consumo e a manutenção usados nos cálculos.</p>
        ${catalogoTipos}
        <details><summary>Modelos cadastrados (${cat.modelos.length})</summary>${catalogoModelos}
        <div class="acoes-fim">${botao("+ Modelo", "adicionarModelo")}</div></details>`)}
    `;
}

function abaMercado(c) {
    const m = mercado;
    const taxas = m.taxas
        ? `<div class="blocos">${m.taxas.map((t) => bloco(esc(t.nome), `${num(t.valor)}% a.a.`)).join("")}</div>
           <div class="aplicar-taxa">
             <span>Usar a Selic como taxa de:</span>
             ${c.investimentos.map((i) => botao(esc(i.nome), "aplicarSelic", `data-id="${i.id}"`)).join("")}
           </div>`
        : `<p class="vazio">Carregando taxas…</p>`;

    const opcoes = (lista, chave, sel) => (lista || []).map((o) =>
        `<option value="${esc(o.codigo)}" ${String(o.codigo) === String(sel) ? "selected" : ""}>${esc(o.nome)}</option>`).join("");

    const fipe = `<div class="grade">
        <label class="campo"><span>Marca</span><select data-fipe="marca"><option value="">Escolha…</option>${opcoes(m.marcas, "marca", m.sel.marca)}</select></label>
        <label class="campo"><span>Modelo</span><select data-fipe="modelo" ${m.modelos ? "" : "disabled"}><option value="">Escolha…</option>${opcoes(m.modelos, "modelo", m.sel.modelo)}</select></label>
        <label class="campo"><span>Ano</span><select data-fipe="ano" ${m.anos ? "" : "disabled"}><option value="">Escolha…</option>${opcoes(m.anos, "ano", m.sel.ano)}</select></label>
    </div>
    ${m.preco ? `<div class="fipe-resultado">
        <div>${bloco(`${esc(m.preco.Marca)} ${esc(m.preco.Modelo)} (${esc(m.preco.AnoModelo)})`, esc(m.preco.Valor), { destaque: true, nota: `Referência: ${esc(m.preco.MesReferencia)}` })}</div>
        ${botao("+ Adicionar à garagem", "fipeGaragem", "", "primario")}
    </div>` : ""}`;

    return `${m.erro ? `<section class="alertas"><p>⚠️ ${esc(m.erro)}</p></section>` : ""}
    ${cartao("Taxas do mercado", taxas + `<p class="dica">Fonte: BrasilAPI (Banco Central e IBGE).</p>`, botao("Atualizar", "carregarTaxas"))}
    ${cartao("Tabela FIPE", fipe + `<p class="dica">Fonte: tabela FIPE via parallelum.com.br.</p>`)}`;
}

function abaAjustes(c) {
    const login = !nuvem
        ? `<p class="dica">Sincronização indisponível (sem conexão com o Firebase). Os dados ficam salvos neste aparelho.</p>`
        : usuario
            ? `<p>Conectado como <b>${esc(usuario.email)}</b>. Os dados são sincronizados com a nuvem.</p>${botao("Sair", "sair")}`
            : `<p class="dica">Entre com sua conta Google para guardar os dados na nuvem e acessar de qualquer aparelho.</p>${botao("Entrar com Google", "entrar", "", "primario")}`;

    const cenarios = dados.cenarios.map((cen) => `<div class="lista-linha cenario">
        ${campo({ caminho: `cenarios.${cen.id}.nome`, valor: cen.nome, tipo: "texto", raiz: "d" })}
        ${botao("Duplicar", "duplicarCenario", `data-id="${cen.id}"`)}
        ${dados.cenarios.length > 1 ? botao("✕", "removerCenario", `data-id="${cen.id}" aria-label="Excluir"`, "remover") : ""}
    </div>`).join("");

    return `
    ${cartao("Conta e sincronização", login)}
    ${cartao("Cenários", `<p class="dica">Cada cenário é uma simulação completa (valores, aquisições, gastos, carros e investimentos).</p>${cenarios}`)}
    ${cartao("Backup", `<p class="dica">Baixe uma cópia dos seus dados ou restaure de um arquivo.</p>
        <div class="acoes">
            ${botao("Baixar backup", "exportar")}
            <label class="botao-arquivo">Restaurar backup<input type="file" accept="application/json" id="arquivoBackup"></label>
            ${botao("Voltar aos dados da planilha", "restaurarPadrao", "", "perigo")}
        </div>`)}`;
}

const ABAS = {
    painel: abaPainel, renda: abaRenda, aquisicoes: abaAquisicoes, investimentos: abaInvestimentos,
    carros: abaCarros, mercado: abaMercado, ajustes: abaAjustes,
};

// ---------- Desenho ----------

function desenhar() {
    const c = cenario();
    dados.cenarioAtivo = c.id;
    seletorCenario.innerHTML = dados.cenarios.map((cen) =>
        `<option value="${cen.id}" ${cen.id === c.id ? "selected" : ""}>${esc(cen.nome)}</option>`).join("");
    document.querySelectorAll("#abas button").forEach((b) => b.classList.toggle("ativa", b.dataset.aba === abaAtual));
    const resultado = calcular(c, dados.catalogo);
    conteudo.innerHTML = ABAS[abaAtual](c, resultado);
}

// ---------- Eventos ----------

function lerValor(el) {
    if (el.dataset.tipo === "bool") return el.checked;
    if (el.dataset.tipo === "num") return el.value === "" ? 0 : Number(el.value);
    return el.value;
}

conteudo.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.c) definir(cenario(), el.dataset.c, lerValor(el));
    else if (el.dataset.k) definir(dados.catalogo, el.dataset.k, lerValor(el));
    else if (el.dataset.d) definir(dados, el.dataset.d, lerValor(el));
    else if (el.dataset.fipe) return trocarFipe(el.dataset.fipe, el.value);
    else if (el.id === "arquivoBackup") return importar(el.files[0]);
    else return;

    // Ao trocar o tipo de investimento, aplica isenção de IR e custódia padrão.
    if (el.dataset.preset) {
        const inv = cenario().investimentos.find((i) => i.id === el.dataset.preset);
        const tipo = TIPOS_INVESTIMENTO.find((t) => t.nome === el.value);
        if (inv && tipo) Object.assign(inv, { isento: tipo.isento, custodia: tipo.custodia });
    }

    // Ao escolher um modelo do catálogo, preenche marca e tipo do carro.
    if (el.dataset.autoTipo) {
        const carro = cenario().carros.find((x) => x.id === el.dataset.autoTipo);
        const modelo = dados.catalogo.modelos.find((m) => m.modelo.toLowerCase() === el.value.toLowerCase());
        if (carro && modelo) Object.assign(carro, { marca: modelo.marca, tipo: modelo.tipo });
    }
    salvar();
    desenhar();
});

const novos = {
    "renda.itens": () => ({ id: novoId(), nome: "Nova renda", valor: 0 }),
    gastos: () => ({ id: novoId(), nome: "Novo gasto", valor: 0 }),
    aquisicoes: (botao) => ({ id: novoId(), grupo: botao.dataset.grupo, nome: "Novo item", valor: 0 }),
    carros: () => ({ id: novoId(), marca: "", modelo: "", tipo: dados.catalogo.tipos[0]?.nome || "", ano: new Date().getFullYear(), fipe: 0, compra: 0 }),
    trajetos: () => ({ id: novoId(), saida: "", destino: "", km: 0, vezes: 1 }),
    investimentos: () => ({
        id: novoId(), nome: "Novo investimento", tipo: "CDB", inicio: new Date().toISOString().slice(0, 10),
        fim: `${new Date().getFullYear() + 2}-01-01`, taxa: 12, custodia: 0, isento: false,
        modo: "fixo", valor: 0, pct: 0, multiplicador: 0, renovacoes: [],
    }),
};

const acoes = {
    renovar(b) {
        const inv = cenario().investimentos.find((i) => i.id === b.dataset.id);
        const datas = [inv.inicio, inv.fim, ...inv.renovacoes.map((x) => x.fim)];
        const [penultima, ultima] = datas.slice(-2);
        const duracao = Math.max(Math.round((new Date(ultima) - new Date(penultima)) / 86400000), 30);
        const anterior = inv.renovacoes[inv.renovacoes.length - 1] || inv;
        inv.renovacoes.push({
            id: novoId(), fim: somarDias(ultima, duracao), taxa: anterior.taxa,
            multiplicador: anterior.multiplicador, aporte: 0,
        });
    },
    adicionar(b) {
        acharNoCaminho(cenario(), b.dataset.colecao.split(".")).push(novos[b.dataset.colecao](b));
    },
    remover(b) {
        const lista = acharNoCaminho(cenario(), b.dataset.colecao.split("."));
        const i = lista.findIndex((x) => x.id === b.dataset.id);
        if (i >= 0) lista.splice(i, 1);
    },
    adicionarModelo() {
        dados.catalogo.modelos.push({ id: novoId(), marca: "", modelo: "", tipo: dados.catalogo.tipos[0]?.nome || "" });
    },
    removerModelo(b) {
        dados.catalogo.modelos = dados.catalogo.modelos.filter((m) => m.id !== b.dataset.id);
    },
    duplicarCenario(b) {
        const original = dados.cenarios.find((x) => x.id === b.dataset.id);
        const copia = JSON.parse(JSON.stringify(original));
        copia.id = novoId();
        copia.nome = `${original.nome} (cópia)`;
        dados.cenarios.push(copia);
        dados.cenarioAtivo = copia.id;
    },
    removerCenario(b) {
        const cen = dados.cenarios.find((x) => x.id === b.dataset.id);
        if (!confirm(`Excluir o cenário "${cen.nome}"? Isso não pode ser desfeito.`)) return false;
        dados.cenarios = dados.cenarios.filter((x) => x.id !== cen.id);
    },
    restaurarPadrao() {
        if (!confirm("Substituir TODOS os dados pelos valores originais da planilha?")) return false;
        dados = dadosPadrao();
    },
    exportar() {
        const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `meu-sistema-backup-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(link.href);
        return false;
    },
    async entrar() {
        try {
            await nuvem.entrar();
        } catch (erro) {
            console.error(erro);
            alert("Não foi possível entrar. Verifique se o login com Google está ativado no Firebase.");
        }
        return false;
    },
    async sair() {
        await nuvem.sair();
        return false;
    },
    carregarTaxas() {
        carregarTaxas();
        return false;
    },
    aplicarSelic(b) {
        const selic = mercado.taxas?.find((t) => t.nome.toLowerCase() === "selic");
        const inv = cenario().investimentos.find((i) => i.id === b.dataset.id);
        if (!selic || !inv) return false;
        inv.taxa = selic.valor;
        mostrarStatus(`Taxa de ${inv.nome} atualizada para ${num(selic.valor)}%`);
    },
    fipeGaragem() {
        const p = mercado.preco;
        const valor = mercadoApi.precoParaNumero(p.Valor);
        const doCatalogo = dados.catalogo.modelos.find((m) => p.Modelo.toLowerCase().startsWith(m.modelo.toLowerCase()));
        cenario().carros.push({
            id: novoId(), marca: p.Marca, modelo: p.Modelo, ano: p.AnoModelo,
            tipo: doCatalogo?.tipo || dados.catalogo.tipos[0]?.nome || "", fipe: valor, compra: valor,
        });
        abaAtual = "carros";
    },
};

document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-acao]");
    if (b) {
        const mudou = await acoes[b.dataset.acao](b);
        if (mudou !== false) {
            salvar();
            desenhar();
        }
        return;
    }
    const aba = e.target.closest("#abas button");
    if (aba) {
        abaAtual = aba.dataset.aba;
        desenhar();
        window.scrollTo({ top: 0 });
        if (abaAtual === "mercado") iniciarMercado();
    }
});

seletorCenario.addEventListener("change", () => {
    dados.cenarioAtivo = seletorCenario.value;
    salvar();
    desenhar();
});

async function importar(arquivo) {
    if (!arquivo) return;
    try {
        const novo = JSON.parse(await arquivo.text());
        if (!Array.isArray(novo.cenarios) || !novo.catalogo) throw new Error("formato inválido");
        if (!confirm("Substituir os dados atuais pelo backup?")) return;
        dados = migrar(novo);
        salvar();
        desenhar();
    } catch {
        alert("Arquivo de backup inválido.");
    }
}

// ---------- Mercado ----------

async function carregarTaxas() {
    try {
        mercado.taxas = await mercadoApi.buscarTaxas();
        mercado.erro = "";
    } catch (erro) {
        mercado.erro = "Não foi possível buscar as taxas. Verifique a internet.";
    }
    if (abaAtual === "mercado") desenhar();
}

async function iniciarMercado() {
    if (!mercado.taxas) carregarTaxas();
    if (!mercado.marcas) {
        try {
            mercado.marcas = await mercadoApi.fipeMarcas();
        } catch {
            mercado.erro = "Não foi possível acessar a tabela FIPE.";
        }
        if (abaAtual === "mercado") desenhar();
    }
}

async function trocarFipe(nivel, valor) {
    const { sel } = mercado;
    try {
        if (nivel === "marca") {
            Object.assign(mercado, { sel: { marca: valor }, modelos: null, anos: null, preco: null });
            if (valor) mercado.modelos = await mercadoApi.fipeModelos(valor);
        } else if (nivel === "modelo") {
            Object.assign(sel, { modelo: valor, ano: "" });
            Object.assign(mercado, { anos: null, preco: null });
            if (valor) mercado.anos = await mercadoApi.fipeAnos(sel.marca, valor);
        } else {
            sel.ano = valor;
            mercado.preco = valor ? await mercadoApi.fipePreco(sel.marca, sel.modelo, valor) : null;
        }
        mercado.erro = "";
    } catch {
        mercado.erro = "Erro ao consultar a tabela FIPE. Tente novamente em instantes.";
    }
    desenhar();
}

// ---------- Nuvem (opcional) ----------

async function iniciarNuvem() {
    try {
        nuvem = await import("./nuvem.js");
    } catch (erro) {
        console.warn("Firebase indisponível, usando só o aparelho.", erro);
        mostrarStatus("Salvo só neste aparelho");
        return;
    }
    nuvem.observarLogin(async (u) => {
        usuario = u;
        if (!u) {
            mostrarStatus("Salvo só neste aparelho");
        } else {
            try {
                const remoto = await nuvem.lerNuvem();
                // Aparelho que nunca sincronizou: a nuvem manda (evita sobrescrever
                // os dados reais com os dados de exemplo de um aparelho novo).
                if (remoto && (!dados.sincronizado || (remoto.atualizadoEm || 0) > (dados.atualizadoEm || 0))) {
                    dados = migrar(remoto);
                    dados.sincronizado = true;
                    salvar();
                } else {
                    dados.sincronizado = true;
                    salvar();
                    await nuvem.salvarNuvem(dados);
                }
                mostrarStatus("Sincronizado");
            } catch (erro) {
                console.error(erro);
                mostrarStatus("Erro ao sincronizar", true);
            }
        }
        desenhar();
    });
}

desenhar();
iniciarNuvem();
