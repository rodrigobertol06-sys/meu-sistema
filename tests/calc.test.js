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
