// Dados iniciais, copiados da planilha "Superior a 10M", "Ate 10M" e "Lista Carros".
// Só são usados na primeira vez que o sistema abre (ou ao restaurar o padrão).

export const novoId = () => Math.random().toString(36).slice(2, 10);

const itens = (lista) => lista.map(([nome, valor]) => ({ id: novoId(), nome, valor }));
const grupo = (nomeGrupo, lista) => itens(lista).map((i) => ({ ...i, grupo: nomeGrupo }));

const trajetosPadrao = () => [
    ["Casa", "CEI Novos Sonhos", 1.5, 2],
    ["CEI Novos Sonhos", "Casa", 1.5, 2],
    ["Casa", "Carbonera", 8, 2],
    ["Carbonera", "Casa", 8, 2],
    ["Casa", "Salão", 15, 1],
    ["Salão", "Casa", 15, 1],
].map(([saida, destino, km, vezes]) => ({ id: novoId(), saida, destino, km, vezes }));

const carro = (marca, modelo, tipo, ano, fipe, compra) =>
    ({ id: novoId(), marca, modelo, tipo, ano, fipe, compra });

const rendaPadrao = (valeMarieli) => ({
    salarioBase: 1621,
    itens: itens([
        ["Salário Rodrigo", 0],
        ["Salário Marieli", 0],
        ["Vale Rodrigo", 0],
        ["Vale Marieli", valeMarieli],
    ]),
});

const investimento = (tipo, taxa, custodia, isento, valor, restante, multiplicador) => ({
    id: novoId(), tipo, inicio: "2026-10-07", fim: "2029-01-01",
    taxa, custodia, isento, valor, restante, multiplicador,
});

function cenarioSuperior() {
    return {
        id: novoId(),
        nome: "Superior a 10M",
        valores: { aReceber: 81000000, pctConsumir: 45 },
        renda: rendaPadrao(550),
        investimentos: [
            investimento("Tesouro", 13.96, 0.2, false, 2000000, false, 0),
            investimento("Poupança", 6, 0, true, 0, true, 100),
        ],
        taxaImoveis: 10,
        aquisicoes: [
            ...grupo("Dívidas", [["Dívidas", 50000]]),
            ...grupo("Compras Diversas", [["Compras diversas", 250000]]),
            ...grupo("Imóveis", [["Apto", 0], ["Condomínio", 3000000], ["Geminado", 0], ["Terreno", 0]]),
            ...grupo("Casa & Reforma", [["Eletros", 50000], ["Móveis", 70000], ["Reforma / Acabamentos", 100000]]),
            ...grupo("Preparação Carros", [["Preparação carros", 631500]]),
            ...grupo("Produtos", [["Produtos", 15000]]),
            ...grupo("Doações", [
                ["Pai & Mãe", 3000000], ["Sogro & Sogra", 200000], ["Vô & Vó", 50000],
                ["Irmãs Rodrigo", 50000], ["Irmãos Marieli", 50000],
            ]),
            ...grupo("Reserva", [["Reserva", 1825000]]),
        ],
        gastos: itens([
            ["Comida", 2500], ["Passeios", 10000], ["Poupança Vini", 3300], ["Condomínio", 0],
            ["IPTU", 705], ["Taxa lixo", 705], ["Água", 500], ["Luz", 1000], ["Internet", 300],
            ["Celular", 100], ["Plano de saúde", 3000], ["Garagem", 0],
        ]),
        carros: [
            carro("Porsche", "GT3", "Sport", 2022, 2000000, 2000000),
            carro("Ferrari", "SF90", "Sport", 2024, 5300000, 5300000),
            carro("Dodge", "Challenger", "Sport", 2023, 1550000, 1550000),
            carro("Porsche", "Turbo S", "Sport", 2023, 1400000, 1400000),
            carro("Audi", "R8", "Sport", 2021, 2000000, 2000000),
            carro("Volkswagen", "Golf GTI", "Premium", 2019, 200000, 230000),
            carro("Volkswagen", "Tiguan", "Premium", 2019, 150000, 150000),
        ],
        carrosCfg: { precoCombustivel: 9, ipva: 2, seguro: 4, diasMes: 30 },
        trajetos: trajetosPadrao(),
    };
}

function cenarioAte10M() {
    return {
        id: novoId(),
        nome: "Até 10M",
        valores: { aReceber: 6600000, pctConsumir: 60 },
        renda: rendaPadrao(550),
        investimentos: [
            investimento("Tesouro", 13.96, 0.2, false, 2000000, false, 12),
            investimento("Poupança", 6, 0, true, 0, true, 0),
        ],
        taxaImoveis: 10,
        aquisicoes: [
            ...grupo("Dívidas", [["Dívidas", 50000]]),
            ...grupo("Compras Diversas", [["Compras diversas", 150000]]),
            ...grupo("Imóveis", [["Apto", 0], ["Condomínio", 0], ["Geminado", 0], ["Terreno", 495000]]),
            ...grupo("Casa & Reforma", [["Eletros", 50000], ["Móveis", 70000], ["Reforma / Acabamentos", 1250000]]),
            ...grupo("Preparação Carros", [["Preparação carros", 88000]]),
            ...grupo("Produtos", [["Produtos", 15000]]),
            ...grupo("Doações", [["Pai & Mãe", 20000], ["Sogro & Sogra", 5000]]),
            ...grupo("Reserva", [["Reserva em dinheiro", 200000]]),
        ],
        gastos: itens([
            ["Comida", 1500], ["Passeios", 1000], ["Poupança Vini", 410], ["Condomínio", 0],
            ["IPTU", 383], ["Taxa lixo", 383], ["Água", 350], ["Luz", 600], ["Internet", 100],
            ["Celular", 100], ["Plano de saúde", 2500], ["Garagem", 0],
        ]),
        carros: [
            carro("Volkswagen", "Tiguan", "Premium", 2019, 145000, 150000),
            carro("Volkswagen", "Golf GTI", "Premium", 2019, 200000, 230000),
            carro("Audi", "A3", "Premium", 2019, 90000, 100000),
        ],
        carrosCfg: { precoCombustivel: 9, ipva: 2, seguro: 4, diasMes: 30 },
        trajetos: trajetosPadrao(),
    };
}

function catalogoPadrao() {
    const sport = {
        Audi: ["RS6", "RS5", "RS3", "R8"],
        Dodge: ["Charger", "Challenger"],
        Ferrari: ["SF90", "458", "PuroSangue", "488", "F8", "296"],
        Porsche: ["Cayenne", "GT3", "Turbo S", "GT4", "Panamera", "Taycan", "Macan"],
    };
    const premium = {
        Audi: ["A3", "Q3"],
        Volkswagen: ["Golf GTI", "Tiguan", "CC", "Tera", "Fusca", "Gol", "Jetta", "Bora", "Saveiro", "Amarok"],
    };
    const modelos = [];
    for (const [tipo, marcas] of [["Sport", sport], ["Premium", premium]]) {
        for (const [marca, lista] of Object.entries(marcas)) {
            lista.forEach((modelo) => modelos.push({ id: novoId(), marca, modelo, tipo }));
        }
    }
    return {
        tipos: [
            { nome: "Sport", consumo: 3, manutencao: 6 },
            { nome: "Premium", consumo: 5, manutencao: 3 },
        ],
        modelos,
    };
}

export function dadosPadrao() {
    const cenarios = [cenarioSuperior(), cenarioAte10M()];
    return { versao: 1, cenarioAtivo: cenarios[0].id, cenarios, catalogo: catalogoPadrao() };
}
