// Importando as ferramentas do Firebase direto da nuvem da Google
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ---> COLE AS SUAS CHAVES GERADAS DO FIREBASE AQUI <---
const firebaseConfig = {
  apiKey: "AIzaSyA4XGEmZIvQP2ZCV32LwGUN2ILTvzFSYTs",
  authDomain: "meu-sistema-d697f.firebaseapp.com",
  projectId: "meu-sistema-d697f",
  storageBucket: "meu-sistema-d697f.firebasestorage.app",
  messagingSenderId: "586853367044",
  appId: "1:586853367044:web:e2c99d1d7906ab0969e451"
};

// Inicializando o Firebase no nosso código
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Pegando os elementos da nossa tela (HTML)
const campoNome = document.getElementById("campoNome");
const campoCargo = document.getElementById("campoCargo");
const botaoSalvar = document.getElementById("botaoSalvar");
const corpoTabela = document.getElementById("corpoTabela");

// Função para buscar os dados salvos no Firebase e preencher a tabela
async function carregarTabela() {
    corpoTabela.innerHTML = ""; // Limpa a tabela para não duplicar
    
    try {
        // Busca a "coleção" (tabela) chamada de "registros" no banco
        const querySnapshot = await getDocs(collection(db, "registros"));
        
        querySnapshot.forEach((doc) => {
            const dados = doc.data();
            const linha = document.createElement("tr");
            linha.innerHTML = `
                <td>${dados.nome}</td>
                <td>${dados.cargo}</td>
            `;
            corpoTabela.appendChild(linha);
        });
    } catch (erro) {
        console.error("Erro ao carregar dados: ", erro);
    }
}

// Ação de clique no botão "Salvar Registro"
botaoSalvar.addEventListener("click", async () => {
    const nome = campoNome.value;
    const cargo = campoCargo.value;

    if (!nome || !cargo) {
        alert("Por favor, preencha todos os campos!");
        return;
    }

    try {
        // Envia os dados para a coleção "registros" lá no Firebase
        await addDoc(collection(db, "registros"), {
            nome: nome,
            cargo: cargo,
            dataCriacao: new Date()
        });

        alert("Salvo com sucesso no banco de dados!");
        
        // Limpa os campos da tela
        campoNome.value = "";
        campoCargo.value = "";

        // Atualiza a tabela na tela na mesma hora
        carregarTabela();
    } catch (erro) {
        console.error("Erro ao salvar os dados: ", erro);
        alert("Erro ao salvar. Verifique o console.");
    }
});

// Assim que a página abre, carrega os dados já existentes
carregarTabela();