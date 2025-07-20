// --- Funções de Armazenamento Local ---
function saveToLocalStorage() {
    localStorage.setItem("wallets", JSON.stringify(wallets));
    localStorage.setItem("transactions", JSON.stringify(transactions));
}

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
                    "token": "ETH",
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
    // Salva os dados padrão no localStorage para futuras visitas
    saveToLocalStorage();
}

// Global variables
let wallets = [];
let transactions = [];
let currentWalletId = null; // Usado para adicionar rede/token a uma carteira específica

// CoinGecko API Base URL
const COINGECKO_API_BASE_URL = 'https://api.coingecko.com/api/v3';

// Mapeamento simples de símbolo para CoinGecko ID
// IMPORTANTE: Expanda este mapa com os IDs CoinGecko dos seus tokens reais.
// Você pode encontrar os IDs em https://www.coingecko.com/en/coins/all
const COINGECKO_TOKEN_MAP = {
    'ETH': 'ethereum',
    'BTC': 'bitcoin',
    'USDC': 'usd-coin',
    'SOL': 'solana',
    'BNB': 'binancecoin',
    'POL': 'polygon',
    'INF': 'injective-protocol',
    'JITOSOL': 'jito-staked-sol',
    'BONK': 'bonk',
    'WSOL': 'wrapped-solana',
    'SSOL': 'synapse-solana',
    // Adicione mais mapeamentos conforme a necessidade dos seus tokens
    // Exemplo: 'UNI': 'uniswap',
};


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

/**
 * Busca o preço atual de um token usando a CoinGecko API.
 * @param {string} tokenSymbol - O símbolo do token (ex: 'eth', 'btc', 'sol').
 * @returns {Promise<number>} O preço do token em USD. Retorna 1 se não for encontrado ou em caso de erro.
 */
async function fetchTokenPrice(tokenSymbol) {
    try {
        const coinGeckoId = COINGECKO_TOKEN_MAP[tokenSymbol.toUpperCase()];

        if (!coinGeckoId) {
            console.warn(`CoinGecko ID não encontrado para o símbolo: ${tokenSymbol}. Usando preço padrão (1 USD).`);
            return 1; // Retorna 1 se o ID não for encontrado
        }

        const response = await fetch(`${COINGECKO_API_BASE_URL}/simple/price?ids=${coinGeckoId}&vs_currencies=usd`);
        if (!response.ok) {
            // Se a resposta não for OK (ex: 429 Too Many Requests, 404 Not Found)
            console.error(`Erro ao buscar preço para ${tokenSymbol} (${coinGeckoId}): ${response.status} ${response.statusText}`);
            return 1; // Retorna 1 em caso de erro na resposta
        }
        const data = await response.json();
        const price = data[coinGeckoId] ? data[coinGeckoId].usd : 1; // Retorna 1 como fallback se o preço não for encontrado no JSON
        return price;
    } catch (error) {
        console.error(`Falha na requisição para CoinGecko API para ${tokenSymbol}:`, error);
        return 1; // Retorna 1 em caso de erro na rede ou parse
    }
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
    return num.toFixed(8).replace('.', ',');
}

/**
 * Retorna o HTML do ícone Font Awesome para um dado símbolo de token.
 * @param {string} tokenSymbol - O símbolo do token (ex: 'ETH', 'BTC', 'USDC').
 * @returns {string} O HTML do elemento <i> com o ícone Font Awesome.
 */
function getTokenIconHtml(tokenSymbol) {
    const upperSymbol = tokenSymbol.toUpperCase();
    switch (upperSymbol) {
        case 'ETH':
            return '<i class="fab fa-ethereum"></i>';
        case 'BTC':
            return '<i class="fab fa-bitcoin"></i>';
        case 'USDC':
            return '<i class="fas fa-dollar-sign"></i>'; // Icone de dólar para stablecoins baseadas em USD
        case 'BNB':
            return '<i class="fas fa-coins"></i>'; // Sem ícone Font Awesome oficial, usando um genérico
        case 'POL': // Polygon
            return '<i class="fas fa-cubes"></i>'; // Ícone genérico de blocos
        case 'XDAI':
            return '<i class="fas fa-coins"></i>'; // Ícone genérico de moedas
        case 'MELON': // Exemplo para o seu "MELON"
            return '<i class="fas fa-seedling"></i>'; // Exemplo de ícone, ajuste se preferir outro
        case 'SOL':
            return '<i class="fab fa-solana"></i>'; // Se Font Awesome tiver (pode precisar de versão mais recente)
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
            const positionsSection = document.querySelector('.positions-section');
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
}

// --- Funções de Carregamento de Dados (chamadas à API) ---

/**
 * Carrega as carteiras do localStorage e atualiza a UI.
 */
async function loadWallets() {
    try {
        loadFromLocalStorage(); // Garante que 'wallets' está populado
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
        const uniqueTokens = new Set(); // Para coletar tokens únicos para buscar preços

        // Primeiro, coleta os balanços e tokens únicos
        wallets.forEach(wallet => {
            let walletTotalBalance = 0;
            const walletNetworks = [];

            wallet.balances.forEach(balance => {
                uniqueTokens.add(balance.token.toUpperCase());
                walletNetworks.push({
                    network: balance.network,
                    token: balance.token,
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
        await Promise.all(Array.from(uniqueTokens).map(async symbol => {
            tokenPrices[symbol] = await fetchTokenPrice(symbol);
        }));

        // Agora, calcula os balanços totais e por rede/token usando os preços reais
        wallets.forEach(wallet => {
            let walletTotalBalance = 0;
            wallet.balances.forEach(balance => {
                const tokenSymbol = balance.token.toUpperCase();
                const price = tokenPrices[tokenSymbol] || 1; // Usa 1 como fallback se o preço não foi encontrado
                const valueInUSD = balance.balance * price;
                walletTotalBalance += valueInUSD;

                balanceByNetwork[balance.network] = (balanceByNetwork[balance.network] || 0) + valueInUSD;
                balanceByToken[tokenSymbol] = (balanceByToken[tokenSymbol] || 0) + valueInUSD;
            });

            // Atualiza o total_balance para a carteira no mockDashboardData
            const currentWalletInMock = walletBalances.find(w => w.id === wallet.id);
            if(currentWalletInMock) {
                currentWalletInMock.total_balance = walletTotalBalance;
            }
            totalBalanceUSD += walletTotalBalance;
        });

        // Calcula o total de SOL (se aplicável, aqui apenas um mock, ou você pode buscar o preço do SOL)
        const solPrice = tokenPrices['SOL'] || 30; // Preço do SOL, se não for buscado
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
                const tokenSymbol = balance.token.toUpperCase(); // Padroniza o símbolo
                if (!userTokens[tokenSymbol]) {
                    userTokens[tokenSymbol] = {
                        name: tokenSymbol, 
                        symbol: tokenSymbol,
                        type: balance.network, 
                        balance: 0,
                        price: 0, // Preço inicializado como 0
                        value: 0,
                        logo: '' // Adicione lógica para logos reais se tiver URLs
                    };
                }
                userTokens[tokenSymbol].balance += balance.balance;
            });
        });

        const tokensArray = Object.values(userTokens);

        // Para cada token, busca o preço real e calcula o valor
        await Promise.all(tokensArray.map(async token => {
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
    loadFromLocalStorage(); // Garante que os dados do localStorage são carregados primeiro
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
                const icon = getTokenIconHtml(n.token);
                return `<span class="wallet-summary-network">${n.network}<span class="wallet-summary-token">${n.token}</span>: ${icon} ${formatBalance(n.balance)}</span>`;
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
                <span class="token-display">${balance.token}</span>
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

        transactionItem.innerHTML = `
            <div class="transaction-type ${transaction.type}">
                <i class="fas ${transaction.type === 'entrada' ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
            </div>
            <div class="transaction-info">
                <h4>${transaction.description || 'Sem descrição'}</h4>
                <p>${transaction.wallet_name}
                    <span class="transaction-network">${transaction.network}</span>
                    <span class="transaction-token">${transaction.token}</span>
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
                    <span class="token-name">${token.name}</span>
                </div>
            </td>
            <td><span class="token-type-badge">${token.type}</span></td>
            <td class="balance">${formatBalance(token.balance)} ${token.symbol}</td>
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

    // Obtém tokens únicos das transações
    const tokens = [...new Set(transactions.map(t => t.token))];

    tokens.forEach(token => {
        const option = document.createElement('option');
        option.value = token;
        option.textContent = token;
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
                option.value = `${balance.network}|${balance.token}`; // Combina rede e token no valor
                option.textContent = `${balance.network} - ${balance.token}`;
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

        const formData = {
            network: document.getElementById('networkInput').value.trim(),
            token: document.getElementById('tokenInput').value.trim().toUpperCase(),
            balance: parseFloat(document.getElementById('initialBalance').value) || 0
        };

        if (!formData.network || !formData.token) {
            showNotification('Rede e token são obrigatórios', 'error');
            return;
        }

        try {
            const wallet = wallets.find(w => w.id === currentWalletId);
            if (!wallet) {
                throw new Error("Carteira não encontrada");
            }

            // Adiciona o novo saldo ao array de balances da carteira
            const newBalance = {
                id: wallet.balances.length > 0 ? Math.max(...wallet.balances.map(b => b.id)) + 1 : 1,
                network: formData.network,
                token: formData.token,
                balance: formData.balance
            };
            wallet.balances.push(newBalance);
            saveToLocalStorage();

            closeModal("addNetworkModal");
            document.getElementById("addNetworkForm").reset();
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

        // Separa a rede e o token do valor combinado no select
        const [network, token] = networkTokenValue.split('|');

        const formData = {
            wallet_id: parseInt(document.getElementById('transactionWallet').value),
            network: network,
            token: token,
            type: document.getElementById('transactionType').value,
            amount: parseFloat(document.getElementById('transactionAmount').value),
            description: document.getElementById('transactionDescription').value
        };

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
                wallet.balances.push({
                    id: newBalanceId,
                    network: network,
                    token: token,
                    balance: formData.type === 'entrada' ? formData.amount : -formData.amount
                });
            }


            // Adiciona a nova transação ao array local
            const newTransaction = {
                id: transactions.length > 0 ? Math.max(...transactions.map(t => t.id)) + 1 : 1,
                date: new Date().toISOString(), // Data atual
                wallet_name: wallet.name,
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