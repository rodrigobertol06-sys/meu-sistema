// Regras de cálculo do sistema, reproduzindo as fórmulas da planilha original.
// Funções puras: recebem um cenário e devolvem números, sem tocar na tela.

const DIA_MS = 24 * 60 * 60 * 1000;
const DIAS_POR_MES = 365 / 12;

const soma = (lista, campo = "valor") =>
    lista.reduce((total, item) => total + (Number(item[campo]) || 0), 0);

function diasEntre(inicio, fim) {
    if (!inicio || !fim) return 0;
    const dias = Math.round((new Date(fim + "T00:00:00Z") - new Date(inicio + "T00:00:00Z")) / DIA_MS);
    return Math.max(dias, 0);
}

// Tabela regressiva do IR para renda fixa (tesouro, CDB...).
export function aliquotaIR(dias) {
    if (dias <= 180) return 22.5;
    if (dias <= 360) return 20;
    if (dias <= 720) return 17.5;
    return 15;
}

// ---------- Valores ----------

export function calcValores(c) {
    const aReceber = Number(c.valores.aReceber) || 0;
    const pct = (Number(c.valores.pctConsumir) || 0) / 100;
    const paraConsumo = aReceber * pct;
    return { aReceber, paraConsumo, aplicavel: aReceber - paraConsumo };
}

// ---------- Investimentos ----------

// Tipos de aplicação com os padrões de cada um (isenção de IR e custódia).
export const TIPOS_INVESTIMENTO = [
    { nome: "Poupança", isento: true, custodia: 0 },
    { nome: "Tesouro Selic", isento: false, custodia: 0.2 },
    { nome: "Tesouro Prefixado", isento: false, custodia: 0.2 },
    { nome: "Tesouro IPCA+", isento: false, custodia: 0.2 },
    { nome: "CDB", isento: false, custodia: 0 },
    { nome: "LCI", isento: true, custodia: 0 },
    { nome: "LCA", isento: true, custodia: 0 },
    { nome: "Outro", isento: false, custodia: 0 },
];

// Um período de aplicação (do início ao vencimento).
// A ideia: o salário do período inteiro é separado antes (não sai da aplicação),
// o valor aplicado rende sem retiradas e, no fim, o "lucro real" é o lucro
// menos o salário que esse rendimento precisava cobrir.
function calcCiclo({ valor, inicio, fim, taxa, custodia, isento, retirada }) {
    const dias = diasEntre(inicio, fim);
    const anos = dias / 365;
    const meses = dias / DIAS_POR_MES;
    const lucroBruto = valor * (Math.pow(1 + (Number(taxa) || 0) / 100, anos) - 1);
    const valorCustodia = valor * ((Number(custodia) || 0) / 100) * anos;
    const ir = isento ? 0 : aliquotaIR(dias);
    const imposto = lucroBruto * (ir / 100);
    const lucroLiquido = lucroBruto - imposto - valorCustodia;
    const rendimentoMensal = meses ? lucroLiquido / meses : 0;
    const reaplicar = rendimentoMensal - retirada;
    const lucroReaplicar = reaplicar * meses;
    return {
        valor, inicio, fim, taxa, dias, meses, anos, ir,
        lucroBruto, valorCustodia, imposto, lucroLiquido,
        saldoFinal: valor + lucroLiquido,
        lucroPct: valor ? lucroLiquido / valor : 0,
        rendimentoMensal,
        retirada,
        ajustarRetirada: retirada > rendimentoMensal,
        reaplicar,
        totalRetirado: retirada * meses,
        lucroReaplicar,
        pctReaplicado: lucroLiquido ? lucroReaplicar / lucroLiquido : 0,
        totalReaplicar: valor + lucroReaplicar,
    };
}

// Data ISO somada de N dias.
export function somarDias(iso, dias) {
    const d = new Date(iso + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().slice(0, 10);
}

export function calcInvestimentos(c) {
    const { aplicavel } = calcValores(c);
    const salarioBase = Number(c.renda.salarioBase) || 0;
    const modo = (i) => i.modo || (i.restante ? "restante" : "fixo");
    const valorDefinido = (i) =>
        modo(i) === "pct" ? aplicavel * ((Number(i.pct) || 0) / 100) : Number(i.valor) || 0;
    const definidos = c.investimentos.filter((i) => modo(i) !== "restante");
    const somaDefinidos = definidos.reduce((t, i) => t + valorDefinido(i), 0);
    const qtdRestante = c.investimentos.length - definidos.length;
    const valorRestante = qtdRestante ? Math.max(aplicavel - somaDefinidos, 0) / qtdRestante : 0;

    const linhas = c.investimentos.map((inv) => {
        const valor = modo(inv) === "restante" ? valorRestante : valorDefinido(inv);
        const primeiro = calcCiclo({
            ...inv, valor, retirada: (Number(inv.multiplicador) || 0) * salarioBase,
        });

        // Renovações: no vencimento, resgata o saldo, separa o salário do próximo
        // período e reaplica o restante (mais um aporte opcional).
        const ciclos = [{ ...primeiro, numero: 1 }];
        for (const ren of inv.renovacoes || []) {
            const anterior = ciclos[ciclos.length - 1];
            const retirada = (Number(ren.multiplicador) || 0) * salarioBase;
            const meses = diasEntre(anterior.fim, ren.fim) / DIAS_POR_MES;
            const reservaSalario = retirada * meses;
            const aporte = Number(ren.aporte) || 0;
            const valorCiclo = anterior.saldoFinal - reservaSalario + aporte;
            const ciclo = calcCiclo({
                valor: Math.max(valorCiclo, 0), inicio: anterior.fim, fim: ren.fim, taxa: ren.taxa,
                custodia: inv.custodia, isento: inv.isento, retirada,
            });
            ciclos.push({
                ...ciclo, id: ren.id, numero: ciclos.length + 1,
                resgatado: anterior.saldoFinal, reservaSalario, aporte,
                faltaParaSalario: valorCiclo < 0 ? -valorCiclo : 0,
            });
        }

        return {
            ...inv,
            ...primeiro,
            modo: modo(inv),
            divisor: aplicavel ? valor / aplicavel : 0,
            ciclos,
            final: ciclos[ciclos.length - 1],
        };
    });

    const totalAplicado = soma(linhas);
    const lucroEsperado = soma(linhas, "lucroLiquido");
    const lucroReal = soma(linhas, "lucroReaplicar");
    const comRenovacao = linhas.filter((l) => l.ciclos.length > 1);
    return {
        linhas,
        totalAplicado,
        naoAlocado: aplicavel - totalAplicado,
        totalRetirado: soma(linhas, "totalRetirado"),
        retiradaMensal: soma(linhas, "retirada"),
        rendimentoMensal: soma(linhas, "rendimentoMensal"),
        esperado: {
            lucro: lucroEsperado,
            pct: totalAplicado ? lucroEsperado / totalAplicado : 0,
            saldo: totalAplicado + lucroEsperado,
        },
        real: {
            lucro: lucroReal,
            pct: totalAplicado ? lucroReal / totalAplicado : 0,
            saldo: totalAplicado + lucroReal,
        },
        renovacoes: comRenovacao.length ? {
            saldoFinal: linhas.reduce((t, l) => t + l.final.saldoFinal, 0),
            ultimoVencimento: comRenovacao.map((l) => l.final.fim).sort().pop(),
            salarioReservado: linhas.reduce((t, l) => t + soma(l.ciclos.slice(1), "reservaSalario"), 0),
        } : null,
    };
}

// ---------- Carros ----------

export function calcCarros(c, catalogo) {
    const cfg = c.carrosCfg;
    const kmDia = c.trajetos.reduce((t, tr) => t + (Number(tr.km) || 0) * (Number(tr.vezes) || 0), 0);
    const kmMes = kmDia * (Number(cfg.diasMes) || 0);
    const qtd = c.carros.length;
    const kmPorCarro = qtd ? kmMes / qtd : 0;
    const preco = Number(cfg.precoCombustivel) || 0;

    const linhas = c.carros.map((carro) => {
        const tipo = catalogo.tipos.find((t) => t.nome === carro.tipo) || { consumo: 0, manutencao: 0 };
        const fipe = Number(carro.fipe) || 0;
        const consumo = Number(tipo.consumo) || 0;
        const combustivelMes = consumo ? (kmPorCarro / consumo) * preco : 0;
        const ipvaAno = fipe * ((Number(cfg.ipva) || 0) / 100);
        const seguroAno = fipe * ((Number(cfg.seguro) || 0) / 100);
        const manutencaoAno = fipe * ((Number(tipo.manutencao) || 0) / 100);
        return {
            ...carro, consumo, combustivelMes, ipvaAno, seguroAno, manutencaoAno,
            custoMes: combustivelMes + (ipvaAno + seguroAno + manutencaoAno) / 12,
        };
    });

    return {
        linhas, kmDia, kmMes, kmPorCarro,
        totalCompra: soma(c.carros, "compra"),
        totalFipe: soma(c.carros, "fipe"),
        mensal: {
            combustivel: soma(linhas, "combustivelMes"),
            manutencao: soma(linhas, "manutencaoAno") / 12,
            ipva: soma(linhas, "ipvaAno") / 12,
            seguro: soma(linhas, "seguroAno") / 12,
        },
    };
}

// ---------- Aquisições ----------

export const GRUPOS_AQUISICAO = [
    "Dívidas", "Compras Diversas", "Imóveis", "Casa & Reforma",
    "Preparação Carros", "Produtos", "Doações", "Reserva", "Outros",
];

export function calcAquisicoes(c, carros, invest) {
    const grupos = GRUPOS_AQUISICAO.map((nome) => {
        const itens = c.aquisicoes.filter((a) => a.grupo === nome);
        let total = soma(itens);
        let extra = 0;
        if (nome === "Imóveis") {
            extra = total * ((Number(c.taxaImoveis) || 0) / 100);
            total += extra;
        }
        return { nome, itens, total, extra };
    });
    grupos.splice(4, 0, { nome: "Carros", itens: [], total: carros.totalCompra, automatico: true });
    grupos.push({ nome: "Retirada p/ Renda", itens: [], total: invest.totalRetirado, automatico: true });
    return { grupos, total: soma(grupos, "total") };
}

// ---------- Fluxo mensal ----------

export function calcFluxo(c, carros, invest) {
    const gastosCarro = [
        { nome: "Combustível", valor: carros.mensal.combustivel },
        { nome: "Manutenção carros", valor: carros.mensal.manutencao },
        { nome: "IPVA carros", valor: carros.mensal.ipva },
        { nome: "Seguro carros", valor: carros.mensal.seguro },
    ];
    const rendaFixa = soma(c.renda.itens);
    const entradas = rendaFixa + invest.retiradaMensal;
    const saidas = soma(c.gastos) + soma(gastosCarro);
    return { gastosCarro, rendaFixa, entradas, saidas, saldo: entradas - saidas };
}

// ---------- Tudo junto ----------

export function calcular(c, catalogo) {
    const valores = calcValores(c);
    const invest = calcInvestimentos(c);
    const carros = calcCarros(c, catalogo);
    const aquisicoes = calcAquisicoes(c, carros, invest);
    const fluxo = calcFluxo(c, carros, invest);
    return {
        valores, invest, carros, aquisicoes, fluxo,
        saldoConsumido: aquisicoes.total,
        saldoDisponivel: valores.paraConsumo - aquisicoes.total,
    };
}
