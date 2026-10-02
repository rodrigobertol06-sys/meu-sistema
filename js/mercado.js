// Dados de mercado de APIs públicas e gratuitas:
// - BrasilAPI: taxas Selic, CDI e IPCA
// - Parallelum (tabela FIPE): marcas, modelos, anos e preço de carros

const FIPE = "https://parallelum.com.br/fipe/api/v1/carros";

async function getJson(url) {
    const resposta = await fetch(url);
    if (!resposta.ok) throw new Error(`Erro ${resposta.status} ao consultar ${url}`);
    return resposta.json();
}

// Devolve [{ nome: "Selic", valor: 15 }, { nome: "CDI", ... }, { nome: "IPCA", ... }]
export const buscarTaxas = () => getJson("https://brasilapi.com.br/api/taxas/v1");

export const fipeMarcas = () => getJson(`${FIPE}/marcas`);
export const fipeModelos = (marca) => getJson(`${FIPE}/marcas/${marca}/modelos`).then((r) => r.modelos);
export const fipeAnos = (marca, modelo) => getJson(`${FIPE}/marcas/${marca}/modelos/${modelo}/anos`);
export const fipePreco = (marca, modelo, ano) =>
    getJson(`${FIPE}/marcas/${marca}/modelos/${modelo}/anos/${ano}`);

// "R$ 145.000,00" -> 145000
export function precoParaNumero(texto) {
    return Number(String(texto).replace(/[^\d,]/g, "").replace(",", ".")) || 0;
}
