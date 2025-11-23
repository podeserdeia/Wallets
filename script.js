// --- Funções de Armazenamento Local ---
function saveToLocalStorage() {
    localStorage.setItem("wallets", JSON.stringify(wallets));
    localStorage.setItem("transactions", JSON.stringify(transactions));
}

// Defina a quantidade maxima de tokens ao pesquisar
const SEARCH_MAX_LENGTH = 50;

// Defina quanto tempo a lista de tokens deve persistir
const TOKEN_PERSIST_DAYS = 1;

// Dados padrão para carregar se o localStorage estiver vazio
// Estes dados são baseados no seu arquivo data.json fornecido.
const DEFAULT_INITIAL_DATA = {
    "wallets": [
        {
            "id": 1,
            "name": "Minha Carteira Principal",
            "address": "0x1234567890abcdef1234567890abcdef12345678",
            "balances": [
                {
                    "id": 1,
                    "network": "Ethereum",
                    "token": "ethereum",
                    "balance": 0.5
                },
                {
                    "id": 2,
                    "network": "BSC",
                    "token": "BNB",
                    "balance": 0.1 // Alterei para positivo para exemplo
                }
            ]
        },
        {
            "id": 2,
            "name": "Carteira Secundária",
            "address": "0xabcdef1234567890abcdef1234567890abcdef12",
            "balances": []
        }
    ],
    "transactions": [
        {
            "id": 1,
            "wallet_id": 1,
            "network": "Ethereum",
            "token": "ETH",
            "type": "entrada",
            "amount": 0.5,
            "description": "Compra de ETH na exchange",
            "date": "2025-07-15T10:34:49.292068"
        },
        {
            "id": 2,
            "wallet_id": 1,
            "network": "BSC",
            "token": "BNB",
            "type": "saida",
            "amount": 0.1,
            "description": "Taxa de transacao BNB",
            "date": "2025-07-15T10:35:10.123456"
        }
    ]
};


function loadFromLocalStorage() {
    const savedWallets = localStorage.getItem("wallets");
    const savedTransactions = localStorage.getItem("transactions");
    const savedListOfTokens = localStorage.getItem("tokens");

    if (savedWallets) {
        wallets = JSON.parse(savedWallets);
    } else {
        // Se não houver carteiras salvas, carrega as carteiras padrão
        wallets = DEFAULT_INITIAL_DATA.wallets;
        console.log("Carteiras carregadas do DEFAULT_INITIAL_DATA.");
    }

    if (savedTransactions) {
        transactions = JSON.parse(savedTransactions);
    } else {
        // Se não houver transações salvas, carrega as transações padrão
        transactions = DEFAULT_INITIAL_DATA.transactions;
        console.log("Transações carregadas do DEFAULT_INITIAL_DATA.");
    }

    if (savedListOfTokens) {
        const local = JSON.parse(savedListOfTokens);

        // Calculate the difference in milliseconds
        const differenceMs = Math.abs((new Date()).getTime() - (new Date(local.date)).getTime());

        const MS_PER_DAY = 1000 * 60 * 60 * 24;
        // Convert the difference to days
        const differenceDays = differenceMs / MS_PER_DAY;

        // Check if the difference is more than 1 day
        if( differenceDays > TOKEN_PERSIST_DAYS){
            fetchAndSaveTokens();
        }else{
            console.log("Lista local");
            listOfTokens = local.list;
        }
    } else {
        fetchAndSaveTokens();
    }

    // Salva os dados padrão no localStorage para futuras visitas
    saveToLocalStorage();
}

// Global variables
let listOfTokens = [];
let wallets = [];
let transactions = [];
let currentWalletId = null; // Usado para adicionar rede/token a uma carteira específica

// CoinGecko API Base URL
const COINGECKO_API_BASE_URL = 'https://api.coingecko.com/api/v3';
const COINGECKO_LIST =  COINGECKO_API_BASE_URL + '/coins/list';
// const COINGECKO_LIST =  '/list.json'; // de teste


// Mock data for the new dashboard (será atualizado com dados reais das carteiras)
const mockDashboardData = {
    netWorth: {
        usd: 0,
        sol: 0,
        jupHoldings: 0.00,
        jupStaked: 0.00
    },
    assets: [],
    positions: []
};

// --- Funções Auxiliares ---

// Cache para preços de tokens por 10 segundos
const tokenPriceCache = {};

/**
 * Busca o preço atual de um token usando a CoinGecko API, com cache de 10 segundos.
 * @param {string} tokenSymbol - O ID da CoinGecko (ex: 'ethereum', 'bitcoin').
 * @returns {Promise<number>} O preço do token em USD. Retorna 1 se não for encontrado ou em caso de erro.
 */
async function fetchTokenPrice(tokenSymbol) {
    // A API da CoinGecko para 'simple/price' aceita o ID da moeda (ex: 'ethereum'), não o símbolo (ex: 'eth').
    const coinGeckoId = tokenSymbol.toLowerCase(); 
    const now = Date.now();

    // Verifica se existe cache válido (10 segundos)
    if (
        tokenPriceCache[coinGeckoId] &&
        now - tokenPriceCache[coinGeckoId].timestamp < 10000
    ) {
        return tokenPriceCache[coinGeckoId].price;
    }

    try {
        const response = await fetch(`${COINGECKO_API_BASE_URL}/simple/price?ids=${coinGeckoId}&vs_currencies=usd`);
        if (!response.ok) {
            console.error(`Erro ao buscar preço para ID ${coinGeckoId}: ${response.status} ${response.statusText}`);
            tokenPriceCache[coinGeckoId] = { price: 1, timestamp: now };
            return 1; // Retorna 1 em caso de erro na resposta
        }
        const data = await response.json();
        const price = data[coinGeckoId]?.usd ?? 1;
        tokenPriceCache[coinGeckoId] = { price, timestamp: now };
        return price;
    } catch (error) {
        console.error(`Falha na requisição para CoinGecko API para ID ${coinGeckoId}:`, error);
        tokenPriceCache[coinGeckoId] = { price: 1, timestamp: now };
        return 1;
    }
}

/**
 * Busca a lista dos tokens usando a CoinGecko API.
 * @returns {Promise<Array<{id: string, symbol: string, name: string}} 
 */
async function fetchTokenList() {
    try {
        const response = await fetch(COINGECKO_LIST);
        if (!response.ok) {
            // Se a resposta não for OK (ex: 429 Too Many Requests, 404 Not Found)
            console.error(`Erro ao buscar lista de tokens`);
            return 1; // Retorna 1 em caso de erro na resposta
        }
        return await response.json();
    } catch (error) {
        console.error(`Falha na requisição da CoinGecko API para a lista de tokens:`, error);
        return 1; // Retorna 1 em caso de erro na rede ou parse
    }
}

function fetchAndSaveTokens(){
    console.log("Nova lista carregada!");
    fetchTokenList().then(s => {
        // Garantir que 's' é uma array antes de salvar
        if (Array.isArray(s)) {
            listOfTokens = s;
            localStorage.setItem("tokens", JSON.stringify({date: (new Date()).toUTCString(), list: s}));
        } else {
             console.error("A lista de tokens retornada pela API não é um array.");
             // Pode tentar carregar do DEFAULT_INITIAL_DATA ou manter vazia
             listOfTokens = [];
        }
    }).catch(error => {
         console.error("Erro ao buscar e salvar tokens:", error);
         listOfTokens = []; // Garante que a lista não é nula em caso de falha
    });
}



/**
 * Formata um valor numérico.
 * Adapta o número de casas decimais para valores muito pequenos.
 * @param {number} balance - O valor a ser formatado.
 * @returns {string} O valor formatado como string, com vírgula para decimais.
 */
function formatBalance(balance) {
    const num = parseFloat(balance);
    if (isNaN(num)) return '0,00'; // Garante que o input é um número válido
    if (num === 0) return '0,00';
    if (Math.abs(num) >= 1) return num.toFixed(2).replace('.', ',');
    if (Math.abs(num) >= 0.01) return num.toFixed(4).replace('.', ',');
    // Se for muito pequeno, mostra mais casas para não arredondar para zero
    return num.toFixed(8).replace('.', ','); 
}

/**
 * Retorna o HTML do ícone Font Awesome para um dado símbolo de token.
 * @param {string} tokenSymbol - O símbolo do token (ex: 'ETH', 'BTC', 'USDC').
 * @returns {string} O HTML do elemento <i> com o ícone Font Awesome.
 */
function getTokenIconHtml(tokenSymbol) {
    // Se tokenSymbol for o ID CoinGecko (ex: 'ethereum'), usa o primeiro símbolo
    const upperSymbol = (tokenSymbol || '').toUpperCase();
    switch (upperSymbol) {
        case 'ETH':
        case 'ETHEREUM':
            return '<i class="fab fa-ethereum"></i>';
        case 'BTC':
        case 'BITCOIN':
            return '<i class="fab fa-bitcoin"></i>';
        case 'USDC':
        case 'USDT':
        case 'DAI':
            return '<i class="fas fa-dollar-sign"></i>'; // Icone de dólar para stablecoins baseadas em USD
        case 'BNB':
        case 'BINANCECOIN':
            return '<i class="fas fa-coins"></i>'; // Sem ícone Font Awesome oficial, usando um genérico
        case 'POL': // Polygon
        case 'POLYGON':
            return '<i class="fas fa-cubes"></i>'; // Ícone genérico de blocos
        case 'XDAI':
            return '<i class="fas fa-coins"></i>'; // Ícone genérico de moedas
        case 'MELON': // Exemplo para o seu "MELON"
            return '<i class="fas fa-seedling"></i>'; // Exemplo de ícone, ajuste se preferir outro
        case 'SOL':
        case 'SOLANA':
            // Assume que Font Awesome 6 está disponível para este ícone
            return '<i class="fab fa-solana"></i>'; 
        case 'USD': // Para representar valores totais em dólar
            return '<i class="fas fa-dollar-sign"></i>';
        default:
            return '<i class="fas fa-circle"></i>'; // Ícone padrão para tokens não mapeados
    }
}

/**
 * Exibe uma notificação no canto superior direito da tela.
 * @param {string} message - A mensagem da notificação.
 * @param {'info'|'success'|'error'} type - O tipo da notificação para estilização.
 */
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        ${message}
    `;

    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 10000;
        animation: slideInRight 0.3s ease;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        gap: 10px;
        max-width: 400px;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Adiciona CSS para as animações de notificação
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }

    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Função auxiliar para limpar opções de select
function clearSelectOptions(selectElement) {
    while (selectElement.children.length > 1) { // Mantém a primeira opção (placeholder)
        selectElement.removeChild(selectElement.lastChild);
    }
}

// --- New Dashboard Functions ---

/**
 * Initializes the new dashboard with mock data
 */
function initializeNewDashboard() {
    updateNetWorthCard();
    updateWalletBreakdownCard();
    updatePositionsSection();
    setupNewDashboardInteractions();
}

/**
 * Updates the Net Worth card with current data
 */
function updateNetWorthCard() {
    const data = mockDashboardData.netWorth;
    
    // Update net worth amount
    const amountEl = document.querySelector('.net-worth-amount');
    if (amountEl) {
        // Usa formatBalance para consistência, mas força 2 casas para o total em USD
        amountEl.textContent = `$${data.usd.toFixed(2).replace('.', ',')}`; 
    }
}

/**
 * Updates the Wallet Breakdown card with asset data
 */
function updateWalletBreakdownCard() {
    const assets = mockDashboardData.assets;
    
    // Update progress bar
    const progressBar = document.querySelector('.assets-progress-bar');
    if (progressBar) {
        progressBar.innerHTML = '';
        assets.forEach(asset => {
            const segment = document.createElement('div');
            // Remove caracteres especiais e espaços para o nome da classe
            segment.className = `progress-segment ${asset.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`; 
            segment.style.width = `${asset.percentage}%`;
            segment.style.backgroundColor = asset.color;
            progressBar.appendChild(segment);
        });
    }
    
    // Update assets list
    const assetsList = document.querySelector('.assets-list');
    if (assetsList) {
        assetsList.innerHTML = '';
        assets.forEach(asset => {
            const assetItem = document.createElement('div');
            assetItem.className = 'asset-item';
            assetItem.innerHTML = `
                <div class="asset-icon" style="background-color: ${asset.color}"></div>
                <div class="asset-info">
                    <span class="asset-name">${asset.name}</span>
                    <span class="asset-percentage">${asset.percentage.toFixed(2)}%</span>
                </div>
            `;
            assetsList.appendChild(assetItem);
        });
    }
}

/**
 * Updates the Positions section with platform data
 */
function updatePositionsSection() {
    const positions = mockDashboardData.positions;
    
    // Update positions grid
    const positionsGrid = document.querySelector('.positions-grid');
    if (positionsGrid) {
        positionsGrid.innerHTML = ''; 
        positions.forEach(position => {
            const positionCard = document.createElement('div');
            // Substitui espaços por traços para o nome da classe
            positionCard.className = `position-card ${position.name.toLowerCase().replace(/\s/g, '-')}`; 
            positionCard.innerHTML = `
                <div class="position-icon" style="background-color: ${position.color}">
                    <i class="${position.icon}"></i>
                </div>
                <div class="position-info">
                    <span class="position-name">${position.name}</span>
                    <span class="position-value">$${position.value.toFixed(2).replace('.', ',')}</span>
                </div>
            `;
            positionsGrid.appendChild(positionCard);
        });
    }
}

/**
 * Sets up interactions for the new dashboard elements
 */
function setupNewDashboardInteractions() {
    // Visibility toggle
    const visibilityToggle = document.querySelector('.visibility-toggle');
    if (visibilityToggle) {
        visibilityToggle.addEventListener('click', () => {
            const icon = visibilityToggle.querySelector('i');
            if (icon.classList.contains('fa-eye')) {
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
                // Hide sensitive data
                document.querySelector('.net-worth-amount').textContent = '****';
            } else {
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
                // Show data again
                updateNetWorthCard();
            }
        });
    }
    
    // Breakdown tabs
    const breakdownTabs = document.querySelectorAll('.breakdown-tab');
    breakdownTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            breakdownTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            if (tab.textContent === 'Platforms') {
                showNotification('Visualização de plataformas será implementada em breve', 'info');
            }
        });
    });
    
    // Position tabs - Updated to handle the new tab system
    const positionTabs = document.querySelectorAll('.position-tab');
    positionTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabType = tab.getAttribute('data-position-tab');
            
            // Remove active class from all tabs and contents
            positionTabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.position-content').forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked tab
            tab.classList.add('active');
            
            // Show corresponding content
            const targetContent = document.getElementById(`${tabType}-content`);
            if (targetContent) {
                targetContent.classList.add('active');
                
                // Load data based on tab type
                if (tabType === 'wallets') {
                    loadWallets();
                } else if (tabType === 'transactions') {
                    loadTransactions();
                } else if (tabType === 'positions') {
                    updatePositionsSection(); // Recarrega as posições se necessário
                }
            }
        });
    });
    
    // Collapse button
    const collapseBtn = document.querySelector('.collapse-btn');
    if (collapseBtn) {
        collapseBtn.addEventListener('click', () => {
            // Note: positionsSection is not used in the logic, removed reference to avoid confusion
            const icon = collapseBtn.querySelector('i');
            const positionContents = document.querySelectorAll('.position-content');
            
            if (icon.classList.contains('fa-chevron-up')) {
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
                positionContents.forEach(content => content.style.display = 'none');
                collapseBtn.innerHTML = 'Expand <i class="fas fa-chevron-down"></i>';
            } else {
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
                // Show the active content
                const activeContent = document.querySelector('.position-content.active');
                if (activeContent) {
                    activeContent.style.display = 'block';
                }
                collapseBtn.innerHTML = 'Collapse <i class="fas fa-chevron-up"></i>';
            }
        });
    }

    const showSearching = document.querySelectorAll('.btn-dropdown');
    showSearching.forEach(btn => {
        btn.addEventListener('click', function() {
            const menu = this.parentElement.querySelector(".dropdown-menu");
            menu.classList.add("show");
            
            if(menu.querySelectorAll(".dropdown-item").length >= 1){
                //Gambiarra pra manter o efeito
                setTimeout(() => {
                    menu.classList.add("full");
                }, 100);
            }
            const input = menu.querySelector(".dropdown-search");
            input.focus();
        });
    });

    const hideSearching = document.querySelectorAll('.dropdown-search');
    hideSearching.forEach(input => {
        input.addEventListener('blur', function() {
            const menu = this.closest(".dropdown-menu");
            setTimeout(() => {
                menu.classList.remove("show");
                menu.classList.remove("full");
            }, 100);
        });

        // Remove tokens duplicados por símbolo e prioriza o "nativo"
function deduplicateTokensBySymbol(tokens) {
    const bySymbol = {};
    const BAD_KEYWORDS = [
        'bridged', 'bridge', 'wormhole', 'binance-peg', 'pegged',
        'wrapped', 'allbridge', 'neonpass', 'osmosis', 'hyperlane',
        'near protocol', 'eclipse', 'evm', 'stake', 'staking'
    ];

    function scoreToken(t) {
        const name = (t.name || '').toLowerCase();
        const id = (t.id || '').toLowerCase();

        let score = 0;

        // NÃO ter palavras de bridge/peg/etc dá muitos pontos
        if (!BAD_KEYWORDS.some(k => name.includes(k))) score += 50;

        // nomes menores tendem a ser o ativo nativo (ex: "Solana" vs "Allbridge Bridged SOL (Near Protocol)")
        score += Math.max(0, 30 - name.length);

        // ids simples (sem muito traço) também contam um pouco
        if (!id.includes('-')) score += 5;

        return score;
    }

    tokens.forEach(t => {
        const symbol = (t.symbol || '').toLowerCase();
        if (!symbol) return;

        if (!bySymbol[symbol]) {
            bySymbol[symbol] = t;
        } else {
            const current = bySymbol[symbol];
            if (scoreToken(t) > scoreToken(current)) {
                bySymbol[symbol] = t;
            }
        }
    });

    return Object.values(bySymbol);
}

            // --- Lógica de Pesquisa Corrigida ---
            input.addEventListener('keyup', function() {
                const search = this.value.trim().toLowerCase();
                const menu = this.closest(".dropdown-menu");
                const list = menu.querySelector(".dropdown-list");
                list.innerHTML = ""; // Limpa resultados anteriores

                let filter = [];

                if (search.length > 0) {
                    const allTokens = listOfTokens;
                    
                    // 1) Símbolo Exato (Prioridade Máxima)
                    const bySymbolExact = allTokens.filter(s =>
                        (s.symbol || '').toLowerCase() === search
                    );
                    
                    // 2) Símbolo Contendo o Texto
                    const bySymbolPartial = allTokens.filter(s =>
                        (s.symbol || '').toLowerCase().includes(search) &&
                        (s.symbol || '').toLowerCase() !== search // Exclui os exatos já capturados
                    );
                    
                    // 3) Nome Contendo o Texto
                    const byNamePartial = allTokens.filter(s =>
                        (s.name || '').toLowerCase().includes(search)
                    );
                    
                    // Concatena na ordem de prioridade
                    filter = [...bySymbolExact, ...bySymbolPartial, ...byNamePartial];

                    // Remove duplicados e escolhe o "nativo" pra cada símbolo
                    filter = deduplicateTokensBySymbol(filter);

                    // Aplica limite final
                    filter = filter.slice(0, SEARCH_MAX_LENGTH);
                }
                
                // Ajusta o tamanho do menu
                if(filter.length > 5){
                    menu.classList.add("full");
                }else{
                    menu.classList.remove("full");
                }

                // Renderiza os resultados
                filter.forEach(s => {
                    list.appendChild(createDropdownItemElement(s)); // Não precisa do 'this.value'
                });
            });
            // --- Fim Lógica de Pesquisa Corrigida ---
    });
}

/**
 * Creates a new dropdown item element based on token data.
 * @param {object} token - An object containing id, symbol, and name properties.
 * @param {string} token.id - O ID da CoinGecko (ex: 'ethereum').
 * @param {string} token.symbol - O símbolo do token (ex: BTC).
 * @param {string} token.name - O nome completo do token (ex: Bitcoin).
 * @returns {HTMLDivElement} The newly created div element.
 */
function createDropdownItemElement(token) {
    // 1. Create the <div> element
    const dropdownItem = document.createElement('div');

    // 2. Add the class 'dropdown-item'
    dropdownItem.classList.add('dropdown-item');

    // 3. Set the data-id e data-name attributes (ID da CoinGecko e Nome Completo)
    dropdownItem.setAttribute('data-id', token.id);
    dropdownItem.setAttribute('data-name', token.name);

    // 4. Set the text content
    // Exibe Símbolo - Nome para clareza
    dropdownItem.textContent = `${(token.symbol || 'N/A').toUpperCase()} - ${token.name || 'Nome Desconhecido'}`;
    
    // --- Lógica de Clique Corrigida ---
    dropdownItem.addEventListener("click", function() {
        const main = this.closest(".dropdown");
        const tokenID = this.dataset.id;
        const tokenName = this.dataset.name;
        
        // Define o nome visível
        main.querySelector(".btn-dropdown-text").innerText = tokenName;
        // Define o ID do CoinGecko no input oculto (#tokenInput)
        main.querySelector("#tokenInput").value = tokenID; 
        
        // Fechar o dropdown após a seleção
        const menu = main.querySelector(".dropdown-menu");
        menu.classList.remove("show");
        menu.classList.remove("full");
    });
    // --- Fim Lógica de Clique Corrigida ---

    return dropdownItem;
}



// --- Funções de Carregamento de Dados (chamadas à API) ---

/**
 * Carrega as carteiras do localStorage e atualiza a UI.
 */
async function loadWallets() {
    try {
        // loadFromLocalStorage(); // Garante que 'wallets' está populado
        renderWallets();
        updateWalletSelects();
    } catch (error) {
        console.error('Erro ao carregar carteiras:', error);
        showNotification('Erro ao carregar carteiras', 'error');
    }
}

/**
 * Carrega as transações da API e atualiza a UI.
 */
async function loadTransactions() {
    try {
        // As transações já estão carregadas no array global 'transactions' pelo loadFromLocalStorage
        renderTransactions();
        updateFilters();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

/**
 * Carrega os dados do dashboard (saldos totais, por rede/token) e atualiza a UI.
 */
async function loadDashboard() {
    try {
        let totalBalanceUSD = 0;
        let totalBalanceSOL = 0;

        const balanceByNetwork = {};
        const balanceByToken = {};
        const walletBalances = [];
        const uniqueIds = new Set(); // Para coletar IDs (CoinGecko) de tokens únicos para buscar preços

        // Primeiro, coleta os balanços e IDs únicos
        wallets.forEach(wallet => {
            let walletTotalBalance = 0;
            const walletNetworks = [];

            wallet.balances.forEach(balance => {
                // O campo `token` no `balances` é o ID da CoinGecko (ex: 'ethereum').
                uniqueIds.add(balance.token); 
                walletNetworks.push({
                    network: balance.network,
                    token: balance.token, // ID da CoinGecko
                    balance: balance.balance
                });
            });
            walletBalances.push({
                id: wallet.id,
                name: wallet.name,
                total_balance: 0, // Será preenchido após buscar preços
                networks: walletNetworks
            });
        });

        // Mapeia tokens únicos para seus preços
        const tokenPrices = {};
        // Usa os IDs únicos para buscar preços
        await Promise.all(Array.from(uniqueIds).map(async id => {
            tokenPrices[id] = await fetchTokenPrice(id);
        }));

        // Agora, calcula os balanços totais e por rede/token usando os preços reais
        wallets.forEach(wallet => {
            let walletTotalBalance = 0;
            wallet.balances.forEach(balance => {
                const tokenId = balance.token; // ID da CoinGecko
                const price = tokenPrices[tokenId] || 1; // Usa 1 como fallback se o preço não foi encontrado
                const valueInUSD = balance.balance * price;
                walletTotalBalance += valueInUSD;

                balanceByNetwork[balance.network] = (balanceByNetwork[balance.network] || 0) + valueInUSD;
                // Usa o tokenId (ex: ethereum) para agrupar por token
                balanceByToken[tokenId.toUpperCase()] = (balanceByToken[tokenId.toUpperCase()] || 0) + valueInUSD; 
            });

            // Atualiza o total_balance para a carteira no mockDashboardData
            const currentWalletInMock = walletBalances.find(w => w.id === wallet.id);
            if(currentWalletInMock) {
                currentWalletInMock.total_balance = walletTotalBalance;
            }
            totalBalanceUSD += walletTotalBalance;
        });

        // Calcula o total de SOL (se aplicável, aqui apenas um mock, ou você pode buscar o preço do SOL)
        // Usa o preço de 'solana' se ele estiver na lista de symbols buscados, senão usa um fallback
        const solPrice = tokenPrices['solana'] || 30; 
        totalBalanceSOL = totalBalanceUSD / solPrice; 

        const dashboardData = {
            netWorth: {
                usd: totalBalanceUSD,
                sol: totalBalanceSOL,
                jupHoldings: 0.00,
                jupStaked: 0.00
            },
            assets: [],
            positions: []
        };

        // Preenche assets com base em balanceByToken
        const totalAssetsValue = Object.values(balanceByToken).reduce((sum, val) => sum + val, 0);
        const sortedTokens = Object.entries(balanceByToken).sort(([, a], [, b]) => b - a); // Ordena por valor

        // Pega os 5 maiores e agrupa o restante em "Others"
        let othersPercentage = 0;
        let othersCount = 0;
        for (let i = 0; i < sortedTokens.length; i++) {
            const [token, value] = sortedTokens[i];
            const percentage = (value / totalAssetsValue) * 100;
            if (i < 5) { // Mostra os 5 primeiros
                dashboardData.assets.push({
                    name: token,
                    percentage: isNaN(percentage) ? 0 : percentage,
                    color: getRandomColor() 
                });
            } else { // Agrupa o restante
                othersPercentage += percentage;
                othersCount++;
            }
        }
        if (othersCount > 0) {
            dashboardData.assets.push({
                name: `Others (${othersCount})`,
                percentage: othersPercentage,
                color: getRandomColor()
            });
        }

        // Preenche positions com base em walletBalances
        dashboardData.positions = walletBalances.map(wallet => ({
            name: wallet.name,
            value: wallet.total_balance,
            icon: 'fas fa-wallet', 
            color: getRandomColor()
        }));

        // Atualiza os dados mockados com os dados calculados
        mockDashboardData.netWorth = dashboardData.netWorth;
        mockDashboardData.assets = dashboardData.assets;
        mockDashboardData.positions = dashboardData.positions;

        renderDashboard({
            balance_by_network: balanceByNetwork,
            balance_by_token: balanceByToken,
            wallet_balances: walletBalances
        });

        // Atualiza o card de Net Worth e Wallet Breakdown com os novos dados
        updateNetWorthCard();
        updateWalletBreakdownCard();
        updatePositionsSection();

    } catch (error) {
        showNotification(`Erro ao carregar dashboard: ${error.message}`, 'error');
        console.error('Erro ao carregar dashboard:', error);
    }
}


// Função auxiliar para gerar cores aleatórias (para os gráficos)
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

/**
 * Carrega os dados dos tokens e atualiza a UI.
 * Agora busca o preço atual de mercado da CoinGecko API.
 */
async function loadTokens() {
    try {
        const userTokens = {};

        wallets.forEach(wallet => {
            wallet.balances.forEach(balance => {
                // Usa o token ID da CoinGecko como chave
                const tokenId = balance.token; 
                // Usamos o ID do balanço para a chave
                if (!userTokens[tokenId]) {
                    userTokens[tokenId] = {
                        name: tokenId.toUpperCase(), // Nome provisório, usaremos o ID em maiúsculo
                        symbol: tokenId, // Usamos o ID como 'symbol' para a busca de preço
                        type: balance.network, 
                        balance: 0,
                        price: 0, // Preço inicializado como 0
                        value: 0,
                        logo: '' // Adicione lógica para logos reais se tiver URLs
                    };
                }
                userTokens[tokenId].balance += balance.balance;
            });
        });

        const tokensArray = Object.values(userTokens);

        // Para cada token, busca o preço real e calcula o valor
        await Promise.all(tokensArray.map(async token => {
            // Usa o 'token.symbol' (que é o ID da CoinGecko) para buscar o preço
            const price = await fetchTokenPrice(token.symbol); 
            token.price = price;
            token.value = token.balance * token.price;
        }));

        renderTokens(tokensArray);
    } catch (error) {
        showNotification(`Erro ao carregar tokens: ${error.message}`, 'error');
        console.error('Erro ao carregar tokens:', error);
    }
}

/**
 * Carrega todos os dados iniciais da aplicação.
 * Usado no carregamento inicial da página.
 */
async function loadData() {
    // loadFromLocalStorage(); // Garante que os dados do localStorage são carregados primeiro
    await loadTokens(); // Carrega tokens e seus preços
    await loadDashboard(); // Usa os preços carregados para o dashboard
    await loadWallets();
    await loadTransactions();
}

// --- Funções de Renderização da UI ---

/**
 * Renderiza os dados do dashboard nos elementos HTML correspondentes.
 * @param {object} data - Objeto com os dados de balanço (total, por rede, por token, por carteira).
 */
function renderDashboard(data) {
    // Saldos por rede
    const networkBalancesEl = document.getElementById('networkBalances');
    networkBalancesEl.innerHTML = '';
    if (Object.keys(data.balance_by_network).length === 0) {
        networkBalancesEl.innerHTML = '<div class="empty-state"><i class="fas fa-network-wired"></i><p>Nenhuma rede cadastrada</p></div>';
    } else {
        Object.entries(data.balance_by_network).forEach(([network, balance]) => {
            const networkItem = document.createElement('div');
            networkItem.className = 'network-item';
            networkItem.innerHTML = `
                <span class="network-name"><i class="fas fa-network-wired"></i> ${network}</span>
                <span class="network-balance">${getTokenIconHtml('USD')} ${formatBalance(balance)}</span>
            `;
            networkBalancesEl.appendChild(networkItem);
        });
    }

    // Saldos por token
    const tokenBalancesEl = document.getElementById('tokenBalances');
    tokenBalancesEl.innerHTML = '';
    if (Object.keys(data.balance_by_token).length === 0) {
        tokenBalancesEl.innerHTML = '<div class="empty-state"><i class="fas fa-coins"></i><p>Nenhum token cadastrado</p></div>';
    } else {
        Object.entries(data.balance_by_token).forEach(([token, balance]) => {
            const tokenItem = document.createElement('div');
            tokenItem.className = 'token-item';
            // O nome do token aqui é o ID em maiúsculo (ex: ETHEREUM)
            tokenItem.innerHTML = ` 
                <span class="token-name">${token}</span>
                <span class="token-balance">${getTokenIconHtml(token)} ${formatBalance(balance)}</span>
            `;
            tokenBalancesEl.appendChild(tokenItem);
        });
    }

    // Resumo das carteiras
    const walletsListEl = document.getElementById('walletsList');
    walletsListEl.innerHTML = '';
    if (data.wallet_balances.length === 0) {
        walletsListEl.innerHTML = '<div class="empty-state"><i class="fas fa-wallet"></i><p>Nenhuma carteira cadastrada</p></div>';
    } else {
        data.wallet_balances.forEach(wallet => {
            const walletItem = document.createElement('div');
            walletItem.className = 'wallet-summary-item';

            const networksHtml = wallet.networks.map(n => {
                const icon = getTokenIconHtml(n.token); // n.token é o ID CoinGecko (ex: ethereum)
                // Exibe o ID em maiúsculo (ex: ETHEREUM)
                return `<span class="wallet-summary-network">${n.network}<span class="wallet-summary-token">${n.token.toUpperCase()}</span>: ${icon} ${formatBalance(n.balance)}</span>`;
            }).join('');

            walletItem.innerHTML = `
                <div>
                    <span class="wallet-summary-name">${wallet.name}</span>
                    <div class="wallet-summary-networks">${networksHtml}</div>
                </div>
                <span class="wallet-summary-balance">${getTokenIconHtml('USD')} ${formatBalance(wallet.total_balance)}</span>
            `;
            walletsListEl.appendChild(walletItem);
        });
    }
}

/**
 * Renderiza a lista de carteiras na grid de carteiras.
 */
function renderWallets() {
    const walletsGrid = document.getElementById('walletsGrid');
    walletsGrid.innerHTML = '';

    if (wallets.length === 0) {
        walletsGrid.innerHTML = '<div class="empty-state"><i class="fas fa-wallet"></i><h3>Nenhuma carteira cadastrada</h3><p>Clique em "Adicionar Carteira" para começar</p></div>';
        return;
    }

    wallets.forEach(wallet => {
        const walletCard = document.createElement('div');
        walletCard.className = 'wallet-card wallet-card-expanded';

        let totalBalance = 0;
        // Para calcular o total da carteira em USD, precisamos dos preços, que são carregados em loadTokens() e loadDashboard()
        // Por isso, garantir que loadTokens/loadDashboard sejam chamados antes para que `mockDashboardData.positions` esteja atualizado
        const walletInMock = mockDashboardData.positions.find(p => p.name === wallet.name);
        if(walletInMock) {
            totalBalance = walletInMock.value;
        }

        const networksHtml = wallet.balances.map(balance => `
            <div class="network-badge-enhanced">
                <i class="fas fa-network-wired"></i>
                <span class="network-name">${balance.network}</span>
                <span class="token-display">${balance.token.toUpperCase()}</span>
                <span class="balance-display">${getTokenIconHtml(balance.token)} ${formatBalance(balance.balance)}</span>
                <button class="remove-network" onclick="removeNetworkFromWallet(${wallet.id}, ${balance.id})" title="Remover rede">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        walletCard.innerHTML = `
            <div class="wallet-header">
                <div class="wallet-name">${wallet.name}</div>
                <button class="btn btn-danger" onclick="deleteWallet(${wallet.id})" title="Remover carteira">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="wallet-address">${wallet.address}</div>
            <div class="wallet-total-balance">Total: ${getTokenIconHtml('USD')} ${formatBalance(totalBalance)}</div>
            <div class="wallet-networks">
                ${networksHtml}
                <button class="add-network-btn" onclick="showAddNetworkModal(${wallet.id})">
                    <i class="fas fa-plus"></i> Adicionar Rede/Token
                </button>
            </div>
        `;
        walletsGrid.appendChild(walletCard);
    });
}

/**
 * Renderiza a lista de transações, aplicando filtros se existirem.
 */
function renderTransactions() {
    const transactionsList = document.getElementById('transactionsList');
    transactionsList.innerHTML = '';

    const walletFilter = document.getElementById('walletFilter').value;
    const networkFilter = document.getElementById('networkFilter').value;
    const tokenFilter = document.getElementById('tokenFilter').value;
    let filteredTransactions = transactions;

    if (walletFilter) {
        filteredTransactions = filteredTransactions.filter(t => t.wallet_id == walletFilter);
    }

    if (networkFilter) {
        filteredTransactions = filteredTransactions.filter(t => t.network === networkFilter);
    }

    if (tokenFilter) {
        filteredTransactions = filteredTransactions.filter(t => t.token === tokenFilter);
    }

    if (filteredTransactions.length === 0) {
        transactionsList.innerHTML = '<div class="empty-state"><i class="fas fa-exchange-alt"></i><h3>Nenhuma transação encontrada</h3><p>Adicione transações para acompanhar o histórico</p></div>';
        return;
    }

    filteredTransactions.forEach(transaction => {
        const transactionItem = document.createElement('div');
        transactionItem.className = 'transaction-item';

        const date = new Date(transaction.date).toLocaleDateString('pt-BR');
        const amount = Math.abs(transaction.amount);
        const sign = transaction.type === 'entrada' ? '+' : '-';

        // Tenta encontrar o nome da carteira pelo ID, se não estiver na transação
        const walletName = transaction.wallet_name || (wallets.find(w => w.id === transaction.wallet_id)?.name || `Carteira #${transaction.wallet_id}`);

        transactionItem.innerHTML = `
            <div class="transaction-type ${transaction.type}">
                <i class="fas ${transaction.type === 'entrada' ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
            </div>
            <div class="transaction-info">
                <h4>${transaction.description || 'Sem descrição'}</h4>
                <p>${walletName}
                    <span class="transaction-network">${transaction.network}</span>
                    <span class="transaction-token">${transaction.token.toUpperCase()}</span>
                </p>
            </div>
            <div class="transaction-amount ${transaction.type}">
                ${sign}${getTokenIconHtml(transaction.token)} ${formatBalance(amount)}
            </div>
            <div class="transaction-date">${date}</div>
        `;
        transactionsList.appendChild(transactionItem);
    });
}

/**
 * Renderiza a tabela de tokens com os dados fornecidos.
 * @param {Array<object>} tokens - Array de objetos de token.
 */
function renderTokens(tokens) {
    const tokensTableBody = document.getElementById('tokensTableBody');
    const tokensEmptyState = document.getElementById('tokensEmptyState');
    const tokensCount = document.querySelector('.tokens-count');
    
    tokensTableBody.innerHTML = '';

    if (tokens.length === 0) {
        tokensEmptyState.style.display = 'block';
        tokensCount.textContent = '$0'; 
        return;
    }

    tokensEmptyState.style.display = 'none';
    
    // Calcula o valor total dos tokens
    const totalValue = tokens.reduce((sum, token) => sum + token.value, 0);
    tokensCount.innerHTML = `${getTokenIconHtml('USD')}${formatBalance(totalValue)}`; 

    tokens.forEach(token => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div class="token-info">
                    <img src="${token.logo}" alt="${token.name} Logo" class="token-logo" onerror="this.style.display='none'">
                    <span class="token-name">${token.symbol.toUpperCase()}</span> 
                </div>
            </td>
            <td><span class="token-type-badge">${token.type}</span></td>
            <td class="balance">${formatBalance(token.balance)} ${token.symbol.toUpperCase()}</td>
            <td class="price">${getTokenIconHtml('USD')}${formatBalance(token.price)}</td>
            <td class="value">${getTokenIconHtml('USD')}${formatBalance(token.value)}</td>
            `;
        tokensTableBody.appendChild(row);
    });
}

// --- Funções de Atualização de Elementos de Formulário/Filtro ---

/**
 * Atualiza os elementos select que listam as carteiras (ex: formulário de transação, filtro de carteiras).
 */
function updateWalletSelects() {
    const selects = ['transactionWallet', 'walletFilter'];

    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        const currentValue = select.value; // Salva o valor atual antes de limpar

        clearSelectOptions(select); // Limpa as opções existentes (mantém o placeholder)

        wallets.forEach(wallet => {
            const option = document.createElement('option');
            option.value = wallet.id;
            option.textContent = wallet.name;
            select.appendChild(option);
        });

        // Restaura o valor anterior se ele ainda existir nas novas opções
        if (currentValue && select.querySelector(`option[value="${currentValue}"]`)) {
            select.value = currentValue;
        }
    });
}

/**
 * Atualiza todos os filtros de transações (rede e token).
 */
function updateFilters() {
    updateNetworkFilter();
    updateTokenFilter();
}

/**
 * Atualiza o filtro de rede com base nas redes existentes nas transações.
 */
function updateNetworkFilter() {
    const networkFilter = document.getElementById('networkFilter');
    const currentValue = networkFilter.value;

    clearSelectOptions(networkFilter);

    // Obtém redes únicas das transações
    const networks = [...new Set(transactions.map(t => t.network))];

    networks.forEach(network => {
        const option = document.createElement('option');
        option.value = network;
        option.textContent = network;
        networkFilter.appendChild(option);
    });

    if (currentValue && networks.includes(currentValue)) {
        networkFilter.value = currentValue;
    }
}

/**
 * Atualiza o filtro de token com base nos tokens existentes nas transações.
 */
function updateTokenFilter() {
    const tokenFilter = document.getElementById('tokenFilter');
    const currentValue = tokenFilter.value;

    clearSelectOptions(tokenFilter);

    // Obtém tokens únicos das transações (ID CoinGecko)
    const tokens = [...new Set(transactions.map(t => t.token))];

    tokens.forEach(token => {
        const option = document.createElement('option');
        option.value = token;
        option.textContent = token.toUpperCase(); // Exibe o ID em maiúsculo
        tokenFilter.appendChild(option);
    });

    if (currentValue && tokens.includes(currentValue)) {
        tokenFilter.value = currentValue;
    }
}

/**
 * Atualiza as opções de rede/token no formulário de transação com base na carteira selecionada.
 */
function updateTransactionNetworkTokens() {
    const walletId = document.getElementById('transactionWallet').value;
    const networkTokenSelect = document.getElementById('transactionNetworkToken');

    // Limpa as opções existentes e adiciona o placeholder
    networkTokenSelect.innerHTML = '<option value="">Selecione uma rede e token</option>';

    if (walletId) {
        const wallet = wallets.find(w => w.id == walletId);
        if (wallet && wallet.balances.length > 0) {
            wallet.balances.forEach(balance => {
                const option = document.createElement('option');
                // Combina rede e token (ID CoinGecko) no valor
                option.value = `${balance.network}|${balance.token}`; 
                // Exibe Rede - ID em maiúsculo
                option.textContent = `${balance.network} - ${balance.token.toUpperCase()}`; 
                networkTokenSelect.appendChild(option);
            });
        }
    }
}

// --- Funções de Gerenciamento de UI (Abas e Modals) ---

/**
 * Inicializa a funcionalidade das abas na interface.
 * Adiciona listeners para alternar entre conteúdos.
 */
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');

            // Remove a classe 'active' de todas as abas e conteúdos
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Adiciona a classe 'active' à aba clicada e ao conteúdo correspondente
            button.classList.add('active');
            document.getElementById(tabId).classList.add('active');

            // Carrega dados específicos para as abas conforme elas são ativadas
            if (tabId === 'dashboard') {
                loadDashboard();
            } else if (tabId === 'wallets') {
                loadWallets();
            } else if (tabId === 'transactions') {
                loadTransactions();
            } else if (tabId === 'tokens') { // Certifica que tokens é carregado
                loadTokens();
            }
        });
    });

    // Ativa a aba "Dashboard" por padrão no carregamento inicial
    const defaultTab = document.querySelector('.tab-btn[data-tab="dashboard"]');
    if (defaultTab) {
        defaultTab.click(); // Simula um clique para carregar o conteúdo inicial do dashboard
    }
}

/**
 * Configura os event listeners para os formulários e filtros.
 */
function setupForms() {
    // Botão e Formulário de Adicionar Carteira
    document.getElementById('showAddWalletModalBtn').addEventListener('click', showAddWalletModal);
    document.getElementById('addWalletForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = {
            name: document.getElementById('walletName').value,
            address: document.getElementById('walletAddress').value
        };

        if (!formData.name || !formData.address) {
             showNotification('Nome e endereço são obrigatórios', 'error');
             return;
        }

        try {
            // Adiciona a nova carteira ao array local
            const newWallet = {
                id: wallets.length > 0 ? Math.max(...wallets.map(w => w.id)) + 1 : 1,
                name: formData.name,
                address: formData.address,
                balances: []
            };
            wallets.push(newWallet);
            saveToLocalStorage();

            closeModal("addWalletModal");
            document.getElementById("addWalletForm").reset();
            // Recarrega todos os dados afetados pela adição de uma carteira
            await loadData(); // Isso irá garantir que tudo seja atualizado na ordem correta
            showNotification("Carteira adicionada com sucesso!", "success");
        } catch (error) {
            showNotification(error.message, "error");
        }
    });

    // Formulário de Adicionar Rede/Token a uma Carteira
    document.getElementById('addNetworkForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        // O #tokenInput agora guarda o ID da CoinGecko
        const tokenCoinGeckoId = document.getElementById('tokenInput').value.trim();
        // O btn-dropdown-text guarda o Nome completo (ex: Bitcoin)
        const tokenName = document.querySelector(".dropdown-search").value.trim() || document.querySelector(".btn-dropdown-text").innerText.trim();
        
        // Tenta encontrar o símbolo a partir do ID na lista de tokens
        let tokenSymbol = tokenCoinGeckoId; // Fallback: usa o ID como símbolo
        const foundToken = listOfTokens.find(t => t.id === tokenCoinGeckoId);
        if (foundToken) {
            tokenSymbol = foundToken.symbol; // Usa o símbolo real se encontrado
        } else {
            // Se não encontrou, tenta deduzir o símbolo a partir do nome se for um token simples (ex: ETH)
            tokenSymbol = tokenName.toUpperCase();
        }

        const formData = {
            network: document.getElementById('networkInput').value.trim(),
            // CORREÇÃO: Usamos APENAS o ID da CoinGecko (que é o que o fetchTokenPrice precisa)
            token: tokenCoinGeckoId, 
            balance: parseFloat(document.getElementById('initialBalance').value) || 0
        };

        if (!formData.network || !formData.token) {
            showNotification('Rede e token são obrigatórios', 'error');
            return;
        }

        if (isNaN(formData.balance) || formData.balance < 0) {
             showNotification('Saldo inicial deve ser um valor numérico positivo', 'error');
             return;
        }

        try {
            const wallet = wallets.find(w => w.id === currentWalletId);
            if (!wallet) {
                throw new Error("Carteira não encontrada");
            }

            // Verifica se a combinação rede/token já existe
            const existingBalance = wallet.balances.find(b => 
                b.network === formData.network && b.token === formData.token
            );

            if (existingBalance) {
                // Atualiza o saldo existente
                existingBalance.balance += formData.balance; 
            } else {
                // Adiciona o novo saldo ao array de balances da carteira
                const newBalance = {
                    id: wallet.balances.length > 0 ? Math.max(...wallet.balances.map(b => b.id)) + 1 : 1,
                    network: formData.network,
                    token: formData.token, // ID da CoinGecko
                    balance: formData.balance
                };
                wallet.balances.push(newBalance);
            }

            saveToLocalStorage();

            closeModal("addNetworkModal");
            //Limpar modal
            document.getElementById("addNetworkForm").reset();
            document.querySelector(".btn-dropdown-text").innerHTML = "<div>Ex: ETH, wETH, POL, USDC</div>";
            document.querySelector(".dropdown-search").value = "";
            document.querySelector("#tokenInput").value = ""; // Limpa o ID CoinGecko
            document.querySelector(".dropdown-list").innerHTML = "";

            // Recarrega todos os dados, pois adição de rede/token afeta carteiras, dashboard e tokens
            await loadData();
            showNotification("Rede e token adicionados com sucesso!", "success");
        } catch (error) {
            showNotification(error.message, "error");
        }
    });

    // Formulário de Adicionar Transação
    document.getElementById('addTransactionForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const networkTokenValue = document.getElementById('transactionNetworkToken').value;
        if (!networkTokenValue) {
            showNotification('Selecione uma rede e token', 'error');
            return;
        }

        // Separa a rede e o token (ID CoinGecko) do valor combinado no select
        const [network, token] = networkTokenValue.split('|');

        const formData = {
            wallet_id: parseInt(document.getElementById('transactionWallet').value),
            network: network,
            token: token, // ID da CoinGecko
            type: document.getElementById('transactionType').value,
            amount: parseFloat(document.getElementById('transactionAmount').value),
            description: document.getElementById('transactionDescription').value
        };

        if (isNaN(formData.amount) || formData.amount <= 0) {
             showNotification('Valor da transação inválido', 'error');
             return;
        }


        try {
            // Encontra a carteira para obter o nome
            const wallet = wallets.find(w => w.id === formData.wallet_id);
            if (!wallet) {
                throw new Error("Carteira não encontrada");
            }

            // Atualiza o saldo do token na carteira
            const balanceToUpdate = wallet.balances.find(b => b.network === network && b.token === token);
            if (balanceToUpdate) {
                if (formData.type === 'entrada') {
                    balanceToUpdate.balance += formData.amount;
                } else {
                    balanceToUpdate.balance -= formData.amount;
                }
            } else {
                // Se o token não existir na carteira para a rede, adiciona
                const newBalanceId = wallet.balances.length > 0 ? Math.max(...wallet.balances.map(b => b.id)) + 1 : 1;
                // O saldo inicial será o valor da transação. 
                // Note que o saldo pode ser negativo se for uma 'saida' e o token não existia.
                wallet.balances.push({
                    id: newBalanceId,
                    network: network,
                    token: token, // ID da CoinGecko
                    balance: formData.type === 'entrada' ? formData.amount : -formData.amount
                });
            }


            // Adiciona a nova transação ao array local
            const newTransaction = {
                id: transactions.length > 0 ? Math.max(...transactions.map(t => t.id)) + 1 : 1,
                date: new Date().toISOString(), // Data atual
                wallet_name: wallet.name, // Guarda o nome da carteira na transação
                ...formData
            };
            transactions.push(newTransaction);
            saveToLocalStorage();

            closeModal("addTransactionModal");
            document.getElementById("addTransactionForm").reset();
            // Recarrega todos os dados, pois transações afetam o histórico, saldos de carteiras e o dashboard
            await loadData();
            showNotification("Transação adicionada com sucesso!", "success");
        } catch (error) {
            showNotification(error.message, "error");
        }
    });

    // Listeners para os filtros de transações
    document.getElementById('walletFilter').addEventListener('change', renderTransactions);
    document.getElementById('networkFilter').addEventListener('change', renderTransactions);
    document.getElementById('tokenFilter').addEventListener('change', renderTransactions);

    // Listener para atualizar as opções de rede/token no formulário de transação quando a carteira muda
    document.getElementById('transactionWallet').addEventListener('change', updateTransactionNetworkTokens);
}

// Funções para mostrar e fechar modais
function showAddWalletModal() {
    document.getElementById('addWalletModal').classList.add('active');
}

function showAddNetworkModal(walletId) {
    currentWalletId = walletId; // Define a carteira atual para o modal de adicionar rede
    // Reseta o formulário e os campos de busca ao abrir
    document.getElementById("addNetworkForm").reset();
    document.querySelector(".btn-dropdown-text").innerHTML = "<div>Ex: ETH, wETH, POL, USDC</div>";
    document.querySelector(".dropdown-search").value = "";
    document.querySelector("#tokenInput").value = "";
    document.querySelector(".dropdown-list").innerHTML = "";

    document.getElementById('addNetworkModal').classList.add('active');
}

function showAddTransactionModal() {
    document.getElementById('addTransactionModal').classList.add('active');
    updateTransactionNetworkTokens(); // Garante que as opções de rede/token estejam atualizadas
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Fecha qualquer modal que tenha a classe 'modal' ao clicar fora dele
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});

// --- Funções de Exclusão ---

/**
 * Deleta uma carteira da API e atualiza a UI.
 * @param {number} walletId - O ID da carteira a ser deletada.
 */
async function deleteWallet(walletId) {
    if (!confirm('Tem certeza que deseja remover esta carteira? Todas as transações e redes/tokens associadas também serão removidas.')) {
        return;
    }

    try {
        // Remove a carteira do array
        wallets = wallets.filter(wallet => wallet.id !== walletId);
        
        // Remove todas as transações relacionadas à carteira
        transactions = transactions.filter(transaction => transaction.wallet_id !== walletId);
        
        // Salva no localStorage
        saveToLocalStorage();
        
        // Recarrega todos os dados, pois a exclusão de uma carteira afeta a lista de carteiras, transações e o dashboard
        await loadData();
        showNotification("Carteira removida com sucesso!", "success");
    } catch (error) {
        showNotification(error.message, "error");
    }
}

/**
 * Remove uma rede e token específicos de uma carteira.
 * @param {number} walletId - O ID da carteira.
 * @param {number} balanceId - O ID do saldo (rede/token) a ser removido.
 */
async function removeNetworkFromWallet(walletId, balanceId) {
    if (!confirm('Tem certeza que deseja remover esta rede e token da carteira? Isso não altera o histórico de transações.')) {
        return;
    }

    try {
        // Encontra a carteira
        const wallet = wallets.find(w => w.id === walletId);
        if (!wallet) {
            throw new Error("Carteira não encontrada");
        }
        
        // Remove o saldo específico
        wallet.balances = wallet.balances.filter(balance => balance.id !== balanceId);
        
        // Salva no localStorage
        saveToLocalStorage();
        
        // Recarrega carteiras e dashboard, pois a remoção afeta ambos
        await loadData();
        showNotification("Rede e token removidos com sucesso!", "success");
    } catch (error) {
        showNotification(error.message, "error");
    }
}

if (!Element.prototype.closest) {
        // Polyfill para Element.closest em navegadores mais antigos
        Element.prototype.closest = function(selector) {
            let elem = this;
            while (elem && elem.nodeType === 1) { // Check if it's an element node
                if (elem.matches(selector)) {
                    return elem;
                }
                elem = elem.parentNode;
            }
            return null;
        };
    }

// --- Inicialização da Aplicação ---

// Garante que o DOM esteja completamente carregado antes de executar o script
document.addEventListener('DOMContentLoaded', async function() {
    // Carrega dados iniciais do localStorage ou dados padrão
    loadFromLocalStorage(); 

    // Inicializa o novo dashboard (com dados do mockDashboardData que serão atualizados)
    initializeNewDashboard();
    
    // Original initialization (for the integrated functionality)
    initializeTabs();        // Configura as abas
    setupForms();            // Configura os formulários e seus listeners
    
    // Carrega todos os dados, incluindo a busca de preços da CoinGecko
    // O await é importante aqui para garantir que os preços e balanços estejam prontos
    // antes que as renderizações finais aconteçam.
    await loadData();
    
    // Setup interactions for the new dashboard (já feito em initializeNewDashboard, mas garante que todos os listeners estejam lá)
    setupNewDashboardInteractions();
});
