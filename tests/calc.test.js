// Confere os cálculos contra os valores da planilha original.
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcular, aliquotaIR } from "../js/calc.js";
import { dadosPadrao } from "../js/dados.js";

const perto = (real, esperado, tolerancia = 0.01) =>
    assert.ok(Math.abs(real - esperado) <= tolerancia, `${real} != ${esperado}`);

const dados = dadosPadrao();
const [superior, ate10] = dados.cenarios.map((c) => calcular(c, dados.catalogo));

test("valores: consumo e saldo aplicável", () => {
    perto(superior.valores.paraConsumo, 36450000);
    perto(superior.valores.aplicavel, 44550000);
    perto(ate10.valores.paraConsumo, 3960000);
    perto(ate10.valores.aplicavel, 2640000);
});

test("investimentos: poupança fica com o restante e rende como na planilha", () => {
    const poup = superior.invest.linhas[1];
    perto(poup.valor, 42550000);
    perto(poup.dias, 817, 0);
    perto(poup.lucroLiquido, 5927822.47);
    perto(poup.rendimentoMensal, 220691.07);
    perto(poup.retirada, 162100);
    perto(poup.reaplicar, 58591.07);
    perto(poup.totalRetirado, 4354050.41);
    perto(poup.lucroReaplicar, 1573772.06);
    perto(ate10.invest.linhas[1].lucroLiquido, 89161.14);
});

test("investimentos: tesouro (lucro bruto e IR de 15%)", () => {
    const tes = ate10.invest.linhas[0];
    perto(tes.lucroBruto, 679551.89);
    perto(tes.imposto, 101932.78);
    assert.equal(tes.ir, 15);
    perto(tes.retirada, 19452);
    perto(tes.totalRetirado, 522486.05);
    assert.ok(tes.valorCustodia > 0, "custódia descontada");
});

test("carros: km e combustível", () => {
    perto(superior.carros.kmMes, 2040, 0);
    perto(superior.carros.mensal.combustivel, 5420.57);
    perto(superior.carros.mensal.manutencao, 62125);
    perto(ate10.carros.mensal.seguro, 1450);
});

test("fluxo mensal: entradas e gastos fixos", () => {
    perto(superior.fluxo.entradas, 162650);
    perto(ate10.fluxo.entradas, 20002);
});

test("aquisições: imóveis com 10% de taxa e doações", () => {
    const g = (r, n) => r.aquisicoes.grupos.find((x) => x.nome === n).total;
    perto(g(ate10, "Imóveis"), 544500);
    perto(g(superior, "Doações"), 3350000);
    perto(g(superior, "Carros"), 12630000);
});

test("tabela regressiva do IR", () => {
    assert.equal(aliquotaIR(100), 22.5);
    assert.equal(aliquotaIR(300), 20);
    assert.equal(aliquotaIR(600), 17.5);
    assert.equal(aliquotaIR(817), 15);
});

test("renovação: resgata o saldo, separa o salário do próximo período e reaplica o resto", () => {
    const d = dadosPadrao();
    const c = d.cenarios[0];
    const poup = c.investimentos[1];
    poup.renovacoes.push({ id: "r1", fim: "2031-03-29", taxa: 6, multiplicador: 100, aporte: 0 });
    const linha = calcular(c, d.catalogo).invest.linhas[1];
    const ciclo = linha.ciclos[1];
    assert.equal(linha.ciclos.length, 2);
    assert.equal(ciclo.inicio, "2029-01-01");
    perto(ciclo.dias, 817, 0);
    perto(ciclo.resgatado, 48477822.47);
    perto(ciclo.reservaSalario, 4354050.41);
    perto(ciclo.valor, 48477822.47 - 4354050.41);
    assert.ok(ciclo.lucroLiquido > 0);
    assert.equal(linha.final, ciclo);
});

test("vários investimentos: valor fixo, % do saldo e restante dividido", () => {
    const d = dadosPadrao();
    const c = d.cenarios[1]; // saldo aplicável 2.640.000
    c.investimentos.push(
        { id: "cdb", nome: "CDB", tipo: "CDB", inicio: "2026-10-07", fim: "2027-10-07", taxa: 14, custodia: 0,
          isento: false, modo: "pct", pct: 10, valor: 0, multiplicador: 0, renovacoes: [] },
        { id: "lci", nome: "LCI", tipo: "LCI", inicio: "2026-10-07", fim: "2027-10-07", taxa: 12, custodia: 0,
          isento: true, modo: "restante", pct: 0, valor: 0, multiplicador: 0, renovacoes: [] },
    );
    const inv = calcular(c, d.catalogo).invest;
    perto(inv.linhas[2].valor, 264000);
    // restante = 2.640.000 - 2.000.000 - 264.000 = 376.000, dividido entre poupança e LCI
    perto(inv.linhas[1].valor, 188000);
    perto(inv.linhas[3].valor, 188000);
    assert.equal(inv.linhas[2].ir, 17.5); // 365 dias
    perto(inv.naoAlocado, 0);
});
