import sqlite3

DATABASE_NAME = 'wallet_tracker.db'

def init_db():
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()

    # Wallets table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS wallets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            address TEXT NOT NULL UNIQUE
        )
    ''')

    # Updated wallet balances table with token field and higher precision
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS wallet_balances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wallet_id INTEGER NOT NULL,
            network TEXT NOT NULL,
            token TEXT NOT NULL,
            balance DECIMAL(20,8) NOT NULL DEFAULT 0.0,
            FOREIGN KEY (wallet_id) REFERENCES wallets(id),
            UNIQUE(wallet_id, network, token)
        )
    ''')

    # Updated transactions table with token field and higher precision
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wallet_id INTEGER NOT NULL,
            network TEXT NOT NULL,
            token TEXT NOT NULL,
            type TEXT NOT NULL, -- 'entrada' ou 'saida'
            amount DECIMAL(20,8) NOT NULL,
            description TEXT,
            date TEXT NOT NULL,
            FOREIGN KEY (wallet_id) REFERENCES wallets(id)
        )
    ''')

    conn.commit()
    conn.close()

    print(f"Banco de dados '{DATABASE_NAME}' inicializado com sucesso.")

if __name__ == '__main__':
    init_db()

